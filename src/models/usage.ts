/** Usage and spending models. */

import {
  asArray,
  asDecimal,
  asDecimalMap,
  asInt,
  asRecord,
  asString,
  optionalBoolean,
  optionalDecimal,
  optionalString,
  optionalUuid,
} from "../decode.ts";
import type { Decimal, Timestamp } from "../types.ts";

/** A per-source spend summary entry. */
export interface UsageSummary {
  /** Spend source, for example `UI` or `API key`. */
  source: string;
  api_key_id?: string;
  user_id?: string;
  key_name?: string;
  credits_consumed: Decimal;
}

function decodeUsageSummary(raw: unknown): UsageSummary {
  const record = asRecord(raw, "UsageSummary");
  return {
    source: asString(record["source"], "UsageSummary.source"),
    api_key_id: optionalUuid(record["api_key_id"]),
    user_id: optionalString(record["user_id"]),
    key_name: optionalString(record["key_name"]),
    credits_consumed: asDecimal(record["credits_consumed"], "UsageSummary.credits_consumed"),
  };
}

/** A single operation-log entry. */
export interface UsageRecord {
  id: string;
  generation_id?: string;
  created_at: Timestamp;
  source: string;
  operation?: string;
  api_key_id?: string;
  user_id?: string;
  model?: string;
  credits_consumed: Decimal;
  settled?: boolean;
  generation_status?: string;
  kind?: string;
  image_model?: string;
  animation_model?: string;
  parent_animation_model?: string;
}

function decodeUsageRecord(raw: unknown): UsageRecord {
  const record = asRecord(raw, "UsageRecord");
  return {
    id: asString(record["id"], "UsageRecord.id"),
    generation_id: optionalUuid(record["generation_id"]),
    created_at: asString(record["created_at"], "UsageRecord.created_at"),
    source: asString(record["source"], "UsageRecord.source"),
    operation: optionalString(record["operation"]),
    api_key_id: optionalUuid(record["api_key_id"]),
    user_id: optionalString(record["user_id"]),
    model: optionalString(record["model"]),
    credits_consumed: asDecimal(record["credits_consumed"], "UsageRecord.credits_consumed"),
    settled: optionalBoolean(record["settled"]),
    generation_status: optionalString(record["generation_status"]),
    kind: optionalString(record["kind"]),
    image_model: optionalString(record["image_model"]),
    animation_model: optionalString(record["animation_model"]),
    parent_animation_model: optionalString(record["parent_animation_model"]),
  };
}

/** Response from `GET /usage`. */
export interface Usage {
  /** Credit balance, available to admins only. */
  balance_credits?: Decimal;
  reserved_credits?: Decimal;
  summary: UsageSummary[];
  records: UsageRecord[];
  next_cursor: string | null;
  total: number;
}

export function decodeUsage(raw: unknown): Usage {
  const record = asRecord(raw, "Usage");
  const summary = asArray(record["summary"] ?? [], "Usage.summary");
  const records = asArray(record["records"] ?? [], "Usage.records");
  return {
    balance_credits: optionalDecimal(record["balance_credits"]),
    reserved_credits: optionalDecimal(record["reserved_credits"]),
    summary: summary.map((item) => decodeUsageSummary(item)),
    records: records.map((item) => decodeUsageRecord(item)),
    next_cursor: optionalString(record["next_cursor"]) ?? null,
    total: record["total"] === undefined ? 0 : asInt(record["total"], "Usage.total"),
  };
}

/** A spend source in a usage histogram. */
export interface UsageHistogramSource {
  /** Source identifier used as the key in each bucket's `values` map. */
  id: string;
  label: string;
  kind: string;
}

function decodeUsageHistogramSource(raw: unknown): UsageHistogramSource {
  const record = asRecord(raw, "UsageHistogramSource");
  return {
    id: asString(record["id"], "UsageHistogramSource.id"),
    label: asString(record["label"] ?? "", "UsageHistogramSource.label"),
    kind: asString(record["kind"] ?? "", "UsageHistogramSource.kind"),
  };
}

/** A single histogram bucket. */
export interface HistogramBucket {
  start: Timestamp;
  end: Timestamp;
  total: Decimal;
  values: Record<string, Decimal>;
}

function decodeHistogramBucket(raw: unknown): HistogramBucket {
  const record = asRecord(raw, "HistogramBucket");
  return {
    start: asString(record["start"], "HistogramBucket.start"),
    end: asString(record["end"], "HistogramBucket.end"),
    total: asDecimal(record["total"], "HistogramBucket.total"),
    values: asDecimalMap(record["values"], "HistogramBucket.values"),
  };
}

/** Response from `GET /usage/histogram`. */
export interface UsageHistogram {
  /** The requested range (`24h`, `7d`, `30d`, `365d`). */
  range: string;
  width_seconds: number;
  sources: UsageHistogramSource[];
  buckets: HistogramBucket[];
}

export function decodeUsageHistogram(raw: unknown): UsageHistogram {
  const record = asRecord(raw, "UsageHistogram");
  const sources = asArray(record["sources"] ?? [], "UsageHistogram.sources");
  const buckets = asArray(record["buckets"] ?? [], "UsageHistogram.buckets");
  return {
    range: asString(record["range"], "UsageHistogram.range"),
    width_seconds: asInt(record["width_seconds"], "UsageHistogram.width_seconds"),
    sources: sources.map((item) => decodeUsageHistogramSource(item)),
    buckets: buckets.map((item) => decodeHistogramBucket(item)),
  };
}
