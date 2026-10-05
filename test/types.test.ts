/** Shared types: money conversion, enums, downloads and list params. */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_EXPORT_FORMATS,
  ApiKeyScope,
  Download,
  ExportFormat,
  ListParams,
  SpendResetCadence,
  SpriteMode,
  apiKeyScopeFromString,
  creditsToUsd,
  exportFormatFromString,
  spendResetCadenceFromString,
  spriteModeFromString,
} from "../src/index.ts";

test("creditsToUsd converts exactly (100 credits = $1)", () => {
  assert.equal(creditsToUsd("300"), "3");
  assert.equal(creditsToUsd("100"), "1");
  assert.equal(creditsToUsd("1"), "0.01");
  assert.equal(creditsToUsd("99"), "0.99");
  assert.equal(creditsToUsd("0"), "0");
  assert.equal(creditsToUsd("5.003952358800"), "0.050039523588");
  assert.equal(creditsToUsd("-250"), "-2.5");
  assert.equal(creditsToUsd("73.347960000000"), "0.7334796");
});

test("enum helpers round-trip", () => {
  assert.equal(SpriteMode.Single, "single");
  assert.equal(spriteModeFromString("multiple"), "multiple");
  assert.equal(spriteModeFromString("nope"), undefined);

  assert.equal(ExportFormat.TexturePackerZip, "texturepacker.zip");
  assert.equal(exportFormatFromString("sequence.zip"), "sequence.zip");
  assert.equal(exportFormatFromString("nope"), undefined);
  assert.equal(ALL_EXPORT_FORMATS.length, 8);

  assert.equal(ApiKeyScope.ProjectWrite, "project_write");
  assert.equal(apiKeyScopeFromString("project_read"), "project_read");
  assert.equal(apiKeyScopeFromString("nope"), undefined);

  assert.equal(SpendResetCadence.Monthly, "monthly");
  assert.equal(spendResetCadenceFromString("never"), "never");
  assert.equal(spendResetCadenceFromString("nope"), undefined);
});

test("Download exposes bytes and content type", () => {
  const data = new Uint8Array([1, 2, 3]);
  const download = new Download("image/png", data);
  assert.equal(download.contentType(), "image/png");
  assert.equal(download.len(), 3);
  assert.equal(download.isEmpty(), false);
  assert.deepEqual([...download.bytes()], [1, 2, 3]);
  assert.equal(new Download(undefined, new Uint8Array()).isEmpty(), true);
});

test("ListParams builds query state", () => {
  const params = ListParams.new().withBefore("abc").includeArchived().baseAssetId("id-1");
  assert.equal(params.before, "abc");
  assert.equal(params.include_archived, true);
  assert.equal(params.base_asset_id, "id-1");
  assert.equal(ListParams.new().include_archived, false);
});
