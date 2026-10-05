/**
 * Creates a project, generates one sprite, waits for it, downloads it, then
 * deletes the project. **Spends credits.**
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/generate-sprite.ts
 */

import { mkdir, writeFile } from "node:fs/promises";

import { Client, SpriteMode } from "../src/index.ts";

const client = Client.fromEnv();
const project = await client.createProject(`Sprite Example ${Date.now()}`);
console.log(`created project '${project.name}' (${project.slug})`);

try {
  const models = await client.spriteModels();
  const imageModel = models.image_models.find((model) => model.available);
  if (!imageModel) {
    throw new Error("no available image models");
  }

  const job = await client
    .generateSprite(project.id)
    .prompt("a friendly red fox, side view, game sprite")
    .mode(SpriteMode.Single)
    .imageModel(imageModel.id)
    .send();
  console.log(`generation ${job.id} is ${job.status}`);

  let generation = await client.getGeneration(job.id, true);
  while (generation.status === "queued" || generation.status === "running") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    generation = await client.getGeneration(job.id, true);
  }
  console.log(`generation finished: ${generation.status}`);

  const asset = generation.assets[0];
  if (asset) {
    const content = await client.assetContent(asset.id);
    await mkdir("output", { recursive: true });
    await writeFile(`output/${asset.id}.png`, content.bytes());
    console.log(`wrote output/${asset.id}.png (${content.len()} bytes)`);
  }
} finally {
  await client.deleteProject(project.slug);
  console.log(`deleted project '${project.slug}'`);
}
