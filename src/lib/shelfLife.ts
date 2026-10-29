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

/** Rough category from a name, for items added without one (e.g. from the shopping list). */
const CATEGORY_GUESSES: [RegExp, string][] = [
  [/\bfrozen\b/, "frozen"],
  [/\beggs?\b/, "eggs"],
  // Before meat/dairy so "chicken broth" and "peanut butter" land here.
  [/\b(rice|pasta|noodles|flour|oats|cereal|beans|lentils|sugar|quinoa|stock|broth|canned|spices?)\b/, "pantry"],
  [/\b(peanut butter|ketchup|mustard|mayo\w*|sauce|dressing|vinegar|oil|salsa|soy|honey|jam|syrup)\b/, "condiments"],
  [/\b(salmon|tuna|cod|tilapia|shrimp|prawns?|fish|scallops?|crab)\b/, "seafood"],
  [/\b(chicken|turkey|beef|pork|lamb|steak|bacon|sausages?|ham|mince|chops?)\b/, "meat"],
  [/\b(milk|cream|yogh?urt|kefir|cheese|cheddar|parmesan|feta|mozzarella|butter|ricotta)\b/, "dairy"],
  [/\b(bread|bagels?|buns?|rolls?|baguette|tortillas?|pita|croissants?)\b/, "bakery"],
  [/\b(juice|soda|water|coffee|tea|beer|wine|kombucha)\b/, "beverages"],
  [/\b(chips|crackers|cookies|nuts|popcorn|granola|chocolate)\b/, "snacks"],
  [
    /\b(apples?|bananas?|berries|\w+berr(y|ies)|grapes|oranges?|lemons?|limes?|avocados?|tomato(es)?|potato(es)?|onions?|garlic|carrots?|celery|lettuce|spinach|kale|greens|herbs?|cilantro|parsley|basil|peppers?|cucumbers?|zucchini|broccoli|cauliflower|mushrooms?|ginger|corn|peas)\b/,
    "produce",
  ],
];

export function guessCategory(name: string): string {
  const n = name.toLowerCase();
  return CATEGORY_GUESSES.find(([re]) => re.test(n))?.[1] ?? "other";
}
