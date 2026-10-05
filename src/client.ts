/**
 * The GameTorch {@link Client} and its builder.
 */

import {
  ApiError,
  DecodeError,
  InvalidBaseUrlError,
  RateLimitedError,
  type GametorchError,
  toTransportError,
} from "./errors.ts";
import {
  Concurrency,
  type Permits,
  RateLimiter,
  type RateClass,
} from "./rate-limit.ts";
import { Download, type OkResponse, decodeOkResponse } from "./types.ts";

/** The production GameTorch API base URL. */
export const DEFAULT_BASE_URL = "https://gametorch.app/api";

/** Environment variable read for the API key or bearer token. */
export const ENV_API_KEY = "GAMETORCH_API_KEY";

/** Environment variable read for the base URL. */
export const ENV_BASE_URL = "GAMETORCH_BASE_URL";

/** SDK version stamped into the default `User-Agent`. */
export const VERSION = "0.1.0";

type Auth =
  | { readonly type: "apiKey"; readonly token: string }
  | { readonly type: "bearer"; readonly token: string };

function authToken(auth: Auth): string {
  return auth.token;
}

function describeAuth(auth: Auth | undefined): string {
  if (auth === undefined) {
    return "none";
  }
  return auth.type === "apiKey" ? "Auth(apiKey, redacted)" : "Auth(bearer, redacted)";
}

/** HTTP methods used by the API. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Internal request description used by the API method groups. */
export interface RequestOptions {
  method: HttpMethod;
  /** Path relative to the base URL, with or without a leading slash. */
  path: string;
  /** Query parameters; `undefined` values are omitted. */
  query?: Record<string, string | undefined>;
  /** JSON body, serialized on every attempt. */
  json?: unknown;
  /** Raw body, used instead of `json` when set. */
  body?: string | Uint8Array | ArrayBuffer | null;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
}

/** A minimal fetch-compatible function, injectable for tests. */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ClientOptions {
  baseUrl?: string;
  auth?: Auth;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  rateLimit: boolean;
  userAgent: string;
  defaultHeaders: Record<string, string>;
  fetch: FetchLike;
}

function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch (cause) {
    throw new InvalidBaseUrlError(raw, { cause });
  }
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  }
  return url.toString();
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function backoffMs(attempt: number, baseMs: number): number {
  const factor = 2 ** Math.min(attempt, 6);
  const exponential = Math.min(baseMs * factor, 30_000);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const seconds = Number.parseInt(value.trim(), 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return null;
}

function retryDelayMs(response: Response, attempt: number, baseMs: number): number {
  const header = parseRetryAfter(response.headers.get("retry-after"));
  return header ?? backoffMs(attempt, baseMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseApiError(response: Response): Promise<ApiError> {
  const status = response.status;
  const requestId =
    response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;

  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let message: string | undefined;
  const trimmed = text.trim();
  if (trimmed.length > 0) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { error?: unknown }).error === "string"
      ) {
        message = (parsed as { error: string }).error;
      }
    } catch {
      // Not JSON: fall through to the raw text.
    }
    if (message === undefined) {
      message = trimmed;
    }
  }
  if (message === undefined || message.length === 0) {
    message = response.statusText || "unknown error";
  }
  return new ApiError(status, message, requestId);
}

/**
 * An async client for the GameTorch API.
 *
 * The client is cheap to share; it owns a connection pool and a rate limiter,
 * so a single client is enough for the whole application.
 */
export class Client {
  /** @internal */
  readonly baseUrl: string;
  readonly #auth: Auth | undefined;
  readonly #limiter: RateLimiter;
  readonly #maxRetries: number;
  readonly #retryBaseDelayMs: number;
  readonly #timeoutMs: number | undefined;
  readonly #userAgent: string;
  readonly #defaultHeaders: Record<string, string>;
  readonly #fetch: FetchLike;

