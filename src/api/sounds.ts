/** Sound generation and sound asset endpoints. */

import { randomUUID } from "node:crypto";

import { Client } from "../client.ts";
import { ConfigError } from "../errors.ts";
import {
  type SoundGeneration,
  type SoundGenerationsResponse,
  decodeSoundGeneration,
  decodeSoundGenerationsResponse,
} from "../models/index.ts";
import { Paginator } from "../paginator.ts";
import { Concurrency } from "../rate-limit.ts";
import {
  type ArchiveResponse,
  type AssetMetadataResponse,
  type AssetNameResponse,
  type Download,
  type JobCreated,
  ListParams,
  type MetadataRemovals,
  decodeArchiveResponse,
  decodeAssetMetadataResponse,
  decodeAssetNameResponse,
  decodeJobCreated,
} from "../types.ts";
import { compactQuery, listQuery, metadataBody } from "./common.ts";

declare module "../client.ts" {
  interface Client {
    /** Starts building a sound generation. */
    generateSound(projectId: string): SoundGenerationBuilder;
    /** Lists a project's sound generations. */
    listSoundGenerations(
      projectId: string,
      params?: ListParams,
    ): Promise<SoundGenerationsResponse>;
    /** Returns one sound generation and its assets. */
    getSoundGeneration(
      generationId: string,
      includeArchived?: boolean,
    ): Promise<SoundGeneration>;
    /** Returns the audio bytes of a sound asset. */
    soundAssetContent(assetId: string): Promise<Download>;
    /** Renames a sound asset. Pass `null` to clear the name. */
    renameSoundAsset(assetId: string, name: string | null): Promise<AssetNameResponse>;
    /**
     * Merges (upserts) a sound asset's metadata. Keys you send are added or
     * overwritten and omitted keys are kept. Pass `remove` (a list of keys, or
     * `{ remove }` / `{ remove_keys }`) to delete keys; it is the only way to
     * remove them.
     */
    putSoundAssetMetadata(
      assetId: string,
      metadata?: Record<string, string>,
      remove?: MetadataRemovals,
    ): Promise<AssetMetadataResponse>;
    /** Archives a sound asset. */
    archiveSoundAsset(assetId: string): Promise<ArchiveResponse>;
    /** Restores an archived sound asset. */
    unarchiveSoundAsset(assetId: string): Promise<ArchiveResponse>;
    /** Permanently deletes a sound asset. */
    deleteSoundAsset(assetId: string): Promise<void>;
    /** Archives a whole sound generation. */
    archiveSoundGeneration(generationId: string): Promise<ArchiveResponse>;
    /** Restores an archived sound generation. */
    unarchiveSoundGeneration(generationId: string): Promise<ArchiveResponse>;
    /** Streams a project's sound generations page by page. */
    streamSoundGenerations(
      projectId: string,
      includeArchived?: boolean,
    ): Paginator<SoundGeneration>;
  }
}

Client.prototype.generateSound = function (
  this: Client,
  projectId: string,
): SoundGenerationBuilder {
  return new SoundGenerationBuilder(this, projectId);
};

Client.prototype.listSoundGenerations = function (
  this: Client,
  projectId: string,
  params?: ListParams,
): Promise<SoundGenerationsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/sound-generations",
    Concurrency.NONE,
    {
      method: "GET",
      path: `projects/${projectId}/sound-generations`,
      query: listQuery(params),
    },
    decodeSoundGenerationsResponse,
  );
};

Client.prototype.getSoundGeneration = function (
  this: Client,
  generationId: string,
  includeArchived = false,
): Promise<SoundGeneration> {
  return this.sendJson(
    "tier2",
    "GET /sound-generations/{id}",
    Concurrency.NONE,
    {
      method: "GET",
      path: `sound-generations/${generationId}`,
      query: compactQuery({ include_archived: includeArchived ? "true" : undefined }),
    },
    decodeSoundGeneration,
  );
};

