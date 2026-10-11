/** Transport behavior: auth, retries, errors and request shaping. */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ApiError,
  Client,
  ConfigError,
  DecodeError,
  ListParams,
  RateLimitedError,
  SpriteMode,
  type FetchLike,
} from "../src/index.ts";

interface Call {
  url: string;
  init: RequestInit;
}

function mockFetch(
  handlers: Array<() => Response | Promise<Response>>,
): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const fetch: FetchLike = (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const handler = handlers[Math.min(index, handlers.length - 1)];
    index += 1;
    if (!handler) {
      throw new Error("no more mocked responses");
    }
    return Promise.resolve(handler());
  };
  return { fetch, calls };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function client(fetch: FetchLike, baseUrl = "http://localhost:8300/api"): Client {
  return Client.builder()
    .apiKey("gt2_test")
    .baseUrl(baseUrl)
    .rateLimit(false)
    .maxRetries(2)
    .retryBaseDelay(1)
    .fetch(fetch)
    .build();
}

test("sends bearer auth, accept and user-agent headers", async () => {
  const { fetch, calls } = mockFetch([() => new Response("ok")]);
  const c = client(fetch);
  assert.equal(await c.health(), "ok");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("authorization"), "Bearer gt2_test");
  assert.equal(headers.get("accept"), "application/json");
  assert.match(headers.get("user-agent") ?? "", /^gametorch-ts\//);
});

test("normalizes the base URL and joins paths", async () => {
  const { fetch, calls } = mockFetch([() => json({ projects: [] })]);
  const c = client(fetch, "http://localhost:8300/api");
  assert.equal(c.getBaseUrl(), "http://localhost:8300/api/");
  await c.listProjects();
  assert.equal(calls[0]?.url, "http://localhost:8300/api/projects");
  assert.equal(calls[0]?.init.method, "GET");
});

test("serializes a JSON body", async () => {
  const { fetch, calls } = mockFetch([
    () =>
      json({
        id: "11111111-1111-1111-1111-111111111111",
        name: "n",
        slug: "s",
        created_at: "t",
      }),
  ]);
  const c = client(fetch);
  await c.createProject("My Game");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(calls[0]?.init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { name: "My Game" });
});

test("builds query parameters for list calls", async () => {
  const { fetch, calls } = mockFetch([
    () => json({ animations: [], next_cursor: null, total: 0 }),
  ]);
  const c = client(fetch);
  const params = new ListParams({ include_archived: true, base_asset_id: "asset-1" });
  await c.listAnimationRuns("proj-1", params);
  const url = new URL(String(calls[0]?.url));
  assert.equal(url.searchParams.get("include_archived"), "true");
  assert.equal(url.searchParams.get("base_asset_id"), "asset-1");
});

test("retries retryable statuses then succeeds", async () => {
  const { fetch, calls } = mockFetch([
    () => new Response("boom", { status: 500 }),
    () => json({ projects: [] }),
  ]);
  const c = client(fetch);
  const result = await c.listProjects();
  assert.deepEqual(result.projects, []);
  assert.equal(calls.length, 2);
});

test("retries transport errors then succeeds", async () => {
  let attempt = 0;
  const fetch: FetchLike = () => {
    attempt += 1;
    if (attempt === 1) {
      return Promise.reject(new Error("ECONNRESET"));
    }
    return Promise.resolve(json({ projects: [] }));
  };
  const c = client(fetch);
  const result = await c.listProjects();
  assert.deepEqual(result.projects, []);
  assert.equal(attempt, 2);
});

test("exhausted 429 becomes RateLimitedError with the attempt count", async () => {
  const { fetch, calls } = mockFetch([
    () => new Response("slow down", { status: 429 }),
    () => new Response("slow down", { status: 429 }),
    () => new Response("slow down", { status: 429 }),
  ]);
  const c = client(fetch);
  await assert.rejects(
    () => c.listProjects(),
    (err: unknown) => {
      assert.ok(err instanceof RateLimitedError);
      assert.equal(err.attempts, 3);
      return true;
    },
  );
  assert.equal(calls.length, 3);
});

