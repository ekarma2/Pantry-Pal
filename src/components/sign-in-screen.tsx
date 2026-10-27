"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { isFirebaseConfigured } from "@/lib/firebase/client";

export function SignInScreen() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      console.error(err);
      toast.error("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={96} height={96} className="rounded-3xl" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pantry Pal</h1>
        <p className="text-muted-foreground">Log what you buy. Eat it before it expires.</p>
      </div>
      {isFirebaseConfigured ? (
        <Button size="lg" className="h-12 w-full max-w-xs text-base" onClick={handleSignIn} disabled={busy}>
          {busy ? "Signing in…" : "Continue with Google"}
        </Button>
      ) : (
        <p className="max-w-sm rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Firebase isn&apos;t configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in the
          Firebase web config, and restart the dev server.
        </p>
      )}
    </main>
  );
}
