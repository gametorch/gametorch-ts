/** API key models. */

import { asArray, asRecord, asString, asUuid, optionalDecimal, optionalString, optionalTimestamp, optionalUuid } from "../decode.ts";
import {
  type ApiKeyScope,
  type Decimal,
  type SpendResetCadence,
  type Timestamp,
  apiKeyScopeFromString,
} from "../types.ts";

/** An API key (the secret itself is never returned after creation). */
export interface ApiKey {
  id: string;
  name?: string;
  /** Non-secret prefix of the key, for display. */
  key_prefix: string;
  expires_at?: Timestamp;
  /** Maximum spend in the current cycle, if a limit is set. */
  max_spend_limit?: Decimal;
  spend_reset_cadence: string;
  key_scope: ApiKeyScope;
  /** The bound project for a project-scoped key; absent for admin keys. */
  project_id?: string;
  spend: Decimal;
  lifetime_spend: Decimal;
  spend_reset_at?: Timestamp;
  created_at: Timestamp;
}

export function decodeApiKey(raw: unknown): ApiKey {
  const record = asRecord(raw, "ApiKey");
  const scope = record["key_scope"];
  const keyScope =
    typeof scope === "string" ? (apiKeyScopeFromString(scope) ?? "admin") : "admin";
  return {
    id: asUuid(record["id"], "ApiKey.id"),
    name: optionalString(record["name"]),
    key_prefix: asString(record["key_prefix"], "ApiKey.key_prefix"),
    expires_at: optionalTimestamp(record["expires_at"]),
    max_spend_limit: optionalDecimal(record["max_spend_limit"]),
    spend_reset_cadence: asString(record["spend_reset_cadence"] ?? "", "ApiKey.spend_reset_cadence"),
    key_scope: keyScope,
    project_id: optionalUuid(record["project_id"]),
    spend: optionalDecimal(record["spend"]) ?? "0",
    lifetime_spend: optionalDecimal(record["lifetime_spend"]) ?? "0",
    spend_reset_at: optionalTimestamp(record["spend_reset_at"]),
    created_at: asString(record["created_at"], "ApiKey.created_at"),
  };
}

/** Response from `POST /keys`: an API key plus its secret, returned only once. */
export interface ApiKeyWithSecret {
  key: ApiKey;
  /** The full key. Store it securely; it cannot be retrieved again. */
  key_full: string;
}

export function decodeApiKeyWithSecret(raw: unknown): ApiKeyWithSecret {
  const record = asRecord(raw, "ApiKeyWithSecret");
  return {
    key: decodeApiKey(record),
    key_full: asString(record["key_full"], "ApiKeyWithSecret.key_full"),
  };
}

/** Response from `GET /keys`. */
export interface KeysResponse {
  keys: ApiKey[];
}

export function decodeKeysResponse(raw: unknown): KeysResponse {
  const record = asRecord(raw, "KeysResponse");
  const keys = asArray(record["keys"] ?? [], "KeysResponse.keys");
  return { keys: keys.map((item) => decodeApiKey(item)) };
}

/** Request body for `POST /keys`. */
export class CreateApiKeyRequest {
  name: string | undefined;
  expires_at: Timestamp | undefined;
  max_spend_limit: Decimal | undefined;
  spend_reset_cadence: SpendResetCadence | undefined;
  key_scope: ApiKeyScope | undefined;
  project_id: string | undefined;

  /** Creates an empty request (which the server treats as an admin key). */
  static new(): CreateApiKeyRequest {
    return new CreateApiKeyRequest();
  }

  /** Creates an admin-scoped key request (full account access). */
  static admin(): CreateApiKeyRequest {
    return new CreateApiKeyRequest().keyScope("admin");
  }

  /** Creates a write-scoped key request bound to `projectId`. */
  static projectWrite(projectId: string): CreateApiKeyRequest {
    return new CreateApiKeyRequest().keyScope("project_write").projectId(projectId);
  }

  /** Creates a read-only key request bound to `projectId`. */
  static projectRead(projectId: string): CreateApiKeyRequest {
    return new CreateApiKeyRequest().keyScope("project_read").projectId(projectId);
  }

  /** Sets the key name. */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /** Sets the expiry time (ISO-8601). */
  expiresAt(expiresAt: Timestamp): this {
    this.expires_at = expiresAt;
    return this;
  }

  /** Sets the spend limit for the current cycle. */
  maxSpendLimit(limit: Decimal): this {
    this.max_spend_limit = limit;
    return this;
  }

  /** Sets the spend reset cadence. */
  spendResetCadence(cadence: SpendResetCadence): this {
    this.spend_reset_cadence = cadence;
    return this;
  }

  /** Sets the key scope explicitly. */
  keyScope(scope: ApiKeyScope): this {
    this.key_scope = scope;
    return this;
  }

  /** Binds the key to a project. */
  projectId(projectId: string): this {
    this.project_id = projectId;
    return this;
  }

  /** The wire representation, omitting unset fields. */
  toJSON(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (this.name !== undefined) body["name"] = this.name;
    if (this.expires_at !== undefined) body["expires_at"] = this.expires_at;
    if (this.max_spend_limit !== undefined) body["max_spend_limit"] = this.max_spend_limit;
    if (this.spend_reset_cadence !== undefined) {
      body["spend_reset_cadence"] = this.spend_reset_cadence;
    }
    if (this.key_scope !== undefined) body["key_scope"] = this.key_scope;
    if (this.project_id !== undefined) body["project_id"] = this.project_id;
    return body;
  }
}

/** Request body for `PATCH /keys/{id}`. Only set fields are updated. */
export class UpdateApiKeyRequest {
  name: string | undefined;
  expires_at: Timestamp | undefined;
  max_spend_limit: Decimal | undefined;
  spend_reset_cadence: SpendResetCadence | undefined;

  /** Creates an empty request. */
  static new(): UpdateApiKeyRequest {
    return new UpdateApiKeyRequest();
  }

  /** Sets the key name. */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /** Sets the expiry time (ISO-8601). */
  expiresAt(expiresAt: Timestamp): this {
    this.expires_at = expiresAt;
    return this;
  }

  /** Sets the spend limit. */
  maxSpendLimit(limit: Decimal): this {
    this.max_spend_limit = limit;
    return this;
  }

  /** Sets the spend reset cadence. */
  spendResetCadence(cadence: SpendResetCadence): this {
    this.spend_reset_cadence = cadence;
    return this;
  }

  /** The wire representation, omitting unset fields. */
  toJSON(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (this.name !== undefined) body["name"] = this.name;
    if (this.expires_at !== undefined) body["expires_at"] = this.expires_at;
    if (this.max_spend_limit !== undefined) body["max_spend_limit"] = this.max_spend_limit;
    if (this.spend_reset_cadence !== undefined) {
      body["spend_reset_cadence"] = this.spend_reset_cadence;
    }
    return body;
  }
}
