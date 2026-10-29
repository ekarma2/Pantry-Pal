import "server-only";

import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { buildDigest, localParts, type DigestItem } from "@/lib/digest";
import { sendPush } from "@/lib/server/push";
import { SETTINGS_DOC_ID, settingsFromDoc, type Settings } from "@/lib/settings";

export const settingsRef = (uid: string) => adminDb().doc(`users/${uid}/settings/${SETTINGS_DOC_ID}`);

export async function readSettings(uid: string): Promise<Settings> {
  return settingsFromDoc((await settingsRef(uid).get()).data());
}

/** Active, dated items that could fall inside the digest window. */
async function expiringItems(uid: string, now: Date, warnDays: number): Promise<DigestItem[]> {
  // Range on one field only (no composite index needed); a day of slack covers
  // time zones ahead of UTC, and buildDigest trims to the exact local window.
  const cutoff = Timestamp.fromMillis(now.getTime() + (warnDays + 2) * 86_400_000);
  const snap = await adminDb().collection(`users/${uid}/inventoryItems`).where("expiresAt", "<=", cutoff).get();
  return snap.docs
    .map((d) => d.data())
    .filter((d) => (d.status ?? "active") === "active" && d.expiresAt instanceof Timestamp)
    .map((d) => ({ name: String(d.name ?? "Item"), expiresAt: (d.expiresAt as Timestamp).toDate() }));
}

export type DigestOutcome = "sent" | "nothing" | "gone" | "no-subscription";

/**
 * Builds and sends one user's digest. With `force` (the Settings test button) it
 * also sends when nothing is expiring, so the user can see notifications work.
 */
export async function sendDigest(
  uid: string,
  settings: Settings,
  now: Date,
  { force = false } = {},
): Promise<DigestOutcome> {
  const sub = settings.pushSubscription;
  if (!sub) return "no-subscription";

  const ref: DocumentReference = settingsRef(uid);
  const items = await expiringItems(uid, now, settings.warnDaysBefore);
  const message =
    buildDigest(items, now, settings) ??
    (force
      ? { title: "Pantry Pal", body: "Notifications are working. Nothing is expiring soon.", url: "/" }
      : null);

  const stamp = { lastDigestDate: localParts(now, settings.timezone).date };
  if (!message) {
    if (!force) await ref.set(stamp, { merge: true });
    return "nothing";
  }

  const result = await sendPush(sub, message);
  if (result === "gone") {
    await ref.set({ pushSubscription: FieldValue.delete() }, { merge: true });
    return "gone";
  }
  if (!force) await ref.set(stamp, { merge: true });
  return "sent";
}
