export const LOCATIONS = ["fridge", "freezer", "pantry"] as const;
export type Location = (typeof LOCATIONS)[number];

export const CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "seafood",
  "eggs",
  "bakery",
  "deli",
  "frozen",
  "pantry",
  "beverages",
  "condiments",
  "snacks",
  "leftovers",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const UNITS = [
  "item", "pack", "bag", "box", "can", "jar", "bottle", "bunch", "dozen",
  "g", "kg", "oz", "lb", "ml", "L",
] as const;

/** Units where "used one" makes sense (vs. weights/volumes). */
export const COUNT_UNITS = new Set<string>([
  "item", "pack", "bag", "box", "can", "jar", "bottle", "bunch", "dozen",
]);

export type ExpirySource = "user" | "package" | "table" | "ai";
export type ItemStatus = "active" | "used" | "wasted";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: Location;
  addedAt: Date;
  expiresAt: Date | null;
  expirySource: ExpirySource | null;
  openedAt: Date | null; // reserved
  barcode: string | null;
  imageUrl: string | null;
  nutrition: Record<string, unknown> | null; // raw from Open Food Facts, reserved
  status: ItemStatus;
  finishedAt: Date | null; // when status left "active"
};

export type NewItem = Pick<
  InventoryItem,
  "name" | "category" | "quantity" | "unit" | "location" | "expiresAt" | "expirySource"
> &
  Partial<Pick<InventoryItem, "barcode" | "imageUrl" | "nutrition">>;

/** What every add method (text, barcode, receipt) produces for Review & Confirm. */
export type ParsedItem = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location: Location;
  estimatedShelfLifeDays: number | null;
  confidence: "high" | "medium" | "low";
  barcode?: string;
  imageUrl?: string;
};

export const WASTE_REASONS = [
  { value: "expired", label: "Expired" },
  { value: "spoiled", label: "Spoiled early" },
  { value: "disliked", label: "Didn't like" },
  { value: "leftovers", label: "Leftovers" },
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number]["value"];

export type WasteLogEntry = {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  reason: WasteReason | null;
  wastedAt: Date;
  addedAt: Date;
};
