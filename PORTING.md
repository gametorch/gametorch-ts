# Porting the GameTorch Rust SDK to TypeScript

This file tracks the work of porting `gametorch-rs` to a TypeScript SDK that
covers 100% of the Rust SDK's public API surface, with matching behavior for
rate limiting, retries, pagination, idempotency, error handling and money.

The Rust SDK is treated as the reference implementation.

## Goals

- Full parity with every `Client` method, builder, model, enum and type.
- Polite client-side rate limiting mirroring the Rust implementation:
  - Tier 1 (generation creates, frame generation, animation exports): 1 req/s
    per route.
  - Tier 2 (content, usage, search, single-item reads): 2 req/s per route.
  - Writes: one shared token bucket, 100 burst / 5 req/s refill.
  - Concurrency: 25 in-flight holds, 5 concurrent frame generations.
  - Retries for `408`, `429`, `5xx` and transport errors, exponential backoff
    with 250ms jitter, honoring `Retry-After`.
- Cursor pagination with async `Paginator` helpers.
- Accurate money handling (100 credits = $1) without floating point drift.
- Offline unit/fixture tests plus opt-in live tests against a local deployment
  (`http://localhost:8300/api`).

The Rust repo also ships a `gametorch` CLI; this port intentionally covers the
SDK library only, since the CLI exposes no API functionality beyond the SDK.

## Supply-chain posture

- **Zero runtime dependencies** in the library: uses the global `fetch` and
  `node:crypto` only.
- Dev dependencies are pinned exactly; `pnpm` is configured to skip lifecycle
  scripts (`ignore-scripts`).
- `pnpm audit` is expected to be clean.
- Tests use the built-in `node:test` runner (no test framework dependency).

## Deliberate representation choices

| Rust | TypeScript | Rationale |
| --- | --- | --- |
| `serde` structs | interfaces + `decode*` parsers | runtime validation matching serde's lenient helpers |
| `chrono::DateTime<Utc>` | ISO-8601 `string` | the wire format is already ISO-8601 |
| `uuid::Uuid` | `string` | no uuid dependency; `crypto.randomUUID()` for new ids |
| `rust_decimal::Decimal` | `string` (normalized) | preserves arbitrary precision; avoids float drift |
| `bytes::Bytes` | `Uint8Array` | native binary type |
| `reqwest` | global `fetch` | built into Node 20+ |
| `tokio` semaphores | promise-based semaphore | local concurrency caps |

`creditsToUsd` performs exact decimal-string division by 100 rather than using
floating point.

## Layout

```
src/            library (zero runtime deps)
  client.ts     Client + ClientBuilder + transport/retries
  rate-limit.ts local limiter
  paginator.ts  async cursor pagination
  errors.ts     Error hierarchy + predicates
  types.ts      shared types, enums, ListParams
  decode.ts     lenient wire decoders
  models/       resource models
  api/          Client method groups
test/           node:test suites (offline + live)
examples/       runnable examples
```

## Checklist

- [x] Study the Rust sources
- [x] Scaffold the project
- [x] Core (errors, types, decode, rate limit, paginator, client)
- [x] Models
- [x] API methods
- [x] Offline tests
- [x] Live tests against localhost:8300
- [x] Examples + README
- [x] Lint / typecheck / tests green, commit

## Notes on live verification

Verified against `http://localhost:8300/api` with a live key:

- Offline: 43 tests pass.
- Read-only live: catalogs, projects, usage, generations/assets/content, sounds,
  animations/frames, **all eight export formats**, saved animations, labels, art
  styles, keys, animation estimate and `401` rejection.
- Writes live: project, label, art-style and saved-animation lifecycles, plus
  `ensureUser` and key lifecycle (skipped when the key lacks admin rights).
- Spend live: sprite generation full flow and sound generation full flow pass.
  The animation-generation test is gated behind `GAMETORCH_LIVE_SPEND=1`; on the
  local deployment the animation worker was too slow to finish a 4s `ash` run
  within the 9-minute polling window, so that test times out on the environment
  (the same limit as the Rust suite). Export and saved-animation behavior is
  covered separately by the read-only and write suites using existing runs.

