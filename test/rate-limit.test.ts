/** Rate limiter behavior: burst, throttling and concurrency caps. */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  Concurrency,
  MAX_FRAME_GENERATIONS,
  MAX_OUTSTANDING_HOLDS,
  Permits,
  RateLimiter,
} from "../src/index.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("disabled limiter never blocks and returns empty permits", async () => {
  const limiter = new RateLimiter(false);
  const started = Date.now();
  for (let i = 0; i < 1000; i += 1) {
    await limiter.acquire("tier1", "route");
  }
  const permits = await limiter.acquireConcurrency(Concurrency.FRAME_GENERATION);
  assert.ok(permits instanceof Permits);
  permits.release();
  assert.ok(Date.now() - started < 100, "disabled limiter should not sleep");
});

test("writes bucket allows a 100-request burst then throttles", async () => {
  const limiter = new RateLimiter(true);
  const started = Date.now();
  for (let i = 0; i < 100; i += 1) {
    await limiter.acquire("writes", "any");
  }
  const afterBurst = Date.now() - started;
  assert.ok(afterBurst < 100, `100 writes should burst, took ${afterBurst}ms`);

  const throttled = Date.now();
  await limiter.acquire("writes", "any");
  const waited = Date.now() - throttled;
  assert.ok(waited >= 150, `101st write should wait for refill, waited ${waited}ms`);
});

test("hold concurrency is capped at the published limit", async () => {
  const limiter = new RateLimiter(true);
  const held: Permits[] = [];
  for (let i = 0; i < MAX_OUTSTANDING_HOLDS; i += 1) {
    held.push(await limiter.acquireConcurrency(Concurrency.HOLD));
  }

  let extraResolved = false;
  const pending = limiter.acquireConcurrency(Concurrency.HOLD).then((permits) => {
    extraResolved = true;
    return permits;
  });
  await sleep(20);
  assert.equal(extraResolved, false, "the 26th hold should block");

  for (const permit of held) {
    permit.release();
  }
  const extra = await pending;
  assert.equal(extraResolved, true);
  extra.release();
});

test("frame generation concurrency is capped separately", async () => {
  const limiter = new RateLimiter(true);
  const held: Permits[] = [];
  for (let i = 0; i < MAX_FRAME_GENERATIONS; i += 1) {
    held.push(await limiter.acquireConcurrency(Concurrency.FRAME_GENERATION));
  }
  let extraResolved = false;
  const pending = limiter.acquireConcurrency(Concurrency.FRAME_GENERATION).then((permits) => {
    extraResolved = true;
    return permits;
  });
  await sleep(20);
  assert.equal(extraResolved, false);
  for (const permit of held) {
    permit.release();
  }
  const extra = await pending;
  extra.release();
});

test("releasing permits twice is safe", async () => {
  const limiter = new RateLimiter(true);
  const permits = await limiter.acquireConcurrency(Concurrency.HOLD);
  permits.release();
  permits.release();
});
