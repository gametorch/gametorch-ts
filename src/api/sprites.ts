/** Sprite generation and sprite asset endpoints. */

import { randomUUID } from "node:crypto";

import { Client } from "../client.ts";
import { ConfigError } from "../errors.ts";
import {
  type Asset,
  type Generation,
  type GenerationsResponse,
  type SpriteAssetsResponse,
  decodeAsset,
  decodeGeneration,
  decodeGenerationsResponse,
  decodeSpriteAssetsResponse,
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
  type SpriteMode,
  decodeArchiveResponse,
  decodeAssetMetadataResponse,
  decodeAssetNameResponse,
  decodeJobCreated,
} from "../types.ts";
import { compactQuery, listQuery } from "./common.ts";

declare module "../client.ts" {
  interface Client {
    /** Starts building a sprite generation. */
    generateSprite(projectId: string): SpriteGenerationBuilder;
    /** Lists a project's generations, including their assets. */
    listGenerations(projectId: string, params?: ListParams): Promise<GenerationsResponse>;
    /** Returns one generation and its results. `GET /generations/{id}` */
    getGeneration(generationId: string, includeArchived?: boolean): Promise<Generation>;
    /** Searches a project's sprite assets by name or label. */
    listSpriteAssets(projectId: string, query?: string): Promise<SpriteAssetsResponse>;
    /** Returns one sprite asset. `GET /assets/{id}` */
    getAsset(assetId: string): Promise<Asset>;
    /** Returns the trimmed PNG bytes of a sprite asset. */
    assetContent(assetId: string): Promise<Download>;
    /** Returns the uncropped original PNG bytes of a sprite asset. */
    assetOriginal(assetId: string): Promise<Download>;
    /** Renames a sprite asset. Pass `null` to clear the name. */
    renameAsset(assetId: string, name: string | null): Promise<AssetNameResponse>;
    /** Replaces a sprite asset's metadata. */
    putAssetMetadata(
      assetId: string,
      metadata: Record<string, string>,
    ): Promise<AssetMetadataResponse>;
    /** Archives a sprite asset. */
    archiveAsset(assetId: string): Promise<ArchiveResponse>;
    /** Restores an archived sprite asset. */
    unarchiveAsset(assetId: string): Promise<ArchiveResponse>;
    /** Permanently deletes a sprite asset and its original. */
    deleteAsset(assetId: string): Promise<void>;
    /** Archives a whole generation. */
    archiveGeneration(generationId: string): Promise<ArchiveResponse>;
    /** Restores an archived generation. */
    unarchiveGeneration(generationId: string): Promise<ArchiveResponse>;
    /** Permanently deletes a generation. */
    deleteGeneration(generationId: string): Promise<void>;
    /** Streams a project's generations page by page. */
    streamGenerations(projectId: string, includeArchived?: boolean): Paginator<Generation>;
  }
}

Client.prototype.generateSprite = function (
  this: Client,
  projectId: string,
): SpriteGenerationBuilder {
  return new SpriteGenerationBuilder(this, projectId);
};

Client.prototype.listGenerations = function (
  this: Client,
  projectId: string,
  params?: ListParams,
): Promise<GenerationsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/generations",
    Concurrency.NONE,
    { method: "GET", path: `projects/${projectId}/generations`, query: listQuery(params) },
    decodeGenerationsResponse,
  );
};

Client.prototype.getGeneration = function (
  this: Client,
  generationId: string,
  includeArchived = false,
): Promise<Generation> {
  return this.sendJson(
    "tier2",
    "GET /generations/{id}",
    Concurrency.NONE,
    {
      method: "GET",
      path: `generations/${generationId}`,
      query: compactQuery({ include_archived: includeArchived ? "true" : undefined }),
    },
    decodeGeneration,
  );
};

Client.prototype.listSpriteAssets = function (
  this: Client,
  projectId: string,
  query?: string,
): Promise<SpriteAssetsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/sprite-assets",
    Concurrency.NONE,
    {
      method: "GET",
      path: `projects/${projectId}/sprite-assets`,
      query: compactQuery({ q: query }),
    },
    decodeSpriteAssetsResponse,
  );
};

Client.prototype.getAsset = function (this: Client, assetId: string): Promise<Asset> {
  return this.sendJson(
    "tier2",
    "GET /assets/{id}",
    Concurrency.NONE,
    { method: "GET", path: `assets/${assetId}` },
    decodeAsset,
  );
};

Client.prototype.assetContent = function (this: Client, assetId: string): Promise<Download> {
  return this.sendDownload("tier2", "GET /assets/{id}/content", Concurrency.NONE, {
    method: "GET",
    path: `assets/${assetId}/content`,
  });
};

