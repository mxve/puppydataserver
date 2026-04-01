import { Router } from "express";
import { randomUUID } from "crypto";
import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { rate_limit } from "../middlewares/rateLimit.js";
import { oauth_client, CLIENT_METADATA } from "../lib/oauth.js";
import { BASE_URL, PDS_URL } from "../config.js";
import { notify_discord } from "../services/discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const pending_invites = new Map();

router.get("/oauth/client-metadata.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.json(CLIENT_METADATA);
});

router.post("/oauth/start", rate_limit(5, 60_000), async (req, res) => {
  if (!oauth_client) return res.redirect("/?error=1");
  const handle = (req.body.handle || "").trim().replace(/^@/, "");
  if (!handle) return res.redirect("/?error=1");
  try {
    const resolve_res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resolve_res.ok) return res.redirect("/?error=1");
    const expected_did = (await resolve_res.json()).did;

    const contact = (req.body.contact || "").trim().slice(0, 200);
    const nonce = randomUUID();
    pending_invites.set(nonce, { did: expected_did, contact });
    setTimeout(() => pending_invites.delete(nonce), 600_000);

    const secure = BASE_URL.startsWith("https");
    res.cookie("invite_nonce", nonce, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600_000,
      secure,
    });

    const url = await oauth_client.authorize(handle, { scope: "atproto" });
    res.redirect(url.href);
  } catch (err) {
    console.error("OAuth start error:", err);
    res.redirect("/?error=1");
  }
});

router.get("/oauth/callback", rate_limit(10, 60_000), async (req, res) => {
  if (!oauth_client) return res.redirect("/?error=1");

  const cookie_header = req.headers.cookie || "";
  const nonce = cookie_header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("invite_nonce="))
    ?.split("=")[1];
  const pending = nonce ? pending_invites.get(nonce) : null;
  const expected_did = pending?.did ?? null;
  const contact = pending?.contact ?? "";
  if (nonce) pending_invites.delete(nonce);
  res.clearCookie("invite_nonce");

  try {
    const params = new URLSearchParams(req.url.split("?")[1] || "");
    const { session } = await oauth_client.callback(params);
    const did = session.did;

    if (!expected_did || did !== expected_did) {
      console.warn(
        `OAuth DID mismatch: expected ${expected_did ?? "none"}, got ${did}`,
      );
      return res.redirect("/?error=1");
    }

    const handle = await resolve_handle(did);
    await log_invite_request(did, handle, contact);
    await notify_discord(did, handle, contact);
    res.redirect("/?invited=1");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect("/?error=1");
  }
});

async function resolve_handle(did) {
  try {
    const endpoint = did.startsWith("did:plc:")
      ? `https://plc.directory/${did}`
      : `https://${did.split(":")[2]}/.well-known/did.json`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
    const doc = await res.json();
    const atUri = doc.alsoKnownAs?.find((u) => u.startsWith("at://"));
    return atUri ? atUri.slice(5) : did;
  } catch {
    return did;
  }
}

async function log_invite_request(did, handle, contact) {
  const logsDir = path.join(__dirname, "../../logs");
  await mkdir(logsDir, { recursive: true });
  const entry =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      did,
      handle,
      contact: contact || null,
    }) + "\n";
  await appendFile(path.join(logsDir, "invite-requests.jsonl"), entry);
}

export default router;
