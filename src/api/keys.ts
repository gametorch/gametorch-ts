/** API key management endpoints. */

import { Client } from "../client.ts";
import {
  type ApiKey,
  type ApiKeyWithSecret,
  type CreateApiKeyRequest,
  type KeysResponse,
  type UpdateApiKeyRequest,
  decodeApiKey,
  decodeApiKeyWithSecret,
  decodeKeysResponse,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";
import type { OkResponse } from "../types.ts";

declare module "../client.ts" {
  interface Client {
    /** Lists the API keys in the caller's scope (admin-only for orgs). `GET /keys` */
    listKeys(): Promise<KeysResponse>;
    /** Creates an API key; the full key is returned exactly once. `POST /keys` */
    createKey(request: CreateApiKeyRequest): Promise<ApiKeyWithSecret>;
    /** Updates an API key; only set fields change. `PATCH /keys/{id}` */
    updateKey(keyId: string, request: UpdateApiKeyRequest): Promise<ApiKey>;
    /** Revokes an API key. `DELETE /keys/{id}` */
    deleteKey(keyId: string): Promise<OkResponse>;
  }
}

Client.prototype.listKeys = function (this: Client): Promise<KeysResponse> {
  return this.sendJson(
    "tier2",
    "GET /keys",
    Concurrency.NONE,
    { method: "GET", path: "keys" },
    decodeKeysResponse,
  );
};

Client.prototype.createKey = function (
  this: Client,
  request: CreateApiKeyRequest,
): Promise<ApiKeyWithSecret> {
  return this.sendJson(
    "writes",
    "POST /keys",
    Concurrency.NONE,
    { method: "POST", path: "keys", json: request },
    decodeApiKeyWithSecret,
  );
};

Client.prototype.updateKey = function (
  this: Client,
  keyId: string,
  request: UpdateApiKeyRequest,
): Promise<ApiKey> {
  return this.sendJson(
    "writes",
    "PATCH /keys/{id}",
    Concurrency.NONE,
    { method: "PATCH", path: `keys/${keyId}`, json: request },
    decodeApiKey,
  );
};

Client.prototype.deleteKey = function (this: Client, keyId: string): Promise<OkResponse> {
  return this.sendAck("writes", "DELETE /keys/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `keys/${keyId}`,
  });
};
