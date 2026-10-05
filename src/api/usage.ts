/** Usage and spending endpoints. */

import { Client } from "../client.ts";
import {
  type Usage,
  type UsageHistogram,
  type UsageRecord,
  decodeUsage,
  decodeUsageHistogram,
} from "../models/index.ts";
import { Paginator } from "../paginator.ts";
import { Concurrency } from "../rate-limit.ts";
import { compactQuery } from "./common.ts";

declare module "../client.ts" {
  interface Client {
    /** Credit balance (admins), per-source summary and operation log. `GET /usage` */
    usage(before?: string, split?: string): Promise<Usage>;
    /** Dense time buckets of spend split by source. `GET /usage/histogram` */
    usageHistogram(range?: string, source?: string, split?: string): Promise<UsageHistogram>;
    /** Streams the operation log page by page. */
    streamUsage(split?: string): Paginator<UsageRecord>;
  }
}

Client.prototype.usage = function (
  this: Client,
  before?: string,
  split?: string,
): Promise<Usage> {
  const query = compactQuery({ before, split });
  return this.sendJson(
    "tier2",
    "GET /usage",
    Concurrency.NONE,
    { method: "GET", path: "usage", query },
    decodeUsage,
  );
};

Client.prototype.usageHistogram = function (
  this: Client,
  range?: string,
  source?: string,
  split?: string,
): Promise<UsageHistogram> {
  const query = compactQuery({ range, source, split });
  return this.sendJson(
    "tier2",
    "GET /usage/histogram",
    Concurrency.NONE,
    { method: "GET", path: "usage/histogram", query },
    decodeUsageHistogram,
  );
};

Client.prototype.streamUsage = function (this: Client, split?: string): Paginator<UsageRecord> {
  return new Paginator<UsageRecord>(async (cursor) => {
    const response = await this.usage(cursor ?? undefined, split);
    return {
      items: response.records,
      next_cursor: response.next_cursor,
      total: response.total,
    };
  });
};
