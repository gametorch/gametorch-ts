/**
 * Client-side rate limiting that mirrors GameTorch's published limits.
 *
 * GameTorch rate limits every account per route and returns `429` when a limit
 * is exceeded. To be a good citizen by default, the SDK throttles requests
 * locally before they are sent:
 *
 * - **Tier 1** — 1 request/second per route: generation creates, frame
 *   generation and animation exports.
 * - **Tier 2** — 2 requests/second per route: content, usage, search and
 *   single-item reads.
 * - **Writes** — one shared token bucket (100-request burst, 5 requests/second
 *   refill) for creation, archive/unarchive and metadata writes.
 * - **Concurrency** — at most 25 in-flight hold-creating requests and 5
 *   concurrent frame generations.
 *
 * The limiter is enabled by default and can be disabled with
 * `ClientBuilder.rateLimit(false)`.
 */

/** The per-account concurrency caps published by GameTorch. */
export const MAX_OUTSTANDING_HOLDS = 25;
/** Maximum concurrent animation-frame generations per account. */
export const MAX_FRAME_GENERATIONS = 5;

/** The rate-limit bucket an operation belongs to. */
export type RateClass = "tier1" | "tier2" | "writes" | "unlimited";

/** Concurrency caps that apply to an operation. */
export interface Concurrency {
  /** Acquire one of the 25 outstanding-hold slots. */
  hold: boolean;
  /** Acquire one of the 5 frame-generation slots. */
  frameGeneration: boolean;
}

export const Concurrency = {
  NONE: { hold: false, frameGeneration: false } satisfies Concurrency,
  HOLD: { hold: true, frameGeneration: false } satisfies Concurrency,
  FRAME_GENERATION: { hold: true, frameGeneration: true } satisfies Concurrency,
} as const;

class Bucket {
  #tokens: number;
  #last: number;
  readonly #capacity: number;
  readonly #refillPerSec: number;

  constructor(capacity: number, refillPerSec: number) {
    this.#tokens = capacity;
    this.#last = Date.now();
    this.#capacity = capacity;
    this.#refillPerSec = refillPerSec;
  }

  #refill(now: number): void {
    const elapsed = Math.max(0, now - this.#last) / 1000;
    if (elapsed > 0) {
      this.#tokens = Math.min(this.#capacity, this.#tokens + elapsed * this.#refillPerSec);
      this.#last = now;
    }
  }

  /**
   * Consumes a token if one is available, otherwise returns how many
   * milliseconds to wait.
   */
  poll(now: number): number | null {
    this.#refill(now);
    if (this.#tokens >= 1) {
      this.#tokens -= 1;
      return null;
    }
    const deficit = 1 - this.#tokens;
    return Math.ceil((deficit / this.#refillPerSec) * 1000);
  }
}

/** A promise-based counting semaphore with FIFO fairness. */
class Semaphore {
  #available: number;
  readonly #waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.#available = permits;
  }

  acquire(): Promise<() => void> {
    if (this.#available > 0) {
      this.#available -= 1;
      return Promise.resolve(this.#makeRelease());
    }
    return new Promise((resolve) => {
      this.#waiters.push(() => resolve(this.#makeRelease()));
    });
  }

  #makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const next = this.#waiters.shift();
      if (next) {
        next();
      } else {
        this.#available += 1;
      }
    };
  }
}

/** Owned concurrency permits held for the lifetime of a request. */
export class Permits {
  #releaseHold: (() => void) | null;
  #releaseFrame: (() => void) | null;

  constructor(releaseHold: (() => void) | null, releaseFrame: (() => void) | null) {
    this.#releaseHold = releaseHold;
    this.#releaseFrame = releaseFrame;
  }

  /** Releases the held permits back to their semaphores. */
  release(): void {
    this.#releaseHold?.();
    this.#releaseFrame?.();
    this.#releaseHold = null;
    this.#releaseFrame = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The SDK's shared rate limiter. */
export class RateLimiter {
  readonly #enabled: boolean;
  readonly #perRoute = new Map<string, Bucket>();
  readonly #writes: Bucket;
  readonly #holds: Semaphore;
  readonly #frameGenerations: Semaphore;

  constructor(enabled: boolean) {
    this.#enabled = enabled;
    this.#writes = new Bucket(100, 5);
    this.#holds = new Semaphore(MAX_OUTSTANDING_HOLDS);
    this.#frameGenerations = new Semaphore(MAX_FRAME_GENERATIONS);
  }

  #bucketParams(rateClass: RateClass): [capacity: number, refill: number] {
    switch (rateClass) {
      case "tier1":
        return [1, 1];
      case "tier2":
        return [1, 2];
      case "writes":
        return [100, 5];
      case "unlimited":
        return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    }
  }

  /** Waits until the operation's rate bucket allows another request. */
  async acquire(rateClass: RateClass, route: string): Promise<void> {
    if (!this.#enabled || rateClass === "unlimited") {
      return;
    }
    for (;;) {
      const now = Date.now();
      let wait: number | null;
      if (rateClass === "writes") {
        wait = this.#writes.poll(now);
      } else {
        const [capacity, refill] = this.#bucketParams(rateClass);
        let bucket = this.#perRoute.get(route);
        if (bucket === undefined) {
          bucket = new Bucket(capacity, refill);
          this.#perRoute.set(route, bucket);
        }
        wait = bucket.poll(now);
      }
      if (wait === null) {
        return;
      }
      await sleep(wait);
    }
  }

  /** Acquires the concurrency permits required by an operation. */
  async acquireConcurrency(concurrency: Concurrency): Promise<Permits> {
    if (!this.#enabled) {
      return new Permits(null, null);
    }
    const releaseHold = concurrency.hold ? await this.#holds.acquire() : null;
    const releaseFrame = concurrency.frameGeneration
      ? await this.#frameGenerations.acquire()
      : null;
    return new Permits(releaseHold, releaseFrame);
  }
}
