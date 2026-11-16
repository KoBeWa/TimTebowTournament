"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, House, Shirt, Trophy, Users } from "lucide-react";
import { MANAGER_COLORS, NAV_GROUPS, CURRENT_SEASON, type NavGroup, type NavLink } from "@/lib/constants";

const ICONS = { calendar: CalendarDays, trophy: Trophy, users: Users, shirt: Shirt } as const;

const isManager = (l: NavLink) => l.href.startsWith("/manager/");

function groupActive(g: NavGroup, pathname: string) {
  // The season table lives under /history but belongs to "Saison"
  const season = `/history/${CURRENT_SEASON}`;
  return g.links.some((l) =>
    l.href === "/history" ? pathname.startsWith("/history") && !pathname.startsWith(season) : pathname.startsWith(l.href));
}

// The links of one group: pages as rows with a line of context, managers as a two-column grid
function GroupLinks({ group, pathname, onNavigate, roomy }: {
  group: NavGroup; pathname: string; onNavigate: () => void; roomy?: boolean;
}) {
  const pages = group.links.filter((l) => !isManager(l));
  const managers = group.links.filter(isManager);
  const row = roomy ? "min-h-12 px-4 py-2.5" : "px-3 py-2";
  return (
    <>
      {pages.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate}
          className={`flex flex-col justify-center rounded-2xl transition-colors hover:bg-white/5 ${row} ${pathname.startsWith(l.href) ? "bg-white/5" : ""}`}>
          <span className="text-sm font-semibold text-ink">{l.label}</span>
          {l.desc && <span className="text-xs text-text-muted">{l.desc}</span>}
        </Link>
      ))}
      {managers.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-0.5 border-t border-white/10 pt-2">
          {managers.map((l) => (
            <Link key={l.href} href={l.href} onClick={onNavigate}
              className={`flex items-center gap-2 rounded-xl text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-ink ${roomy ? "min-h-11 px-4" : "px-3 py-1.5"}`}>
              <span aria-hidden className="h-2.5 w-1 rounded-full" style={{ backgroundColor: MANAGER_COLORS[l.label] }} />
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  // Open group, and for the desktop menu how far its trigger sits from the right edge
  const [open, setOpen] = useState<{ label: string; right: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(null);

  // Close on outside click and Escape (links close the menu on click)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!barRef.current?.contains(t) && !mobileRef.current?.contains(t)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  const toggle = (g: NavGroup, el: HTMLElement) => {
    if (open?.label === g.label) return close();
    const bar = barRef.current?.getBoundingClientRect();
    const btn = el.getBoundingClientRect();
    setOpen({ label: g.label, right: bar ? Math.max(0, bar.right - btn.right) : 0 });
  };
  const openGroup = NAV_GROUPS.find((g) => g.label === open?.label);

  return (
    <>
      {/* Top bar: floats above the content from md up; on phones it only carries the name and scrolls away */}
      <div className="top-0 z-50 px-3 pt-3 sm:px-6 md:sticky">
        <div ref={barRef} className="relative mx-auto max-w-7xl">
          <nav aria-label="Hauptnavigation" className="glass flex h-14 items-center justify-between gap-4 rounded-full pl-2.5 pr-2">
            <Link href="/" onClick={close} className="group flex min-h-11 shrink-0 items-center gap-2.5 rounded-full pr-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red display-title text-base text-white">TTT</span>
              <span className="display-title text-lg text-ink group-hover:text-red transition-colors">Tim Tebow Tournament</span>
            </Link>

            <div className="hidden items-center gap-0.5 md:flex">
              {NAV_GROUPS.map((g) => {
                const active = groupActive(g, pathname);
                const isOpen = open?.label === g.label;
                return (
                  <button key={g.label} type="button" aria-expanded={isOpen} aria-haspopup="true"
                    onClick={(e) => toggle(g, e.currentTarget)}
                    className={`flex h-11 items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors ${
                      isOpen || active ? "bg-white/10 text-ink" : "text-text-secondary hover:bg-white/5 hover:text-ink"}`}>
                    {g.label}
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Desktop menu: a sibling of the bar so its own blur works, anchored under its trigger */}
          {openGroup && (
            <div className="glass absolute top-full mt-2 hidden w-72 rounded-3xl p-2 md:block" style={{ right: open!.right }}>
              <GroupLinks group={openGroup} pathname={pathname} onNavigate={close} />
            </div>
          )}
        </div>
      </div>

      {/* Phones: tab bar within reach of the thumb; a tab opens its pages in a sheet above it */}
      <div ref={mobileRef} className="md:hidden">
        {openGroup && (
          <div className="glass fixed inset-x-3 z-50 max-h-[70dvh] overflow-y-auto rounded-3xl p-2"
            style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>
            <div className="px-4 pb-1 pt-2 text-xs font-medium text-text-muted">{openGroup.label}</div>
            <GroupLinks group={openGroup} pathname={pathname} onNavigate={close} roomy />
          </div>
        )}
        <nav aria-label="Bereiche" className="glass fixed inset-x-3 z-50 flex h-16 items-stretch justify-between rounded-full px-2"
          style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <Link href="/" onClick={close} aria-current={pathname === "/" ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium ${
              pathname === "/" && !open ? "text-red" : "text-text-secondary"}`}>
            <House size={21} />Start
          </Link>
          {NAV_GROUPS.map((g) => {
            const Icon = ICONS[g.icon];
            const isOpen = open?.label === g.label;
            const active = isOpen || (!open && groupActive(g, pathname));
            return (
              <button key={g.label} type="button" aria-expanded={isOpen} aria-haspopup="true"
                onClick={(e) => toggle(g, e.currentTarget)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium ${
                  active ? "text-red" : "text-text-secondary"} ${isOpen ? "bg-white/10" : ""}`}>
                <Icon size={21} />{g.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
