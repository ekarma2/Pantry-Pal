import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { isDigestDue } from "@/lib/digest";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { sendDigest, type DigestOutcome } from "@/lib/server/digest";
import { SETTINGS_DOC_ID, settingsFromDoc } from "@/lib/settings";

export const maxDuration = 60;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET is not configured");
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Unauthorized");
  }
}

/**
 * Runs hourly. Each user gets one digest per local day, on the first run at or
 * after their notifyTime, so a missed or late run catches up instead of skipping.
 */
async function run(req: Request): Promise<Response> {
  try {
    requireCronSecret(req);
    const now = new Date();

    const snap = await adminDb().collectionGroup("settings").get();
    const due = snap.docs
      .filter((d) => d.id === SETTINGS_DOC_ID && d.ref.parent.parent)
      .map((d) => ({ uid: d.ref.parent.parent!.id, settings: settingsFromDoc(d.data()) }))
      .filter(({ settings }) => isDigestDue(settings, now));

    const results = await Promise.allSettled(due.map(({ uid, settings }) => sendDigest(uid, settings, now)));
    const counts: Record<DigestOutcome | "failed", number> = {
      sent: 0,
      nothing: 0,
      gone: 0,
      "no-subscription": 0,
      failed: 0,
    };
    results.forEach((r, i) => {
      if (r.status === "fulfilled") counts[r.value]++;
      else {
        counts.failed++;
        console.error(`Digest failed for ${due[i].uid}`, r.reason); // retried next hour
      }
    });

    return Response.json({ checked: snap.size, due: due.length, ...counts });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = run;
export const POST = run;
