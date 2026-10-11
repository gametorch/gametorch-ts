/**
 * Opt-in live tests that **spend credits**.
 *
 * They only run when `GAMETORCH_LIVE_SPEND=1` and `GAMETORCH_API_KEY` are set.
 * Each test creates its own project and deletes it again at the end, unless
 * `GAMETORCH_KEEP_PROJECT=1` is set.
 *
 * Approximate cost per full run: a single sprite (~5 credits), a sound effect
 * (~4 credits) and a 4-second `ash` animation (~73 credits) plus frame
 * generation (~3 credits). 100 credits = $1.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_EXPORT_FORMATS,
  type AnimationRun,
  type Client,
  type Generation,
  type SoundGeneration,
  SpriteMode,
} from "../../src/index.ts";
import { client, createProject, envEnabled, finishProject, shortName, sleep } from "./common.ts";

const SPRITE_FILEPATH = "/foo/bar/sprites/hero.png";
const SOUND_FILEPATH = "/foo/bar/audio/sword-unsheath.mp3";
const ANIMATION_FILEPATH = "/foo/bar/animations/sword-raise.aseprite";

function spendClient(): Client | undefined {
  return envEnabled("GAMETORCH_LIVE_SPEND") ? client() : undefined;
}

async function waitGeneration(c: Client, id: string): Promise<Generation> {
  for (let i = 0; i < 120; i += 1) {
    const generation = await c.getGeneration(id, true);
    if (generation.status !== "queued" && generation.status !== "running") {
      return generation;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for sprite generation ${id}`);
}

async function waitSound(c: Client, id: string): Promise<SoundGeneration> {
  for (let i = 0; i < 120; i += 1) {
    const generation = await c.getSoundGeneration(id, true);
    if (generation.status !== "queued" && generation.status !== "running") {
      return generation;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for sound generation ${id}`);
}

async function waitAnimation(c: Client, id: string): Promise<AnimationRun> {
  for (let i = 0; i < 180; i += 1) {
    const run = await c.getAnimationRun(id);
    if (run.status !== "queued" && run.status !== "running") {
      return run;
    }
    await sleep(3000);
  }
  throw new Error(`timed out waiting for animation run ${id}`);
}

async function waitForFrames(c: Client, id: string): Promise<AnimationRun> {
  let lastLen = 0;
  for (let i = 0; i < 180; i += 1) {
    const run = await c.getAnimationRun(id);
    const settled = run.frame_runs.every(
      (frameRun) => frameRun.status !== "queued" && frameRun.status !== "running",
    );
    if (run.frames.length > 0 && settled && run.frames.length === lastLen) {
      return run;
    }
    lastLen = run.frames.length;
    await sleep(2000);
  }
  return c.getAnimationRun(id);
}

test("sprite generation full flow", async () => {
  const c = spendClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Sprite Spend Test");
  if (!project) {
    return;
  }

  const models = await c.spriteModels();
  const imageModel = models.image_models.find((model) => model.available);
  assert.ok(imageModel !== undefined, "no available image models");

  const job = await c
    .generateSprite(project.id)
    .prompt("a friendly red fox, side view, game sprite")
    .mode(SpriteMode.Single)
    .imageModel(imageModel.id)
    .send();

  const generation = await waitGeneration(c, job.id);
  assert.equal(generation.status, "succeeded", `generation failed: ${generation.error}`);
  const asset = generation.assets[0];
  assert.ok(asset !== undefined, "at least one asset");

  const named = await c.renameAsset(asset.id, "Hero Fox");
  assert.equal(named.name, "Hero Fox");

  const metadata = { filepath: SPRITE_FILEPATH };
  const updated = await c.putAssetMetadata(asset.id, metadata);
  assert.equal(updated.metadata["filepath"], SPRITE_FILEPATH);

  // Metadata merges: a second call adds `variant` and keeps `filepath`.
  const merged = await c.putAssetMetadata(asset.id, { variant: "idle" });
  assert.equal(merged.metadata["filepath"], SPRITE_FILEPATH);
  assert.equal(merged.metadata["variant"], "idle");

  // `remove` is the only way to delete keys; the response is the full map.
  const pruned = await c.putAssetMetadata(asset.id, undefined, ["variant"]);
  assert.equal(pruned.metadata["variant"], undefined);
  assert.equal(pruned.metadata["filepath"], SPRITE_FILEPATH);

  const label = await c.createLabel(project.id, shortName("sprite"));
  const associated = await c.associateAssetLabel(asset.id, label.name);
  assert.ok(associated.labels.includes(label.name));
  const removed = await c.removeAssetLabel(asset.id, label.name);
  assert.ok(!removed.labels.includes(label.name));
  await c.associateAssetLabel(asset.id, label.name);

  const archived = await c.archiveAsset(asset.id);
  assert.ok(archived.archived_at !== undefined);
  const unarchived = await c.unarchiveAsset(asset.id);
  assert.equal(unarchived.archived_at, undefined);

  const content = await c.assetContent(asset.id);
  assert.ok(!content.isEmpty());

  await finishProject(c, project.slug);
});

test("sound generation full flow", async () => {
  const c = spendClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Sound Spend Test");
  if (!project) {
    return;
  }

  const models = await c.soundModels();
  const job = await c
    .generateSound(project.id)
    .prompt("a single sword unsheathing, then a heavy metal thud")
    .soundModel(models.model.id)
    .responseFormat(models.default_format)
    .send();

  const generation = await waitSound(c, job.id);
  assert.equal(generation.status, "succeeded", `generation failed: ${generation.error}`);
  const asset = generation.assets[0];
  assert.ok(asset !== undefined, "at least one asset");

  const named = await c.renameSoundAsset(asset.id, "Sword Unsheath");
  assert.equal(named.name, "Sword Unsheath");

  const metadata = { filepath: SOUND_FILEPATH };
  const updated = await c.putSoundAssetMetadata(asset.id, metadata);
  assert.equal(updated.metadata["filepath"], SOUND_FILEPATH);

  // Metadata merges: a second call adds `variant` and keeps `filepath`.
  const merged = await c.putSoundAssetMetadata(asset.id, { variant: "swing" });
  assert.equal(merged.metadata["filepath"], SOUND_FILEPATH);
  assert.equal(merged.metadata["variant"], "swing");

  // `remove` is the only way to delete keys; the response is the full map.
  const pruned = await c.putSoundAssetMetadata(asset.id, undefined, ["variant"]);
  assert.equal(pruned.metadata["variant"], undefined);
  assert.equal(pruned.metadata["filepath"], SOUND_FILEPATH);

  const label = await c.createLabel(project.id, shortName("sound"));
  const associated = await c.associateSoundLabel(asset.id, label.name);
  assert.ok(associated.labels.includes(label.name));
  const removed = await c.removeSoundLabel(asset.id, label.name);
  assert.ok(!removed.labels.includes(label.name));
  await c.associateSoundLabel(asset.id, label.name);

  const archived = await c.archiveSoundAsset(asset.id);
  assert.ok(archived.archived_at !== undefined);
  const unarchived = await c.unarchiveSoundAsset(asset.id);
  assert.equal(unarchived.archived_at, undefined);

  const content = await c.soundAssetContent(asset.id);
  assert.ok(!content.isEmpty());

  await finishProject(c, project.slug);
});

test("animation generation, exports and saved animation", async () => {
  const c = spendClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Animation Spend Test");
  if (!project) {
    return;
  }

  const job = await c
    .generateAnimation(project.id)
    .prompt("the hero draws her sword and raises it overhead")
    .animationModel("ash")
    .duration(4)
    .send();

  let run = await waitAnimation(c, job.id);
  assert.equal(run.status, "succeeded", `animation failed: ${run.error}`);

  if (run.frames.length === 0) {
    await c.generateFrames(project.id, run.id).fps(12).send();
  }
  run = await waitForFrames(c, run.id);
  assert.ok(run.frames.length > 0, "animation produced no frames");

  const last = run.frames[run.frames.length - 1]?.frame_number ?? 1;
  const startFrame = Math.min(2, last);
  const endFrame = Math.max(last - 1, startFrame);
  const saved = await c
    .saveAnimation(project.id)
    .generationId(run.id)
    .range(startFrame, endFrame)
    .name("Sword Raise")
    .send();
  assert.equal(saved.generation_id, run.id);
  assert.equal(saved.start_frame, startFrame);
  assert.equal(saved.end_frame, endFrame);

  const renamed = await c.renameSavedAnimation(saved.id, "Sword Raise (named)");
  assert.equal(renamed.name, "Sword Raise (named)");

  const metadata = { filepath: ANIMATION_FILEPATH };
  const tagged = await c.putSavedAnimationMetadata(saved.id, metadata);
  assert.equal(tagged.metadata["filepath"], ANIMATION_FILEPATH);

  // Metadata merges: a second call adds `variant` and keeps `filepath`.
  const merged = await c.putSavedAnimationMetadata(saved.id, { variant: "attack" });
  assert.equal(merged.metadata["filepath"], ANIMATION_FILEPATH);
  assert.equal(merged.metadata["variant"], "attack");

  // `remove` is the only way to delete keys; the response is the full map.
  const pruned = await c.putSavedAnimationMetadata(saved.id, undefined, ["variant"]);
  assert.equal(pruned.metadata["variant"], undefined);
  assert.equal(pruned.metadata["filepath"], ANIMATION_FILEPATH);

  const label = await c.createLabel(project.id, shortName("anim"));
  const associated = await c.associateSavedAnimationLabel(saved.id, label.name);
  assert.ok(associated.labels.includes(label.name));
  const removed = await c.removeSavedAnimationLabel(saved.id, label.name);
  assert.ok(!removed.labels.includes(label.name));
  await c.associateSavedAnimationLabel(saved.id, label.name);

  const archived = await c.archiveSavedAnimation(saved.id);
  assert.ok(archived.archived_at !== undefined);
  const unarchived = await c.unarchiveSavedAnimation(saved.id);
  assert.equal(unarchived.archived_at, undefined);

  const frame = await c.frameContentByNumber(run.id, startFrame);
  assert.ok(!frame.isEmpty());

  for (const format of ALL_EXPORT_FORMATS) {
    const exported = await c.export(run.id, format, startFrame, endFrame);
    if (exported.kind === "binary") {
      assert.ok(!exported.value.isEmpty(), `${format} was empty`);
    } else if (exported.kind === "texturepacker") {
      assert.ok(exported.value.image_base64.length > 0, "texturepacker image was empty");
      assert.ok(exported.value.json_filename.length > 0);
    } else {
      assert.ok(exported.value.tres.length > 0, "godot resource was empty");
      assert.ok(exported.value.image_base64.length > 0, "godot image was empty");
    }
  }

  await finishProject(c, project.slug);
});
