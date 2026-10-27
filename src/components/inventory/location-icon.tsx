import { Package, Refrigerator, Snowflake, type LucideProps } from "lucide-react";
import type { Location } from "@/lib/types";

const ICONS = { fridge: Refrigerator, freezer: Snowflake, pantry: Package } as const;

export const LOCATION_LABEL: Record<Location, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  pantry: "Pantry",
};

export function LocationIcon({ location, ...props }: { location: Location } & LucideProps) {
  const Icon = ICONS[location];
  return <Icon aria-hidden {...props} />;
}
