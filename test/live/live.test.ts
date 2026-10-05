/**
 * Live integration tests (read-only; never spends credits).
 *
 * They run only when `GAMETORCH_API_KEY` is set, so the default `pnpm test`
 * stays offline. Point them at a local deployment with
 * `GAMETORCH_BASE_URL=http://localhost:8300/api`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ALL_EXPORT_FORMATS, ApiError, Client, ListParams } from "../../src/index.ts";
import { anonymousClient, client } from "./common.ts";

async function firstProject(c: Client): Promise<string | undefined> {
  try {
    const projects = await c.listProjects();
    return projects.projects[0]?.id;
  } catch {
    return undefined;
  }
}

test("health is ok", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const status = await c.health();
  assert.notEqual(status.length, 0);
});

test("catalogs decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const sprites = await c.spriteModels();
  assert.ok(sprites.image_models.length > 0);

  const sounds = await c.soundModels();
  assert.ok(sounds.formats.length > 0);

  const animations = await c.animationModels();
  assert.ok(animations.data.length > 0);
});

test("list projects decodes", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projects = await c.listProjects();
  for (const project of projects.projects) {
    assert.notEqual(project.slug.length, 0);
  }
});

test("usage decodes", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const usage = await c.usage();
  assert.ok(usage.total >= 0);

  const histogram = await c.usageHistogram("24h");
  assert.equal(histogram.range, "24h");
});

test("generations and assets decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const params = ListParams.new().includeArchived(true);
  const generations = await c.listGenerations(projectId, params);

  for (const generation of generations.generations.slice(0, 3)) {
    const fetched = await c.getGeneration(generation.id, true);
    assert.equal(fetched.id, generation.id);

    const asset = fetched.assets[0];
    if (asset !== undefined) {
      const fetchedAsset = await c.getAsset(asset.id);
      assert.equal(fetchedAsset.id, asset.id);
      const content = await c.assetContent(asset.id);
      assert.ok(!content.isEmpty());
      if (fetchedAsset.has_original) {
        const original = await c.assetOriginal(asset.id);
        assert.ok(!original.isEmpty());
      }
    }
  }

  const assets = await c.listSpriteAssets(projectId);
  for (const asset of assets.assets.slice(0, 3)) {
    assert.ok(asset.width >= 0);
  }
});

test("sounds decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const params = ListParams.new().includeArchived(true);
  const sounds = await c.listSoundGenerations(projectId, params);

  for (const generation of sounds.sound_generations.slice(0, 3)) {
    const fetched = await c.getSoundGeneration(generation.id, true);
    assert.equal(fetched.id, generation.id);
    const asset = fetched.assets[0];
    if (asset !== undefined) {
      const content = await c.soundAssetContent(asset.id);
      assert.ok(!content.isEmpty());
    }
  }
});

test("animations and exports decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const params = ListParams.new().includeArchived(true);
  const runs = await c.listAnimationRuns(projectId, params);

  let exportedEveryFormat = false;
  for (const run of runs.animations.slice(0, 2)) {
    const fetched = await c.getAnimationRun(run.id);
    assert.equal(fetched.id, run.id);
    assert.ok(
      (fetched.provenance.source ?? "").length > 0,
      "animation run has no provenance source",
    );

    const frame = fetched.frames[0];
    if (frame !== undefined) {
      const content = await c.frameContent(frame.id);
      assert.ok(!content.isEmpty());

      const plan = await c.exportPlan(run.id, 1, 2);
      assert.ok(plan.frame_count >= 0);
    }

    // Exports are read-only (they never spend credits); validate every format
    // against one run that already has frames.
    if (!exportedEveryFormat && fetched.frames.length > 0) {
      exportedEveryFormat = true;
      const endFrame = Math.min(4, fetched.frames.length);
      for (const format of ALL_EXPORT_FORMATS) {
        const exported = await c.export(run.id, format, 1, endFrame);
        if (exported.kind === "binary") {
          assert.ok(!exported.value.isEmpty(), `${format} was empty`);
        } else if (exported.kind === "texturepacker") {
          assert.ok(exported.value.image_base64.length > 0);
        } else {
          assert.ok(exported.value.tres.length > 0);
        }
      }
    }
  }

  const base =
    runs.animations.find((run) => run.base_asset_id !== undefined)?.base_asset_id ??
    crypto.randomUUID();
  const filtered = await c.listAnimationRuns(
    projectId,
    ListParams.new().includeArchived(true).baseAssetId(base),
  );
  assert.ok(filtered.animations.every((run) => run.base_asset_id === base));
  if (runs.animations.some((run) => run.base_asset_id === base)) {
    assert.ok(filtered.animations.length > 0);
  }
});

test("saved animations decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const params = ListParams.new().includeArchived(true);
  const saved = await c.listSavedAnimations(projectId, params);
  for (const animation of saved.saved_animations.slice(0, 3)) {
    const fetched = await c.getSavedAnimation(animation.id);
    assert.equal(fetched.id, animation.id);
  }
});

test("labels and art styles decode", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const labels = await c.listLabels(projectId);
  const label = labels.labels[0];
  if (label !== undefined) {
    const items = await c.labelItems(label.id);
    assert.equal(items.label.id, label.id);
  }

  const styles = await c.listArtStyles(projectId);
  for (const style of styles.art_styles) {
    assert.notEqual(style.name.length, 0);
  }
});

test("keys decode or are forbidden", async () => {
  const c = client();
  if (!c) {
    return;
  }
  try {
    const keys = await c.listKeys();
    for (const key of keys.keys) {
      assert.notEqual(key.key_prefix.length, 0);
    }
  } catch (err) {
    if (err instanceof ApiError && err.isForbidden()) {
      // Organization API keys are admin-only; that's expected.
      return;
    }
    throw err;
  }
});

test("animation estimate decodes", async () => {
  const c = client();
  if (!c) {
    return;
  }
  const projectId = await firstProject(c);
  if (projectId === undefined) {
    console.error("skipping: no projects");
    return;
  }

  const estimate = await c.estimateAnimation(projectId).animationModel("ash").duration(4).send();
  assert.equal(estimate.animation_model, "ash");
  assert.equal(estimate.duration, 4);
  assert.notEqual(estimate.resolution.length, 0);
});

test("unauthenticated requests are rejected", async () => {
  const anonymous = anonymousClient();
  if (!anonymous) {
    return;
  }
  await assert.rejects(
    () => anonymous.listProjects(),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      return true;
    },
  );
});
