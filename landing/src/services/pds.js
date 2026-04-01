import { readFile } from "fs/promises";
import {
  DISCORD_WEBHOOK_URL,
  PDS_URL,
  STATS_FILE,
  COLLECTION_PAGE_CAP,
} from "../config.js";

export const pds_health = {
  up: true,
  down_since: null,
  notified_down: false,
  fail_count: 0,
};

export async function check_pds_health() {
  let healthy = false;
  try {
    const res = await fetch(`${PDS_URL}/xrpc/_health`, {
      signal: AbortSignal.timeout(500),
    });
    if (res.ok) {
      const data = await res.json();
      healthy = "version" in data;
    }
  } catch {}

  if (healthy) {
    if (!pds_health.up) {
      if (DISCORD_WEBHOOK_URL) {
        fetch(DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: 'PDS is back online!!',
          }),
        }).catch((err) => console.error("Discord health webhook error:", err));
      }
    }
    pds_health.up = true;
    pds_health.down_since = null;
    pds_health.notified_down = false;
    pds_health.fail_count = 0;
  } else {
    pds_health.fail_count++;
    if (pds_health.fail_count >= 3 && pds_health.up) {
      pds_health.up = false;
      pds_health.down_since = new Date();
      if (DISCORD_WEBHOOK_URL) {
        fetch(DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `PDS is down, this may be kinda bad!? \`${PDS_URL}/xrpc/_health\` failed 3 consecutive checks.`,
          }),
        }).catch((err) => console.error("Discord health webhook error:", err));
      }
      pds_health.notified_down = true;
    }
  }
}

export const stats_cache = { users: null, extra: {}, updated_at: null };

export async function refresh_stats() {
  try {
    let users = 0;
    let cursor;
    do {
      const url = new URL(`${PDS_URL}/xrpc/com.atproto.sync.listRepos`);
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("cursor", cursor);
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) break;
      const data = await res.json();
      users += (data.repos || []).length;
      cursor = data.cursor;
    } while (cursor);
    stats_cache.users = users;
  } catch (err) {
    console.error("Stats refresh error:", err);
  }

  if (STATS_FILE) {
    try {
      const text = await readFile(STATS_FILE, "utf8");
      stats_cache.extra = JSON.parse(text);
    } catch {}
  }

  stats_cache.updated_at = new Date();
}

export async function count_collection(did, collection) {
  let count = 0;
  let cursor;
  let pages = 0;
  do {
    const url = new URL(`${PDS_URL}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set("repo", did);
    url.searchParams.set("collection", collection);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) break;
    const data = await res.json();
    count += (data.records || []).length;
    cursor = data.cursor;
    pages++;
  } while (cursor && pages < COLLECTION_PAGE_CAP);
  return { count, capped: !!cursor && pages >= COLLECTION_PAGE_CAP };
}
