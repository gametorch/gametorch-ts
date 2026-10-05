/** Shared helpers for the live integration suites. */

import {
  Client,
  type Project,
} from "../../src/index.ts";

/** Reads the API key, or `undefined` when live tests should be skipped. */
export function apiKey(): string | undefined {
  const key = process.env["GAMETORCH_API_KEY"];
  return key !== undefined && key.length > 0 ? key : undefined;
}

/** Builds a client from the environment, or `undefined` when unauthenticated. */
export function client(): Client | undefined {
  const key = apiKey();
  if (key === undefined) {
    return undefined;
  }
  const builder = Client.builder().apiKey(key);
  const baseUrl = process.env["GAMETORCH_BASE_URL"];
  if (baseUrl !== undefined && baseUrl.length > 0) {
    builder.baseUrl(baseUrl);
  }
  return builder.build();
}

/** Builds an unauthenticated client against the same base URL. */
export function anonymousClient(): Client | undefined {
  if (apiKey() === undefined) {
    return undefined;
  }
  const builder = Client.builder();
  const baseUrl = process.env["GAMETORCH_BASE_URL"];
  if (baseUrl !== undefined && baseUrl.length > 0) {
    builder.baseUrl(baseUrl);
  }
  return builder.build();
}

/** Whether a `GAMETORCH_*` flag is set to `"1"`. */
export function envEnabled(name: string): boolean {
  return process.env[name] === "1";
}

export function keepProject(): boolean {
  return envEnabled("GAMETORCH_KEEP_PROJECT");
}

/** A short, unique, label-safe token. */
export function shortName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function projectName(kind: string): string {
  return `SDK TS ${kind} ${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Creates a fresh project, or returns `undefined` if this key may not create
 * them.
 */
export async function createProject(
  c: Client,
  kind: string,
): Promise<Project | undefined> {
  try {
    const project = await c.createProject(projectName(kind));
    console.log(`created project '${project.name}' (${project.slug})`);
    return project;
  } catch (err) {
    if (err instanceof Error && "isForbidden" in err && (err as { isForbidden(): boolean }).isForbidden()) {
      console.error("skipping: this key cannot create projects");
      return undefined;
    }
    throw err;
  }
}

/** Deletes the project unless `GAMETORCH_KEEP_PROJECT=1`. */
export async function finishProject(c: Client, slug: string): Promise<void> {
  if (keepProject()) {
    console.log(`keeping project '${slug}' (GAMETORCH_KEEP_PROJECT=1)`);
    return;
  }
  await c.deleteProject(slug);
  console.log(`deleted project '${slug}'`);
}
