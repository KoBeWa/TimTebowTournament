"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, CURRENT_SEASON, LEAGUE_FOUNDED } from "@/lib/constants";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const season = CURRENT_SEASON - LEAGUE_FOUNDED + 1;

  return (
    <nav
      style={{ borderBottom: "3px solid #1a1a1a" }}
      className="sticky top-0 z-50 bg-cream"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-9 items-center justify-between">
          {/* Edition info */}
          <Link href="/" className="label-nav text-xs text-text-muted hover:text-ink transition-colors">
            Tim Tebow Tournament · Saison {season} · {CURRENT_SEASON}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`label-nav text-xs transition-colors ${
                    isActive ? "text-ink" : "text-text-secondary hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden label-nav text-xs text-text-secondary hover:text-ink"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "Schließen" : "Menü"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ borderTop: "1px solid #1a1a1a" }} className="md:hidden bg-cream px-6 py-3 max-h-[calc(100vh-2.25rem)] overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block label-nav text-xs py-2 transition-colors ${
                  isActive ? "text-ink" : "text-text-secondary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
