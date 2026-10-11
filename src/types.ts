/**
 * Shared types used across the SDK: pagination, request parameters, downloads
 * and the common acknowledgement/creation envelopes.
 */

import {
  asBoolean,
  asDecimal,
  asRecord,
  asString,
  asStringMap,
  asUuid,
  optionalString,
  optionalTimestamp,
} from "./decode.ts";

/**
 * A decimal amount represented exactly as a string.
 *
 * GameTorch encodes credit and USD amounts as decimal strings
 * (`"5.003952358800"`), occasionally as JSON numbers (`300`). Keeping them as
 * strings avoids floating-point drift; use {@link creditsToUsd} for exact
 * credit-to-dollar conversion.
 */
export type Decimal = string;

/** An ISO-8601 timestamp string, as returned by the API. */
export type Timestamp = string;

/** A generic acknowledgement response (`{"ok": true}`). */
export interface OkResponse {
  ok: boolean;
}

export function decodeOkResponse(raw: unknown): OkResponse {
  const record = asRecord(raw, "OkResponse");
  return { ok: asBoolean(record["ok"], "OkResponse.ok") };
}

/** Response returned by archive/unarchive endpoints. */
export interface ArchiveResponse {
  ok: boolean;
  archived_at?: Timestamp;
}

export function decodeArchiveResponse(raw: unknown): ArchiveResponse {
  const record = asRecord(raw, "ArchiveResponse");
  return {
    ok: asBoolean(record["ok"], "ArchiveResponse.ok"),
    archived_at: optionalTimestamp(record["archived_at"]),
  };
}

/** Response returned by asset rename endpoints. */
export interface AssetNameResponse {
  ok: boolean;
  name?: string;
}

export function decodeAssetNameResponse(raw: unknown): AssetNameResponse {
  const record = asRecord(raw, "AssetNameResponse");
  return {
    ok: asBoolean(record["ok"], "AssetNameResponse.ok"),
    name: optionalString(record["name"]),
  };
}

/** Response returned by the metadata endpoints. */
export interface AssetMetadataResponse {
  ok: boolean;
  /** The full metadata map after the change (merged, not just the request). */
  metadata: Record<string, string>;
}

export function decodeAssetMetadataResponse(raw: unknown): AssetMetadataResponse {
  const record = asRecord(raw, "AssetMetadataResponse");
  return {
    ok: asBoolean(record["ok"], "AssetMetadataResponse.ok"),
    metadata: asStringMap(record["metadata"], "AssetMetadataResponse.metadata"),
  };
}

/**
 * Keys to delete from an asset's metadata. Either a plain list of keys, or an
 * object that also accepts the `remove_keys` wire alias.
 */
export type MetadataRemovals =
  | readonly string[]
  | {
      /** Keys to delete (max 10). */
      remove?: readonly string[];
      /** Alias for `remove`; merged with it. */
      remove_keys?: readonly string[];
    };

/**
 * Request body for the `PUT .../metadata` endpoints (OpenAPI
 * `PutMetadataRequest` / `PutSoundMetadataRequest` /
 * `PutSavedAnimationMetadataRequest`).
 *
 * Metadata is merged (upserted): the keys you send are added or overwritten and
 * any key you omit is kept. Passing `metadata` never clears anything; `remove`
 * is the only way to delete keys.
 */
export interface PutMetadataRequest {
  /** Keys to add or overwrite (keys 1–1024 chars, string values 0–1024 chars, max 10 pairs). */
  metadata?: Record<string, string>;
  /** Keys to delete (max 10). */
  remove?: readonly string[];
  /** Alias for {@link PutMetadataRequest.remove}; merged with it. */
  remove_keys?: readonly string[];
}

/** OpenAPI schema alias for {@link PutMetadataRequest}. */
export type PutSoundMetadataRequest = PutMetadataRequest;

/** OpenAPI schema alias for {@link PutMetadataRequest}. */
export type PutSavedAnimationMetadataRequest = PutMetadataRequest;

/**
 * A job-creation envelope returned by generation and frame-generation endpoints
 * (the OpenAPI `Reservation` schema).
 */
export interface JobCreated {
  id: string;
  status: string;
  created: boolean;
  reserved_credits: Decimal;
}

export function decodeJobCreated(raw: unknown): JobCreated {
  const record = asRecord(raw, "JobCreated");
  return {
    id: asUuid(record["id"], "JobCreated.id"),
    status: asString(record["status"], "JobCreated.status"),
    created: asBoolean(record["created"], "JobCreated.created"),
    reserved_credits: asDecimal(record["reserved_credits"], "JobCreated.reserved_credits"),
  };
}

/** Raw bytes returned by a content endpoint, along with the response's type. */
export class Download {
  /** The `Content-Type` reported by the server, if any. */
  readonly content_type: string | undefined;
  /** The response body. */
  readonly data: Uint8Array;

  constructor(content_type: string | undefined, data: Uint8Array) {
    this.content_type = content_type;
    this.data = data;
  }

  /** The content type reported by the server, if any. */
  contentType(): string | undefined {
    return this.content_type;
  }

  /** The raw response bytes. */
  bytes(): Uint8Array {
    return this.data;
  }

  /** The raw response bytes. */
  asBytes(): Uint8Array {
    return this.data;
  }

