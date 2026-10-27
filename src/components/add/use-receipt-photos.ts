"use client";

import { useEffect, useRef, useState } from "react";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { apiFetch } from "@/lib/api";
import { storage } from "@/lib/firebase/client";
import { blobToDataUrl, compressImage } from "@/lib/image";
import { MAX_RECEIPT_IMAGES, MAX_TOTAL_IMAGE_CHARS } from "@/lib/receipt";
import type { ParsedItem } from "@/lib/types";

export type ReceiptPhoto = {
  id: string;
  previewUrl: string;
  /** Compressed JPEG, ready to send. */
  ready: Promise<Blob>;
  /** Storage path once uploaded; null if the upload failed (parsing doesn't depend on it). */
  stored: Promise<string | null>;
};

let seq = 0;

function deleteStored(photo: ReceiptPhoto) {
  photo.stored.then((path) => {
    if (path) deleteObject(ref(storage(), path)).catch(() => {});
  });
}

/** Receipt photos for one receipt: compressed on add, held in Storage until parsed. */
export function useReceiptPhotos(uid: string | undefined) {
  const [photos, setPhotos] = useState<ReceiptPhoto[]>([]);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  function addFiles(files: FileList | File[]) {
    if (!uid) return;
    const room = MAX_RECEIPT_IMAGES - photosRef.current.length;
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type === "")
      .slice(0, Math.max(room, 0))
      .map((file): ReceiptPhoto => {
        const id = `r${Date.now()}-${++seq}`;
        const ready = compressImage(file);
        ready.catch(() => {}); // surfaced when the job awaits it
        const stored = ready
          .then(async (blob) => {
            const path = `users/${uid}/receipts/${id}.jpg`;
            await uploadBytes(ref(storage(), path), blob, { contentType: "image/jpeg" });
            return path;
          })
          .catch((err) => {
            console.warn("Receipt upload to Storage failed (continuing without it)", err);
            return null;
          });
        return { id, previewUrl: URL.createObjectURL(file), ready, stored };
      });
    setPhotos((ps) => [...ps, ...added]);
    return Array.from(files).length - added.length; // how many were skipped
  }

  function remove(id: string) {
    const photo = photosRef.current.find((p) => p.id === id);
    if (!photo) return;
    URL.revokeObjectURL(photo.previewUrl);
    deleteStored(photo);
    setPhotos((ps) => ps.filter((p) => p.id !== id));
  }

  /**
   * A parse job for the current photos. On success the photos are cleared and
   * deleted from Storage; on failure they stay so the user can retry.
   */
  function makeJob(): () => Promise<ParsedItem[]> {
    const batch = [...photosRef.current];
    return async () => {
      let images: string[];
      try {
        images = await Promise.all(batch.map(async (p) => blobToDataUrl(await p.ready)));
      } catch {
        throw new Error("Couldn't read one of the photos. Try retaking it.");
      }
      if (images.reduce((n, i) => n + i.length, 0) > MAX_TOTAL_IMAGE_CHARS) {
        throw new Error("Those photos are too large together. Try fewer photos.");
      }

      const res = await apiFetch("/api/parse-receipt", { method: "POST", body: JSON.stringify({ images }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that receipt");

      batch.forEach((p) => {
        URL.revokeObjectURL(p.previewUrl);
        deleteStored(p);
      });
      const done = new Set(batch.map((p) => p.id));
      setPhotos((ps) => ps.filter((p) => !done.has(p.id)));
      return body.items as ParsedItem[];
    };
  }

  return { photos, addFiles, remove, makeJob };
}
