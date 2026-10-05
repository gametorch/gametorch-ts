/** Animation export endpoints. */

import { Client } from "../client.ts";
import {
  type Export,
  type ExportPlan,
  type GodotExport,
  type TexturePackerExport,
  decodeExportPlan,
  decodeGodotExport,
  decodeTexturePackerExport,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";
import type { Download, ExportFormat } from "../types.ts";

interface RangeBody {
  start_frame: number;
  end_frame: number;
}

function rangeBody(start_frame: number, end_frame: number): RangeBody {
  return { start_frame, end_frame };
}

declare module "../client.ts" {
  interface Client {
    /** Returns the export plan without building a file. */
    exportPlan(runId: string, startFrame: number, endFrame: number): Promise<ExportPlan>;
    /** Builds and returns an export in the requested format. */
    export(
      runId: string,
      format: ExportFormat,
      startFrame: number,
      endFrame: number,
    ): Promise<Export>;
    /** Exports a TexturePacker JSON atlas (structured JSON). */
    exportTexturepacker(
      runId: string,
      startFrame: number,
      endFrame: number,
    ): Promise<TexturePackerExport>;
    /** Exports a Godot `.tres` and PNG (structured JSON). */
    exportGodot(runId: string, startFrame: number, endFrame: number): Promise<GodotExport>;
    /** Exports a zipped TexturePacker JSON atlas. */
    exportTexturepackerZip(
      runId: string,
      startFrame: number,
      endFrame: number,
    ): Promise<Download>;
    /** Exports an Aseprite file. */
    exportAseprite(runId: string, startFrame: number, endFrame: number): Promise<Download>;
    /** Exports a zipped Godot `.tres` and PNG. */
    exportGodotZip(runId: string, startFrame: number, endFrame: number): Promise<Download>;
    /** Exports a single grid-strip PNG. */
    exportGrid(runId: string, startFrame: number, endFrame: number): Promise<Download>;
    /** Exports a GameMaker strip PNG. */
    exportGamemaker(runId: string, startFrame: number, endFrame: number): Promise<Download>;
    /** Exports a zipped numbered PNG sequence. */
    exportSequenceZip(runId: string, startFrame: number, endFrame: number): Promise<Download>;
    /** @internal */
    exportBinary(
      runId: string,
      format: ExportFormat,
      startFrame: number,
      endFrame: number,
    ): Promise<Download>;
  }
}

Client.prototype.exportPlan = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<ExportPlan> {
  return this.sendJson(
    "tier1",
    "POST /animation-runs/{id}/export-plan",
    Concurrency.NONE,
    { method: "POST", path: `animation-runs/${runId}/export-plan`, json: rangeBody(startFrame, endFrame) },
    decodeExportPlan,
  );
};

Client.prototype.export = function (
  this: Client,
  runId: string,
  format: ExportFormat,
  startFrame: number,
  endFrame: number,
): Promise<Export> {
  switch (format) {
    case "texturepacker":
      return this.exportTexturepacker(runId, startFrame, endFrame).then((value) => ({
        kind: "texturepacker" as const,
        value,
      }));
    case "godot":
      return this.exportGodot(runId, startFrame, endFrame).then((value) => ({
        kind: "godot" as const,
        value,
      }));
    default:
      return this.exportBinary(runId, format, startFrame, endFrame).then((value) => ({
        kind: "binary" as const,
        value,
      }));
  }
};

Client.prototype.exportTexturepacker = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<TexturePackerExport> {
  return this.sendJson(
    "tier1",
    "POST /animation-runs/{id}/export/texturepacker",
    Concurrency.NONE,
    {
      method: "POST",
      path: `animation-runs/${runId}/export/texturepacker`,
      json: rangeBody(startFrame, endFrame),
    },
    decodeTexturePackerExport,
  );
};

Client.prototype.exportGodot = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<GodotExport> {
  return this.sendJson(
    "tier1",
    "POST /animation-runs/{id}/export/godot",
    Concurrency.NONE,
    {
      method: "POST",
      path: `animation-runs/${runId}/export/godot`,
      json: rangeBody(startFrame, endFrame),
    },
    decodeGodotExport,
  );
};

/** @internal */
Client.prototype.exportBinary = function (
  this: Client,
  runId: string,
  format: ExportFormat,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.sendDownload(
    "tier1",
    "POST /animation-runs/{id}/export/{format}",
    Concurrency.NONE,
    {
      method: "POST",
      path: `animation-runs/${runId}/export/${format}`,
      json: rangeBody(startFrame, endFrame),
    },
  );
};

Client.prototype.exportTexturepackerZip = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "texturepacker.zip", startFrame, endFrame);
};

Client.prototype.exportAseprite = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "aseprite", startFrame, endFrame);
};

Client.prototype.exportGodotZip = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "godot.zip", startFrame, endFrame);
};

Client.prototype.exportGrid = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "grid", startFrame, endFrame);
};

Client.prototype.exportGamemaker = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "gamemaker", startFrame, endFrame);
};

Client.prototype.exportSequenceZip = function (
  this: Client,
  runId: string,
  startFrame: number,
  endFrame: number,
): Promise<Download> {
  return this.exportBinary(runId, "sequence.zip", startFrame, endFrame);
};
