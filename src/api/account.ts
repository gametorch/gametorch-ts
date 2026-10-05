/** Account and health endpoints. */

import { Client } from "../client.ts";
import { Concurrency } from "../rate-limit.ts";
import { type OkResponse, decodeOkResponse } from "../types.ts";

declare module "../client.ts" {
  interface Client {
    /** Ensures a mirrored user row exists for the caller. `POST /users/me` */
    ensureUser(): Promise<OkResponse>;
    /** Returns the API health status (`"ok"` when healthy). `GET /health` */
    health(): Promise<string>;
  }
}

Client.prototype.ensureUser = function (this: Client): Promise<OkResponse> {
  return this.sendJson(
    "writes",
    "POST /users/me",
    Concurrency.NONE,
    { method: "POST", path: "users/me" },
    decodeOkResponse,
  );
};

Client.prototype.health = async function (this: Client): Promise<string> {
  const download = await this.sendDownload("unlimited", "GET /health", Concurrency.NONE, {
    method: "GET",
    path: "health",
  });
  return new TextDecoder().decode(download.bytes()).trim();
};
