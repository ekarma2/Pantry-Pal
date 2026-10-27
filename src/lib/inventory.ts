"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";
import { toast } from "sonner";
import { firestore } from "@/lib/firebase/client";
import { addDays, startOfDay } from "@/lib/dates";
import { freezerShelfLifeDays } from "@/lib/shelfLife";
import type { InventoryItem, NewItem, WasteReason } from "@/lib/types";

// All data lives under users/{uid}/...
const itemsCol = (uid: string) => collection(firestore(), "users", uid, "inventoryItems");
const wasteCol = (uid: string) => collection(firestore(), "users", uid, "wasteLog");

const toTs = (d: Date | null | undefined) => (d ? Timestamp.fromDate(d) : null);
const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

function itemToDoc(item: Omit<InventoryItem, "id"> & { id?: string }): DocumentData {
  // The id is the document key, not a field.
  const { id, ...rest } = item;
  void id;
  return {
    ...rest,
    addedAt: toTs(item.addedAt),
    expiresAt: toTs(item.expiresAt),
    openedAt: toTs(item.openedAt),
    finishedAt: toTs(item.finishedAt),
  };
}

function docToItem(id: string, d: DocumentData): InventoryItem {
  return {
    id,
    name: d.name ?? "",
    category: d.category ?? "other",
    quantity: typeof d.quantity === "number" ? d.quantity : 1,
    unit: d.unit ?? "item",
    location: d.location ?? "fridge",
    addedAt: toDate(d.addedAt) ?? new Date(0),
    expiresAt: toDate(d.expiresAt),
    expirySource: d.expirySource ?? null,
    openedAt: toDate(d.openedAt),
    barcode: d.barcode ?? null,
    imageUrl: d.imageUrl ?? null,
    nutrition: d.nutrition ?? null,
    status: d.status ?? "active",
    finishedAt: toDate(d.finishedAt),
  };
}

/**
 * Commit without awaiting: with offline persistence the local cache (and every
 * snapshot listener) updates immediately, but the promise only settles once the
 * server acknowledges, which never happens while offline.
 */
function commit(batch: WriteBatch) {
  batch.commit().catch((err) => {
    console.error(err);
    toast.error("Couldn't save that change. Please try again.");
  });
}

type Undo = () => void;

export function subscribeActiveItems(
  uid: string,
  onItems: (items: InventoryItem[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(itemsCol(uid), where("status", "==", "active"));
  return onSnapshot(
    q,
    (snap) => onItems(snap.docs.map((d) => docToItem(d.id, d.data()))),
    onError,
  );
}

export function addItems(uid: string, items: NewItem[]): string[] {
  const batch = writeBatch(firestore());
  const now = new Date();
  const ids = items.map((item) => {
    const ref = doc(itemsCol(uid));
    batch.set(
      ref,
      itemToDoc({
        barcode: null,
        imageUrl: null,
        nutrition: null,
        ...item,
        addedAt: now,
        openedAt: null,
        status: "active",
        finishedAt: null,
      }),
    );
    return ref.id;
  });
  commit(batch);
  return ids;
}

export function deleteItemsById(uid: string, ids: string[]) {
  const batch = writeBatch(firestore());
  ids.forEach((id) => batch.delete(doc(itemsCol(uid), id)));
  commit(batch);
}

export function updateItem(uid: string, id: string, patch: Partial<NewItem>) {
  const batch = writeBatch(firestore());
  const data: DocumentData = { ...patch };
  if ("expiresAt" in patch) data.expiresAt = toTs(patch.expiresAt);
  batch.update(doc(itemsCol(uid), id), data);
  commit(batch);
}

/** Record a Claude-estimated expiry for an item that had none. */
export function setAiExpiry(uid: string, id: string, expiresAt: Date) {
  const batch = writeBatch(firestore());
  batch.update(doc(itemsCol(uid), id), { expiresAt: toTs(expiresAt), expirySource: "ai" });
  commit(batch);
}

/** Use `amount` of an item; uses it up entirely when nothing would be left. */
export function markUsed(uid: string, item: InventoryItem, amount = item.quantity): Undo {
  const ref = doc(itemsCol(uid), item.id);
  const batch = writeBatch(firestore());
  const remaining = item.quantity - amount;
  if (remaining > 0) {
    batch.update(ref, { quantity: remaining });
  } else {
    batch.update(ref, { status: "used", finishedAt: Timestamp.now() });
  }
  commit(batch);

  return () => {
    const undo = writeBatch(firestore());
    undo.update(ref, { quantity: item.quantity, status: "active", finishedAt: null });
    commit(undo);
  };
}

export function markWasted(uid: string, item: InventoryItem, reason: WasteReason | null): Undo {
  const ref = doc(itemsCol(uid), item.id);
  const logRef = doc(wasteCol(uid));
  const now = Timestamp.now();
  const batch = writeBatch(firestore());
  batch.update(ref, { status: "wasted", finishedAt: now });
  batch.set(logRef, {
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    reason,
    wastedAt: now,
    addedAt: toTs(item.addedAt),
  });
  commit(batch);

  return () => {
    const undo = writeBatch(firestore());
    undo.update(ref, { status: "active", finishedAt: null });
    undo.delete(logRef);
    commit(undo);
  };
}

/** Move to the freezer and extend expiry using the freezer shelf life. */
export function moveToFreezer(uid: string, item: InventoryItem, today: Date): Undo {
  const ref = doc(itemsCol(uid), item.id);
  const expiresAt = addDays(startOfDay(today), freezerShelfLifeDays(item.name, item.category));
  const batch = writeBatch(firestore());
  batch.update(ref, { location: "freezer", expiresAt: toTs(expiresAt), expirySource: "table" });
  commit(batch);

  return () => {
    const undo = writeBatch(firestore());
    undo.update(ref, {
      location: item.location,
      expiresAt: toTs(item.expiresAt),
      expirySource: item.expirySource,
    });
    commit(undo);
  };
}

export function deleteItem(uid: string, item: InventoryItem): Undo {
  const ref = doc(itemsCol(uid), item.id);
  const batch = writeBatch(firestore());
  batch.delete(ref);
  commit(batch);

  return () => {
    const undo = writeBatch(firestore());
    undo.set(ref, itemToDoc(item));
    commit(undo);
  };
}
