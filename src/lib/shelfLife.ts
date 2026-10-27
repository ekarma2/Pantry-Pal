import type { Location } from "@/lib/types";

/**
 * Bundled shelf-life table: days an item keeps from purchase, by storage location.
 * Deterministic and offline. Values are deliberately conservative for
 * safety-critical foods (meat, seafood, dairy, cooked leftovers).
 * A missing entry means "not in the table": fall back to the AI estimate.
 */
type Days = Partial<Record<Location, number>>;

/** Specific foods, checked first (in order) against the item name. */
const KEYWORDS: [RegExp, Days][] = [
  [/\bground (beef|turkey|pork|chicken|lamb)\b|\bmince\b|\bburger patt/, { fridge: 1, freezer: 90 }],
  [/\b(chicken|turkey|poultry|wings?|drumsticks?|thighs?)\b/, { fridge: 2, freezer: 270 }],
  [/\b(salmon|tuna steak|cod|tilapia|shrimp|prawns?|fish|scallops?)\b/, { fridge: 1, freezer: 90 }],
  [/\b(bacon|hot dogs?|sausages?)\b/, { fridge: 7, freezer: 30 }],
  [/\b(steak|beef|pork|lamb|chops?|roast)\b/, { fridge: 3, freezer: 180 }],
  [/\b(milk|cream|half[- ]and[- ]half)\b/, { fridge: 7, freezer: 90 }],
  [/\b(yogh?urt|kefir)\b/, { fridge: 14, freezer: 60 }],
  [/\b(cottage|ricotta|cream cheese|brie|feta|fresh mozzarella|burrata)\b/, { fridge: 7, freezer: 60 }],
  [/\b(cheddar|parmesan|parmigiano|gouda|swiss|cheese)\b/, { fridge: 28, freezer: 180 }],
  [/\bbutter\b/, { fridge: 60, freezer: 270 }],
  [/\beggs?\b/, { fridge: 28 }],
  [/\b(berries|strawberr\w*|raspberr\w*|blueberr\w*|blackberr\w*)\b/, { fridge: 4, freezer: 240 }],
  [/\b(spinach|lettuce|greens|salad|arugula|kale|herbs?|cilantro|parsley|basil)\b/, { fridge: 5, freezer: 180 }],
  [/\bmushrooms?\b/, { fridge: 5 }],
  [/\b(bananas?|avocados?)\b/, { pantry: 4, fridge: 7, freezer: 90 }],
  [/\btomato(es)?\b/, { pantry: 5, fridge: 7 }],
  [/\b(apples?|carrots?|celery|cabbage)\b/, { fridge: 21, pantry: 7 }],
  [/\b(oranges?|lemons?|limes?|grapefruits?|citrus)\b/, { fridge: 21, pantry: 7 }],
  [/\b(potato(es)?|onions?|sweet potato(es)?)\b/, { pantry: 30, fridge: 30 }],
  [/\bgarlic\b/, { pantry: 90 }],
  [/\bhummus\b/, { fridge: 7 }],
  [/\b(bread|bagels?|buns?|rolls?|baguette)\b/, { pantry: 5, fridge: 10, freezer: 90 }],
  [/\btortillas?\b/, { pantry: 7, fridge: 21, freezer: 180 }],
  [/\b(juice|orange juice|oj)\b/, { fridge: 7, freezer: 240 }],
  [/\b(rice|pasta|flour|oats|cereal|beans|lentils|sugar)\b/, { pantry: 365 }],
  [/\b(canned|can of)\b/, { pantry: 730 }],
];

/** Fallback by category × location. */
const CATEGORY: Record<string, Days> = {
  produce: { fridge: 7, freezer: 240, pantry: 5 },
  dairy: { fridge: 7, freezer: 90 },
  meat: { fridge: 2, freezer: 120 },
  seafood: { fridge: 1, freezer: 90 },
  eggs: { fridge: 28 },
  bakery: { pantry: 4, fridge: 7, freezer: 90 },
  deli: { fridge: 4, freezer: 60 },
  frozen: { freezer: 180, fridge: 2 },
  pantry: { pantry: 180, fridge: 30, freezer: 180 },
  beverages: { pantry: 180, fridge: 7, freezer: 180 },
  condiments: { pantry: 180, fridge: 90, freezer: 180 },
  snacks: { pantry: 60, fridge: 30, freezer: 90 },
  leftovers: { fridge: 3, freezer: 90 },
};

/** Days from purchase, or null when the table has nothing for this item. */
export function tableShelfLifeDays(name: string, category: string, location: Location): number | null {
  const n = name.toLowerCase();
  for (const [re, days] of KEYWORDS) {
    if (re.test(n) && days[location] != null) return days[location]!;
  }
  return CATEGORY[category]?.[location] ?? null;
}

const DEFAULT_LOCATION: Record<string, Location> = {
  produce: "fridge",
  dairy: "fridge",
  meat: "fridge",
  seafood: "fridge",
  eggs: "fridge",
  deli: "fridge",
  leftovers: "fridge",
  frozen: "freezer",
};

export function defaultLocationFor(category: string): Location {
  return DEFAULT_LOCATION[category] ?? "pantry";
}

/** Days an item keeps once moved to the freezer. */
export function freezerShelfLifeDays(name: string, category: string): number {
  return tableShelfLifeDays(name, category, "freezer") ?? 90;
}
