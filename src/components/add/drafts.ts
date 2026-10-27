import { addDays, fromInputDate, toInputDate } from "@/lib/dates";
import { tableShelfLifeDays } from "@/lib/shelfLife";
import type { ExpirySource, Location, NewItem, ParsedItem } from "@/lib/types";

/** An editable row on the Review & Confirm screen. */
export type Draft = {
  key: string;
  name: string;
  qty: string;
  unit: string;
  category: string;
  location: Location;
  expiresOn: string; // YYYY-MM-DD or ""
  expirySource: ExpirySource | null;
  confidence: ParsedItem["confidence"];
  barcode: string | null;
  imageUrl: string | null;
  nutrition: Record<string, unknown> | null;
};

let seq = 0;
const nextKey = () => `d${++seq}`;

/** Expiry for a draft: table first, then the AI's days, else blank (backfilled after saving). */
function estimate(
  name: string,
  category: string,
  location: Location,
  aiDays: number | null,
  today: Date,
): Pick<Draft, "expiresOn" | "expirySource"> {
  const table = tableShelfLifeDays(name, category, location);
  if (table != null) return { expiresOn: toInputDate(addDays(today, table)), expirySource: "table" };
  if (aiDays != null) return { expiresOn: toInputDate(addDays(today, aiDays)), expirySource: "ai" };
  return { expiresOn: "", expirySource: null };
}

export function draftFromParsed(
  p: ParsedItem & { nutrition?: Record<string, unknown> | null; expiresAt?: Date | null },
  today: Date,
): Draft {
  const expiry = p.expiresAt
    ? { expiresOn: toInputDate(p.expiresAt), expirySource: "package" as const }
    : estimate(p.name, p.category, p.location, p.estimatedShelfLifeDays, today);
  return {
    key: nextKey(),
    name: p.name,
    qty: String(p.quantity),
    unit: p.unit,
    category: p.category,
    location: p.location,
    ...expiry,
    confidence: p.confidence,
    barcode: p.barcode ?? null,
    imageUrl: p.imageUrl ?? null,
    nutrition: p.nutrition ?? null,
  };
}

/** Change location, re-estimating expiry unless the user/package set it. */
export function moveDraft(d: Draft, location: Location, today: Date): Draft {
  if (d.expirySource === "user" || d.expirySource === "package") return { ...d, location };
  return { ...d, location, ...estimate(d.name, d.category, location, null, today) };
}

export function draftToNewItem(d: Draft): NewItem {
  const qty = Number(d.qty);
  const expiresAt = fromInputDate(d.expiresOn);
  return {
    name: d.name.trim(),
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: d.unit,
    category: d.category,
    location: d.location,
    expiresAt,
    expirySource: expiresAt ? (d.expirySource ?? "user") : null,
    barcode: d.barcode,
    imageUrl: d.imageUrl,
    nutrition: d.nutrition,
  };
}
