import "server-only";

import { z } from "zod";
import { defaultLocationFor } from "@/lib/shelfLife";
import { CATEGORIES, LOCATIONS, UNITS, type Location, type ParsedItem } from "@/lib/types";

/**
 * Claude output schema shared by the text and receipt parsers. unit/category/
 * location are plain strings (normalized below): the SDK can't enforce enums,
 * and one off-list value shouldn't fail the whole parse.
 */
export const ParsedItemsOutput = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
      category: z.string(),
      location: z.string(),
      estimatedShelfLifeDays: z.number().int().nullable(),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
});

/** Field rules both parsers put in their system prompts. */
export const ITEM_FIELD_RULES = `- unit must be one of: ${UNITS.join(", ")}.
- category must be one of: ${CATEGORIES.join(", ")}.
- location must be one of: ${LOCATIONS.join(", ")}. Use where it would normally be stored right after shopping: freezer for anything frozen, pantry for shelf-stable goods.
- estimatedShelfLifeDays: whole days it stays good from today in that location, unopened. Be conservative, especially for meat, poultry, seafood, dairy, and cooked food. Use null only if you truly can't tell.
- confidence: how sure you are that you identified the item correctly ("low" for ambiguous entries or guesses).`;

const UNIT_ALIASES: Record<string, string> = {
  each: "item", ea: "item", items: "item", pcs: "item", piece: "item", pieces: "item", ct: "item", count: "item",
  lbs: "lb", pound: "lb", pounds: "lb", ounce: "oz", ounces: "oz", gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg", liter: "L", liters: "L", l: "L", litre: "L", litres: "L",
  milliliter: "ml", milliliters: "ml", packs: "pack", package: "pack", bags: "bag", boxes: "box",
  cans: "can", jars: "jar", bottles: "bottle", bunches: "bunch",
};

function normalizeUnit(u: string): string {
  const k = u.trim();
  if ((UNITS as readonly string[]).includes(k)) return k;
  const lower = k.toLowerCase();
  if ((UNITS as readonly string[]).includes(lower)) return lower;
  return UNIT_ALIASES[lower] ?? "item";
}

function normalizeCategory(c: string): string {
  const k = c.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(k) ? k : "other";
}

function normalizeLocation(l: string, category: string): Location {
  const k = l.trim().toLowerCase();
  return (LOCATIONS as readonly string[]).includes(k) ? (k as Location) : defaultLocationFor(category);
}

/** Clean up Claude's items into valid ParsedItems. */
export function normalizeParsedItems(items: z.infer<typeof ParsedItemsOutput>["items"]): ParsedItem[] {
  return items
    .filter((i) => i.name.trim())
    .slice(0, 80)
    .map((i) => {
      const category = normalizeCategory(i.category);
      return {
        name: i.name.trim().slice(0, 120),
        quantity: i.quantity > 0 ? i.quantity : 1,
        unit: normalizeUnit(i.unit),
        category,
        location: normalizeLocation(i.location, category),
        estimatedShelfLifeDays:
          i.estimatedShelfLifeDays == null ? null : Math.min(Math.max(i.estimatedShelfLifeDays, 0), 1095),
        confidence: i.confidence,
      };
    });
}
