"use client";

import { doc, getDocFromCache, setDoc } from "firebase/firestore";
import { apiFetch } from "@/lib/api";
import { firestore } from "@/lib/firebase/client";
import { defaultLocationFor } from "@/lib/shelfLife";
import type { BarcodeCacheEntry, ScannedProduct } from "@/lib/barcode";

const cacheDoc = (uid: string, code: string) => doc(firestore(), "users", uid, "barcodeCache", code);

export type LookupResult =
  | { status: "found"; product: ScannedProduct }
  | { status: "unknown" } // not in cache or Open Food Facts
  | { status: "offline" }; // couldn't reach the server; name it by hand

/** Local barcodeCache first (instant, works offline), then the server route. */
export async function lookupBarcode(uid: string, code: string): Promise<LookupResult> {
  try {
    const snap = await getDocFromCache(cacheDoc(uid, code));
    if (snap.exists()) {
      const e = snap.data() as BarcodeCacheEntry;
      return {
        status: "found",
        product: {
          name: e.name,
          quantity: 1,
          unit: "item",
          category: e.category,
          location: defaultLocationFor(e.category),
          estimatedShelfLifeDays: null,
          confidence: "high",
          barcode: code,
          imageUrl: e.imageUrl,
          brand: e.brand,
          nutrition: e.nutrition ?? null,
        },
      };
    }
  } catch {
    // Not cached locally; fall through to the server.
  }

  try {
    const res = await apiFetch(`/api/barcode/${code}`);
    if (!res.ok) return { status: "offline" };
    const product = (await res.json()) as ScannedProduct | null;
    return product ? { status: "found", product } : { status: "unknown" };
  } catch {
    return { status: "offline" };
  }
}

/** Remember the user's name/category for a barcode so the next scan uses it. */
export function rememberBarcode(uid: string, entry: BarcodeCacheEntry) {
  const data: Record<string, unknown> = { barcode: entry.barcode, name: entry.name, category: entry.category };
  if (entry.brand) data.brand = entry.brand;
  if (entry.imageUrl) data.imageUrl = entry.imageUrl;
  if (entry.nutrition) data.nutrition = entry.nutrition;
  setDoc(cacheDoc(uid, entry.barcode), data, { merge: true }).catch((err) => console.error(err));
}
