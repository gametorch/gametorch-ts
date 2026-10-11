/**
 * Walks the full animation workflow: generation, frame generation, saving a
 * sub-range as a named preset, naming, metadata, labels and exporting in every
 * supported format. **Spends credits.**
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/generate-animation.ts
 */

import { mkdir, writeFile } from "node:fs/promises";

import {
  ALL_EXPORT_FORMATS,
  type AnimationRun,
  Client,
} from "../src/index.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitAnimation(client: Client, id: string): Promise<AnimationRun> {
  for (;;) {
    const run = await client.getAnimationRun(id);
    if (run.status !== "queued" && run.status !== "running") {
      return run;
    }
    await sleep(3000);
  }
}

async function waitForFrames(client: Client, id: string): Promise<AnimationRun> {
  let lastLen = 0;
  for (;;) {
    const run = await client.getAnimationRun(id);
    const settled = run.frame_runs.every(
      (frameRun) => frameRun.status !== "queued" && frameRun.status !== "running",
    );
    if (run.frames.length > 0 && settled && run.frames.length === lastLen) {
      return run;
    }
    lastLen = run.frames.length;
    await sleep(2000);
  }
}

const client = Client.fromEnv();
const project = await client.createProject(`Animation Example ${Date.now()}`);
console.log(`created project '${project.name}' (${project.slug})`);

try {
  const job = await client
    .generateAnimation(project.id)
    .prompt("the hero draws her sword and raises it overhead")
    .animationModel("ash")
    .duration(4)
    .send();
  console.log(`animation ${job.id} is ${job.status}`);

  let run = await waitAnimation(client, job.id);
  if (run.status !== "succeeded") {
    throw new Error(`animation failed: ${run.error}`);
  }

  if (run.frames.length === 0) {
    await client.generateFrames(project.id, run.id).fps(12).send();
  }
  run = await waitForFrames(client, run.id);
  console.log(`animation produced ${run.frames.length} frames`);

  const lastFrame = run.frames[run.frames.length - 1]?.frame_number ?? 1;
  const startFrame = Math.min(2, lastFrame);
  const endFrame = Math.max(lastFrame - 1, startFrame);

  const saved = await client
    .saveAnimation(project.id)
    .generationId(run.id)
    .range(startFrame, endFrame)
    .name("Sword Raise")
    .send();
  console.log(`saved animation ${saved.id} (frames ${saved.start_frame}-${saved.end_frame})`);

  await client.renameSavedAnimation(saved.id, "Sword Raise (named)");

  // Metadata merges (upserts): omitted keys are kept, matching keys are
  // overwritten. `remove` (alias `remove_keys`) is the only way to delete keys,
  // and the response returns the full merged map.
  await client.putSavedAnimationMetadata(saved.id, { filepath: "/foo/bar/raise.aseprite" });
  const tagged = await client.putSavedAnimationMetadata(saved.id, { variant: "attack" });
  console.log(`metadata: ${JSON.stringify(tagged.metadata)}`);
  const untagged = await client.putSavedAnimationMetadata(saved.id, undefined, {
    remove_keys: ["variant"],
  });
  console.log(`metadata: ${JSON.stringify(untagged.metadata)}`);
  const label = await client.createLabel(project.id, `anim-${Date.now()}`, "#8bc34a");
  await client.associateSavedAnimationLabel(saved.id, label.name);

  await mkdir("output", { recursive: true });
  for (const format of ALL_EXPORT_FORMATS) {
    const exported = await client.export(run.id, format, startFrame, endFrame);
    const safe = format.replace(".", "_");
    if (exported.kind === "binary") {
      await writeFile(`output/export.${safe}`, exported.value.bytes());
    } else if (exported.kind === "texturepacker") {
      await writeFile(`output/export.${safe}.json`, JSON.stringify(exported.value, null, 2));
    } else {
      await writeFile(`output/export.${safe}.json`, JSON.stringify(exported.value, null, 2));
    }
    console.log(`exported ${format}`);
  }

  // A single frame is downloadable by number.
  const frame = await client.frameContentByNumber(run.id, startFrame);
  await writeFile(`output/frame-${startFrame}.png`, frame.bytes());
} finally {
  await client.deleteProject(project.slug);
  console.log(`deleted project '${project.slug}'`);
}
