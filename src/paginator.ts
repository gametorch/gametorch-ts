/**
 * An asynchronous cursor over a paginated GameTorch list endpoint.
 *
 * Created by the `stream*` methods on {@link Client}.
 *
 * ```ts
 * for await (const generation of client.streamGenerations(projectId)) {
 *   console.log(generation.id);
 * }
 * ```
 */

import type { Page } from "./types.ts";

/** Fetches a single page for a cursor (or the first page when `null`). */
export type PageFetcher<T> = (cursor: string | null) => Promise<Page<T>>;

export class Paginator<T> implements AsyncIterable<T> {
  readonly #fetch: PageFetcher<T>;
  #cursor: string | null = null;
  #finished = false;
  #buffer: T[] = [];
  #index = 0;
  #total: number | null = null;

  constructor(fetch: PageFetcher<T>) {
    this.#fetch = fetch;
  }

  /**
   * The total number of items reported by the API, once the first page has been
   * fetched.
   */
  get total(): number | null {
    return this.#total;
  }

  /**
   * Fetches the next page, or `null` when the cursor is exhausted. Items are
   * returned as they arrive; errors reject.
   */
  async nextPage(): Promise<T[] | null> {
    if (this.#finished) {
      return null;
    }
    let page: Page<T>;
    try {
      page = await this.#fetch(this.#cursor);
    } catch (err) {
      this.#finished = true;
      throw err;
    }
    this.#total = page.total;
    this.#cursor = page.next_cursor;
    if (this.#cursor === null) {
      this.#finished = true;
    }
    if (page.items.length === 0 && this.#finished) {
      return null;
    }
    return page.items;
  }

  /** Fetches the next item, transparently loading pages as needed. */
  async nextItem(): Promise<T | null> {
    for (;;) {
      if (this.#index < this.#buffer.length) {
        const item = this.#buffer[this.#index];
        this.#index += 1;
        if (item !== undefined) {
          return item;
        }
        continue;
      }
      const items = await this.nextPage();
      if (items === null) {
        return null;
      }
      this.#buffer = items;
      this.#index = 0;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (;;) {
      const item = await this.nextItem();
      if (item === null) {
        return;
      }
      yield item;
    }
  }
}
