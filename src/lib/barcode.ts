import type { ParsedItem } from "@/lib/types";

/** A barcode lookup result: a ParsedItem plus extra product data worth keeping. */
export type ScannedProduct = ParsedItem & {
  barcode: string;
  brand?: string;
  nutrition?: Record<string, unknown> | null;
};

/** barcodeCache document, stored at users/{uid}/barcodeCache/{barcode}. */
export type BarcodeCacheEntry = {
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  imageUrl?: string;
  nutrition?: Record<string, unknown> | null;
};

/** Digits only; 12-digit UPC-A becomes its 13-digit EAN form so scanners agree. */
export function normalizeBarcode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 12 ? `0${digits}` : digits;
}

export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

// Open Food Facts category tags -> our categories. First match wins.
const OFF_CATEGORY_RULES: [RegExp, string][] = [
  [/frozen/, "frozen"],
  [/canned|tinned/, "pantry"],
  [/\beggs?\b/, "eggs"],
  [/cheese|yogurt|yoghurt|milk|dair|cream|butter/, "dairy"],
  [/fish|seafood|shrimp|salmon|tuna/, "seafood"],
  [/ham|salami|deli|cold-cut/, "deli"],
  [/meat|poultry|chicken|beef|pork|sausage/, "meat"],
  [/bread|bakery|pastr|bagel|tortilla/, "bakery"],
  [/beverage|drink|water|juice|soda|coffee|tea/, "beverages"],
  [/sauce|condiment|spread|dressing|ketchup|mustard|mayonnaise|vinegar|oil/, "condiments"],
  [/snack|chip|crisp|chocolate|cand|biscuit|cookie|cracker|bar/, "snacks"],
  [/fruit|vegetable|produce|salad/, "produce"],
  [/cereal|pasta|rice|flour|legume|bean|grain|baking|sugar|spice/, "pantry"],
];

export function categoryFromOffTags(tags: string[] | undefined): string {
  const joined = (tags ?? []).join(" ").toLowerCase();
  for (const [re, cat] of OFF_CATEGORY_RULES) if (re.test(joined)) return cat;
  return "other";
}
