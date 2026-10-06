/** Animation run, frame generation and content endpoints. */

import { randomUUID } from "node:crypto";

import { Client } from "../client.ts";
import { ConfigError } from "../errors.ts";
import {
  type AnimationEstimate,
  type AnimationRun,
  type AnimationsResponse,
  decodeAnimationEstimate,
  decodeAnimationRun,
  decodeAnimationsResponse,
} from "../models/index.ts";
import { Paginator } from "../paginator.ts";
import { Concurrency } from "../rate-limit.ts";
import {
  type ArchiveResponse,
  type Download,
  type JobCreated,
  ListParams,
  decodeArchiveResponse,
  decodeJobCreated,
} from "../types.ts";
import { listQuery } from "./common.ts";

declare module "../client.ts" {
  interface Client {
    /**
     * Estimates the credit cost of an animation run without starting one.
     *
     * Pass a sprite's `base_asset_id` (see {@link Client.listSpriteAssets}) to
     * price animating that sprite, or omit it to price a from-scratch run.
     */
    estimateAnimation(projectId: string): AnimationEstimateBuilder;
    /**
     * Starts building an animation run.
     *
     * To animate an existing sprite, pass its asset id from
     * {@link Client.listSpriteAssets} / `GET /projects/{id}/sprite-assets` as
     * `base_asset_id`; omit it to generate an animation from scratch.
     */
    generateAnimation(projectId: string): AnimationRunBuilder;
    /** Lists a project's animation runs. */
    listAnimationRuns(projectId: string, params?: ListParams): Promise<AnimationsResponse>;
    /** Returns one animation run and its frames. */
    getAnimationRun(runId: string): Promise<AnimationRun>;
    /** Returns the animation clip bytes. */
    animationContent(runId: string): Promise<Download>;
    /** Archives an animation run. */
    archiveAnimationRun(runId: string): Promise<ArchiveResponse>;
    /** Restores an archived animation run. */
    unarchiveAnimationRun(runId: string): Promise<ArchiveResponse>;
    /** Permanently deletes an animation run. */
    deleteAnimationRun(runId: string): Promise<void>;
    /** Generates individual PNG frames from a finished animation run. */
    generateFrames(projectId: string, runId: string): FrameGenerationBuilder;
    /** Returns the PNG bytes of a generated frame by its id. */
    frameContent(frameId: string): Promise<Download>;
    /** Returns the PNG bytes of a frame addressed by its 1-based number. */
    frameContentByNumber(runId: string, frameNumber: number): Promise<Download>;
    /** Streams a project's animation runs page by page. */
    streamAnimationRuns(projectId: string, params?: ListParams): Paginator<AnimationRun>;
  }
}

Client.prototype.estimateAnimation = function (
  this: Client,
  projectId: string,
): AnimationEstimateBuilder {
  return new AnimationEstimateBuilder(this, projectId);
};

Client.prototype.generateAnimation = function (
  this: Client,
  projectId: string,
): AnimationRunBuilder {
  return new AnimationRunBuilder(this, projectId);
};

Client.prototype.listAnimationRuns = function (
  this: Client,
  projectId: string,
  params?: ListParams,
): Promise<AnimationsResponse> {
  const query = listQuery(params);
  if (params?.base_asset_id !== undefined) {
    query["base_asset_id"] = params.base_asset_id;
  }
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/animation-runs",
    Concurrency.NONE,
    { method: "GET", path: `projects/${projectId}/animation-runs`, query },
    decodeAnimationsResponse,
  );
};

Client.prototype.getAnimationRun = function (
  this: Client,
  runId: string,
): Promise<AnimationRun> {
  return this.sendJson(
    "tier2",
    "GET /animation-runs/{id}",
    Concurrency.NONE,
    { method: "GET", path: `animation-runs/${runId}` },
    decodeAnimationRun,
  );
};

Client.prototype.animationContent = function (this: Client, runId: string): Promise<Download> {
  return this.sendDownload("tier2", "GET /animation-runs/{id}/content", Concurrency.NONE, {
    method: "GET",
    path: `animation-runs/${runId}/content`,
  });
};

Client.prototype.archiveAnimationRun = function (
  this: Client,
  runId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /animation-runs/{id}/archive",
    Concurrency.NONE,
    { method: "POST", path: `animation-runs/${runId}/archive` },
    decodeArchiveResponse,
  );
};

Client.prototype.unarchiveAnimationRun = function (
  this: Client,
  runId: string,
): Promise<ArchiveResponse> {
  return this.sendJson(
    "writes",
    "POST /animation-runs/{id}/unarchive",
    Concurrency.NONE,
    { method: "POST", path: `animation-runs/${runId}/unarchive` },
    decodeArchiveResponse,
  );
};

Client.prototype.deleteAnimationRun = function (this: Client, runId: string): Promise<void> {
  return this.sendOk("writes", "DELETE /animation-runs/{id}", Concurrency.NONE, {
    method: "DELETE",
    path: `animation-runs/${runId}`,
  });
};

Client.prototype.generateFrames = function (
  this: Client,
  projectId: string,
  runId: string,
): FrameGenerationBuilder {
  return new FrameGenerationBuilder(this, projectId, runId);
};

Client.prototype.frameContent = function (this: Client, frameId: string): Promise<Download> {
  return this.sendDownload(
    "tier2",
    "GET /animation-run-frames/{id}/content",
    Concurrency.NONE,
    { method: "GET", path: `animation-run-frames/${frameId}/content` },
  );
};

