/** Label models. */

import {
  asArray,
  asBoolean,
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
import { type Provenance, decodeProvenance } from "./provenance.ts";

/** A project label. */
export interface Label {
  id: string;
  name: string;
  /** Hex color, for example `#ca8a04`. */
  color?: string;
  /** The asset used as the label's cover thumbnail, if any. */
  thumbnail_asset_id?: string;
  created_at: Timestamp;
}

export function decodeLabel(raw: unknown): Label {
  const record = asRecord(raw, "Label");
  return {
    id: asUuid(record["id"], "Label.id"),
    name: asString(record["name"], "Label.name"),
    color: optionalString(record["color"]),
    thumbnail_asset_id: optionalUuid(record["thumbnail_asset_id"]),
    created_at: asString(record["created_at"], "Label.created_at"),
  };
}

/** Response from `GET /projects/{project_id}/labels`. */
export interface LabelsResponse {
  labels: Label[];
}

export function decodeLabelsResponse(raw: unknown): LabelsResponse {
  const record = asRecord(raw, "LabelsResponse");
  const labels = asArray(record["labels"] ?? [], "LabelsResponse.labels");
  return { labels: labels.map((item) => decodeLabel(item)) };
}

/** The label-name set returned by a label mutation. */
export interface LabelAssociation {
  ok: boolean;
  labels: string[];
}

export function decodeLabelAssociation(raw: unknown): LabelAssociation {
  const record = asRecord(raw, "LabelAssociation");
  return {
    ok: asBoolean(record["ok"], "LabelAssociation.ok"),
    labels: asStringArray(record["labels"], "LabelAssociation.labels"),
  };
}

/** A sprite asset as returned by the label-items endpoint. */
export interface LabelAsset {
  id: string;
  width: number;
  height: number;
  name?: string;
  labels: string[];
  metadata: Record<string, string>;
  has_original: boolean;
  generation_id?: string;
  prompt?: string;
  created_at?: Timestamp;
  archived_at?: Timestamp;
  provenance: Provenance;
}

function decodeLabelAsset(raw: unknown): LabelAsset {
  const record = asRecord(raw, "LabelAsset");
  return {
    id: asUuid(record["id"], "LabelAsset.id"),
    width: asInt(record["width"] ?? 0, "LabelAsset.width"),
    height: asInt(record["height"] ?? 0, "LabelAsset.height"),
    name: optionalString(record["name"]),
    labels: asStringArray(record["labels"], "LabelAsset.labels"),
    metadata: asStringMap(record["metadata"], "LabelAsset.metadata"),
    has_original: record["has_original"] === true,
    generation_id: optionalUuid(record["generation_id"]),
    prompt: optionalString(record["prompt"]),
    created_at: optionalTimestamp(record["created_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    provenance: decodeProvenance(record),
  };
}

/** A sound asset as returned by the label-items endpoint. */
export interface LabelSound {
  id: string;
  format: string;
  name?: string;
  labels: string[];
  metadata: Record<string, string>;
  generation_id?: string;
  prompt?: string;
  created_at?: Timestamp;
  archived_at?: Timestamp;
  provenance: Provenance;
}

function decodeLabelSound(raw: unknown): LabelSound {
  const record = asRecord(raw, "LabelSound");
  return {
    id: asUuid(record["id"], "LabelSound.id"),
    format: asString(record["format"] ?? "", "LabelSound.format"),
    name: optionalString(record["name"]),
    labels: asStringArray(record["labels"], "LabelSound.labels"),
    metadata: asStringMap(record["metadata"], "LabelSound.metadata"),
    generation_id: optionalUuid(record["generation_id"]),
    prompt: optionalString(record["prompt"]),
    created_at: optionalTimestamp(record["created_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    provenance: decodeProvenance(record),
  };
}

/** A saved animation as returned by the label-items endpoint. */
export interface LabelSavedAnimation {
  id: string;
  project_id: string;
  generation_id: string;
  start_frame: number;
  end_frame: number;
  name?: string;
  animation_model?: string;
  prompt?: string;
  base_asset_id?: string;
  frame_count: number;
  labels: string[];
  metadata: Record<string, string>;
  created_at?: Timestamp;
  archived_at?: Timestamp;
  provenance: Provenance;
}

function decodeLabelSavedAnimation(raw: unknown): LabelSavedAnimation {
  const record = asRecord(raw, "LabelSavedAnimation");
  return {
    id: asUuid(record["id"], "LabelSavedAnimation.id"),
    project_id: asUuid(record["project_id"], "LabelSavedAnimation.project_id"),
    generation_id: asUuid(record["generation_id"], "LabelSavedAnimation.generation_id"),
    start_frame: asInt(record["start_frame"], "LabelSavedAnimation.start_frame"),
    end_frame: asInt(record["end_frame"], "LabelSavedAnimation.end_frame"),
    name: optionalString(record["name"]),
    animation_model: optionalString(record["animation_model"]),
    prompt: optionalString(record["prompt"]),
    base_asset_id: optionalUuid(record["base_asset_id"]),
    frame_count: asInt(record["frame_count"] ?? 0, "LabelSavedAnimation.frame_count"),
    labels: asStringArray(record["labels"], "LabelSavedAnimation.labels"),
    metadata: asStringMap(record["metadata"], "LabelSavedAnimation.metadata"),
    created_at: optionalTimestamp(record["created_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    provenance: decodeProvenance(record),
  };
}

/** Response from `GET /labels/{label_id}/items`. */
export interface LabelItems {
  label: Label;
  assets: LabelAsset[];
  sounds: LabelSound[];
  saved_animations: LabelSavedAnimation[];
}

export function decodeLabelItems(raw: unknown): LabelItems {
  const record = asRecord(raw, "LabelItems");
  const assets = asArray(record["assets"] ?? [], "LabelItems.assets");
  const sounds = asArray(record["sounds"] ?? [], "LabelItems.sounds");
  const saved = asArray(record["saved_animations"] ?? [], "LabelItems.saved_animations");
  return {
    label: decodeLabel(record["label"]),
    assets: assets.map((item) => decodeLabelAsset(item)),
    sounds: sounds.map((item) => decodeLabelSound(item)),
    saved_animations: saved.map((item) => decodeLabelSavedAnimation(item)),
  };
}