test("honors Retry-After on retryable responses", async () => {
  const { fetch } = mockFetch([
    () => new Response("wait", { status: 503, headers: { "retry-after": "0" } }),
    () => json({ projects: [] }),
  ]);
  const c = client(fetch);
  const result = await c.listProjects();
  assert.deepEqual(result.projects, []);
});

test("non-retryable API errors surface the server message", async () => {
  const { fetch, calls } = mockFetch([() => json({ error: "bad request" }, 400)]);
  const c = client(fetch);
  await assert.rejects(
    () => c.listProjects(),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 400);
      assert.equal(err.apiMessage, "bad request");
      return true;
    },
  );
  assert.equal(calls.length, 1);
});

test("plain-text error bodies fall back to the raw text", async () => {
  const { fetch } = mockFetch([() => new Response("nope", { status: 403 })]);
  const c = client(fetch);
  await assert.rejects(
    () => c.listProjects(),
    (err: unknown) => err instanceof ApiError && err.apiMessage === "nope",
  );
});

test("invalid JSON responses raise DecodeError", async () => {
  const { fetch } = mockFetch([() => new Response("<html>")]);
  const c = client(fetch);
  await assert.rejects(() => c.listProjects(), DecodeError);
});

test("downloads expose bytes and content type", async () => {
  const { fetch } = mockFetch([
    () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } }),
  ]);
  const c = client(fetch);
  const download = await c.assetContent("asset-1");
  assert.equal(download.contentType(), "image/png");
  assert.deepEqual([...download.bytes()], [1, 2, 3]);
});

test("generation builders validate required fields", async () => {
  const { fetch } = mockFetch([() => json({})]);
  const c = client(fetch);
  await assert.rejects(() => c.generateSprite("p").send(), ConfigError);
  await assert.rejects(
    () => c.generateSprite("p").prompt("x").send(),
    ConfigError,
  );
  await assert.rejects(() => c.generateSound("p").send(), ConfigError);
  await assert.rejects(() => c.generateAnimation("p").send(), ConfigError);
});

test("generation builder sends request_id and mode", async () => {
  const { fetch, calls } = mockFetch([
    () => json({ id: "11111111-1111-1111-1111-111111111111", status: "queued", created: true, reserved_credits: "5" }),
  ]);
  const c = client(fetch);
  await c
    .generateSprite("proj-1")
    .prompt("a fox")
    .mode(SpriteMode.Multiple)
    .imageModel("m")
    .textModel("none")
    .send();
  const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
  assert.equal(body["mode"], "multiple");
  assert.equal(body["text_model"], "none");
  assert.equal(body["image_model"], "m");
  assert.match(String(body["request_id"]), /^[0-9a-f-]{36}$/);
});

test("metadata PUT merges (upserts) and returns the full map", async () => {
  const { fetch, calls } = mockFetch([
    () => json({ ok: true, metadata: { filepath: "a.png", variant: "idle" } }),
  ]);
  const c = client(fetch);
  const response = await c.putAssetMetadata("asset-1", { variant: "idle" });

  assert.equal(calls[0]?.init.method, "PUT");
  assert.equal(
    new URL(String(calls[0]?.url)).pathname,
    "/api/assets/asset-1/metadata",
  );
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    metadata: { variant: "idle" },
  });
  assert.deepEqual(response.metadata, { filepath: "a.png", variant: "idle" });
});

test("metadata PUT serializes remove keys and the remove_keys alias", async () => {
  const { fetch, calls } = mockFetch([() => json({ ok: true, metadata: {} })]);
  const c = client(fetch);

  await c.putAssetMetadata("a", undefined, ["x", "y"]);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { remove: ["x", "y"] });

  await c.putSoundAssetMetadata("s", { k: "v" }, { remove: ["x"] });
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
    metadata: { k: "v" },
    remove: ["x"],
  });

  await c.putSavedAnimationMetadata("sa", { k: "v" }, { remove_keys: ["x"] });
  assert.deepEqual(JSON.parse(String(calls[2]?.init.body)), {
    metadata: { k: "v" },
    remove: ["x"],
  });

  await c.putAssetMetadata("a", { k: "v" }, { remove: ["x"], remove_keys: ["y"] });
  assert.deepEqual(JSON.parse(String(calls[3]?.init.body)), {
    metadata: { k: "v" },
    remove: ["x", "y"],
  });
});
