import { errorResponse, HttpError, requireUid } from "@/lib/server/auth";
import { readSettings, sendDigest } from "@/lib/server/digest";
import { rateLimit } from "@/lib/server/rate-limit";

/** Sends the user's digest right now (Settings → "Send a test"), whether or not it's due. */
export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    rateLimit(uid, "push-test", 5);

    const settings = await readSettings(uid);
    const outcome = await sendDigest(uid, settings, new Date(), { force: true });
    if (outcome === "no-subscription") throw new HttpError(400, "Turn on notifications first");
    if (outcome === "gone") throw new HttpError(410, "This device's subscription expired. Turn notifications on again.");
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
