/**
 * Error hierarchy for the GameTorch SDK.
 *
 * Every fallible operation rejects with a {@link GametorchError}. The concrete
 * subclasses mirror the variants of the Rust SDK's `Error` enum and expose the
 * HTTP status and the API's `error` message where applicable.
 */

/** A short, stable label for the error kind, useful in logs. */
export type ErrorKind =
  | "http"
  | "api"
  | "rate_limited"
  | "config"
  | "invalid_base_url"
  | "decode";

/** Base class for every error thrown by the SDK. */
export class GametorchError extends Error {
  /** A short, stable label for the error kind. */
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.kind = kind;
  }

  /** The HTTP status code, when this error originated from an API response. */
  get status(): number | undefined {
    return undefined;
  }

  /** The API's error message, when this error originated from an API response. */
  get apiMessage(): string | undefined {
    return undefined;
  }

  /** The API correlation id echoed on the response, when present. */
  get requestId(): string | undefined {
    return undefined;
  }

  /** Returns `true` for `404 Not Found` responses. */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /** Returns `true` for `401 Unauthorized` responses. */
  isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Returns `true` for `402 Payment Required` responses, which GameTorch uses
   * for insufficient credits or a spending/entitlement limit.
   */
  isPaymentRequired(): boolean {
    return this.status === 402;
  }

  /** Returns `true` for `403 Forbidden` responses. */
  isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Returns `true` for `409 Conflict` responses, typically an idempotency
   * `request_id` reused with a different body.
   */
  isConflict(): boolean {
    return this.status === 409;
  }

  /** Returns `true` for `429 Too Many Requests` responses. */
  isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** The HTTP transport failed (DNS, connection, timeout, body decoding). */
export class HttpError extends GametorchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("http", message, options);
  }
}

/** The API returned a non-success status with a JSON `{"error": ...}` body. */
export class ApiError extends GametorchError {
  readonly #status: number;
  readonly #message: string;
  readonly #requestId: string | undefined;

  constructor(status: number, message: string, requestId?: string) {
    super("api", `GameTorch API error (${status}): ${message}`);
    this.#status = status;
    this.#message = message;
    this.#requestId = requestId;
  }

  override get status(): number {
    return this.#status;
  }

  override get apiMessage(): string {
    return this.#message;
  }

  override get requestId(): string | undefined {
    return this.#requestId;
  }
}

/**
 * The API kept returning a retryable failure (for example `429`) after the
 * configured number of retries.
 */
export class RateLimitedError extends GametorchError {
  /** Number of attempts that were made. */
  readonly attempts: number;
  readonly #status: number | undefined;

  constructor(attempts: number, status?: number) {
    super("rate_limited", `rate limited by GameTorch after ${attempts} attempt(s)`);
    this.attempts = attempts;
    this.#status = status;
  }

  override get status(): number | undefined {
    return this.#status;
  }
}

/** The client was misconfigured, for example no credentials were supplied. */
export class ConfigError extends GametorchError {
  constructor(message: string) {
    super("config", `invalid client configuration: ${message}`);
  }
}

/** The supplied base URL could not be parsed. */
export class InvalidBaseUrlError extends GametorchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("invalid_base_url", `invalid base URL: ${message}`, options);
  }
}

/** A response could not be decoded, or the body was not valid JSON. */
export class DecodeError extends GametorchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("decode", `failed to decode response: ${message}`, options);
  }
}

/** Narrows an unknown value thrown from a `fetch` call into an SDK error. */
export function toTransportError(cause: unknown): GametorchError {
  if (cause instanceof GametorchError) {
    return cause;
  }
  let detail = "unknown transport error";
  if (cause instanceof Error && cause.message) {
    detail = cause.message;
  } else if (typeof cause === "string" && cause.length > 0) {
    detail = cause;
  }
  return new HttpError(`HTTP transport error: ${detail}`, { cause });
}
