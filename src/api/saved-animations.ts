/** Saved animation endpoints. */

import { Client } from "../client.ts";
import { ConfigError } from "../errors.ts";
import {
  type SavedAnimation,
  type SavedAnimationsResponse,
  decodeSavedAnimation,
  decodeSavedAnimationsResponse,
} from "../models/index.ts";
import { Paginator } from "../paginator.ts";
import { Concurrency } from "../rate-limit.ts";
import {
  type ArchiveResponse,
  type AssetMetadataResponse,
  type AssetNameResponse,
  ListParams,
  decodeArchiveResponse,
  decodeAssetMetadataResponse,
  decodeAssetNameResponse,
} from "../types.ts";
import { listQuery } from "./common.ts";

declare module "../client.ts" {
  interface Client {
    /** Lists a project's saved animations. */
    listSavedAnimations(
      projectId: string,
      params?: ListParams,
    ): Promise<SavedAnimationsResponse>;
    /** Starts building a saved animation from a range of an animation run. */
    saveAnimation(projectId: string): SaveAnimationBuilder;
    /** Returns one saved animation. `GET /saved-animations/{id}` */
    getSavedAnimation(id: string): Promise<SavedAnimation>;
    /** Renames a saved animation. Pass `null` to clear the name. */
    renameSavedAnimation(id: string, name: string | null): Promise<AssetNameResponse>;
    /** Replaces a saved animation's metadata. */
    putSavedAnimationMetadata(
      id: string,
      metadata: Record<string, string>,
    ): Promise<AssetMetadataResponse>;
    /** Archives a saved animation. */
    archiveSavedAnimation(id: string): Promise<ArchiveResponse>;
    /** Restores an archived saved animation. */
    unarchiveSavedAnimation(id: string): Promise<ArchiveResponse>;
    /** Permanently deletes a saved animation. */
    deleteSavedAnimation(id: string): Promise<void>;
    /** Streams a project's saved animations page by page. */
    streamSavedAnimations(
      projectId: string,
      includeArchived?: boolean,
    ): Paginator<SavedAnimation>;
  }
}

Client.prototype.listSavedAnimations = function (
  this: Client,
  projectId: string,
  params?: ListParams,
): Promise<SavedAnimationsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/saved-animations",
    Concurrency.NONE,
    {
      method: "GET",
      path: `projects/${projectId}/saved-animations`,
      query: listQuery(params),
    },
    decodeSavedAnimationsResponse,
  );
};

Client.prototype.saveAnimation = function (
  this: Client,
  projectId: string,
): SaveAnimationBuilder {
  return new SaveAnimationBuilder(this, projectId);
};

Client.prototype.getSavedAnimation = function (
  this: Client,
  id: string,
): Promise<SavedAnimation> {
  return this.sendJson(
    "tier2",
    "GET /saved-animations/{id}",
    Concurrency.NONE,
    { method: "GET", path: `saved-animations/${id}` },
    decodeSavedAnimation,
  );
};

Client.prototype.renameSavedAnimation = function (
  this: Client,
  id: string,
  name: string | null,
): Promise<AssetNameResponse> {
  return this.sendJson(
    "writes",
    "PATCH /saved-animations/{id}",
    Concurrency.NONE,
    { method: "PATCH", path: `saved-animations/${id}`, json: { name } },
    decodeAssetNameResponse,
  );
};

Client.prototype.putSavedAnimationMetadata = function (
  this: Client,
  id: string,
  metadata: Record<string, string>,
): Promise<AssetMetadataResponse> {
  return this.sendJson(
    "writes",
    "PUT /saved-animations/{id}/metadata",
    Concurrency.NONE,
    { method: "PUT", path: `saved-animations/${id}/metadata`, json: { metadata } },
    decodeAssetMetadataResponse,
  );
};

Client.prototype.archiveSavedAnimation = function (
  this: Client,
  id: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /saved-animations/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `saved-animations/${id}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveSavedAnimation = function (
  this: Client,
  id: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /saved-animations/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `saved-animations/${id}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.deleteSavedAnimation = function (this: Client, id: string): Promise<void> {
  return this.sendOk("writes", "DELETE /saved-animations/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `saved-animations/${id}`,
  });
};

Client.prototype.streamSavedAnimations = function (
  this: Client,
  projectId: string,
  includeArchived = false,
): Paginator<SavedAnimation> {
  return new Paginator<SavedAnimation>(async (cursor) => {
    const params = new ListParams({ before: cursor ?? undefined, include_archived: includeArchived });
    const response = await this.listSavedAnimations(projectId, params);
    return {
      items: response.saved_animations,
      next_cursor: response.next_cursor,
      total: response.total,
    };
  });
};

/** Builder for creating a saved animation. */
export class SaveAnimationBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  #generationId: string | undefined;
  #startFrame: number | undefined;
  #endFrame: number | undefined;
  #name: string | undefined;

  constructor(client: Client, projectId: string) {
    this.#client = client;
    this.#projectId = projectId;
  }

  /** Sets the source animation run id (required). */
  generationId(generationId: string): this {
    this.#generationId = generationId;
    return this;
  }

  /** Sets the inclusive frame range (required). */
  range(startFrame: number, endFrame: number): this {
    this.#startFrame = startFrame;
    this.#endFrame = endFrame;
    return this;
  }

  /** Sets an optional name for the saved animation. */
  name(name: string): this {
    this.#name = name;
    return this;
  }

  /** Creates the saved animation. */
  send(): Promise<SavedAnimation> {
    if (this.#generationId === undefined) {
      return Promise.reject(new ConfigError("saved animation requires a generation_id"));
    }
    if (this.#startFrame === undefined) {
      return Promise.reject(new ConfigError("saved animation requires a start_frame"));
    }
    if (this.#endFrame === undefined) {
      return Promise.reject(new ConfigError("saved animation requires an end_frame"));
    }
    const body = {
      generation_id: this.#generationId,
      start_frame: this.#startFrame,
      end_frame: this.#endFrame,
      name: this.#name,
    };
    return this.#client.sendJson(
      "writes",
      "POST /projects/{project_id}/saved-animations",
      Concurrency.NONE,
      { method: "POST", path: `projects/${this.#projectId}/saved-animations`, json: body },
      decodeSavedAnimation,
    );
  }
}
