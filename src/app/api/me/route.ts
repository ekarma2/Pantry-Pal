import { errorResponse, requireUid } from "@/lib/server/auth";

/** Smoke test for server-side token verification. */
export async function GET(req: Request) {
  try {
    const uid = await requireUid(req);
    return Response.json({ uid });
  } catch (err) {
    return errorResponse(err);
  }
}
