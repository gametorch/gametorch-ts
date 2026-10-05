/** Sprite generation and asset models. */

import {
  asArray,
  asBoolOrInt,
  asDecimal,
  asInt,
  asRecord,
  asString,
  asStringArray,
  asStringListLenient,
  asStringMap,
  asUuid,
  optionalString,
  optionalTimestamp,
  optionalUuid,
} from "../decode.ts";
import type { Decimal, Timestamp } from "../types.ts";
import { type Provenance, decodeProvenance } from "./provenance.ts";

/** A sprite generation and its results. */
export interface Generation {
  id: string;
  project_id: string;
  prompt: string;
  /** Generation mode (`single` or `multiple`). */
  mode: string;
  image_model: string;
  text_model?: string;
  quality?: string;
  resolution?: string;
  /** The asset this generation edited, if any. */
  base_asset_id?: string;
  status: string;
  credits_consumed: Decimal;
  reserved_credits: Decimal;
  assets_delivered: number;
  archived_assets: number;
  warming: boolean;
  error?: string;
  label_suggestions: string[];
  art_style_suggestion?: string;
  created_at: Timestamp;
  completed_at?: Timestamp;
  archived_at?: Timestamp;
  assets: Asset[];
  provenance: Provenance;
}

export function decodeGeneration(raw: unknown): Generation {
  const record = asRecord(raw, "Generation");
  const assets = asArray(record["assets"] ?? [], "Generation.assets");
  return {
    id: asUuid(record["id"], "Generation.id"),
    project_id: asUuid(record["project_id"], "Generation.project_id"),
    prompt: asString(record["prompt"], "Generation.prompt"),
    mode: asString(record["mode"], "Generation.mode"),
    image_model: asString(record["image_model"], "Generation.image_model"),
    text_model: optionalString(record["text_model"]),
    quality: optionalString(record["quality"]),
    resolution: optionalString(record["resolution"]),
    base_asset_id: optionalUuid(record["base_asset_id"]),
    status: asString(record["status"], "Generation.status"),
    credits_consumed: asDecimal(record["credits_consumed"], "Generation.credits_consumed"),
    reserved_credits: asDecimal(record["reserved_credits"], "Generation.reserved_credits"),
    assets_delivered: asBoolOrInt(record["assets_delivered"], "Generation.assets_delivered"),
    archived_assets: record["archived_assets"] === undefined
      ? 0
      : asInt(record["archived_assets"], "Generation.archived_assets"),
    warming: record["warming"] === true,
    error: optionalString(record["error"]),
    label_suggestions: asStringListLenient(
      record["label_suggestions"],
      "Generation.label_suggestions",
    ),
    art_style_suggestion: optionalString(record["art_style_suggestion"]),
    created_at: asString(record["created_at"], "Generation.created_at"),
    completed_at: optionalTimestamp(record["completed_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    assets: assets.map((item) => decodeAsset(item)),
    provenance: decodeProvenance(record),
  };
}

/** Response from `GET /projects/{project_id}/generations`. */
export interface GenerationsResponse {
  generations: Generation[];
  next_cursor: string | null;
  total: number;
}

export function decodeGenerationsResponse(raw: unknown): GenerationsResponse {
  const record = asRecord(raw, "GenerationsResponse");
  const generations = asArray(record["generations"] ?? [], "GenerationsResponse.generations");
  return {
    generations: generations.map((item) => decodeGeneration(item)),
    next_cursor: optionalString(record["next_cursor"]) ?? null,
    total: record["total"] === undefined ? 0 : asInt(record["total"], "GenerationsResponse.total"),
  };
}

/** A sprite asset. */
export interface Asset {
  id: string;
  name?: string;
  width: number;
  height: number;
  labels: string[];
  metadata: Record<string, string>;
  has_original: boolean;
  dismissed_suggestions: string[];
  generation_id?: string;
  project_id?: string;
  prompt?: string;
  created_at?: Timestamp;
  archived_at?: Timestamp;
  provenance: Provenance;
}

export function decodeAsset(raw: unknown): Asset {
  const record = asRecord(raw, "Asset");
  return {
    id: asUuid(record["id"], "Asset.id"),
    name: optionalString(record["name"]),
    width: record["width"] === undefined ? 0 : asInt(record["width"], "Asset.width"),
    height: record["height"] === undefined ? 0 : asInt(record["height"], "Asset.height"),
    labels: asStringArray(record["labels"], "Asset.labels"),
    metadata: asStringMap(record["metadata"], "Asset.metadata"),
    has_original: record["has_original"] === true,
    dismissed_suggestions: asStringListLenient(
      record["dismissed_suggestions"],
      "Asset.dismissed_suggestions",
    ),
    generation_id: optionalUuid(record["generation_id"]),
    project_id: optionalUuid(record["project_id"]),
    prompt: optionalString(record["prompt"]),
    created_at: optionalTimestamp(record["created_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    provenance: decodeProvenance(record),
  };
}

/** Response from `GET /projects/{project_id}/sprite-assets`. */
export interface SpriteAssetsResponse {
  assets: Asset[];
}

export function decodeSpriteAssetsResponse(raw: unknown): SpriteAssetsResponse {
  const record = asRecord(raw, "SpriteAssetsResponse");
  const assets = asArray(record["assets"] ?? [], "SpriteAssetsResponse.assets");
  return { assets: assets.map((item) => decodeAsset(item)) };
}
