/** Catalog models: available sprite, sound and animation models. */

import {
  asArray,
  asBoolean,
  asInt,
  asRecord,
  asString,
  asStringArray,
  optionalDecimal,
  optionalString,
} from "../decode.ts";
import type { Decimal } from "../types.ts";

/** Layout metadata for sprite `multiple` mode. */
export interface MultipleLayout {
  columns: number;
  images_per_request: number;
  rows: number;
}

function decodeMultipleLayout(raw: unknown): MultipleLayout {
  const record = asRecord(raw, "MultipleLayout");
  return {
    columns: asInt(record["columns"], "MultipleLayout.columns"),
    images_per_request: asInt(record["images_per_request"], "MultipleLayout.images_per_request"),
    rows: asInt(record["rows"], "MultipleLayout.rows"),
  };
}

/** An image model available for sprite generation. */
export interface ImageModel {
  available: boolean;
  blurb: string;
  capabilities_url?: string;
  default_canvas_size?: string;
  default_quality?: string;
  default_resolution?: string;
  editing: boolean;
  /** Model identifier to pass as `image_model`. */
  id: string;
  name: string;
  native_transparency: boolean;
  qualities: string[];
  reservation_credits?: Decimal;
  resolutions: string[];
  transparency_status?: string;
  unavailable_reason?: string;
}

function decodeImageModel(raw: unknown): ImageModel {
  const record = asRecord(raw, "ImageModel");
  return {
    available: asBoolean(record["available"], "ImageModel.available"),
    blurb: asString(record["blurb"] ?? "", "ImageModel.blurb"),
    capabilities_url: optionalString(record["capabilities_url"]),
    default_canvas_size: optionalString(record["default_canvas_size"]),
    default_quality: optionalString(record["default_quality"]),
    default_resolution: optionalString(record["default_resolution"]),
    editing: asBoolean(record["editing"], "ImageModel.editing"),
    id: asString(record["id"], "ImageModel.id"),
    name: asString(record["name"], "ImageModel.name"),
    native_transparency: asBoolean(
      record["native_transparency"],
      "ImageModel.native_transparency",
    ),
    qualities: asStringArray(record["qualities"], "ImageModel.qualities"),
    reservation_credits: optionalDecimal(record["reservation_credits"]),
    resolutions: asStringArray(record["resolutions"], "ImageModel.resolutions"),
    transparency_status: optionalString(record["transparency_status"]),
    unavailable_reason: optionalString(record["unavailable_reason"]),
  };
}

/** A prompt-enhancement text model. */
export interface TextModel {
  /** Model identifier to pass as `text_model`. */
  id: string;
  name: string;
}

function decodeTextModel(raw: unknown): TextModel {
  const record = asRecord(raw, "TextModel");
  return {
    id: asString(record["id"], "TextModel.id"),
    name: asString(record["name"], "TextModel.name"),
  };
}

/** Response from `GET /sprite-models`. */
export interface SpriteModels {
  default_text_model: string;
  empirical_evidence?: string;
  image_models: ImageModel[];
  modes: string[];
  multiple_layout: MultipleLayout;
  reservation_credits?: Decimal;
  resolution_note?: string;
  resolution_scope?: string;
  text_models: TextModel[];
  verified_at?: string;
}

export function decodeSpriteModels(raw: unknown): SpriteModels {
  const record = asRecord(raw, "SpriteModels");
  const imageModels = asArray(record["image_models"] ?? [], "SpriteModels.image_models");
  const textModels = asArray(record["text_models"] ?? [], "SpriteModels.text_models");
  return {
    default_text_model: asString(record["default_text_model"], "SpriteModels.default_text_model"),
    empirical_evidence: optionalString(record["empirical_evidence"]),
    image_models: imageModels.map((item) => decodeImageModel(item)),
    modes: asStringArray(record["modes"], "SpriteModels.modes"),
    multiple_layout: decodeMultipleLayout(record["multiple_layout"]),
    reservation_credits: optionalDecimal(record["reservation_credits"]),
    resolution_note: optionalString(record["resolution_note"]),
    resolution_scope: optionalString(record["resolution_scope"]),
    text_models: textModels.map((item) => decodeTextModel(item)),
    verified_at: optionalString(record["verified_at"]),
  };
}

/** A sound generation model. */
export interface SoundModelInfo {
  blurb: string;
  /** Model identifier to pass as `sound_model`. */
  id: string;
  name: string;
}

function decodeSoundModelInfo(raw: unknown): SoundModelInfo {
  const record = asRecord(raw, "SoundModelInfo");
  return {
    blurb: asString(record["blurb"] ?? "", "SoundModelInfo.blurb"),
    id: asString(record["id"], "SoundModelInfo.id"),
    name: asString(record["name"], "SoundModelInfo.name"),
  };
}

/** Response from `GET /sound-models`. */
export interface SoundModels {
  default_format: string;
  formats: string[];
  model: SoundModelInfo;
}

export function decodeSoundModels(raw: unknown): SoundModels {
  const record = asRecord(raw, "SoundModels");
  return {
    default_format: asString(record["default_format"], "SoundModels.default_format"),
    formats: asStringArray(record["formats"], "SoundModels.formats"),
    model: decodeSoundModelInfo(record["model"]),
  };
}

/** An animation model addressed by its public name (`ash`, `birch`, `cedar`). */
export interface AnimationModelInfo {
  description: string;
  /** Public model name to pass as `animation_model`. */
  id: string;
  name: string;
  supported_durations: number[];
  supported_resolutions: string[];
}

function decodeAnimationModelInfo(raw: unknown): AnimationModelInfo {
  const record = asRecord(raw, "AnimationModelInfo");
  const durations = asArray(
    record["supported_durations"] ?? [],
    "AnimationModelInfo.supported_durations",
  );
  return {
    description: asString(record["description"] ?? "", "AnimationModelInfo.description"),
    id: asString(record["id"], "AnimationModelInfo.id"),
    name: asString(record["name"], "AnimationModelInfo.name"),
    supported_durations: durations.map((item, index) =>
      asInt(item, `AnimationModelInfo.supported_durations[${index}]`),
    ),
    supported_resolutions: asStringArray(
      record["supported_resolutions"],
      "AnimationModelInfo.supported_resolutions",
    ),
  };
}

/** Response from `GET /animation-models`. */
export interface AnimationModels {
  data: AnimationModelInfo[];
}

export function decodeAnimationModels(raw: unknown): AnimationModels {
  const record = asRecord(raw, "AnimationModels");
  const data = asArray(record["data"] ?? [], "AnimationModels.data");
  return { data: data.map((item) => decodeAnimationModelInfo(item)) };
}