Client.prototype.soundAssetContent = function (
  this: Client,
  assetId: string,
): Promise<Download> {
  return this.sendDownload("tier2", "GET /sound-assets/{id}/content", Concurrency.NONE, {
    method: "GET",
    path: `sound-assets/${assetId}/content`,
  });
};

Client.prototype.renameSoundAsset = function (
  this: Client,
  assetId: string,
  name: string | null,
): Promise<AssetNameResponse> {
  return this.sendJson(
    "writes",
    "PATCH /sound-assets/{id}",
    Concurrency.NONE,
    { method: "PATCH", path: `sound-assets/${assetId}`, json: { name } },
    decodeAssetNameResponse,
  );
};

Client.prototype.putSoundAssetMetadata = function (
  this: Client,
  assetId: string,
  metadata?: Record<string, string>,
  remove?: MetadataRemovals,
): Promise<AssetMetadataResponse> {
  return this.sendJson(
    "writes",
    "PUT /sound-assets/{id}/metadata",
    Concurrency.NONE,
    {
      method: "PUT",
      path: `sound-assets/${assetId}/metadata`,
      json: metadataBody(metadata, remove),
    },
    decodeAssetMetadataResponse,
  );
};

Client.prototype.archiveSoundAsset = function (
  this: Client,
  assetId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /sound-assets/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `sound-assets/${assetId}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveSoundAsset = function (
  this: Client,
  assetId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /sound-assets/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `sound-assets/${assetId}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.deleteSoundAsset = function (this: Client, assetId: string): Promise<void> {
  return this.sendOk("writes", "DELETE /sound-assets/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `sound-assets/${assetId}`,
  });
};

Client.prototype.archiveSoundGeneration = function (
  this: Client,
  generationId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /sound-generations/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `sound-generations/${generationId}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveSoundGeneration = function (
  this: Client,
  generationId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /sound-generations/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `sound-generations/${generationId}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.streamSoundGenerations = function (
  this: Client,
  projectId: string,
  includeArchived = false,
): Paginator<SoundGeneration> {
  return new Paginator<SoundGeneration>(async (cursor) => {
    const params = new ListParams({ before: cursor ?? undefined, include_archived: includeArchived });
    const response = await this.listSoundGenerations(projectId, params);
    return {
      items: response.sound_generations,
      next_cursor: response.next_cursor,
      total: response.total,
    };
  });
};

/**
 * Builder for a sound generation.
 *
 * `prompt` and `soundModel` are required.
 */
export class SoundGenerationBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  #prompt: string | undefined;
  #soundModel: string | undefined;
  #responseFormat: string | undefined;
  #requestId: string | undefined;

  constructor(client: Client, projectId: string) {
    this.#client = client;
    this.#projectId = projectId;
  }

  /** Sets the generation prompt (required). */
  prompt(prompt: string): this {
    this.#prompt = prompt;
    return this;
  }

  /** Sets the sound model id (required). See {@link Client.soundModels}. */
  soundModel(soundModel: string): this {
    this.#soundModel = soundModel;
    return this;
  }

  /** Sets the output format, for example `mp3` or `pcm`. */
  responseFormat(responseFormat: string): this {
    this.#responseFormat = responseFormat;
    return this;
  }

  /** Overrides the idempotency key. Defaults to a fresh UUID v4. */
  requestId(requestId: string): this {
    this.#requestId = requestId;
    return this;
  }

  /** Sends the sound generation request. */
  send(): Promise<JobCreated> {
    if (this.#prompt === undefined) {
      return Promise.reject(new ConfigError("sound generation requires a prompt"));
    }
    if (this.#soundModel === undefined) {
      return Promise.reject(new ConfigError("sound generation requires a sound_model"));
    }
    const body = {
      request_id: this.#requestId ?? randomUUID(),
      prompt: this.#prompt,
      sound_model: this.#soundModel,
      response_format: this.#responseFormat,
    };
    return this.#client.sendJson(
      "tier1",
      "POST /projects/{project_id}/sound-generations",
      Concurrency.HOLD,
      { method: "POST", path: `projects/${this.#projectId}/sound-generations`, json: body },
      decodeJobCreated,
    );
  }
}
