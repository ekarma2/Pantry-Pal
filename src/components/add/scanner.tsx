"use client";

import { useRef, useState } from "react";
import { CameraOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBarcodeCamera } from "@/hooks/use-barcode-camera";
import { cn } from "@/lib/utils";
import type { useScanSession } from "./use-scan-session";

type Session = ReturnType<typeof useScanSession>;

/** Continuous camera scanning into a pending list; the camera stays open between items. */
export function Scanner({ session, onReview }: { session: Session; onReview: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = useBarcodeCamera(videoRef, session.add);
  const [manual, setManual] = useState("");
  const { scans, lastScanned } = session;
  const flashing = lastScanned !== null && scans.length > 0;
  const total = scans.reduce((n, s) => n + s.qty, 0);

  return (
    <div className="space-y-4 pb-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover" />
        {status === "scanning" && (
          <div
            key={lastScanned?.at}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2",
              "border-white/70",
              flashing && "animate-scan-flash",
            )}
          />
        )}
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="size-6 animate-spin" aria-label="Starting camera" />
          </div>
        )}
        {(status === "denied" || status === "unavailable") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
            <CameraOff className="size-8" aria-hidden />
            <p className="text-sm">
              {status === "denied"
                ? "Camera access is blocked. Allow it in your browser settings, or type the barcode below."
                : "No camera available here. Type the barcode below instead."}
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {status === "scanning" &&
          (scans.length ? `${total} scanned. Keep going, or review when done.` : "Point the camera at a barcode.")}
      </p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          session.add(manual);
          setManual("");
        }}
      >
        <Input
          aria-label="Type a barcode"
          inputMode="numeric"
          placeholder="Or type the barcode number"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" variant="outline" size="touch" disabled={manual.replace(/\D/g, "").length < 8}>
          Add
        </Button>
      </form>

      {scans.length > 0 && (
        <ul className="space-y-2">
          {scans.map((s) => (
            <li key={s.code} className="flex min-h-14 items-center gap-3 rounded-xl border px-3">
              {s.result?.status === "found" && s.result.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.result.product.imageUrl} alt="" className="size-10 rounded object-contain" />
              ) : (
                <span className="size-10 rounded bg-muted" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {s.result === null ? (
                    <span className="text-muted-foreground">Looking up…</span>
                  ) : s.result.status === "found" ? (
                    s.result.product.name
                  ) : (
                    "Unknown product"
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.result?.status === "found"
                    ? (s.result.product.brand ?? s.code)
                    : s.result
                      ? "You'll name it in review"
                      : s.code}
                </span>
              </span>
              {s.qty > 1 && <span className="text-sm font-medium">×{s.qty}</span>}
              <Button variant="ghost" size="icon-touch" aria-label="Remove" onClick={() => session.remove(s.code)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button size="touch-lg" className="w-full" disabled={scans.length === 0} onClick={onReview}>
        {scans.length ? `Review ${scans.length} ${scans.length === 1 ? "item" : "items"}` : "Review"}
      </Button>
    </div>
  );
}
