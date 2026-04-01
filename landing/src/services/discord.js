import { DISCORD_WEBHOOK_URL } from "../config.js";

export async function notify_discord(did, handle, contact) {
  if (!DISCORD_WEBHOOK_URL) return;
  const contact_line = contact ? `\n**Contact:** ${contact}` : "";
  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `Invite requested!!\n**Handle:** ${handle}\n**DID:** \`${did}\`${contact_line}`,
    }),
  }).catch((err) => console.error("Discord webhook error:", err));
}
