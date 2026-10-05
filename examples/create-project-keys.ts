/**
 * Creates a project, then a project-scoped read-only key and read/write key
 * with names, spend limits, reset cadence and expiry; then cleans everything
 * up. Requires an admin key. No credits spent.
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/create-project-keys.ts
 */

import { Client, CreateApiKeyRequest, SpendResetCadence } from "../src/index.ts";

const client = Client.fromEnv();
const project = await client.createProject(`Project Keys Example ${Date.now()}`);
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
console.log(`created project '${project.name}' (${project.slug})`);

try {
  const read = await client.createKey(
    CreateApiKeyRequest.projectRead(project.id)
      .withName("CI read key")
      .maxSpendLimit("0")
      .spendResetCadence(SpendResetCadence.Monthly)
      .expiresAt(expiresAt),
  );
  console.log(`read key: scope ${read.key.key_scope}, project ${read.key.project_id}`);
  console.log(`  key_full (shown once): ${read.key_full}`);

  const write = await client.createKey(
    CreateApiKeyRequest.projectWrite(project.id)
      .withName("CI write key")
      .maxSpendLimit("500")
      .spendResetCadence(SpendResetCadence.Weekly)
      .expiresAt(expiresAt),
  );
  console.log(`write key: scope ${write.key.key_scope}, limit ${write.key.max_spend_limit}`);
  console.log(`  key_full (shown once): ${write.key_full}`);

  await client.deleteKey(read.key.id);
  await client.deleteKey(write.key.id);
} finally {
  await client.deleteProject(project.slug);
  console.log(`deleted project '${project.slug}'`);
}
