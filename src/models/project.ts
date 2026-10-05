/** Project models. */

import { asArray, asRecord, asString, asUuid } from "../decode.ts";
import type { Timestamp } from "../types.ts";

/** A GameTorch project. */
export interface Project {
  id: string;
  name: string;
  /** URL-safe project slug, used by the rename/delete endpoints. */
  slug: string;
  created_at: Timestamp;
}

export function decodeProject(raw: unknown): Project {
  const record = asRecord(raw, "Project");
  return {
    id: asUuid(record["id"], "Project.id"),
    name: asString(record["name"], "Project.name"),
    slug: asString(record["slug"], "Project.slug"),
    created_at: asString(record["created_at"], "Project.created_at"),
  };
}

/** Response from `GET /projects`. */
export interface ProjectsResponse {
  projects: Project[];
}

export function decodeProjectsResponse(raw: unknown): ProjectsResponse {
  const record = asRecord(raw, "ProjectsResponse");
  const projects = asArray(record["projects"] ?? [], "ProjectsResponse.projects");
  return { projects: projects.map((item) => decodeProject(item)) };
}
