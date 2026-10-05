/** Label endpoints. */

import { Client } from "../client.ts";
import {
  type Label,
  type LabelAssociation,
  type LabelItems,
  type LabelsResponse,
  decodeLabel,
  decodeLabelAssociation,
  decodeLabelItems,
  decodeLabelsResponse,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";
import { type OkResponse, decodeOkResponse } from "../types.ts";

declare module "../client.ts" {
  interface Client {
    /** Lists a project's labels. `GET /projects/{project_id}/labels` */
    listLabels(projectId: string): Promise<LabelsResponse>;
    /** Creates a label. `POST /projects/{project_id}/labels` */
    createLabel(projectId: string, name: string, color?: string | null): Promise<Label>;
    /** Updates a label's name and/or color. `PATCH /labels/{label_id}` */
    updateLabel(labelId: string, name?: string | null, color?: string | null): Promise<Label>;
    /** Deletes a label. `DELETE /labels/{label_id}` */
    deleteLabel(labelId: string): Promise<OkResponse>;
    /** Lists the items tagged with a label. `GET /labels/{label_id}/items` */
    labelItems(labelId: string): Promise<LabelItems>;
    /** Sets or clears a label's cover thumbnail. `POST /labels/{label_id}/thumbnail` */
    setLabelThumbnail(labelId: string, assetId: string | null): Promise<Label>;
    /** Adds a label to a sprite asset. `POST /assets/{asset_id}/labels` */
    associateAssetLabel(assetId: string, name: string): Promise<LabelAssociation>;
    /** Removes a label from a sprite asset. `DELETE /assets/{asset_id}/labels` */
    removeAssetLabel(assetId: string, name: string): Promise<LabelAssociation>;
    /** Dismisses a suggested label for a sprite asset. */
    dismissAssetLabelSuggestion(assetId: string, name: string): Promise<OkResponse>;
    /** Adds a label to a sound asset. */
    associateSoundLabel(assetId: string, name: string): Promise<LabelAssociation>;
    /** Removes a label from a sound asset. */
    removeSoundLabel(assetId: string, name: string): Promise<LabelAssociation>;
    /** Dismisses a suggested label for a sound asset. */
    dismissSoundLabelSuggestion(assetId: string, name: string): Promise<OkResponse>;
    /** Adds a label to a saved animation. */
    associateSavedAnimationLabel(id: string, name: string): Promise<LabelAssociation>;
    /** Removes a label from a saved animation. */
    removeSavedAnimationLabel(id: string, name: string): Promise<LabelAssociation>;
  }
}

Client.prototype.listLabels = function (this: Client, projectId: string): Promise<LabelsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects/{project_id}/labels",
    Concurrency.NONE,
    { method: "GET", path: `projects/${projectId}/labels` },
    decodeLabelsResponse,
  );
};

Client.prototype.createLabel = function (
  this: Client,
  projectId: string,
  name: string,
  color?: string | null,
): Promise<Label> {
  const body: Record<string, unknown> = { name };
  if (color !== undefined && color !== null) {
    body["color"] = color;
  }
  return this.sendJson(
    "writes",
    "POST /projects/{project_id}/labels",
    Concurrency.NONE,
    { method: "POST", path: `projects/${projectId}/labels`, json: body },
    decodeLabel,
  );
};

Client.prototype.updateLabel = function (
  this: Client,
  labelId: string,
  name?: string | null,
  color?: string | null,
): Promise<Label> {
  const body: Record<string, unknown> = {};
  if (name !== undefined && name !== null) {
    body["name"] = name;
  }
  if (color !== undefined && color !== null) {
    body["color"] = color;
  }
  return this.sendJson(
    "writes",
    "PATCH /labels/{label_id}",
    Concurrency.NONE,
    { method: "PATCH", path: `labels/${labelId}`, json: body },
    decodeLabel,
  );
};

Client.prototype.deleteLabel = function (this: Client, labelId: string): Promise<OkResponse> {
  return this.sendAck("writes", "DELETE /labels/{label_id}", Concurrency.NONE, {
    method: "DELETE",
    path: `labels/${labelId}`,
  });
};

Client.prototype.labelItems = function (this: Client, labelId: string): Promise<LabelItems> {
  return this.sendJson(
    "tier2",
    "GET /labels/{label_id}/items",
    Concurrency.NONE,
    { method: "GET", path: `labels/${labelId}/items` },
    decodeLabelItems,
  );
};

Client.prototype.setLabelThumbnail = function (
  this: Client,
  labelId: string,
  assetId: string | null,
): Promise<Label> {
  return this.sendJson(
    "writes",
    "POST /labels/{label_id}/thumbnail",
    Concurrency.NONE,
    { method: "POST", path: `labels/${labelId}/thumbnail`, json: { asset_id: assetId } },
    decodeLabel,
  );
};

Client.prototype.associateAssetLabel = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "POST /assets/{asset_id}/labels",
    Concurrency.NONE,
    { method: "POST", path: `assets/${assetId}/labels`, json: { name } },
    decodeLabelAssociation,
  );
};

Client.prototype.removeAssetLabel = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "DELETE /assets/{asset_id}/labels",
    Concurrency.NONE,
    { method: "DELETE", path: `assets/${assetId}/labels`, query: { name } },
    decodeLabelAssociation,
  );
};

Client.prototype.dismissAssetLabelSuggestion = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<OkResponse> {
  return this.sendJson(
    "writes",
    "DELETE /assets/{asset_id}/label-suggestions",
    Concurrency.NONE,
    { method: "DELETE", path: `assets/${assetId}/label-suggestions`, query: { name } },
    decodeOkResponse,
  );
};

Client.prototype.associateSoundLabel = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "POST /sound-assets/{asset_id}/labels",
    Concurrency.NONE,
    { method: "POST", path: `sound-assets/${assetId}/labels`, json: { name } },
    decodeLabelAssociation,
  );
};

Client.prototype.removeSoundLabel = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "DELETE /sound-assets/{asset_id}/labels",
    Concurrency.NONE,
    { method: "DELETE", path: `sound-assets/${assetId}/labels`, query: { name } },
    decodeLabelAssociation,
  );
};

Client.prototype.dismissSoundLabelSuggestion = function (
  this: Client,
  assetId: string,
  name: string,
): Promise<OkResponse> {
  return this.sendJson(
    "writes",
    "DELETE /sound-assets/{asset_id}/label-suggestions",
    Concurrency.NONE,
    { method: "DELETE", path: `sound-assets/${assetId}/label-suggestions`, query: { name } },
    decodeOkResponse,
  );
};

Client.prototype.associateSavedAnimationLabel = function (
  this: Client,
  id: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "POST /saved-animations/{id}/labels",
    Concurrency.NONE,
    { method: "POST", path: `saved-animations/${id}/labels`, json: { name } },
    decodeLabelAssociation,
  );
};

Client.prototype.removeSavedAnimationLabel = function (
  this: Client,
  id: string,
  name: string,
): Promise<LabelAssociation> {
  return this.sendJson(
    "writes",
    "DELETE /saved-animations/{id}/labels",
    Concurrency.NONE,
    { method: "DELETE", path: `saved-animations/${id}/labels`, query: { name } },
    decodeLabelAssociation,
  );
};
