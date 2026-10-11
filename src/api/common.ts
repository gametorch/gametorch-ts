/** Helpers shared by the API method groups. */

import type { ListParams, MetadataRemovals, PutMetadataRequest } from "../types.ts";

/** Narrows a {@link MetadataRemovals} union to the plain key list. */
function isKeyList(value: MetadataRemovals | undefined): value is readonly string[] {
  return Array.isArray(value);
}

/**
 * Builds the body for a `PUT .../metadata` call from the positional
 * `metadata` / `remove` arguments, normalizing the `remove_keys` alias.
 */
export function metadataBody(
  metadata: Record<string, string> | undefined,
  removals: MetadataRemovals | undefined,
): PutMetadataRequest {
  let remove: readonly string[] | undefined;
  if (isKeyList(removals)) {
    remove = removals;
  } else if (removals !== undefined) {
    const merged = [...(removals.remove ?? []), ...(removals.remove_keys ?? [])];
    remove = merged.length > 0 ? merged : undefined;
  }
  return { metadata, remove };
}

/** Builds the shared `before` / `include_archived` query pairs. */
export function listQuery(params?: ListParams): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = {};
  if (params?.before !== undefined) {
    query["before"] = params.before;
  }
  if (params?.include_archived === true) {
    query["include_archived"] = "true";
  }
  return query;
}

/** Drops `undefined` entries from a query object. */
export function compactQuery(
  query: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
