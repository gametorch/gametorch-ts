# GameTorch TypeScript SDK

The official SDK for the [GameTorch](https://gametorch.app) API. GameTorch
generates game-ready **sprites**, **sound effects** and **animations** from text
prompts and organizes them into projects.

- [API reference](https://gametorch.app/api/docs)
- [Agent / LLM guide](https://gametorch.app/llms.txt)
- [Privacy policy](https://gametorch.app/privacy)
- [Terms and conditions](https://gametorch.app/terms)

## Features

- Full coverage of the public GameTorch API, with typed request and response
  models.
- Async-first, built on the global `fetch` — **zero runtime dependencies**.
- Works in Node.js 20.19+ (and any runtime with `fetch`, `AbortSignal.timeout`
  and `crypto.randomUUID`).
- Polite by default: client-side rate limiting that mirrors GameTorch's
  published limits, concurrency caps, and automatic retries with exponential
  backoff that honors `Retry-After`.
- Cursor pagination with an async-iterable `Paginator`.
- Accurate money handling (100 credits = $1) without floating-point drift.
- Sensible errors with status-code helpers.
- MIT licensed.

## Installation

```sh
npm install gametorch
# or
pnpm add gametorch
# or
yarn add gametorch
```

## Quickstart

```ts
import { Client, SpriteMode } from "gametorch";

// Reads GAMETORCH_API_KEY; or call .apiKey("gt2_...") explicitly.
const client = Client.fromEnv();

const models = await client.spriteModels();
const project = await client.createProject("My Game");

const job = await client
  .generateSprite(project.id)
  .prompt("a red fox, side view")
  .mode(SpriteMode.Single)
  .imageModel(models.image_models[0]!.id)
  .send();

console.log(`generation ${job.id} is ${job.status}`);
```

## Authentication

Every request uses `Authorization: Bearer <token>`, where the token is either a
server-to-server API key (`gt2_...`) or a Clerk session token:

```ts
import { Client } from "gametorch";

// API key (server-to-server)
const client = Client.builder().apiKey("gt2_...").build();

// Clerk session token (browser / trusted backend)
const client2 = Client.builder().bearerToken("eyJ...").build();
```

Create an API key from the GameTorch dashboard or with
[`client.createKey`](https://gametorch.app/api/docs). Keys are shown only once
and can carry a spend limit.

### Key scopes

Every API key has a `key_scope` fixed at creation:

- `admin` — full access to the owning account/organization, exactly like an
  admin session. Carries no project.
- `project_write` — bound to one project: read and write its sprites, sounds,
  animations, labels, names and metadata. No account/admin access, no other
  projects.
- `project_read` — bound to one project: read-only.

Project-scoped keys get `403` on account/admin routes and `404` when they name
another project. Build scoped keys with the request constructors:

```ts
import { Client, CreateApiKeyRequest, SpendResetCadence } from "gametorch";

const read = await client.createKey(
  CreateApiKeyRequest.projectRead(projectId)
    .withName("CI read key")
    .maxSpendLimit("0")
    .spendResetCadence(SpendResetCadence.Monthly)
    .expiresAt(new Date(Date.now() + 30 * 86_400_000).toISOString()),
);
console.log(`scope: ${read.key.key_scope}, project: ${read.key.project_id}`);
```

See `ApiKeyScope`, `CreateApiKeyRequest` and the `create_admin_key` /
`create_project_keys` examples.

## Base URL

The SDK defaults to `https://gametorch.app/api`. For local development, point it
at your local deployment:

```ts
const client = Client.builder()
  .apiKey("gt2_local_dev_key")
  .baseUrl("http://localhost:8300/api")
  .build();
```

You can also set `GAMETORCH_BASE_URL`.

## Rate limits

GameTorch rate limits every account per route and returns `429` when a limit is
exceeded. The SDK is respectful by default:

- Throttles **Tier 1** routes (generation creates, frame generation, animation
  exports) to 1 request/second per route.
- Throttles **Tier 2** routes (content, usage, search, single-item reads) to
  2 requests/second per route.
- Shares a **token bucket** (100-request burst, 5 requests/second refill) across
  unbounded writes.
- Caps in-flight hold-creating requests at 25 and concurrent frame generations
  at 5.
- Retries `429`, `408` and `5xx` responses with exponential backoff and jitter,
  honoring `Retry-After`.

Tune or disable this behavior on the builder:

```ts
const client = Client.builder()
  .apiKey("gt2_...")
  .maxRetries(5)
  .retryBaseDelay(250) // ms
  .rateLimit(false) // only if you manage limits yourself
  .build();
```

## Pagination

List endpoints accept `ListParams` and return a page with a `next_cursor`. The
`stream*` helpers fetch pages on demand and are async-iterable:

```ts
import { ListParams } from "gametorch";

const generations = client.streamGenerations(projectId, false);
for await (const generation of generations) {
  console.log(generation.id);
}
console.log(`total: ${generations.total}`);

// Or page by page.
const page = await client.listGenerations(
  projectId,
  ListParams.new().includeArchived(true),
);
console.log(page.generations, page.next_cursor, page.total);
```

## Animating an existing sprite (`base_asset_id`)

`base_asset_id` is a **sprite asset UUID** — the `id` of an `Asset` returned by
`listSpriteAssets` (or `GET /projects/{id}/sprite-assets`), not a generation id.
To animate an existing sprite, pass that id to `baseAssetId(...)`; omit it to
generate an animation from scratch. The estimate endpoint accepts it too:

```ts
import { Client, SpriteMode } from "gametorch";

const client = Client.fromEnv();

// Generate a sprite...
const models = await client.spriteModels();
const job = await client
  .generateSprite(projectId)
  .prompt("a friendly red fox, side view, game sprite")
  .mode(SpriteMode.Single)
  .imageModel(models.image_models[0]!.id)
  .send();

// ...then read the sprite asset id back from the project's sprite assets.
const { assets } = await client.listSpriteAssets(projectId);
const spriteId = assets[0]!.id;

// Price it first, then animate that exact sprite.
await client
  .estimateAnimation(projectId)
  .animationModel("ash")
  .duration(4)
  .baseAssetId(spriteId)
  .send();

const run = await client
  .generateAnimation(projectId)
  .prompt("the fox turns its head and flicks its tail")
  .animationModel("ash")
  .duration(4)
  .baseAssetId(spriteId) // omit to generate from scratch
  .send();

console.log(run.id);
```

The finished run echoes the link in `base_asset_id`, which also lets you filter
animation queries by the sprite they came from:

```ts
import { ListParams } from "gametorch";

const runs = await client.listAnimationRuns(
  projectId,
  ListParams.new().baseAssetId(spriteId),
);
for (const animation of runs.animations) {
  console.log(animation.id, animation.base_asset_id);
}

// The stream helper honors the same filters.
for await (const animation of client.streamAnimationRuns(
  projectId,
  ListParams.new().baseAssetId(spriteId),
)) {
  console.log(animation.id);
}
```

See [`examples/animate-sprite.ts`](examples/animate-sprite.ts) for the full
generate-sprite-then-animate-it flow.

## Money

Credit and USD amounts are returned as decimal strings and parsed as exact
decimals (never floating point). `creditsToUsd` converts credits to dollars
exactly (100 credits = $1):

```ts
import { creditsToUsd } from "gametorch";

job.reserved_credits; // "300.000000000000"
creditsToUsd(job.reserved_credits); // "3"
```

Dates are ISO-8601 strings and ids are UUID strings.

## Provenance

Generation and asset responses expose who or what created them. The fields live
on `provenance` (`user_id`, `source`, `api_key_id`, `key_name`):

```ts
const generation = await client.getGeneration(generationId, false);
console.log(`created by ${generation.provenance.user_id} via ${generation.provenance.source}`);
```

## Metadata

`putAssetMetadata`, `putSoundAssetMetadata` and `putSavedAnimationMetadata` all
share the same semantics. The request body is
`{ metadata?, remove?, remove_keys? }` (OpenAPI `PutMetadataRequest` /
`PutSoundMetadataRequest` / `PutSavedAnimationMetadataRequest`):

- **Metadata merges (upserts).** The keys you send are added or overwritten;
  keys you omit are kept. A call never clears metadata.
- **`remove` deletes keys** and is the only way to remove them. `remove_keys`
  is an accepted alias and is merged with `remove`.
- The response's `metadata` is the **full merged map** after the change.

```ts
import { Client } from "gametorch";

const client = Client.fromEnv();

// Merge: `filepath` is added and `variant` is set.
await client.putAssetMetadata(assetId, { filepath: "output/fox.png", variant: "idle" });

// Merge again: `variant` is overwritten, `filepath` is kept.
const merged = await client.putSoundAssetMetadata(soundId, { variant: "run" });
console.log(merged.metadata); // { filepath: "...", variant: "run" }

// Remove: pass a key list, or `{ remove }` / `{ remove_keys }`.
const removed = await client.putSavedAnimationMetadata(savedId, undefined, ["variant"]);
console.log(removed.metadata);
```

Constraints (unchanged): keys are 1–1024 chars, values are 0–1024 char strings,
and at most 10 pairs per call; `remove` also takes at most 10 keys. Invalid
input returns `400` (bad keys/limits) or `422` (non-string value / bad body).

## Error handling

Every fallible operation rejects with a `GametorchError`. `ApiError` exposes the
HTTP status, the API's `error` message and convenience predicates:

```ts
import { ApiError } from "gametorch";

try {
  await client.getAsset(assetId);
} catch (err) {
  if (err instanceof ApiError && err.isNotFound()) {
    console.log("no such asset");
  } else if (err instanceof ApiError && err.isRateLimited()) {
    console.log("slow down");
  } else {
    throw err;
  }
}
```

`GametorchError` subclasses: `HttpError`, `ApiError`, `RateLimitedError`,
`ConfigError`, `InvalidBaseUrlError`, `DecodeError`. Predicates:
`isNotFound`, `isUnauthorized`, `isPaymentRequired`, `isForbidden`,
`isConflict`, `isRateLimited`.

## API coverage

| Area | Methods |
| --- | --- |
| Catalog | `spriteModels`, `soundModels`, `animationModels` |
| Projects | `listProjects`, `createProject`, `renameProject`, `deleteProject` |
| Sprites | `generateSprite`, `listGenerations`, `getGeneration`, `listSpriteAssets`, `getAsset`, `assetContent`, `assetOriginal`, `renameAsset`, `putAssetMetadata`, `archiveAsset`, `unarchiveAsset`, `deleteAsset`, `archiveGeneration`, `unarchiveGeneration`, `deleteGeneration` |
| Sounds | `generateSound`, `listSoundGenerations`, `getSoundGeneration`, `soundAssetContent`, `renameSoundAsset`, `putSoundAssetMetadata`, `archiveSoundAsset`, `unarchiveSoundAsset`, `deleteSoundAsset`, `archiveSoundGeneration`, `unarchiveSoundGeneration` |
| Animations | `estimateAnimation`, `generateAnimation`, `listAnimationRuns`, `getAnimationRun`, `animationContent`, `archiveAnimationRun`, `unarchiveAnimationRun`, `deleteAnimationRun`, `generateFrames`, `frameContent`, `frameContentByNumber` |
| Exports | `exportPlan`, `export`, `exportTexturepacker`, `exportTexturepackerZip`, `exportAseprite`, `exportGodot`, `exportGodotZip`, `exportGrid`, `exportGamemaker`, `exportSequenceZip` |
| Saved animations | `listSavedAnimations`, `saveAnimation`, `getSavedAnimation`, `renameSavedAnimation`, `putSavedAnimationMetadata`, `archiveSavedAnimation`, `unarchiveSavedAnimation`, `deleteSavedAnimation` |
| Labels | `listLabels`, `createLabel`, `updateLabel`, `deleteLabel`, `labelItems`, `setLabelThumbnail`, `associateAssetLabel`, `removeAssetLabel`, `dismissAssetLabelSuggestion`, `associateSoundLabel`, `removeSoundLabel`, `dismissSoundLabelSuggestion`, `associateSavedAnimationLabel`, `removeSavedAnimationLabel` |
| Art styles | `listArtStyles`, `createArtStyle`, `generateArtStyle`, `deleteArtStyle` |
| Usage | `usage`, `usageHistogram`, `streamUsage` |
| API keys | `listKeys`, `createKey`, `updateKey`, `deleteKey` |
| Account | `ensureUser`, `health` |

Streaming helpers: `streamGenerations`, `streamSoundGenerations`,
`streamAnimationRuns` (honors `base_asset_id`), `streamSavedAnimations`,
`streamUsage`.

## Examples

Runnable examples live in [`examples/`](examples). Node 20.22+/22.6+ can run
TypeScript directly:

```sh
export GAMETORCH_API_KEY=gt2_...
node examples/list-projects.ts
node examples/generate-sprite.ts      # spends credits
node examples/generate-sound.ts       # spends credits
node examples/generate-animation.ts   # spends credits
node examples/animate-sprite.ts       # spends credits; animates a generated sprite
node examples/export-animation.ts     # read-only; exports every format
node examples/create-admin-key.ts     # needs an admin key
node examples/create-project-keys.ts  # needs an admin key
GAMETORCH_PROJECT=<project-uuid> node examples/stream-generations.ts
```

## Testing

`pnpm test` runs the offline unit and fixture tests. The live suites are opt-in
so they never hit the network or spend credits unless you ask:

| Suite | Env vars | Spends credits |
| --- | --- | --- |
| `test/live/live.test.ts` | `GAMETORCH_API_KEY` | No (read-only + exports) |
| `test/live/live-writes.test.ts` | `GAMETORCH_API_KEY`, `GAMETORCH_LIVE_WRITES=1` | No (creates and cleans up its own data) |
| `test/live/live-spend.test.ts` | `GAMETORCH_API_KEY`, `GAMETORCH_LIVE_SPEND=1` | **Yes** |

```sh
# Offline.
pnpm test

# Read-only live tests against a local deployment.
GAMETORCH_API_KEY=gt2_... GAMETORCH_BASE_URL=http://localhost:8300/api pnpm test:live

# Writes (no credits).
GAMETORCH_API_KEY=gt2_... GAMETORCH_LIVE_WRITES=1 \
  GAMETORCH_BASE_URL=http://localhost:8300/api pnpm test:live

# Costs money: generates a sprite, a sound and a 4s animation plus exports.
GAMETORCH_API_KEY=gt2_... GAMETORCH_LIVE_SPEND=1 \
  GAMETORCH_BASE_URL=http://localhost:8300/api pnpm test:live
```

Live tests create their own projects and delete them again at the end; set
`GAMETORCH_KEEP_PROJECT=1` to keep them for inspection.

### Typecheck, lint and build

```sh
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint --deny-warnings
pnpm build       # emit dist/
```

## Supply chain

This package deliberately has **zero runtime dependencies**. Development
dependencies are pinned exactly and installed with lifecycle scripts disabled
(`ignore-scripts=true`), and `pnpm audit` is kept clean. Responses are validated
at the boundary by the decoder layer, so type checks are enforced at runtime as
well as compile time.

## License

MIT. See [LICENSE](LICENSE).
