"use client";

import { useEffect, useRef, useState } from "react";

export type CameraStatus = "starting" | "scanning" | "denied" | "unavailable";

// Minimal BarcodeDetector types (not in TypeScript's DOM lib).
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
};

const GROCERY_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function nativeDetector(): Promise<BarcodeDetectorInstance | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = await Ctor.getSupportedFormats();
    const formats = GROCERY_FORMATS.filter((f) => supported.includes(f));
    return formats.length ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

/**
 * Streams the rear camera into `videoRef` and calls `onDetect` for every barcode
 * seen (continuously; callers de-duplicate). Uses the native BarcodeDetector where
 * available, otherwise lazy-loads ZXing (iOS Safari has no BarcodeDetector).
 */
export function useBarcodeCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onDetect: (code: string) => void,
) {
  const [status, setStatus] = useState<CameraStatus>("starting");
  const onDetectRef = useRef(onDetect);

  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let zxingStop: (() => void) | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) setStatus((err as DOMException).name === "NotAllowedError" ? "denied" : "unavailable");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = await nativeDetector();
      if (cancelled) return;

      if (detector) {
        const tick = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              for (const code of await detector.detect(video)) onDetectRef.current(code.rawValue);
            } catch {
              // Transient detect errors (e.g. frame not ready) are fine to skip.
            }
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) onDetectRef.current(result.getText());
        });
        if (cancelled) controls.stop();
        else zxingStop = () => controls.stop();
      }
      setStatus("scanning");
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [videoRef]);

  return status;
}
