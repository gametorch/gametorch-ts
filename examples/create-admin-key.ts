/**
 * Creates an admin-scoped API key with a name, spend limit, reset cadence and
 * expiry. Requires an admin key. The full key is shown once. No credits spent.
 *
 *   GAMETORCH_API_KEY=gt2_... node examples/create-admin-key.ts
 */

import { Client, CreateApiKeyRequest, SpendResetCadence } from "../src/index.ts";

const client = Client.fromEnv();
const created = await client.createKey(
  CreateApiKeyRequest.admin()
    .withName(`Admin CI key ${Date.now()}`)
    .maxSpendLimit("5000")
    .spendResetCadence(SpendResetCadence.Monthly)
    .expiresAt(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()),
);

console.log(`created key ${created.key.id} (prefix ${created.key.key_prefix})`);
console.log(`scope: ${created.key.key_scope}, project: ${created.key.project_id ?? "none"}`);
console.log(`key_full (shown once): ${created.key_full}`);
