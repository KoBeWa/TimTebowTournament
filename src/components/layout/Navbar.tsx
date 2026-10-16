"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, CURRENT_SEASON, LEAGUE_FOUNDED } from "@/lib/constants";
import NavIcon from "./NavIcon";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const season = CURRENT_SEASON - LEAGUE_FOUNDED + 1;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red to-gold text-cream display-title text-lg shadow-lg shadow-red/20">
              TTT
            </span>
            <span className="leading-tight">
              <span className="block display-title text-lg text-ink group-hover:text-red transition-colors">
                Tim Tebow Tournament
              </span>
              <span className="block text-[11px] text-text-faint">
                Saison {season} · {CURRENT_SEASON}
              </span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden xl:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface-3 text-ink"
                      : "text-text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <NavIcon name={item.icon} size={15} className={`hidden 2xl:block ${isActive ? "text-red" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile toggle */}
          <button
            className="xl:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-ink"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-border bg-cream max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl border p-3 transition-colors ${
                    isActive
                      ? "border-red/50 bg-red/10"
                      : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <NavIcon name={item.icon} size={18} className={isActive ? "text-red" : "text-text-muted"} />
                  <div className="mt-2 text-sm font-semibold text-ink">{item.label}</div>
                  <div className="text-xs text-text-faint">{item.desc}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
