/**
 * Animates an existing sprite: generates a sprite, then passes its asset id as
 * `base_asset_id` so the animation is derived from that exact image instead of
 * being generated from scratch. **Spends credits.**
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/animate-sprite.ts
 */

import { mkdir, writeFile } from "node:fs/promises";

import { Client, SpriteMode } from "../src/index.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const client = Client.fromEnv();
const project = await client.createProject(`Animate Sprite Example ${Date.now()}`);
console.log(`created project '${project.name}' (${project.slug})`);

try {
  // 1. Generate the sprite we want to animate.
  const models = await client.spriteModels();
  const imageModel = models.image_models.find((model) => model.available);
  if (!imageModel) {
    throw new Error("no available image models");
  }

  const spriteJob = await client
    .generateSprite(project.id)
    .prompt("a friendly red fox, side view, game sprite")
    .mode(SpriteMode.Single)
    .imageModel(imageModel.id)
    .send();

  let generation = await client.getGeneration(spriteJob.id, true);
  while (generation.status === "queued" || generation.status === "running") {
    await sleep(2000);
    generation = await client.getGeneration(spriteJob.id, true);
  }
  if (generation.status !== "succeeded") {
    throw new Error(`sprite generation failed: ${generation.error}`);
  }

  // 2. Grab the sprite asset id. This is the reference image id: the same id
  //    `listSpriteAssets` returns for the sprite.
  const sprite = generation.assets[0];
  if (!sprite) {
    throw new Error("sprite generation produced no assets");
  }
  console.log(`generated sprite asset ${sprite.id}`);

  // 3. Optionally price the run first; the estimate accepts the same base id.
  const estimate = await client
    .estimateAnimation(project.id)
    .animationModel("ash")
    .duration(4)
    .baseAssetId(sprite.id)
    .send();
  console.log(`estimate for animating ${sprite.id}: ${estimate.credits} credits`);

  // 4. Animate the sprite by passing its asset id as base_asset_id. Omit
  //    baseAssetId(...) to generate an animation from scratch instead.
  const animationJob = await client
    .generateAnimation(project.id)
    .prompt("the fox turns its head and flicks its tail")
    .animationModel("ash")
    .duration(4)
    .baseAssetId(sprite.id)
    .send();
  console.log(`animation ${animationJob.id} is ${animationJob.status}`);

  let run = await client.getAnimationRun(animationJob.id);
  while (run.status === "queued" || run.status === "running") {
    await sleep(3000);
    run = await client.getAnimationRun(animationJob.id);
  }
  if (run.status !== "succeeded") {
    throw new Error(`animation failed: ${run.error}`);
  }

  if (run.base_asset_id === undefined) {
    throw new Error("animation was not linked to the sprite");
  }
  console.log(`animation ${run.id} is linked to base asset ${run.base_asset_id}`);

  const clip = await client.animationContent(run.id);
  const ext = clip.contentType()?.split("/")[1]?.split(";")[0] ?? "bin";
  await mkdir("output", { recursive: true });
  await writeFile(`output/animation-${run.id}.${ext}`, clip.bytes());
  console.log(`wrote output/animation-${run.id}.${ext} (${clip.len()} bytes)`);
} finally {
  await client.deleteProject(project.slug);
  console.log(`deleted project '${project.slug}'`);
}
