import "server-only";

import { unstable_rethrow } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Verifies the `Authorization: Bearer <Firebase ID token>` header and returns the uid. */
export async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Missing auth token");

  const auth = adminAuth(); // throws (-> 500) if Admin credentials are missing
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new HttpError(401, "Invalid auth token");
  }
}

export function errorResponse(err: unknown): Response {
  // Let Next.js control-flow errors (e.g. prerender bailouts) propagate.
  unstable_rethrow(err);
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
