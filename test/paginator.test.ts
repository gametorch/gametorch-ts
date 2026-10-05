/** Paginator behavior with a stubbed page fetcher. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { Paginator, type Page } from "../src/index.ts";

function makePages(pages: number[][]): {
  fetch: (cursor: string | null) => Promise<Page<number>>;
  cursors: Array<string | null>;
} {
  const cursors: Array<string | null> = [];
  const fetch = (cursor: string | null): Promise<Page<number>> => {
    cursors.push(cursor);
    const index = cursor === null ? 0 : Number.parseInt(cursor, 10);
    const items = pages[index] ?? [];
    const next = index + 1 < pages.length ? String(index + 1) : null;
    return Promise.resolve({ items, next_cursor: next, total: pages.flat().length });
  };
  return { fetch, cursors };
}

test("nextItem walks every page", async () => {
  const { fetch, cursors } = makePages([
    [1, 2],
    [3],
    [4, 5],
  ]);
  const paginator = new Paginator(fetch);
  const seen: number[] = [];
  for (;;) {
    const item = await paginator.nextItem();
    if (item === null) {
      break;
    }
    seen.push(item);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
  assert.equal(paginator.total, 5);
  assert.deepEqual(cursors, [null, "1", "2"]);
});

test("async iteration yields items in order", async () => {
  const { fetch } = makePages([[1, 2], [3]]);
  const seen: number[] = [];
  for await (const item of new Paginator(fetch)) {
    seen.push(item);
  }
  assert.deepEqual(seen, [1, 2, 3]);
});

test("nextPage returns null when exhausted", async () => {
  const { fetch } = makePages([[]]);
  const paginator = new Paginator(fetch);
  assert.equal(await paginator.nextPage(), null);
});

test("a fetch error rejects and stops iteration", async () => {
  const paginator = new Paginator(() => Promise.reject(new Error("boom")));
  await assert.rejects(() => paginator.nextItem(), /boom/);
  assert.equal(await paginator.nextItem(), null);
});