Client.prototype.frameContentByNumber = function (
  this: Client,
  runId: string,
  frameNumber: number,
): Promise<Download> {
  return this.sendDownload(
    "tier2",
    "GET /animation-runs/{id}/frames/{number}/content",
    Concurrency.NONE,
    { method: "GET", path: `animation-runs/${runId}/frames/${frameNumber}/content` },
  );
};

Client.prototype.streamAnimationRuns = function (
  this: Client,
  projectId: string,
  params?: ListParams,
): Paginator<AnimationRun> {
  const base = params ?? ListParams.new();
  return new Paginator<AnimationRun>(async (cursor) => {
    const pageParams = new ListParams({
      before: cursor ?? undefined,
      include_archived: base.include_archived,
      base_asset_id: base.base_asset_id,
    });
    const response = await this.listAnimationRuns(projectId, pageParams);
    return {
      items: response.animations,
      next_cursor: response.next_cursor,
      total: response.total,
    };
  });
};

/** Builder for an animation cost estimate. */
export class AnimationEstimateBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  #animationModel: string | undefined;
  #duration: number | undefined;
  #baseAssetId: string | undefined;

  constructor(client: Client, projectId: string) {
    this.#client = client;
    this.#projectId = projectId;
  }

  /** Sets the animation model (`ash`, `birch` or `cedar`); required. */
  animationModel(animationModel: string): this {
    this.#animationModel = animationModel;
    return this;
  }

  /** Sets the desired duration in seconds. */
  duration(duration: number): this {
    this.#duration = duration;
    return this;
  }

  /** Bases the estimate on an existing sprite asset (its `Asset.id`). */
  baseAssetId(baseAssetId: string): this {
    this.#baseAssetId = baseAssetId;
    return this;
  }

  /** Sends the estimate request. */
  send(): Promise<AnimationEstimate> {
    if (this.#animationModel === undefined) {
      return Promise.reject(
        new ConfigError("animation estimate requires an animation_model"),
      );
    }
    const body = {
      animation_model: this.#animationModel,
      duration: this.#duration,
      base_asset_id: this.#baseAssetId,
    };
    return this.#client.sendJson(
      "tier2",
      "POST /projects/{project_id}/animation-runs/estimate",
      Concurrency.NONE,
      {
        method: "POST",
        path: `projects/${this.#projectId}/animation-runs/estimate`,
        json: body,
      },
      decodeAnimationEstimate,
    );
  }
}

/** Builder for an animation run. */
export class AnimationRunBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  #prompt: string | undefined;
  #animationModel: string | undefined;
  #duration: number | undefined;
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

  /** Sets the animation model (`ash`, `birch` or `cedar`); required. */
  animationModel(animationModel: string): this {
    this.#animationModel = animationModel;
    return this;
  }

  /** Sets the desired duration in seconds. */
  duration(duration: number): this {
    this.#duration = duration;
    return this;
  }

  /**
   * Animates an existing sprite by its sprite asset id (`Asset.id`, as
   * returned by {@link Client.listSpriteAssets}). Omit to generate from
   * scratch.
   */
  baseAssetId(baseAssetId: string): this {
    this.#baseAssetId = baseAssetId;
    return this;
  }

  /** Overrides the idempotency key. Defaults to a fresh UUID v4. */
  requestId(requestId: string): this {
    this.#requestId = requestId;
    return this;
  }

  /** Sends the animation run request. */
  send(): Promise<JobCreated> {
    if (this.#prompt === undefined) {
      return Promise.reject(new ConfigError("animation run requires a prompt"));
    }
    if (this.#animationModel === undefined) {
      return Promise.reject(new ConfigError("animation run requires an animation_model"));
    }
    const body = {
      request_id: this.#requestId ?? randomUUID(),
      prompt: this.#prompt,
      animation_model: this.#animationModel,
      duration: this.#duration,
      base_asset_id: this.#baseAssetId,
    };
    return this.#client.sendJson(
      "tier1",
      "POST /projects/{project_id}/animation-runs",
      Concurrency.HOLD,
      { method: "POST", path: `projects/${this.#projectId}/animation-runs`, json: body },
      decodeJobCreated,
    );
  }
}

/** Builder for animation frame generation. */
export class FrameGenerationBuilder {
  readonly #client: Client;
  readonly #projectId: string;
  readonly #runId: string;
  #fps = 12;
  #requestId: string | undefined;

  constructor(client: Client, projectId: string, runId: string) {
    this.#client = client;
    this.#projectId = projectId;
    this.#runId = runId;
  }

  /** Sets the sampling rate (1–30 fps). Defaults to 12. */
  fps(fps: number): this {
    this.#fps = fps;
    return this;
  }

  /** Overrides the idempotency key. Defaults to a fresh UUID v4. */
  requestId(requestId: string): this {
    this.#requestId = requestId;
    return this;
  }

  /** Sends the frame-generation request. */
  send(): Promise<JobCreated> {
    const body = { request_id: this.#requestId ?? randomUUID(), fps: this.#fps };
    return this.#client.sendJson(
      "tier1",
      "POST /projects/{project_id}/animation-runs/{id}/frames",
      Concurrency.FRAME_GENERATION,
      {
        method: "POST",
        path: `projects/${this.#projectId}/animation-runs/${this.#runId}/frames`,
        json: body,
      },
      decodeJobCreated,
    );
  }
}
