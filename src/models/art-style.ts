/** Art style models. */

import { asArray, asRecord, asString, asUuid } from "../decode.ts";
import type { Timestamp } from "../types.ts";

/** A reusable project art style. */
export interface ArtStyle {
  id: string;
  name: string;
  created_at: Timestamp;
}

export function decodeArtStyle(raw: unknown): ArtStyle {
  const record = asRecord(raw, "ArtStyle");
  return {
    id: asUuid(record["id"], "ArtStyle.id"),
    name: asString(record["name"], "ArtStyle.name"),
    created_at: asString(record["created_at"], "ArtStyle.created_at"),
  };
}

/** Response from `GET /projects/{project_id}/art-styles`. */
export interface ArtStylesResponse {
  art_styles: ArtStyle[];
}

export function decodeArtStylesResponse(raw: unknown): ArtStylesResponse {
  const record = asRecord(raw, "ArtStylesResponse");
  const styles = asArray(record["art_styles"] ?? [], "ArtStylesResponse.art_styles");
  return { art_styles: styles.map((item) => decodeArtStyle(item)) };
}

/**
 * A freshly generated art-style suggestion returned by
 * `POST /projects/{project_id}/art-styles/generate`.
 */
export interface ArtStyleSuggestion {
  name: string;
}

export function decodeArtStyleSuggestion(raw: unknown): ArtStyleSuggestion {
  const record = asRecord(raw, "ArtStyleSuggestion");
  return { name: asString(record["name"], "ArtStyleSuggestion.name") };
}
