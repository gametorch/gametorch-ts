/** Animation run, frame and export models. */

import {
  asArray,
  asBoolOrInt,
  asDecimal,
  asInt,
  asNumber,
  asRecord,
  asString,
  asUuid,
  optionalInt,
  optionalString,
  optionalTimestamp,
  optionalUuid,
} from "../decode.ts";
import type { Decimal, Download, Timestamp } from "../types.ts";
import { type Provenance, decodeProvenance } from "./provenance.ts";

/** Metadata about the underlying animation clip. */
export interface AnimationAsset {
  id: string;
  duration_seconds: number;
  resolution: string;
  created_at: Timestamp;
}

function decodeAnimationAsset(raw: unknown): AnimationAsset {
  const record = asRecord(raw, "AnimationAsset");
  return {
    id: asUuid(record["id"], "AnimationAsset.id"),
    duration_seconds: record["duration_seconds"] === undefined
      ? 0
      : asInt(record["duration_seconds"], "AnimationAsset.duration_seconds"),
    resolution: asString(record["resolution"] ?? "", "AnimationAsset.resolution"),
    created_at: asString(record["created_at"], "AnimationAsset.created_at"),
  };
}

/** A frame-generation run that sampled an animation into PNG frames. */
export interface FrameRun {
  id: string;
  status: string;
  fps: number;
  frame_count: number;
  /** True once this frame run hit a cold start on an internal model. */
  warming: boolean;
  credits_consumed: Decimal;
  reserved_credits: Decimal;
  error?: string;
  created_at: Timestamp;
}

function decodeFrameRun(raw: unknown): FrameRun {
  const record = asRecord(raw, "FrameRun");
  return {
    id: asUuid(record["id"], "FrameRun.id"),
    status: asString(record["status"], "FrameRun.status"),
    fps: record["fps"] === undefined ? 0 : asInt(record["fps"], "FrameRun.fps"),
    frame_count: record["frame_count"] === undefined
      ? 0
      : asInt(record["frame_count"], "FrameRun.frame_count"),
    warming: record["warming"] === true,
    credits_consumed: asDecimal(record["credits_consumed"], "FrameRun.credits_consumed"),
    reserved_credits: asDecimal(record["reserved_credits"], "FrameRun.reserved_credits"),
    error: optionalString(record["error"]),
    created_at: asString(record["created_at"], "FrameRun.created_at"),
  };
}

/** An individual generated animation frame. */
export interface AnimationFrame {
  id: string;
  /** 1-based frame number. */
  frame_number: number;
  generation_id?: string;
  created_at: Timestamp;
}

function decodeAnimationFrame(raw: unknown): AnimationFrame {
  const record = asRecord(raw, "AnimationFrame");
  return {
    id: asUuid(record["id"], "AnimationFrame.id"),
    frame_number: asInt(record["frame_number"], "AnimationFrame.frame_number"),
    generation_id: optionalUuid(record["generation_id"]),
    created_at: asString(record["created_at"], "AnimationFrame.created_at"),
  };
}

/** An animation run and its results. */
export interface AnimationRun {
  id: string;
  project_id: string;
  prompt: string;
  animation_model?: string;
  duration?: number;
  animation?: AnimationAsset;
  status: string;
  credits_consumed: Decimal;
  reserved_credits: Decimal;
  assets_delivered: number;
  /** The sprite asset this run was animated from (`undefined` when generated from scratch). */
  base_asset_id?: string;
  error?: string;
  created_at: Timestamp;
  completed_at?: Timestamp;
  archived_at?: Timestamp;
  frame_runs: FrameRun[];
  frames: AnimationFrame[];
  provenance: Provenance;
}

