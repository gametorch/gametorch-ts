/** Sound generation and asset models. */

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
} from "../decode.ts";
import type { Decimal, Timestamp } from "../types.ts";
import { type Provenance, decodeProvenance } from "./provenance.ts";

/** A sound asset. */
export interface SoundAsset {
  id: string;
  /** Audio format, for example `mp3`. */
  format: string;
  name?: string;
  labels: string[];
  metadata: Record<string, string>;
  dismissed_suggestions: string[];
  created_at?: Timestamp;
  archived_at?: Timestamp;
  provenance: Provenance;
}

export function decodeSoundAsset(raw: unknown): SoundAsset {
  const record = asRecord(raw, "SoundAsset");
  return {
    id: asUuid(record["id"], "SoundAsset.id"),
    format: asString(record["format"] ?? "", "SoundAsset.format"),
    name: optionalString(record["name"]),
    labels: asStringArray(record["labels"], "SoundAsset.labels"),
    metadata: asStringMap(record["metadata"], "SoundAsset.metadata"),
    dismissed_suggestions: asStringListLenient(
      record["dismissed_suggestions"],
      "SoundAsset.dismissed_suggestions",
    ),
    created_at: optionalTimestamp(record["created_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    provenance: decodeProvenance(record),
  };
}

/** A sound generation and its results. */
export interface SoundGeneration {
  id: string;
  project_id: string;
  prompt: string;
  sound_model: string;
  response_format?: string;
  status: string;
  credits_consumed: Decimal;
  reserved_credits: Decimal;
  assets_delivered: number;
  archived_assets: number;
  error?: string;
  label_suggestions: string[];
  created_at: Timestamp;
  completed_at?: Timestamp;
  archived_at?: Timestamp;
  assets: SoundAsset[];
  provenance: Provenance;
}

export function decodeSoundGeneration(raw: unknown): SoundGeneration {
  const record = asRecord(raw, "SoundGeneration");
  const assets = asArray(record["assets"] ?? [], "SoundGeneration.assets");
  return {
    id: asUuid(record["id"], "SoundGeneration.id"),
    project_id: asUuid(record["project_id"], "SoundGeneration.project_id"),
    prompt: asString(record["prompt"], "SoundGeneration.prompt"),
    sound_model: asString(record["sound_model"], "SoundGeneration.sound_model"),
    response_format: optionalString(record["response_format"]),
    status: asString(record["status"], "SoundGeneration.status"),
    credits_consumed: asDecimal(record["credits_consumed"], "SoundGeneration.credits_consumed"),
    reserved_credits: asDecimal(record["reserved_credits"], "SoundGeneration.reserved_credits"),
    assets_delivered: asBoolOrInt(
      record["assets_delivered"],
      "SoundGeneration.assets_delivered",
    ),
    archived_assets: record["archived_assets"] === undefined
      ? 0
      : asInt(record["archived_assets"], "SoundGeneration.archived_assets"),
    error: optionalString(record["error"]),
    label_suggestions: asStringListLenient(
      record["label_suggestions"],
      "SoundGeneration.label_suggestions",
    ),
    created_at: asString(record["created_at"], "SoundGeneration.created_at"),
    completed_at: optionalTimestamp(record["completed_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    assets: assets.map((item) => decodeSoundAsset(item)),
    provenance: decodeProvenance(record),
  };
}

/** Response from `GET /projects/{project_id}/sound-generations`. */
export interface SoundGenerationsResponse {
  sound_generations: SoundGeneration[];
  next_cursor: string | null;
  total: number;
}

export function decodeSoundGenerationsResponse(raw: unknown): SoundGenerationsResponse {
  const record = asRecord(raw, "SoundGenerationsResponse");
  const generations = asArray(
    record["sound_generations"] ?? [],
    "SoundGenerationsResponse.sound_generations",
  );
  return {
    sound_generations: generations.map((item) => decodeSoundGeneration(item)),
    next_cursor: optionalString(record["next_cursor"]) ?? null,
    total: record["total"] === undefined
      ? 0
      : asInt(record["total"], "SoundGenerationsResponse.total"),
  };
}
