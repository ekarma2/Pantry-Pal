"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, Menu, Refrigerator, Settings, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddSheetProvider } from "@/components/add/add-sheet";
import { InventoryProvider } from "@/components/inventory/inventory-provider";
import { MealsProvider } from "@/components/meals/meals-provider";
import { SettingsProvider } from "@/components/settings-provider";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Pantry", icon: Refrigerator },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/shop", label: "Shop", icon: ShoppingCart },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

const MENU = [
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const TITLES: Record<string, string> = {
  "/": "Pantry",
  "/plan": "Meal plan",
  "/shop": "Shopping list",
  "/stats": "Stats",
  "/recipes": "Recipes",
  "/settings": "Settings",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <InventoryProvider>
        <MealsProvider>
          <AddSheetProvider>
            <ShellLayout>{children}</ShellLayout>
          </AddSheetProvider>
        </MealsProvider>
      </InventoryProvider>
    </SettingsProvider>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const title = TITLES[pathname] ?? "Pantry Pal";

  // Screens are client-rendered behind sign-in, so name the tab here (read out on navigation).
  useEffect(() => {
    document.title = title === "Pantry Pal" ? title : `${title} · Pantry Pal`;
  }, [title]);
  const online = useOnline();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            {!online && (
              <span role="status" className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Offline · changes will sync
              </span>
            )}
          </div>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-muted"
            >
              <Menu className="size-5" />
            </button>
            {menuOpen && (
              <nav className="absolute right-0 top-12 w-44 overflow-hidden rounded-lg border bg-popover shadow-lg">
                {MENU.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex h-11 items-center gap-3 px-4 text-sm hover:bg-muted"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 px-4 pb-24 pt-4 outline-none">{children}</main>

      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                    active ? "font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
