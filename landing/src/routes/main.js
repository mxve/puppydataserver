import { Router } from "express";
import { rate_limit } from "../middlewares/rateLimit.js";
import { fetch_bsky_profile } from "../services/bsky.js";
import { pds_health, stats_cache, count_collection } from "../services/pds.js";
import { PDS_URL } from "../config.js";

const router = Router();

router.get("/", (req, res) => {
  const pds_down = !pds_health.up;
  const s = { ...stats_cache };
  const ex = s.extra || {};
  const has_stats =
    !pds_down &&
    (s.users !== null ||
      ex.records != null ||
      ex.blobs != null ||
      ex.disk_gb != null);

  const stats_items = [];
  if (has_stats) {
    if (s.users !== null) {
      stats_items.push({
        icon: "users",
        value: s.users.toLocaleString(),
        label: "accounts",
      });
    }
    if (ex.blobs != null) {
      stats_items.push({
        icon: "paperclip",
        value: Number(ex.blobs).toLocaleString(),
        label: "blobs",
      });
    }
    if (ex.disk_gb != null) {
      stats_items.push({
        icon: "hard-drive",
        value:
          Number(ex.disk_gb).toLocaleString(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          }) + " GB",
        label: "storage",
      });
    }
    if (ex.custom) {
      ex.custom.forEach((c) => {
        stats_items.push({
          icon: c.icon || "bar-chart-2",
          value: c.value,
          label: c.label,
        });
      });
    }
  }

  res.render("index", {
    title: "PuppyDataServer",
    description: "a small doghouse on atproto ♡",
    invited: req.query.invited === "1",
    error: req.query.error === "1",
    pds_down,
    down_since: pds_health.down_since,
    has_stats,
    stats_items,
  });
});

router.get("/profile/:handle", rate_limit(20, 60_000), async (req, res) => {
  const input = req.params.handle.replace(/^@/, "");
  const render_error = (msg) =>
    res.render("profile", {
      title: "Profile - PuppyDataServer",
      description: "",
      error: msg,
      profile: null,
    });

  if (!pds_health.up)
    return render_error(
      "The PDS is currently unavailable. Please try again later.",
    );

  try {
    let did;
    if (input.startsWith("did:")) {
      did = input;
    } else {
      const r = await fetch(
        `${PDS_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(input)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) return render_error("Handle not found on this server.");
      did = (await r.json()).did;
    }

    const describe_res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!describe_res.ok) return render_error("User not found on this server.");
    const describe = await describe_res.json();
    const collections = describe.collections || [];

    const counts = await Promise.all(
      collections.map(async (col) => {
        const { count, capped } = await count_collection(did, col);
        return { collection: col, count, capped };
      }),
    );
    counts.sort((a, b) => b.count - a.count);
    const total_records = counts.reduce((s, c) => s + c.count, 0);

    const likes_entry = counts.find(
      (c) => c.collection === "app.bsky.feed.like",
    );
    const reposts_entry = counts.find(
      (c) => c.collection === "app.bsky.feed.repost",
    );

    let pds_profile = null;
    try {
      const pr = await fetch(
        `${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (pr.ok) pds_profile = (await pr.json()).value;
    } catch {}

    const avatar_cid = pds_profile?.avatar?.ref?.["$link"];
    const avatar_url = avatar_cid
      ? `${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(avatar_cid)}`
      : null;

    const bsky = await fetch_bsky_profile(did);

    const handle = describe.handle;
    const display_name = pds_profile?.displayName || bsky?.displayName || null;
    res.render("profile", {
      title: `${display_name || handle} - PuppyDataServer`,
      description: `${handle} on PuppyDataServer`,
      error: null,
      profile: {
        did,
        handle,
        display_name,
        avatar: avatar_url,
        followers_count: bsky?.followersCount ?? null,
        follows_count: bsky?.followsCount ?? null,
        posts_count: bsky?.postsCount ?? null,
        likes_given: likes_entry?.count ?? null,
        likes_capped: likes_entry?.capped ?? false,
        reposts_count: reposts_entry?.count ?? null,
        reposts_capped: reposts_entry?.capped ?? false,
        total_records,
        total_capped: counts.some((c) => c.capped),
        collections_count: counts.length,
      },
    });
  } catch (err) {
    console.error("Profile error:", err);
    render_error("Something went wrong, please try again.");
  }
});

export default router;
