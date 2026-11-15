"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { MANAGER_COLORS, NAV_GROUPS, CURRENT_SEASON, type NavGroup, type NavLink } from "@/lib/constants";

const isManager = (l: NavLink) => l.href.startsWith("/manager/");

function groupActive(g: NavGroup, pathname: string) {
  if (g.href) return pathname.startsWith(g.href);
  // The season table lives under /history but belongs to "Saison"
  const season = `/history/${CURRENT_SEASON}`;
  return (g.links ?? []).some((l) =>
    l.href === "/history" ? pathname.startsWith("/history") && !pathname.startsWith(season) : pathname.startsWith(l.href));
}

function ManagerDot({ id }: { id: string }) {
  return <span aria-hidden className="h-2.5 w-1 rounded-full" style={{ backgroundColor: MANAGER_COLORS[id] }} />;
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const close = () => { setOpen(null); setMobileOpen(false); };

  // Close menus on outside click and Escape (links close them on click)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!navRef.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setMobileOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <nav ref={navRef} className="sticky top-0 z-50 border-b border-border bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" onClick={close} className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red display-title text-base text-white">TTT</span>
          <span className="display-title text-lg text-ink group-hover:text-red transition-colors">Tim Tebow Tournament</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_GROUPS.map((g) => {
            const active = groupActive(g, pathname);
            const base = `flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "text-ink" : "text-text-muted hover:text-ink"}`;
            if (g.href) {
              return <Link key={g.label} href={g.href} onClick={close} className={base} aria-current={active ? "page" : undefined}>{g.label}</Link>;
            }
            const isOpen = open === g.label;
            const managers = g.links!.filter(isManager);
            const pages = g.links!.filter((l) => !isManager(l));
            return (
              <div key={g.label} className="relative">
                <button type="button" className={`${base} ${isOpen ? "bg-surface-2 text-ink" : ""}`}
                  aria-expanded={isOpen} aria-haspopup="true"
                  onClick={() => setOpen(isOpen ? null : g.label)}>
                  {g.label}
                  <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  {active && <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-red" />}
                </button>
                {isOpen && (
                  <div className="absolute right-0 top-full mt-2.5 w-72 rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/40">
                    {pages.map((l) => (
                      <Link key={l.href} href={l.href} onClick={close}
                        className={`block rounded-xl px-3 py-2 transition-colors hover:bg-surface-2 ${pathname.startsWith(l.href) ? "bg-surface-2" : ""}`}>
                        <span className="block text-sm font-semibold text-ink">{l.label}</span>
                        {l.desc && <span className="block text-xs text-text-muted">{l.desc}</span>}
                      </Link>
                    ))}
                    {managers.length > 0 && (
                      <div className="mt-1 grid grid-cols-2 gap-0.5 border-t border-border-light pt-2">
                        {managers.map((l) => (
                          <Link key={l.href} href={l.href} onClick={close}
                            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-ink">
                            <ManagerDot id={l.label} />{l.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile toggle */}
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"} aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu: every group visible at once, no nested taps */}
      {mobileOpen && (
        <div className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-border bg-cream px-4 pb-6 md:hidden">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="border-b border-border-light py-3 last:border-0">
              {g.href ? (
                <Link href={g.href} onClick={close} className="block py-1 text-base font-semibold text-ink">{g.label}</Link>
              ) : (
                <>
                  <div className="mb-1 text-xs font-medium text-text-faint">{g.label}</div>
                  <div className={g.links!.some(isManager) ? "grid grid-cols-2 gap-x-4" : ""}>
                    {g.links!.map((l) => (
                      <Link key={l.href} href={l.href} onClick={close}
                        className={`flex items-center gap-2 py-1.5 text-base ${isManager(l) ? "text-text-secondary" : "font-semibold text-ink"} ${
                          !isManager(l) && g.links!.some(isManager) ? "col-span-2" : ""}`}>
                        {isManager(l) && <ManagerDot id={l.label} />}{l.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
