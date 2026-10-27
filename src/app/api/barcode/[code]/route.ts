import { adminDb } from "@/lib/firebase/admin";
import {
  categoryFromOffTags,
  isValidBarcode,
  normalizeBarcode,
  type BarcodeCacheEntry,
  type ScannedProduct,
} from "@/lib/barcode";
import { errorResponse, HttpError, requireUid } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { defaultLocationFor } from "@/lib/shelfLife";

const OFF_FIELDS = "product_name,generic_name,brands,categories_tags,image_front_small_url,nutriments,nutriscore_grade";

type OffProduct = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
  nutriscore_grade?: string;
};

function toProduct(entry: BarcodeCacheEntry): ScannedProduct {
  return {
    name: entry.name,
    quantity: 1,
    unit: "item",
    category: entry.category,
    location: defaultLocationFor(entry.category),
    estimatedShelfLifeDays: null,
    confidence: "high",
    barcode: entry.barcode,
    imageUrl: entry.imageUrl,
    brand: entry.brand,
    nutrition: entry.nutrition ?? null,
  };
}

async function lookupOpenFoodFacts(code: string): Promise<BarcodeCacheEntry | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, {
    headers: { "User-Agent": "PantryPal/0.1 (personal pantry tracker)" },
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, "Product lookup failed");
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  const p = body.product;
  const name = (p?.product_name || p?.generic_name || "").trim();
  if (body.status !== 1 || !p || !name) return null;

  const entry: BarcodeCacheEntry = {
    barcode: code,
    name,
    category: categoryFromOffTags(p.categories_tags),
  };
  const brand = p.brands?.split(",")[0]?.trim();
  if (brand) entry.brand = brand;
  if (p.image_front_small_url) entry.imageUrl = p.image_front_small_url;
  if (p.nutriments) entry.nutrition = { ...p.nutriments, nutriscore_grade: p.nutriscore_grade ?? null };
  return entry;
}

/** ScannedProduct | null: checks the user's barcodeCache first, then Open Food Facts. */
export async function GET(req: Request, ctx: RouteContext<"/api/barcode/[code]">) {
  try {
    const uid = await requireUid(req);
    rateLimit(uid, "barcode", 60);

    const code = normalizeBarcode((await ctx.params).code);
    if (!isValidBarcode(code)) throw new HttpError(400, "Invalid barcode");

    const cacheRef = adminDb().doc(`users/${uid}/barcodeCache/${code}`);
    const cached = await cacheRef.get();
    if (cached.exists) return Response.json(toProduct(cached.data() as BarcodeCacheEntry));

    const entry = await lookupOpenFoodFacts(code);
    if (!entry) return Response.json(null);

    await cacheRef.set(entry);
    return Response.json(toProduct(entry));
  } catch (err) {
    return errorResponse(err);
  }
}
