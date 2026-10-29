import "server-only";

import webpush, { WebPushError } from "web-push";
import { HttpError } from "@/lib/server/auth";
import type { StoredPushSubscription } from "@/lib/settings";
import type { DigestMessage } from "@/lib/digest";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new HttpError(503, "Push isn't configured on the server (VAPID keys missing)");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Sends one notification. Returns "gone" when the push service says the
 * subscription no longer exists (uninstalled app, revoked permission), so the
 * caller can forget it. Other failures throw.
 */
export async function sendPush(sub: StoredPushSubscription, message: DigestMessage): Promise<"sent" | "gone"> {
  configure();
  try {
    await webpush.sendNotification(sub, JSON.stringify(message), {
      TTL: 6 * 60 * 60, // a digest older than 6h isn't worth showing
      urgency: "normal",
      topic: "daily-digest", // a newer digest replaces an undelivered one
    });
    return "sent";
  } catch (err) {
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) return "gone";
    throw err;
  }
}
