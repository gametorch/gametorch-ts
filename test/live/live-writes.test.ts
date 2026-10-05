/**
 * Opt-in live write tests that do **not** spend credits.
 *
 * Enabled only when both `GAMETORCH_API_KEY` and `GAMETORCH_LIVE_WRITES=1` are
 * set. Each test creates its own project and deletes it again at the end,
 * unless `GAMETORCH_KEEP_PROJECT=1` is set.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ApiKeyScope,
  ApiError,
  CreateApiKeyRequest,
  ListParams,
  SpendResetCadence,
  UpdateApiKeyRequest,
} from "../../src/index.ts";
import {
  client,
  createProject,
  envEnabled,
  finishProject,
  shortName,
  projectName,
} from "./common.ts";

function writesClient() {
  return envEnabled("GAMETORCH_LIVE_WRITES") ? client() : undefined;
}

test("project lifecycle", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Project Test");
  if (!project) {
    return;
  }

  const projects = await c.listProjects();
  assert.ok(projects.projects.some((p) => p.id === project.id));

  const renamed = await c.renameProject(project.slug, projectName("Project Test Renamed"));
  assert.equal(renamed.id, project.id);

  await finishProject(c, renamed.slug);
});

test("label lifecycle", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Label Test");
  if (!project) {
    return;
  }

  const name = shortName("sdk-label");
  const label = await c.createLabel(project.id, name, "#123456");
  assert.equal(label.name, name);

  const newName = shortName("sdk-renamed");
  const updated = await c.updateLabel(label.id, newName, "#654321");
  assert.equal(updated.name, newName);

  const labels = await c.listLabels(project.id);
  assert.ok(labels.labels.some((l) => l.id === label.id));

  await c.deleteLabel(label.id);

  const kept = await c.createLabel(project.id, shortName("sdk-kept"), "#8bc34a");
  console.log(`kept label '${kept.name}'`);

  await finishProject(c, project.slug);
});

test("art style lifecycle", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Art Style Test");
  if (!project) {
    return;
  }

  const name = shortName("sdk-style");
  const style = await c.createArtStyle(project.id, name);
  assert.equal(style.name, name);

  const styles = await c.listArtStyles(project.id);
  assert.ok(styles.art_styles.some((s) => s.id === style.id));

  await c.deleteArtStyle(style.id);

  const kept = await c.createArtStyle(project.id, shortName("sdk-kept-style"));
  console.log(`kept art style '${kept.name}'`);

  await finishProject(c, project.slug);
});

test("generate art style decodes", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Art Style Suggest Test");
  if (!project) {
    return;
  }

  const suggestion = await c.generateArtStyle(project.id);
  assert.notEqual(suggestion.name.length, 0);

  await finishProject(c, project.slug);
});

test("ensure user ok", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const response = await c.ensureUser();
  assert.equal(response.ok, true);
});

test("key lifecycle", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }

  let created;
  try {
    created = await c.createKey(CreateApiKeyRequest.new().withName(shortName("sdk-key")));
  } catch (err) {
    if (err instanceof ApiError && err.isForbidden()) {
      console.error("skipping: this key cannot manage API keys (admin required)");
      return;
    }
    throw err;
  }
  assert.notEqual(created.key_full.length, 0);
  assert.notEqual(created.key.key_prefix.length, 0);

  const updated = await c.updateKey(
    created.key.id,
    UpdateApiKeyRequest.new().withName(shortName("sdk-key-renamed")),
  );
  assert.ok(updated.name !== undefined);

  await c.deleteKey(created.key.id);
});

test("scoped key lifecycle", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }
  const project = await createProject(c, "Scoped Key Test");
  if (!project) {
    return;
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  let read;
  try {
    read = await c.createKey(
      CreateApiKeyRequest.projectRead(project.id)
        .withName(shortName("sdk-read"))
        .maxSpendLimit("0")
        .spendResetCadence(SpendResetCadence.Monthly)
        .expiresAt(expiresAt),
    );
  } catch (err) {
    if (err instanceof ApiError && err.isForbidden()) {
      console.error("skipping: this key cannot manage API keys (admin required)");
      await finishProject(c, project.slug);
      return;
    }
    throw err;
  }
  assert.equal(read.key.key_scope, ApiKeyScope.ProjectRead);
  assert.equal(read.key.project_id, project.id);
  assert.ok(read.key.name !== undefined);
  assert.ok(read.key.expires_at !== undefined);

  const write = await c.createKey(
    CreateApiKeyRequest.projectWrite(project.id)
      .withName(shortName("sdk-write"))
      .maxSpendLimit("500")
      .spendResetCadence(SpendResetCadence.Weekly)
      .expiresAt(expiresAt),
  );
  assert.equal(write.key.key_scope, ApiKeyScope.ProjectWrite);
  assert.equal(write.key.project_id, project.id);
  assert.equal(write.key.max_spend_limit, "500");

  const updated = await c.updateKey(
    write.key.id,
    UpdateApiKeyRequest.new()
      .withName(shortName("sdk-write-renamed"))
      .maxSpendLimit("750")
      .spendResetCadence(SpendResetCadence.Monthly)
      .expiresAt(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()),
  );
  assert.equal(updated.max_spend_limit, "750");
  assert.equal(updated.spend_reset_cadence, "monthly");

  await c.deleteKey(read.key.id);
  await c.deleteKey(write.key.id);

  await finishProject(c, project.slug);
});

test("saved animation lifecycle on an existing run", async () => {
  const c = writesClient();
  if (!c) {
    return;
  }

  // Reuse an existing succeeded run so no credits are spent.
  const projects = await c.listProjects();
  let target: { projectId: string; runId: string; frameCount: number } | undefined;
  for (const project of projects.projects) {
    const runs = await c.listAnimationRuns(project.id, ListParams.new().includeArchived(true));
    const run = runs.animations.find((candidate) => candidate.frames.length > 0);
    if (run) {
      target = { projectId: project.id, runId: run.id, frameCount: run.frames.length };
      break;
    }
  }
  if (!target) {
    console.error("skipping: no animation run with frames available");
    return;
  }

  const start = 1;
  const end = Math.min(4, target.frameCount);
  const saved = await c
    .saveAnimation(target.projectId)
    .generationId(target.runId)
    .range(start, end)
    .name(shortName("sdk-saved"))
    .send();
  assert.equal(saved.generation_id, target.runId);
  assert.equal(saved.start_frame, start);
  assert.equal(saved.end_frame, end);

  const fetched = await c.getSavedAnimation(saved.id);
  assert.equal(fetched.id, saved.id);

  const renamed = await c.renameSavedAnimation(saved.id, shortName("sdk-saved-2"));
  assert.ok(renamed.name !== undefined);

  const metadata = { filepath: "/tmp/hero.aseprite" };
  const tagged = await c.putSavedAnimationMetadata(saved.id, metadata);
  assert.equal(tagged.metadata["filepath"], metadata.filepath);
  const cleared = await c.putSavedAnimationMetadata(saved.id, {});
  assert.deepEqual(cleared.metadata, {});

  const label = await c.createLabel(target.projectId, shortName("sdk-saved-label"));
  const associated = await c.associateSavedAnimationLabel(saved.id, label.name);
  assert.ok(associated.labels.includes(label.name));
  const removed = await c.removeSavedAnimationLabel(saved.id, label.name);
  assert.ok(!removed.labels.includes(label.name));

  const archived = await c.archiveSavedAnimation(saved.id);
  assert.ok(archived.archived_at !== undefined);
  const unarchived = await c.unarchiveSavedAnimation(saved.id);
  assert.equal(unarchived.archived_at, undefined);

  await c.deleteSavedAnimation(saved.id);
  await c.deleteLabel(label.id);
});
