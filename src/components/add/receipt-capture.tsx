"use client";

import { useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_RECEIPT_IMAGES } from "@/lib/receipt";
import type { useReceiptPhotos } from "./use-receipt-photos";

type Photos = ReturnType<typeof useReceiptPhotos>;

/** Take or pick one or more receipt photos, then hand them to the parser. */
export function ReceiptCapture({ photos, onRead }: { photos: Photos; onRead: () => void }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const full = photos.photos.length >= MAX_RECEIPT_IMAGES;

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      const skipped = photos.addFiles(files) ?? 0;
      if (skipped > 0) toast(`Up to ${MAX_RECEIPT_IMAGES} photos per receipt. ${skipped} skipped.`);
    }
    e.target.value = ""; // allow picking the same file again
  }

  return (
    <div className="space-y-4 pb-4">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFiles} />

      <div className="grid grid-cols-2 gap-2">
        <Button size="touch-lg" variant="outline" disabled={full} onClick={() => cameraInput.current?.click()}>
          <Camera /> Take photo
        </Button>
        <Button size="touch-lg" variant="outline" disabled={full} onClick={() => fileInput.current?.click()}>
          <ImagePlus /> Choose
        </Button>
      </div>

      {photos.photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2" aria-label="Receipt photos">
          {photos.photos.map((p, i) => (
            <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`Receipt photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => photos.remove(p.id)}
                className="absolute right-1 top-1 flex size-11 items-center justify-center"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <X className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Lay the receipt flat in good light. For a long receipt, take several photos from top to bottom.
        </p>
      )}

      <Button size="touch-lg" className="w-full" disabled={photos.photos.length === 0} onClick={onRead}>
        {photos.photos.length > 1 ? `Read receipt (${photos.photos.length} photos)` : "Read receipt"}
      </Button>
    </div>
  );
}