  /** Returns the raw bytes. */
  intoBytes(): Uint8Array {
    return this.data;
  }

  /** The length of the body in bytes. */
  len(): number {
    return this.data.byteLength;
  }

  /** Whether the body is empty. */
  isEmpty(): boolean {
    return this.data.byteLength === 0;
  }

  /** Copy the body into a new `ArrayBuffer`. */
  toArrayBuffer(): ArrayBuffer {
    return this.data.slice().buffer;
  }
}

/** One page of a paginated list response. */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  total: number;
}

/**
 * Options shared by the paginated list endpoints.
 *
 * ```ts
 * ListParams.new().includeArchived(true).baseAssetId(spriteId)
 * ```
 */
export class ListParams {
  before: string | undefined;
  include_archived: boolean;
  base_asset_id: string | undefined;

  constructor(init: Partial<ListParams> = {}) {
    this.before = init.before;
    this.include_archived = init.include_archived ?? false;
    this.base_asset_id = init.base_asset_id;
  }

  /** Creates empty list parameters. */
  static new(): ListParams {
    return new ListParams();
  }

  /** Sets the pagination cursor. */
  withBefore(cursor: string): this {
    this.before = cursor;
    return this;
  }

  /** Includes or excludes archived items. */
  includeArchived(include = true): this {
    this.include_archived = include;
    return this;
  }

  /** Filters animation runs by their base sprite asset id. */
  baseAssetId(baseAssetId: string): this {
    this.base_asset_id = baseAssetId;
    return this;
  }
}

/** Sprite generation mode. */
export type SpriteMode = "single" | "multiple";
export const SpriteMode = {
  Single: "single",
  Multiple: "multiple",
} as const satisfies Record<string, SpriteMode>;

export function spriteModeFromString(value: string): SpriteMode | undefined {
  return value === "single" || value === "multiple" ? value : undefined;
}

/** The supported animation export formats. */
export type ExportFormat =
  | "texturepacker"
  | "texturepacker.zip"
  | "aseprite"
  | "godot"
  | "godot.zip"
  | "grid"
  | "gamemaker"
  | "sequence.zip";
export const ExportFormat = {
  TexturePacker: "texturepacker",
  TexturePackerZip: "texturepacker.zip",
  Aseprite: "aseprite",
  Godot: "godot",
  GodotZip: "godot.zip",
  Grid: "grid",
  GameMaker: "gamemaker",
  SequenceZip: "sequence.zip",
} as const satisfies Record<string, ExportFormat>;

/** Every export format, in a stable order. */
export const ALL_EXPORT_FORMATS: ExportFormat[] = [
  "texturepacker",
  "texturepacker.zip",
  "aseprite",
  "godot",
  "godot.zip",
  "grid",
  "gamemaker",
  "sequence.zip",
];

export function exportFormatFromString(value: string): ExportFormat | undefined {
  return (ALL_EXPORT_FORMATS as string[]).includes(value)
    ? (value as ExportFormat)
    : undefined;
}

/**
 * What an API key is allowed to do. The scope is fixed at creation.
 */
export type ApiKeyScope = "admin" | "project_write" | "project_read";
export const ApiKeyScope = {
  Admin: "admin",
  ProjectWrite: "project_write",
  ProjectRead: "project_read",
} as const satisfies Record<string, ApiKeyScope>;

export function apiKeyScopeFromString(value: string): ApiKeyScope | undefined {
  return value === "admin" || value === "project_write" || value === "project_read"
    ? value
    : undefined;
}

/** How often an API key's spend counter resets. */
export type SpendResetCadence = "daily" | "weekly" | "monthly" | "never";
export const SpendResetCadence = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Never: "never",
} as const satisfies Record<string, SpendResetCadence>;

export function spendResetCadenceFromString(
  value: string,
): SpendResetCadence | undefined {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "never"
    ? value
    : undefined;
}

/**
 * Converts GameTorch credits to US dollars (100 credits = $1) exactly, using
 * decimal-string arithmetic rather than floating point.
 */
export function creditsToUsd(credits: Decimal): Decimal {
  const trimmed = credits.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match) {
    // Scientific notation or other exotic forms: fall back to a best-effort
    // computation, still avoiding binary floating point where possible.
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) {
      throw new TypeError(`invalid decimal: ${JSON.stringify(credits)}`);
    }
    return formatNumber(numeric / 100);
  }
  const sign = match[1] === "-" ? "-" : "";
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? "";
  const digits = `${intPart}${fracPart}`;
  // Shift the decimal point two places to the left.
  const pointFromLeft = digits.length - fracPart.length - 2;
  let resultInt: string;
  let resultFrac: string;
  if (pointFromLeft > 0) {
    resultInt = digits.slice(0, pointFromLeft);
    resultFrac = digits.slice(pointFromLeft);
  } else {
    resultInt = "0";
    resultFrac = `${"0".repeat(-pointFromLeft)}${digits}`;
  }
  resultFrac = resultFrac.replace(/0+$/, "");
  const magnitude = resultFrac.length > 0 ? `${resultInt}.${resultFrac}` : resultInt;
  if (/^0*$/.test(magnitude.replace(".", ""))) {
    return "0";
  }
  return `${sign}${magnitude}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toString();
}
