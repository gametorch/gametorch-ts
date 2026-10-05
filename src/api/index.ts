/**
 * Endpoint implementations, grouped by resource.
 *
 * Importing this module installs every method on {@link Client.prototype} and
 * applies the module augmentations that type them. It is imported for side
 * effects from the package entry point.
 */

import "./account.ts";
import "./animations.ts";
import "./art-styles.ts";
import "./catalog.ts";
import "./exports.ts";
import "./keys.ts";
import "./labels.ts";
import "./projects.ts";
import "./saved-animations.ts";
import "./sounds.ts";
import "./sprites.ts";
import "./usage.ts";

export type { AnimationEstimateBuilder, AnimationRunBuilder, FrameGenerationBuilder } from "./animations.ts";
export type { SaveAnimationBuilder } from "./saved-animations.ts";
export type { SoundGenerationBuilder } from "./sounds.ts";
export type { SpriteGenerationBuilder } from "./sprites.ts";
