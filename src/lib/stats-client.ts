"use client";

import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { itemsCol } from "@/lib/inventory";
import type { AddedItem, WasteEntry } from "@/lib/stats";

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

/** wasteLog entries since `since`, newest first. */
export function subscribeWaste(uid: string, since: Date, onEntries: (entries: WasteEntry[]) => void) {
  const q = query(
    collection(firestore(), "users", uid, "wasteLog"),
    where("wastedAt", ">=", Timestamp.fromDate(since)),
    orderBy("wastedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) =>
      onEntries(
        snap.docs.flatMap((d) => {
          const w = d.data();
          const wastedAt = toDate(w.wastedAt);
          if (!wastedAt) return [];
          return [
            {
              id: d.id,
              itemName: w.itemName ?? "Item",
              category: w.category ?? "other",
              reason: w.reason ?? null,
              wastedAt,
            },
          ];
        }),
      ),
    (err) => console.error(err),
  );
}

/** Every item added since `since`, whatever happened to it (for the waste rate). */
export function subscribeAddedSince(uid: string, since: Date, onItems: (items: AddedItem[]) => void) {
  const q = query(itemsCol(uid), where("addedAt", ">=", Timestamp.fromDate(since)));
  return onSnapshot(
    q,
    (snap) =>
      onItems(
        snap.docs.flatMap((d) => {
          const addedAt = toDate(d.data().addedAt);
          return addedAt ? [{ status: d.data().status ?? "active", addedAt }] : [];
        }),
      ),
    (err) => console.error(err),
  );
}
