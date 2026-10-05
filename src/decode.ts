/**
 * Lenient wire decoders.
 *
 * These mirror the `serde` helpers used by the Rust SDK: credit/USD amounts may
 * arrive as decimal strings (`"5.003952358800"`) or JSON numbers (`300`); some
 * counts are booleans in the OpenAPI schema but integers on the wire; some
 * string lists may be `null` or a count. Each helper validates the shape and
 * throws {@link DecodeError} on unexpected input, so responses are checked at
 * the boundary just like serde does.
 */

import { DecodeError } from "./errors.ts";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DecodeError(`expected object for ${context}, found ${describe(value)}`);
  }
  return value;
}

export function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DecodeError(`expected array for ${context}, found ${describe(value)}`);
  }
  return value;
}

function field(context: string, name: string): string {
  return context.length > 0 ? `${context}.${name}` : name;
}

export function asString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new DecodeError(`expected string for ${context}, found ${describe(value)}`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new DecodeError(`expected string, found ${describe(value)}`);
  }
  return value;
}

export function asBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new DecodeError(`expected boolean for ${context}, found ${describe(value)}`);
  }
  return value;
}

export function optionalBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new DecodeError(`expected boolean, found ${describe(value)}`);
  }
  return value;
}

export function asNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new DecodeError(`expected number for ${context}, found ${describe(value)}`);
  }
  return value;
}

export function asInt(value: unknown, context: string): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  throw new DecodeError(`expected integer for ${context}, found ${describe(value)}`);
}

export function optionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return asInt(value, "value");
}

/** A decimal string, normalized from a string or JSON number. */
export function asDecimal(value: unknown, context: string): string {
  if (typeof value === "string") {
    if (!DECIMAL_RE.test(value.trim())) {
      throw new DecodeError(`invalid decimal string for ${context}: ${JSON.stringify(value)}`);
    }
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  throw new DecodeError(`expected decimal for ${context}, found ${describe(value)}`);
}

export function optionalDecimal(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return asDecimal(value, "value");
}

export function asDecimalMap(value: unknown, context: string): Record<string, string> {
  if (value === null || value === undefined) {
    return {};
  }
  const record = asRecord(value, context);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (entry === null || entry === undefined) {
      continue;
    }
    out[key] = asDecimal(entry, field(context, key));
  }
  return out;
}

/**
 * A count that the API may encode as a boolean (spec) or an integer (wire):
 * `true` maps to `1`, `false`/`null` to `0`.
 */
export function asBoolOrInt(value: unknown, context: string): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  throw new DecodeError(`expected boolean or integer for ${context}, found ${describe(value)}`);
}

/**
 * A list of strings decoded leniently: an array of strings is used as-is, while
 * `null`, a number or a boolean yields an empty list.
 */
export function asStringListLenient(value: unknown, context: string): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item !== "string") {
        throw new DecodeError(
          `expected string at ${context}[${index}], found ${describe(item)}`,
        );
      }
      return item;
    });
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [];
  }
  throw new DecodeError(`expected string array for ${context}, found ${describe(value)}`);
}

export function asStringArray(value: unknown, context: string): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  const items = asArray(value, context);
  return items.map((item, index) => asString(item, `${context}[${index}]`));
}

export function asStringMap(value: unknown, context: string): Record<string, string> {
  if (value === null || value === undefined) {
    return {};
  }
  const record = asRecord(value, context);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    out[key] = asString(entry, field(context, key));
  }
  return out;
}

export function asUuid(value: unknown, context: string): string {
  const text = asString(value, context);
  if (!UUID_RE.test(text)) {
    throw new DecodeError(`invalid uuid for ${context}: ${JSON.stringify(text)}`);
  }
  return text;
}

export function optionalUuid(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return asUuid(value, "value");
}

export function asTimestamp(value: unknown, context: string): string {
  return asString(value, context);
}

export function optionalTimestamp(value: unknown): string | undefined {
  return optionalString(value);
}

function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

/** Exposed for model decoders that need the `context.field` naming. */
export { field as decodeField };