Client.prototype.assetOriginal = function (this: Client, assetId: string): Promise<Download> {
  return this.sendDownload("tier2", "GET /assets/{id}/original", Concurrency.NONE, {
    method: "GET",
    path: `assets/${assetId}/original`,
  });
};

Client.prototype.renameAsset = function (
  this: Client,
  assetId: string,
  name: string | null,
): Promise<AssetNameResponse> {
  return this.sendJson(
    "writes",
    "PATCH /assets/{id}",
    Concurrency.NONE,
    { method: "PATCH", path: `assets/${assetId}`, json: { name } },
    decodeAssetNameResponse,
  );
};

Client.prototype.putAssetMetadata = function (
  this: Client,
  assetId: string,
  metadata: Record<string, string>,
): Promise<AssetMetadataResponse> {
  return this.sendJson(
    "writes",
    "PUT /assets/{id}/metadata",
    Concurrency.NONE,
    { method: "PUT", path: `assets/${assetId}/metadata`, json: { metadata } },
    decodeAssetMetadataResponse,
  );
};

Client.prototype.archiveAsset = function (
  this: Client,
  assetId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /assets/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `assets/${assetId}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveAsset = function (
  this: Client,
  assetId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /assets/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `assets/${assetId}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.deleteAsset = function (this: Client, assetId: string): Promise<void> {
  return this.sendOk("writes", "DELETE /assets/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `assets/${assetId}`,
  });
};

Client.prototype.archiveGeneration = function (
  this: Client,
  generationId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /generations/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `generations/${generationId}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveGeneration = function (
  this: Client,
  generationId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /generations/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `generations/${generationId}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.deleteGeneration = function (
  this: Client,
  generationId: string,
): Promise<void> {
  return this.sendOk("writes", "DELETE /generations/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `generations/${generationId}`,
  });
};

Client.prototype.streamGenerations = function (
  this: Client,
  projectId: string,
  includeArchived = false,
): Paginator<Generation> {
  return new Paginator<Generation>(async (cursor) => {
    const params = new ListParams({ before: cursor ?? undefined, include_archived: includeArchived });
    const response = await this.listGenerations(projectId, params);
    return {
      items: response.generations,
      next_cursor: response.next_cursor,
      total: response.total,
    };
  });
};

/**
 * Builder for a sprite generation.
 *
 * `prompt` and `imageModel` are required; everything else has a default.
 */
export class SpriteGenerationBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  #prompt: string | undefined;
  #mode: SpriteMode = "single";
  #imageModel: string | undefined;
  #textModel: string | undefined;
  #quality: string | undefined;
  #resolution: string | undefined;
  #baseAssetId: string | undefined;
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

  /** Sets the generation mode. Defaults to `"single"`. */
  mode(mode: SpriteMode): this {
    this.#mode = mode;
    return this;
  }

  /** Sets the image model id (required). See {@link Client.spriteModels}. */
  imageModel(imageModel: string): this {
    this.#imageModel = imageModel;
    return this;
  }

  /** Sets the prompt-enhancement text model. Use `"none"` to disable it. */
  textModel(textModel: string): this {
    this.#textModel = textModel;
    return this;
  }

  /** Disables prompt enhancement. */
  noTextModel(): this {
    this.#textModel = "none";
    return this;
  }

  /** Sets the quality setting. */
  quality(quality: string): this {
    this.#quality = quality;
    return this;
  }

  /** Sets the resolution setting. */
  resolution(resolution: string): this {
    this.#resolution = resolution;
    return this;
  }

  /** Edits an existing individual image result. */
  baseAssetId(baseAssetId: string): this {
    this.#baseAssetId = baseAssetId;
    return this;
  }

  /**
   * Overrides the idempotency key. By default a fresh UUID v4 is generated for
   * every call. Reusing a key with the same body returns the existing
   * generation; reusing it with a different body returns `409`.
   */
  requestId(requestId: string): this {
    this.#requestId = requestId;
    return this;
  }

  /** Sends the generation request. */
  send(): Promise<JobCreated> {
    if (this.#prompt === undefined) {
      return Promise.reject(new ConfigError("sprite generation requires a prompt"));
    }
    if (this.#imageModel === undefined) {
      return Promise.reject(new ConfigError("sprite generation requires an image_model"));
    }
    const body = {
      request_id: this.#requestId ?? randomUUID(),
      prompt: this.#prompt,
      mode: this.#mode,
      image_model: this.#imageModel,
      text_model: this.#textModel,
      quality: this.#quality,
      resolution: this.#resolution,
      base_asset_id: this.#baseAssetId,
    };
    return this.#client.sendJson(
      "tier1",
      "POST /projects/{project_id}/generations",
      Concurrency.HOLD,
      { method: "POST", path: `projects/${this.#projectId}/generations`, json: body },
      decodeJobCreated,
    );
  }
}
