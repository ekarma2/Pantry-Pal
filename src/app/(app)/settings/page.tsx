"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [check, setCheck] = useState<string | null>(null);

  async function checkServer() {
    setCheck("Checking…");
    try {
      const res = await apiFetch("/api/me");
      const body = await res.json();
      setCheck(res.ok ? `Server verified uid ${body.uid}` : `Error ${res.status}: ${body.error}`);
    } catch (err) {
      setCheck(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-medium">{user?.email}</p>
      </section>

      <p className="text-sm text-muted-foreground">Notification settings arrive in build step 7.</p>

      <section className="space-y-2">
        <Button variant="outline" className="h-11 w-full" onClick={checkServer}>
          Check server connection
        </Button>
        {check && <p className="text-sm text-muted-foreground">{check}</p>}
      </section>

      <Button variant="destructive" className="h-11 w-full" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
