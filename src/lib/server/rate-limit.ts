import "server-only";

import { HttpError } from "@/lib/server/auth";

// In-memory sliding window per user and bucket. Per server instance only, which
// is fine for a single-user MVP; move to a Firestore counter if that changes.
const hits = new Map<string, number[]>();

export function rateLimit(uid: string, bucket: string, limit: number, windowMs = 60_000) {
  const key = `${bucket}:${uid}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    throw new HttpError(429, "Too many requests, slow down a little");
  }
  recent.push(now);
  hits.set(key, recent);
}
