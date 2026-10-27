"use client";

import { useState } from "react";
import { Check, Pencil, Snowflake, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatShortDate } from "@/lib/dates";
import { freshnessOf } from "@/lib/freshness";
import { WASTE_REASONS, type InventoryItem } from "@/lib/types";
import { useToday } from "@/hooks/use-today";
import { FreshnessPill } from "./freshness-pill";
import { ItemForm } from "./item-form";
import { LOCATION_LABEL } from "./location-icon";
import { defaultUseAmount, useItemActions } from "./use-item-actions";

type Mode = "actions" | "toss" | "edit";

export function ItemDetailSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  // Keep showing the last item while the sheet animates closed.
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);

  return (
    <Drawer open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {/* Keyed so each item opens fresh in "actions" mode. */}
        {shown && <ItemDetail key={shown.id} item={shown} onClose={onClose} />}
      </DrawerContent>
    </Drawer>
  );
}

function ItemDetail({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("actions");
  const actions = useItemActions();
  const today = useToday();
  const freshness = freshnessOf(item.expiresAt, today);
  const estimated = item.expirySource === "table" || item.expirySource === "ai";
  const useOne = defaultUseAmount(item);

  function run(fn: () => void) {
    fn();
    onClose();
  }

  return (
    <div className="pb-safe overflow-y-auto">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">{item.name}</DrawerTitle>
        <DrawerDescription className="capitalize">
          {item.quantity} {item.unit} · {item.category} · {LOCATION_LABEL[item.location]}
        </DrawerDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <FreshnessPill freshness={freshness} />
          {item.expiresAt && (
            <span className="text-sm text-muted-foreground">{formatShortDate(item.expiresAt)}</span>
          )}
          {item.expiresAt && estimated && (
            <Badge variant="outline" title={item.expirySource === "ai" ? "Estimated by AI" : "Estimated from typical shelf life"}>
              estimated
            </Badge>
          )}
          {!item.expiresAt && <span className="text-sm text-muted-foreground">Estimating…</span>}
        </div>
      </DrawerHeader>

      <div className="p-4">
        {mode === "actions" && (
          <div className="grid grid-cols-2 gap-2">
            {useOne < item.quantity ? (
              <>
                <Button size="touch-lg" onClick={() => run(() => actions.used(item, useOne))}>
                  <Check /> Used {useOne}
                </Button>
                <Button size="touch-lg" variant="secondary" onClick={() => run(() => actions.used(item, item.quantity))}>
                  <Check /> Used all
                </Button>
              </>
            ) : (
              <Button size="touch-lg" className="col-span-2" onClick={() => run(() => actions.used(item))}>
                <Check /> Used it
              </Button>
            )}
            <Button size="touch-lg" variant="destructive" onClick={() => setMode("toss")}>
              <Trash2 /> Threw it out
            </Button>
            {item.location !== "freezer" ? (
              <Button size="touch-lg" variant="outline" onClick={() => run(() => actions.freeze(item))}>
                <Snowflake /> Freeze
              </Button>
            ) : (
              <span />
            )}
            <Button size="touch-lg" variant="outline" className="col-span-2" onClick={() => setMode("edit")}>
              <Pencil /> Edit
            </Button>
          </div>
        )}

        {mode === "toss" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Why? (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              {WASTE_REASONS.map((r) => (
                <Button
                  key={r.value}
                  size="touch-lg"
                  variant="outline"
                  onClick={() => run(() => actions.wasted(item, r.value))}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Button size="touch" variant="ghost" className="w-full" onClick={() => run(() => actions.wasted(item))}>
              Skip
            </Button>
          </div>
        )}

        {mode === "edit" && (
          <ItemForm
            initial={item}
            submitLabel="Save"
            onSubmit={(patch) => run(() => actions.update(item, patch))}
            onCancel={() => setMode("actions")}
            onDelete={() => run(() => actions.remove(item))}
          />
        )}
      </div>
    </div>
  );
}
