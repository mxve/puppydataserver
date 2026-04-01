import { BSKY_API, BSKY_CACHE_TTL } from "../config.js";

const bsky_cache = new Map();

export async function fetch_bsky_profile(did) {
  const cached = bsky_cache.get(did);
  const now = Date.now();
  if (cached) {
    if (now - cached.timestamp < BSKY_CACHE_TTL) return cached.data;
    if (!cached.refreshing) {
      cached.refreshing = true;
      fetch(
        `${BSKY_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
        { signal: AbortSignal.timeout(5000) },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          bsky_cache.set(did, {
            data: data ?? cached.data,
            timestamp: Date.now(),
            refreshing: false,
          });
        })
        .catch(() => {
          cached.refreshing = false;
        });
    }
    return cached.data;
  }
  try {
    const r = await fetch(
      `${BSKY_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    const data = r.ok ? await r.json() : null;
    bsky_cache.set(did, { data, timestamp: Date.now(), refreshing: false });
    return data;
  } catch {
    return null;
  }
}
