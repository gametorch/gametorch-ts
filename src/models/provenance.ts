/** Who or what created a resource. */

import { optionalString, optionalUuid } from "../decode.ts";

/**
 * Who or what created a resource.
 *
 * GameTorch records the Clerk user and, when the request came through an API
 * key, the key that ran the operation. These fields are flattened onto the
 * owning resource as `user_id`, `source`, `api_key_id` and `key_name`.
 */
export interface Provenance {
  /** Clerk user id (or API-key owner) credited for the result. */
  user_id?: string;
  /** Spend/creation source, for example `UI` or `API key`. */
  source?: string;
  /** The API key used, when the result came through one. */
  api_key_id?: string;
  /** The API key's name, when available. */
  key_name?: string;
}

/** Decodes the flattened provenance fields from a resource record. */
export function decodeProvenance(record: Record<string, unknown>): Provenance {
  return {
    user_id: optionalString(record["user_id"]),
    source: optionalString(record["source"]),
    api_key_id: optionalUuid(record["api_key_id"]),
    key_name: optionalString(record["key_name"]),
  };
}
