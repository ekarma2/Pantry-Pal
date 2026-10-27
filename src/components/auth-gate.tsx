"use client";

import { useAuth } from "@/components/auth-provider";
import { SignInScreen } from "@/components/sign-in-screen";
import { AppShell } from "@/components/app-shell";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) return <SignInScreen />;
  return <AppShell>{children}</AppShell>;
}
