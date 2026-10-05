/** Project endpoints. */

import { Client } from "../client.ts";
import {
  type Project,
  type ProjectsResponse,
  decodeProject,
  decodeProjectsResponse,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";
import type { OkResponse } from "../types.ts";

declare module "../client.ts" {
  interface Client {
    /** Lists the projects in the caller's scope. `GET /projects` */
    listProjects(): Promise<ProjectsResponse>;
    /** Creates a project owned by the caller's scope. `POST /projects` */
    createProject(name: string): Promise<Project>;
    /** Renames a project. The slug may change. `PATCH /projects/{slug}` */
    renameProject(slug: string, name: string): Promise<Project>;
    /** Permanently deletes a project and its generations/assets. `DELETE /projects/{slug}` */
    deleteProject(slug: string): Promise<OkResponse>;
  }
}

Client.prototype.listProjects = function (this: Client): Promise<ProjectsResponse> {
  return this.sendJson(
    "tier2",
    "GET /projects",
    Concurrency.NONE,
    { method: "GET", path: "projects" },
    decodeProjectsResponse,
  );
};

Client.prototype.createProject = function (this: Client, name: string): Promise<Project> {
  return this.sendJson(
    "writes",
    "POST /projects",
    Concurrency.NONE,
    { method: "POST", path: "projects", json: { name } },
    decodeProject,
  );
};

Client.prototype.renameProject = function (
  this: Client,
  slug: string,
  name: string,
): Promise<Project> {
  return this.sendJson(
    "writes",
    "PATCH /projects/{slug}",
    Concurrency.NONE,
    { method: "PATCH", path: `projects/${encodeURIComponent(slug)}`, json: { name } },
    decodeProject,
  );
};

Client.prototype.deleteProject = function (this: Client, slug: string): Promise<OkResponse> {
  return this.sendAck("writes", "DELETE /projects/{slug}", Concurrency.NONE, {
    method: "DELETE",
    path: `projects/${encodeURIComponent(slug)}`,
  });
};
