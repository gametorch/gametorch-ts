/**
 * Guards full API-surface parity with the Rust SDK: every public endpoint
 * method must exist on `Client.prototype`, and every builder must expose its
 * chainable setters.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "../src/index.ts";

const CLIENT_METHODS = [
  // Catalog
  "spriteModels",
  "soundModels",
  "animationModels",
  // Projects
  "listProjects",
  "createProject",
  "renameProject",
  "deleteProject",
  // Sprites
  "generateSprite",
  "listGenerations",
  "getGeneration",
  "listSpriteAssets",
  "getAsset",
  "assetContent",
  "assetOriginal",
  "renameAsset",
  "putAssetMetadata",
  "archiveAsset",
  "unarchiveAsset",
  "deleteAsset",
  "archiveGeneration",
  "unarchiveGeneration",
  "deleteGeneration",
  "streamGenerations",
  // Sounds
  "generateSound",
  "listSoundGenerations",
  "getSoundGeneration",
  "soundAssetContent",
  "renameSoundAsset",
  "putSoundAssetMetadata",
  "archiveSoundAsset",
  "unarchiveSoundAsset",
  "deleteSoundAsset",
  "archiveSoundGeneration",
  "unarchiveSoundGeneration",
  "streamSoundGenerations",
  // Animations
  "estimateAnimation",
  "generateAnimation",
  "listAnimationRuns",
  "getAnimationRun",
  "animationContent",
  "archiveAnimationRun",
  "unarchiveAnimationRun",
  "deleteAnimationRun",
  "generateFrames",
  "frameContent",
  "frameContentByNumber",
  "streamAnimationRuns",
  // Exports
  "exportPlan",
  "export",
  "exportTexturepacker",
  "exportTexturepackerZip",
  "exportAseprite",
  "exportGodot",
  "exportGodotZip",
  "exportGrid",
  "exportGamemaker",
  "exportSequenceZip",
  // Saved animations
  "listSavedAnimations",
  "saveAnimation",
  "getSavedAnimation",
  "renameSavedAnimation",
  "putSavedAnimationMetadata",
  "archiveSavedAnimation",
  "unarchiveSavedAnimation",
  "deleteSavedAnimation",
  "streamSavedAnimations",
  // Labels
  "listLabels",
  "createLabel",
  "updateLabel",
  "deleteLabel",
  "labelItems",
  "setLabelThumbnail",
  "associateAssetLabel",
  "removeAssetLabel",
  "dismissAssetLabelSuggestion",
  "associateSoundLabel",
  "removeSoundLabel",
  "dismissSoundLabelSuggestion",
  "associateSavedAnimationLabel",
  "removeSavedAnimationLabel",
  // Art styles
  "listArtStyles",
  "createArtStyle",
  "generateArtStyle",
  "deleteArtStyle",
  // Usage
  "usage",
  "usageHistogram",
  "streamUsage",
  // API keys
  "listKeys",
  "createKey",
  "updateKey",
  "deleteKey",
  // Account
  "ensureUser",
  "health",
];

test("every documented endpoint method exists", () => {
  const client = Client.builder().apiKey("gt2_test").rateLimit(false).build();
  const methods = new Set<string>();
  for (const name of Object.getOwnPropertyNames(Client.prototype)) {
    methods.add(name);
  }
  for (const method of CLIENT_METHODS) {
    assert.ok(methods.has(method), `Client is missing method ${method}`);
    assert.equal(
      typeof (client as unknown as Record<string, unknown>)[method],
      "function",
      `${method} is not a function`,
    );
  }
});

test("builders expose their setters and send", () => {
  const client = Client.builder().apiKey("gt2_test").rateLimit(false).build();

  const sprite = client.generateSprite("p");
  for (const method of [
    "prompt",
    "mode",
    "imageModel",
    "textModel",
    "noTextModel",
    "quality",
    "resolution",
    "baseAssetId",
    "requestId",
    "send",
  ]) {
    assert.equal(typeof (sprite as unknown as Record<string, unknown>)[method], "function");
  }

  const sound = client.generateSound("p");
  for (const method of ["prompt", "soundModel", "responseFormat", "requestId", "send"]) {
    assert.equal(typeof (sound as unknown as Record<string, unknown>)[method], "function");
  }

  const animation = client.generateAnimation("p");
  for (const method of ["prompt", "animationModel", "duration", "baseAssetId", "requestId", "send"]) {
    assert.equal(typeof (animation as unknown as Record<string, unknown>)[method], "function");
  }

  const frames = client.generateFrames("p", "r");
  for (const method of ["fps", "requestId", "send"]) {
    assert.equal(typeof (frames as unknown as Record<string, unknown>)[method], "function");
  }

  const estimate = client.estimateAnimation("p");
  for (const method of ["animationModel", "duration", "baseAssetId", "send"]) {
    assert.equal(typeof (estimate as unknown as Record<string, unknown>)[method], "function");
  }

  const saved = client.saveAnimation("p");
  for (const method of ["generationId", "range", "name", "send"]) {
    assert.equal(typeof (saved as unknown as Record<string, unknown>)[method], "function");
  }
});
