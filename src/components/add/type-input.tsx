"use client";

import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  onTextChange: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
};

/** One text box for "milk, dozen eggs, 2 chicken breasts", with optional voice input. */
export function TypeInput({ text, onTextChange, onSubmit }: Props) {
  const speech = useSpeech((spoken) => {
    if (!spoken) return;
    onTextChange((prev) => (prev.trim() ? `${prev.trim().replace(/,$/, "")}, ${spoken}` : spoken));
  });

  function submit() {
    speech.stop();
    if (text.trim()) onSubmit();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <textarea
          aria-label="What did you buy?"
          value={speech.listening && speech.interim ? `${text} ${speech.interim}`.trim() : text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="milk, dozen eggs, 2 chicken breasts, bag of spinach"
          enterKeyHint="done"
          autoFocus
          rows={4}
          className="w-full resize-none rounded-xl border border-input bg-transparent p-3 pr-14 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        {speech.supported && (
          <button
            type="button"
            aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
            aria-pressed={speech.listening}
            onClick={speech.listening ? speech.stop : speech.start}
            className={cn(
              "absolute bottom-3 right-2 flex size-11 items-center justify-center rounded-full",
              speech.listening ? "animate-pulse bg-red-600 text-white" : "bg-muted text-foreground",
            )}
          >
            {speech.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {speech.error ??
          (speech.listening
            ? "Listening… say your items, then tap the mic to stop."
            : speech.supported
              ? "Type or tap the mic. Separate items with commas."
              : "Type, or use your keyboard's dictation button. Separate items with commas.")}
      </p>

      <Button type="submit" size="touch-lg" className="w-full" disabled={!text.trim()}>
        Read my list
      </Button>
    </form>
  );
}
