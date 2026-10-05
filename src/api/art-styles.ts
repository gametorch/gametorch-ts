/** Art style endpoints. */

import { Client } from "../client.ts";
import {
  type ArtStyle,
  type ArtStyleSuggestion,
  type ArtStylesResponse,
  decodeArtStyle,
  decodeArtStyleSuggestion,
  decodeArtStylesResponse,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";
import type { OkResponse } from "../types.ts";

declare module "../client.ts" {
  interface Client {
    /** Lists a project's reusable art styles. `GET /projects/{project_id}/art-styles` */
    listArtStyles(projectId: string): Promise<ArtStylesResponse>;
    /** Creates an art style. `POST /projects/{project_id}/art-styles` */
    createArtStyle(projectId: string, name: string): Promise<ArtStyle>;
    /** Returns a fresh suggested art style. `POST /projects/{project_id}/art-styles/generate` */
    generateArtStyle(projectId: string): Promise<ArtStyleSuggestion>;
    /** Deletes an art style. `DELETE /art-styles/{art_style_id}` */
    deleteArtStyle(artStyleId: string): Promise<OkResponse>;
  }
}

Client.prototype.listArtStyles = function (
  this: Client,
  projectId: string,
): Promise<ArtStylesResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/art-styles",
    Concurrency.NONE,
    { method: "GET", path: `projects/${projectId}/art-styles` },
    decodeArtStylesResponse,
  );
};

Client.prototype.createArtStyle = function (
  this: Client,
  projectId: string,
  name: string,
): Promise<ArtStyle> {
  return this.sendJson(
    "writes",
    "POST /projects/{project_id}/art-styles",
    Concurrency.NONE,
    { method: "POST", path: `projects/${projectId}/art-styles`, json: { name } },
    decodeArtStyle,
  );
};

Client.prototype.generateArtStyle = function (
  this: Client,
  projectId: string,
): Promise<ArtStyleSuggestion> {
  return this.sendJson(
    "tier2",
    "POST /projects/{project_id}/art-styles/generate",
    Concurrency.NONE,
    { method: "POST", path: `projects/${projectId}/art-styles/generate` },
    decodeArtStyleSuggestion,
  );
};

Client.prototype.deleteArtStyle = function (
  this: Client,
  artStyleId: string,
): Promise<OkResponse> {
  return this.sendAck("writes", "DELETE /art-styles/{art_style_id}", Concurrency.NONE, {
    method: "DELETE",
    path: `art-styles/${artStyleId}`,
  });
};
