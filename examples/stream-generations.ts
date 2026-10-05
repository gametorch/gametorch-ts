/**
 * Streams a project's generations, fetching pages on demand (read-only).
 *
 *   GAMETORCH_API_KEY=gt2_... GAMETORCH_PROJECT=<uuid-or-slug> \
 *     node examples/stream-generations.ts
 *
 * Without `GAMETORCH_PROJECT`, the first project in scope is used.
 */

import { Client } from "../src/index.ts";

const client = Client.fromEnv();

let projectId = process.env["GAMETORCH_PROJECT"];
if (projectId === undefined || projectId.length === 0) {
  const projects = await client.listProjects();
  projectId = projects.projects[0]?.id;
}
if (projectId === undefined) {
  throw new Error("no project available; set GAMETORCH_PROJECT");
}

const generations = client.streamGenerations(projectId, false);
let count = 0;
for await (const generation of generations) {
  console.log(`${generation.id}  ${generation.status}  ${generation.prompt}`);
  count += 1;
  if (count >= 20) {
    break;
  }
}
console.log(`streamed ${count} generation(s), total reported ${generations.total ?? "?"}`);
