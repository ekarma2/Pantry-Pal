"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Keyboard, Plus, Receipt, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ItemForm } from "@/components/inventory/item-form";
import { useAuth } from "@/components/auth-provider";
import { useItemActions } from "@/components/inventory/use-item-actions";
import { useToday } from "@/hooks/use-today";
import { apiFetch } from "@/lib/api";
import { rememberBarcode } from "@/lib/barcode-client";
import type { ParsedItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { draftFromParsed, draftToNewItem, type Draft } from "./drafts";
import { ReviewList } from "./review-list";
import { ReceiptCapture } from "./receipt-capture";
import { Scanner } from "./scanner";
import { TypeInput } from "./type-input";
import { useReceiptPhotos } from "./use-receipt-photos";
import { useScanSession } from "./use-scan-session";

type Mode = "menu" | "type" | "scan" | "receipt" | "manual" | "review";

type AddSheetApi = {
  openAdd: () => void;
  /**
   * Run a parse job in the background and send its results to Review & Confirm.
   * The user can close the sheet and keep using the app meanwhile.
   */
  startReview: (label: string, job: () => Promise<ParsedItem[]>, returnTo?: Mode) => void;
};

const AddSheetContext = createContext<AddSheetApi | null>(null);

const TITLES: Record<Mode, string> = {
  menu: "Add food",
  type: "Type or say it",
  scan: "Scan barcodes",
  receipt: "Receipt photo",
  manual: "Add manually",
  review: "Review & confirm",
};

async function parseText(text: string): Promise<ParsedItem[]> {
  const res = await apiFetch("/api/parse-text", { method: "POST", body: JSON.stringify({ text }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't read that list");
  return body.items as ParsedItem[];
}

/** The persistent "+" button, the Add sheet it opens, and Review & Confirm. */
export function AddSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [returnTo, setReturnTo] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const [job, setJob] = useState<string | null>(null); // label while parsing
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const jobId = useRef(0);
  const openRef = useRef(open);
  const actions = useItemActions();
  const today = useToday();
  const { user } = useAuth();
  const scanSession = useScanSession(user?.uid);
  const receipt = useReceiptPhotos(user?.uid);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function openAdd() {
    setMode("menu");
    setOpen(true);
  }

  function openReview() {
    setMode("review");
    setOpen(true);
  }

  function startReview(label: string, run: () => Promise<ParsedItem[]>, from: Mode = "menu") {
    if (!navigator.onLine) {
      toast.error("You're offline. Use Manual add, or try again when you're back online.");
      return;
    }
    const id = ++jobId.current;
    setJob(label);
    setDrafts(null);
    setReturnTo(from);
    setMode("review");

    run()
      .then((items) => {
        if (id !== jobId.current) return;
        setJob(null);
        setDrafts(items.map((p) => draftFromParsed(p, today)));
        if (!openRef.current) {
          const n = items.length;
          toast(n ? `${n} ${n === 1 ? "item" : "items"} ready to review` : "Couldn't find any food in that", {
            action: n ? { label: "Review", onClick: openReview } : undefined,
          });
        }
      })
      .catch((err: Error) => {
        if (id !== jobId.current) return;
        setJob(null);
        toast.error(err.message || "Something went wrong");
        setMode((m) => (m === "review" ? from : m));
      });
  }

  function addAll() {
    if (!drafts?.length) return;
    actions.add(drafts.map(draftToNewItem));
    // Remember names for scanned barcodes (including ones the user named or corrected).
    if (user) {
      for (const d of drafts) {
        if (!d.barcode || !d.name.trim()) continue;
        rememberBarcode(user.uid, {
          barcode: d.barcode,
          name: d.name.trim(),
          category: d.category,
          imageUrl: d.imageUrl ?? undefined,
          nutrition: d.nutrition,
        });
      }
    }
    setDrafts(null);
    setText("");
    setOpen(false);
  }

  const pending = job !== null || (drafts !== null && drafts.length > 0);

  return (
    <AddSheetContext.Provider value={{ openAdd, startReview }}>
      {children}

      <button
        type="button"
        aria-label={pending ? "Add food (items waiting for review)" : "Add food"}
        onClick={() => (drafts?.length && !job ? openReview() : openAdd())}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-15rem))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
      >
        <Plus className="size-7" />
        {pending && (
          <span
            aria-hidden
            className={cn("absolute right-0 top-0 size-4 rounded-full border-2 border-background bg-amber-500", job && "animate-pulse")}
          />
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="pb-safe overflow-y-auto">
            <DrawerHeader className="flex-row items-center gap-2 text-left">
              {mode !== "menu" && (
                <Button
                  variant="ghost"
                  size="icon-touch"
                  aria-label="Back"
                  onClick={() => setMode(mode === "review" ? returnTo : "menu")}
                >
                  <ArrowLeft />
                </Button>
              )}
              <DrawerTitle className="text-xl">{TITLES[mode]}</DrawerTitle>
            </DrawerHeader>

            <div className="px-4 pt-4">
              {mode === "menu" && (
                <ul className="space-y-2 pb-4">
                  {pending && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setMode("review")}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-amber-100 px-4 text-left text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      >
                        <span className="flex-1 font-medium">
                          {job ?? `Review ${drafts!.length} ${drafts!.length === 1 ? "item" : "items"}`}
                        </span>
                        <ChevronRight className="size-5" aria-hidden />
                      </button>
                    </li>
                  )}
                  <MethodButton icon={Keyboard} label="Type or say it" hint="“milk, dozen eggs, spinach”" onClick={() => setMode("type")} />
                  <MethodButton
                    icon={ScanBarcode}
                    label="Scan barcodes"
                    hint={scanSession.scans.length ? `${scanSession.scans.length} scanned so far` : "Scan several in a row"}
                    onClick={() => setMode("scan")}
                  />
                  <MethodButton
                    icon={Receipt}
                    label="Receipt photo"
                    hint={receipt.photos.length ? `${receipt.photos.length} photo(s) ready` : "Snap your grocery receipt"}
                    onClick={() => setMode("receipt")}
                  />
                  <MethodButton icon={Plus} label="Manual" hint="Name, quantity, location, date" onClick={() => setMode("manual")} />
                </ul>
              )}

              {mode === "type" && (
                <div className="pb-4">
                  <TypeInput
                    text={text}
                    onTextChange={setText}
                    onSubmit={() => startReview("Reading your list…", () => parseText(text), "type")}
                  />
                </div>
              )}

              {mode === "scan" && (
                <Scanner
                  session={scanSession}
                  onReview={() => startReview("Looking up products…", scanSession.takeAll(), "scan")}
                />
              )}

              {mode === "receipt" && (
                <ReceiptCapture
                  photos={receipt}
                  onRead={() => startReview("Reading your receipt…", receipt.makeJob(), "receipt")}
                />
              )}

              {mode === "manual" && (
                <div className="pb-4">
                  <ItemForm
                    submitLabel="Add item"
                    onSubmit={(item) => {
                      actions.add([item]);
                      setOpen(false);
                    }}
                  />
                </div>
              )}

              {mode === "review" &&
                (job ? (
                  <div aria-busy="true" className="space-y-3 pb-4">
                    <p className="font-medium" role="status">{job}</p>
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
                    ))}
                    <p className="text-sm text-muted-foreground">
                      You can close this and keep going. We&apos;ll let you know when it&apos;s ready.
                    </p>
                  </div>
                ) : drafts ? (
                  <ReviewList
                    drafts={drafts}
                    onChange={(fn) => setDrafts((ds) => (ds ? fn(ds) : ds))}
                    onAddAll={addAll}
                    onBack={() => setMode(returnTo)}
                  />
                ) : (
                  <p className="pb-4 text-sm text-muted-foreground">Nothing waiting for review.</p>
                ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </AddSheetContext.Provider>
  );
}

function MethodButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-16 w-full items-center gap-4 rounded-xl border px-4 text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <Icon className="size-6 text-primary" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">{label}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
      </button>
    </li>
  );
}

export function useAddSheet() {
  const ctx = useContext(AddSheetContext);
  if (!ctx) throw new Error("useAddSheet must be used inside <AddSheetProvider>");
  return ctx;
}
