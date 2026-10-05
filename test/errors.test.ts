/** Error hierarchy and predicate behavior. */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ApiError,
  ConfigError,
  DecodeError,
  HttpError,
  InvalidBaseUrlError,
  RateLimitedError,
  toTransportError,
} from "../src/index.ts";

test("ApiError exposes status, message and request id", () => {
  const err = new ApiError(404, "no such asset", "req_123");
  assert.equal(err.kind, "api");
  assert.equal(err.status, 404);
  assert.equal(err.apiMessage, "no such asset");
  assert.equal(err.requestId, "req_123");
  assert.equal(err.isNotFound(), true);
  assert.equal(err.isForbidden(), false);
  assert.ok(err instanceof Error);
});

test("status predicates map to the right codes", () => {
  assert.equal(new ApiError(401, "x").isUnauthorized(), true);
  assert.equal(new ApiError(402, "x").isPaymentRequired(), true);
  assert.equal(new ApiError(403, "x").isForbidden(), true);
  assert.equal(new ApiError(409, "x").isConflict(), true);
  assert.equal(new ApiError(429, "x").isRateLimited(), true);
});

test("RateLimitedError reports attempts", () => {
  const err = new RateLimitedError(3, 429);
  assert.equal(err.kind, "rate_limited");
  assert.equal(err.attempts, 3);
  assert.equal(err.status, 429);
  assert.equal(err.isRateLimited(), true);
});

test("ConfigError, DecodeError, InvalidBaseUrlError carry kinds", () => {
  assert.equal(new ConfigError("nope").kind, "config");
  assert.equal(new DecodeError("bad").kind, "decode");
  assert.equal(new InvalidBaseUrlError("::").kind, "invalid_base_url");
});

test("toTransportError wraps unknown causes", () => {
  const wrapped = toTransportError(new Error("connection reset"));
  assert.equal(wrapped.kind, "http");
  assert.equal(wrapped instanceof HttpError, true);
  assert.match(wrapped.message, /connection reset/);
});

test("toTransportError passes through SDK errors", () => {
  const original = new ApiError(500, "oops");
  assert.equal(toTransportError(original), original);
});
