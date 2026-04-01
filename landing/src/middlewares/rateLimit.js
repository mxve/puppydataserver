const rate_limit_windows = new Map();

export function rate_limit(max_requests, window_ms) {
  return (req, res, next) => {
    const client_ip =
      req.headers["cf-connecting-ip"] ||
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown";
    const key = client_ip + ":" + req.path.split("/")[1];
    const now = Date.now();
    const cutoff = now - window_ms;
    const hits = (rate_limit_windows.get(key) || []).filter((t) => t > cutoff);
    if (hits.length >= max_requests) {
      res.status(429).send("Too Many Requests");
      return;
    }
    hits.push(now);
    rate_limit_windows.set(key, hits);
    next();
  };
}

setInterval(() => {
  const cutoff = Date.now() - 300_000;
  for (const [key, hits] of rate_limit_windows) {
    const pruned = hits.filter((t) => t > cutoff);
    if (pruned.length === 0) rate_limit_windows.delete(key);
    else rate_limit_windows.set(key, pruned);
  }
}, 60_000);