export function decodeAnimationRun(raw: unknown): AnimationRun {
  const record = asRecord(raw, "AnimationRun");
  const frameRuns = asArray(record["frame_runs"] ?? [], "AnimationRun.frame_runs");
  const frames = asArray(record["frames"] ?? [], "AnimationRun.frames");
  return {
    id: asUuid(record["id"], "AnimationRun.id"),
    project_id: asUuid(record["project_id"], "AnimationRun.project_id"),
    prompt: asString(record["prompt"], "AnimationRun.prompt"),
    animation_model: optionalString(record["animation_model"]),
    duration: optionalInt(record["duration"]),
    animation: record["animation"] === null || record["animation"] === undefined
      ? undefined
      : decodeAnimationAsset(record["animation"]),
    status: asString(record["status"], "AnimationRun.status"),
    credits_consumed: asDecimal(record["credits_consumed"], "AnimationRun.credits_consumed"),
    reserved_credits: asDecimal(record["reserved_credits"], "AnimationRun.reserved_credits"),
    assets_delivered: asBoolOrInt(record["assets_delivered"], "AnimationRun.assets_delivered"),
    base_asset_id: optionalUuid(record["base_asset_id"]),
    error: optionalString(record["error"]),
    created_at: asString(record["created_at"], "AnimationRun.created_at"),
    completed_at: optionalTimestamp(record["completed_at"]),
    archived_at: optionalTimestamp(record["archived_at"]),
    frame_runs: frameRuns.map((item) => decodeFrameRun(item)),
    frames: frames.map((item) => decodeAnimationFrame(item)),
    provenance: decodeProvenance(record),
  };
}

/** Response from `GET /projects/{project_id}/animation-runs`. */
export interface AnimationsResponse {
  animations: AnimationRun[];
  next_cursor: string | null;
  total: number;
}

export function decodeAnimationsResponse(raw: unknown): AnimationsResponse {
  const record = asRecord(raw, "AnimationsResponse");
  const animations = asArray(record["animations"] ?? [], "AnimationsResponse.animations");
  return {
    animations: animations.map((item) => decodeAnimationRun(item)),
    next_cursor: optionalString(record["next_cursor"]) ?? null,
    total: record["total"] === undefined ? 0 : asInt(record["total"], "AnimationsResponse.total"),
  };
}

/** Response from `POST /projects/{project_id}/animation-runs/estimate`. */
export interface AnimationEstimate {
  animation_model: string;
  duration: number;
  resolution: string;
  credits: Decimal;
  usd: Decimal;
  reserved_credits: Decimal;
}

export function decodeAnimationEstimate(raw: unknown): AnimationEstimate {
  const record = asRecord(raw, "AnimationEstimate");
  return {
    animation_model: asString(record["animation_model"], "AnimationEstimate.animation_model"),
    duration: record["duration"] === undefined
      ? 0
      : asInt(record["duration"], "AnimationEstimate.duration"),
    resolution: asString(record["resolution"] ?? "", "AnimationEstimate.resolution"),
    credits: asDecimal(record["credits"], "AnimationEstimate.credits"),
    usd: asDecimal(record["usd"], "AnimationEstimate.usd"),
    reserved_credits: asDecimal(
      record["reserved_credits"],
      "AnimationEstimate.reserved_credits",
    ),
  };
}

/** The reference frame used to size an export canvas. */
export interface ExportReference {
  bounds: number[];
  image_width: number;
  image_height: number;
}

function decodeExportReference(raw: unknown): ExportReference {
  const record = asRecord(raw, "ExportReference");
  return {
    bounds: asArray(record["bounds"] ?? [], "ExportReference.bounds").map((item, index) =>
      asInt(item, `ExportReference.bounds[${index}]`),
    ),
    image_width: asInt(record["image_width"], "ExportReference.image_width"),
    image_height: asInt(record["image_height"], "ExportReference.image_height"),
  };
}

/** Layout information for a single exported frame. */
export interface ExportFrame {
  frame_number: number;
  bounds?: number[];
  image_width: number;
  image_height: number;
  offset_x?: number;
  offset_y?: number;
  scaled_width?: number;
  scaled_height?: number;
}

function decodeExportFrame(raw: unknown): ExportFrame {
  const record = asRecord(raw, "ExportFrame");
  return {
    frame_number: asInt(record["frame_number"], "ExportFrame.frame_number"),
    bounds:
      record["bounds"] === null || record["bounds"] === undefined
        ? undefined
        : asArray(record["bounds"], "ExportFrame.bounds").map((item, index) =>
            asInt(item, `ExportFrame.bounds[${index}]`),
          ),
    image_width: asInt(record["image_width"], "ExportFrame.image_width"),
    image_height: asInt(record["image_height"], "ExportFrame.image_height"),
    offset_x: optionalInt(record["offset_x"]),
    offset_y: optionalInt(record["offset_y"]),
    scaled_width: optionalInt(record["scaled_width"]),
    scaled_height: optionalInt(record["scaled_height"]),
  };
}