  /** @internal */
  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.#auth = options.auth;
    this.#limiter = new RateLimiter(options.rateLimit);
    this.#maxRetries = options.maxRetries;
    this.#retryBaseDelayMs = options.retryBaseDelayMs;
    this.#timeoutMs = options.timeoutMs;
    this.#userAgent = options.userAgent;
    this.#defaultHeaders = options.defaultHeaders;
    this.#fetch = options.fetch;
  }

  /** Starts building a new client. */
  static builder(): ClientBuilder {
    return new ClientBuilder();
  }

  /** Builds a client from `GAMETORCH_API_KEY` and `GAMETORCH_BASE_URL`. */
  static fromEnv(): Client {
    return ClientBuilder.fromEnv().build();
  }

  /** The base URL this client talks to, including the `/api` suffix. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Whether the client is authenticated. */
  isAuthenticated(): boolean {
    return this.#auth !== undefined;
  }

  toString(): string {
    return `Client(baseUrl=${this.baseUrl}, auth=${describeAuth(this.#auth)}, maxRetries=${this.#maxRetries})`;
  }

  #buildRequest(options: RequestOptions): { url: string; init: RequestInit } {
    const url = new URL(options.path.replace(/^\/+/, ""), this.baseUrl);
    if (options.query !== undefined) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers = new Headers(this.#defaultHeaders);
    headers.set("accept", "application/json");
    headers.set("user-agent", this.#userAgent);
    if (this.#auth !== undefined) {
      headers.set("authorization", `Bearer ${authToken(this.#auth)}`);
    }
    if (options.headers !== undefined) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    let body: string | Uint8Array | ArrayBuffer | null = options.body ?? null;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }

    const signal = this.#timeoutMs === undefined ? undefined : AbortSignal.timeout(this.#timeoutMs);
    const init: RequestInit = { method: options.method, headers, body };
    if (signal !== undefined) {
      init.signal = signal;
    }
    return { url: url.toString(), init };
  }

  /**
   * Sends a request with local rate limiting, concurrency caps and retries,
   * returning the raw response on success.
   */
  async send(
    rateClass: RateClass,
    route: string,
    concurrency: Concurrency,
    options: RequestOptions,
  ): Promise<Response> {
    let attempt = 0;
    for (;;) {
      await this.#limiter.acquire(rateClass, route);
      const permits: Permits = await this.#limiter.acquireConcurrency(concurrency);

      let response: Response;
      try {
        const { url, init } = this.#buildRequest(options);
        response = await this.#fetch(url, init);
      } catch (cause) {
        if (attempt < this.#maxRetries) {
          const delay = backoffMs(attempt, this.#retryBaseDelayMs);
          attempt += 1;
          permits.release();
          await sleep(delay);
          continue;
        }
        permits.release();
        throw toTransportError(cause);
      }

      if (response.ok) {
        return response;
      }

      const status = response.status;
      if (isRetryableStatus(status) && attempt < this.#maxRetries) {
        const delay = retryDelayMs(response, attempt, this.#retryBaseDelayMs);
        attempt += 1;
        permits.release();
        await cancelBody(response);
        await sleep(delay);
        continue;
      }

      permits.release();
      if (status === 429) {
        await cancelBody(response);
        throw new RateLimitedError(attempt + 1, 429);
      }
      throw await parseApiError(response);
    }
  }

  /** Sends a request and decodes a JSON response body with `decode`. */
  async sendJson<T>(
    rateClass: RateClass,
    route: string,
    concurrency: Concurrency,
    options: RequestOptions,
    decode: (raw: unknown) => T,
  ): Promise<T> {
    const response = await this.send(rateClass, route, concurrency, options);
    const raw = await readJson(response);
    try {
      return decode(raw);
    } catch (cause) {
      if (cause instanceof DecodeError) {
        throw cause;
      }
      throw new DecodeError(cause instanceof Error ? cause.message : String(cause), { cause });
    }
  }

  /** Sends a request and returns the raw bytes plus content type. */
  async sendDownload(
    rateClass: RateClass,
    route: string,
    concurrency: Concurrency,
    options: RequestOptions,
  ): Promise<Download> {
    const response = await this.send(rateClass, route, concurrency, options);
    const content_type = response.headers.get("content-type") ?? undefined;
    const buffer = await readBytes(response);
    return new Download(content_type, buffer);
  }

  /** Sends a request and discards the body, returning `void`. */
  async sendOk(
    rateClass: RateClass,
    route: string,
    concurrency: Concurrency,
    options: RequestOptions,
  ): Promise<void> {
    const response = await this.send(rateClass, route, concurrency, options);
    await readBytes(response);
  }

  /** Sends a request and decodes the `{"ok": true}` acknowledgement. */
  async sendAck(
    rateClass: RateClass,
    route: string,
    concurrency: Concurrency,
    options: RequestOptions,
  ): Promise<OkResponse> {
    return this.sendJson(rateClass, route, concurrency, options, decodeOkResponse);
  }
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore cancellation failures.
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    throw new DecodeError("empty response body");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new DecodeError("body is not valid JSON", { cause });
  }
}

