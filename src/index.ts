/**
 * # GameTorch TypeScript SDK
 *
 * The official SDK for the [GameTorch](https://gametorch.app) API. GameTorch
 * generates game-ready sprites, sound effects and animations from text prompts
 * and organizes them into projects.
 *
 * ```ts
 * import { Client, SpriteMode } from "gametorch";
 *
 * const client = Client.fromEnv(); // reads GAMETORCH_API_KEY
 * const models = await client.spriteModels();
 * const project = await client.createProject("My Game");
 *
 * const job = await client
 *   .generateSprite(project.id)
 *   .prompt("a red fox, side view")
 *   .mode(SpriteMode.Single)
 *   .imageModel(models.image_models[0]!.id)
 *   .send();
 * ```
 */

import "./api/index.ts";

export * from "./client.ts";
export * from "./errors.ts";
export * from "./models/index.ts";
export * from "./paginator.ts";
export * from "./rate-limit.ts";
export * from "./types.ts";