/** Response from `POST /animation-runs/{id}/export-plan`. */
export interface ExportPlan {
  start_frame: number;
  end_frame: number;
  reference?: ExportReference;
  first_frame?: ExportFrame;
  frames: ExportFrame[];
  max_width: number;
  max_height: number;
  scale: number;
  scale_width: number;
  scale_height: number;
  canvas_width: number;
  canvas_height: number;
  frame_count: number;
}

export function decodeExportPlan(raw: unknown): ExportPlan {
  const record = asRecord(raw, "ExportPlan");
  const frames = asArray(record["frames"] ?? [], "ExportPlan.frames");
  return {
    start_frame: asInt(record["start_frame"], "ExportPlan.start_frame"),
    end_frame: asInt(record["end_frame"], "ExportPlan.end_frame"),
    reference: record["reference"] === null || record["reference"] === undefined
      ? undefined
      : decodeExportReference(record["reference"]),
    first_frame: record["first_frame"] === null || record["first_frame"] === undefined
      ? undefined
      : decodeExportFrame(record["first_frame"]),
    frames: frames.map((item) => decodeExportFrame(item)),
    max_width: asInt(record["max_width"], "ExportPlan.max_width"),
    max_height: asInt(record["max_height"], "ExportPlan.max_height"),
    scale: asNumber(record["scale"], "ExportPlan.scale"),
    scale_width: asNumber(record["scale_width"], "ExportPlan.scale_width"),
    scale_height: asNumber(record["scale_height"], "ExportPlan.scale_height"),
    canvas_width: asInt(record["canvas_width"], "ExportPlan.canvas_width"),
    canvas_height: asInt(record["canvas_height"], "ExportPlan.canvas_height"),
    frame_count: asInt(record["frame_count"], "ExportPlan.frame_count"),
  };
}

/** The JSON body returned by `POST /animation-runs/{id}/export/texturepacker`. */
export interface TexturePackerExport {
  plan: ExportPlan;
  /** The TexturePacker "JSON Hash" document. */
  texturepacker: unknown;
  image_base64: string;
  image_filename: string;
  json_filename: string;
}

export function decodeTexturePackerExport(raw: unknown): TexturePackerExport {
  const record = asRecord(raw, "TexturePackerExport");
  return {
    plan: decodeExportPlan(record["plan"]),
    texturepacker: record["texturepacker"],
    image_base64: asString(record["image_base64"], "TexturePackerExport.image_base64"),
    image_filename: asString(record["image_filename"], "TexturePackerExport.image_filename"),
    json_filename: asString(record["json_filename"], "TexturePackerExport.json_filename"),
  };
}

/** The JSON body returned by `POST /animation-runs/{id}/export/godot`. */
export interface GodotExport {
  plan: ExportPlan;
  tres: string;
  image_base64: string;
  image_filename: string;
  tres_filename: string;
}

export function decodeGodotExport(raw: unknown): GodotExport {
  const record = asRecord(raw, "GodotExport");
  return {
    plan: decodeExportPlan(record["plan"]),
    tres: asString(record["tres"], "GodotExport.tres"),
    image_base64: asString(record["image_base64"], "GodotExport.image_base64"),
    image_filename: asString(record["image_filename"], "GodotExport.image_filename"),
    tres_filename: asString(record["tres_filename"], "GodotExport.tres_filename"),
  };
}

/** The result of `Client.export`, which varies by format. */
export type Export =
  | { kind: "texturepacker"; value: TexturePackerExport }
  | { kind: "godot"; value: GodotExport }
  | { kind: "binary"; value: Download };

export function isBinaryExport(value: Export): value is { kind: "binary"; value: Download } {
  return value.kind === "binary";
}

/** Returns the binary payload, if this is a binary export. */
export function exportAsBinary(value: Export): Download | undefined {
  return value.kind === "binary" ? value.value : undefined;
}
