/**
 * Read-only: finds an animation run with frames and exports it in every
 * supported format. Never spends credits.
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/export-animation.ts [run-id]
 */

import { mkdir, writeFile } from "node:fs/promises";

import { ALL_EXPORT_FORMATS, Client, ListParams } from "../src/index.ts";

const client = Client.fromEnv();

let runId = process.argv[2];
if (runId === undefined) {
  const projects = await client.listProjects();
  outer: for (const project of projects.projects) {
    const runs = await client.listAnimationRuns(project.id, ListParams.new().includeArchived(true));
    for (const run of runs.animations) {
      if (run.frames.length > 0) {
        runId = run.id;
        break outer;
      }
    }
  }
}
if (runId === undefined) {
  throw new Error("no animation run with frames found; pass a run id explicitly");
}

const run = await client.getAnimationRun(runId);
const endFrame = Math.min(4, run.frames.length);
await mkdir("output", { recursive: true });

for (const format of ALL_EXPORT_FORMATS) {
  const exported = await client.export(runId, format, 1, endFrame);
  const safe = format.replace(".", "_");
  if (exported.kind === "binary") {
    await writeFile(`output/${runId}.${safe}`, exported.value.bytes());
  } else {
    await writeFile(`output/${runId}.${safe}.json`, JSON.stringify(exported.value, null, 2));
  }
  console.log(`exported ${format}`);
}