async function readBytes(response: Response): Promise<Uint8Array> {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Configures and builds a {@link Client}.
 *
 * ```ts
 * const client = Client.builder()
 *   .apiKey("gt2_...")
 *   .timeout(60_000)
 *   .build();
 * ```
 */
export class ClientBuilder {
  #baseUrl: string | undefined;
  #auth: Auth | undefined;
  #timeoutMs: number | undefined = 120_000;
  #connectTimeoutMs: number | undefined = 15_000;
  #maxRetries = 3;
  #retryBaseDelayMs = 500;
  #rateLimit = true;
  #userAgent = `gametorch-ts/${VERSION}`;
  #defaultHeaders: Record<string, string> = {};
  #fetch: FetchLike = globalThis.fetch.bind(globalThis);

  /** Sets a `gt2_...` API key used for server-to-server authentication. */
  apiKey(apiKey: string): this {
    this.#auth = { type: "apiKey", token: apiKey };
    return this;
  }

  /** Sets a Clerk session/bearer token. */
  bearerToken(token: string): this {
    this.#auth = { type: "bearer", token };
    return this;
  }

  /**
   * Overrides the base URL. Defaults to {@link DEFAULT_BASE_URL}. For local
   * development use `http://localhost:8300/api`.
   */
  baseUrl(baseUrl: string): this {
    this.#baseUrl = baseUrl;
    return this;
  }

  /** Sets the total request timeout in milliseconds (default 120000). */
  timeout(timeoutMs: number): this {
    this.#timeoutMs = timeoutMs;
    return this;
  }

  /** Disables the total request timeout. */
  noTimeout(): this {
    this.#timeoutMs = undefined;
    return this;
  }

  /**
   * Sets the connection timeout in milliseconds (default 15000). Accepted for
   * parity with the Rust SDK; the built-in `fetch` enforces the total timeout
   * rather than a separate connect timeout.
   */
  connectTimeout(connectTimeoutMs: number): this {
    this.#connectTimeoutMs = connectTimeoutMs;
    return this;
  }

  /** Maximum automatic retries for retryable failures (default 3). */
  maxRetries(maxRetries: number): this {
    this.#maxRetries = maxRetries;
    return this;
  }

  /** Base delay in milliseconds for exponential backoff (default 500). */
  retryBaseDelay(retryBaseDelayMs: number): this {
    this.#retryBaseDelayMs = retryBaseDelayMs;
    return this;
  }

  /** Enables or disables the built-in rate limiting (enabled by default). */
  rateLimit(enabled: boolean): this {
    this.#rateLimit = enabled;
    return this;
  }

  /** Overrides the `User-Agent` header. */
  userAgent(userAgent: string): this {
    this.#userAgent = userAgent;
    return this;
  }

  /** Adds a default header sent with every request. */
  defaultHeader(name: string, value: string): this {
    this.#defaultHeaders[name] = value;
    return this;
  }

  /** Overrides the fetch implementation (mainly for tests). */
  fetch(fetchImpl: FetchLike): this {
    this.#fetch = fetchImpl;
    return this;
  }

  /** Populates builder fields from `GAMETORCH_API_KEY` / `GAMETORCH_BASE_URL`. */
  static fromEnv(): ClientBuilder {
    const builder = new ClientBuilder();
    const apiKey = process.env[ENV_API_KEY];
    if (apiKey !== undefined && apiKey.length > 0) {
      builder.apiKey(apiKey);
    }
    const baseUrl = process.env[ENV_BASE_URL];
    if (baseUrl !== undefined && baseUrl.length > 0) {
      builder.baseUrl(baseUrl);
    }
    return builder;
  }

  /** Builds the client. */
  build(): Client {
    return new Client({
      baseUrl: this.#baseUrl ?? DEFAULT_BASE_URL,
      auth: this.#auth,
      timeoutMs: this.#timeoutMs,
      connectTimeoutMs: this.#connectTimeoutMs,
      maxRetries: this.#maxRetries,
      retryBaseDelayMs: this.#retryBaseDelayMs,
      rateLimit: this.#rateLimit,
      userAgent: this.#userAgent,
      defaultHeaders: this.#defaultHeaders,
      fetch: this.#fetch,
    });
  }
}

/** Re-exported for the API method groups. */
export type { GametorchError };

/**
 * The API method groups (`src/api/*.ts`) augment this interface with one method
 * per endpoint and install the implementations on {@link Client.prototype}.
 *
 * The class/interface merge is intentional: the class provides the runtime
 * value, while the interface is the augmentation point for the API modules.
 */
export interface Client {}
