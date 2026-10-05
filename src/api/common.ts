/** Helpers shared by the API method groups. */

import type { ListParams } from "../types.ts";

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
