/** Saved animation models. */

import {
  asArray,
  asInt,
  asRecord,
  asString,
  asStringArray,
  asStringMap,
  asUuid,
  optionalString,
  optionalTimestamp,
  optionalUuid,
} from "../decode.ts";
import type { Timestamp } from "../types.ts";

/**
 * A named frame range taken from an animation run, reusable as a preset.
 */
export interface SavedAnimation {
  id: string;
  project_id: string;
  generation_id: string;
  name?: string;
  animation_model?: string;
  prompt?: string;
  base_asset_id?: string;
  start_frame: number;
  end_frame: number;
  frame_count: number;
  labels: string[];
  metadata: Record<string, string>;
  created_at: Timestamp;
  archived_at?: Timestamp;
}

export function decodeSavedAnimation(raw: unknown): SavedAnimation {
  const record = asRecord(raw, "SavedAnimation");
  return {
    id: asUuid(record["id"], "SavedAnimation.id"),
    project_id: asUuid(record["project_id"], "SavedAnimation.project_id"),
    generation_id: asUuid(record["generation_id"], "SavedAnimation.generation_id"),
    name: optionalString(record["name"]),
    animation_model: optionalString(record["animation_model"]),
    prompt: optionalString(record["prompt"]),
    base_asset_id: optionalUuid(record["base_asset_id"]),
    start_frame: asInt(record["start_frame"], "SavedAnimation.start_frame"),
    end_frame: asInt(record["end_frame"], "SavedAnimation.end_frame"),
    frame_count: record["frame_count"] === undefined
      ? 0
      : asInt(record["frame_count"], "SavedAnimation.frame_count"),
    labels: asStringArray(record["labels"], "SavedAnimation.labels"),
    metadata: asStringMap(record["metadata"], "SavedAnimation.metadata"),
    created_at: asString(record["created_at"], "SavedAnimation.created_at"),
    archived_at: optionalTimestamp(record["archived_at"]),
  };
}

/** Response from `GET /projects/{project_id}/saved-animations`. */
export interface SavedAnimationsResponse {
  saved_animations: SavedAnimation[];
  next_cursor: string | null;
  total: number;
}

export function decodeSavedAnimationsResponse(raw: unknown): SavedAnimationsResponse {
  const record = asRecord(raw, "SavedAnimationsResponse");
  const saved = asArray(
    record["saved_animations"] ?? [],
    "SavedAnimationsResponse.saved_animations",
  );
  return {
    saved_animations: saved.map((item) => decodeSavedAnimation(item)),
    next_cursor: optionalString(record["next_cursor"]) ?? null,
    total: record["total"] === undefined
      ? 0
      : asInt(record["total"], "SavedAnimationsResponse.total"),
  };
}
