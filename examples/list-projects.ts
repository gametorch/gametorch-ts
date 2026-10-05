/**
 * Lists the projects in the caller's scope (read-only).
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/list-projects.ts
 */

import { Client } from "../src/index.ts";

const client = Client.fromEnv();
const projects = await client.listProjects();

if (projects.projects.length === 0) {
  console.log("no projects yet");
} else {
  for (const project of projects.projects) {
    console.log(`${project.id}  ${project.slug.padEnd(32)} ${project.name}`);
  }
}
