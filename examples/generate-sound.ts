/**
 * Creates a project, generates a sound effect, waits for it, downloads it, then
 * deletes the project. **Spends credits.**
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/generate-sound.ts
 */

import { mkdir, writeFile } from "node:fs/promises";

import { Client } from "../src/index.ts";

const client = Client.fromEnv();
const project = await client.createProject(`Sound Example ${Date.now()}`);
console.log(`created project '${project.name}' (${project.slug})`);

try {
  const models = await client.soundModels();
  const job = await client
    .generateSound(project.id)
    .prompt("a single sword unsheathing, then a heavy metal thud")
    .soundModel(models.model.id)
    .responseFormat(models.default_format)
    .send();
  console.log(`sound generation ${job.id} is ${job.status}`);

  let generation = await client.getSoundGeneration(job.id, true);
  while (generation.status === "queued" || generation.status === "running") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    generation = await client.getSoundGeneration(job.id, true);
  }
  console.log(`sound generation finished: ${generation.status}`);

  const asset = generation.assets[0];
  if (asset) {
    const content = await client.soundAssetContent(asset.id);
    await mkdir("output", { recursive: true });
    await writeFile(`output/${asset.id}.${asset.format}`, content.bytes());
    console.log(`wrote output/${asset.id}.${asset.format} (${content.len()} bytes)`);
  }
} finally {
  await client.deleteProject(project.slug);
  console.log(`deleted project '${project.slug}'`);
}
