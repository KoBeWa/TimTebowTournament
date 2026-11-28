"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, Award, CalendarDays, ChartNoAxesColumn, History, House, ListOrdered, Percent, Shirt, Swords,
  Activity, Table2, Target, Trophy, Tv, Users, type LucideIcon,
} from "lucide-react";
import {
  MANAGER_COLORS, NAV_GROUPS, CURRENT_SEASON, type NavGroup, type NavIconName, type NavLink,
} from "@/lib/constants";

const GROUP_ICONS = { calendar: CalendarDays, trophy: Trophy, users: Users, shirt: Shirt } as const;
const LINK_ICONS: Record<NavIconName, LucideIcon> = {
  home: House, tv: Tv, table: Table2, history: History, ranking: ChartNoAxesColumn, award: Award, target: Target,
  swords: Swords, players: Shirt, draft: ListOrdered, moves: ArrowLeftRight, odds: Percent, live: Activity,
};

const isManager = (l: NavLink) => l.href.startsWith("/manager/");

// The season table lives under /history but belongs to "Saison"
function linkActive(l: NavLink, pathname: string) {
  const season = `/history/${CURRENT_SEASON}`;
  if (l.href === "/history") return pathname.startsWith("/history") && !pathname.startsWith(season);
  const hit = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // A deeper destination of its own (/playoffs/live) wins over its parent (/playoffs)
  const deeper = NAV_GROUPS.some((g) => g.links.some((o) => o.href.startsWith(`${l.href}/`) && hit(o.href)));
  return hit(l.href) && !deeper;
}
const groupActive = (g: NavGroup, pathname: string) => g.links.some((l) => linkActive(l, pathname));

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} aria-label="Tim Tebow Tournament, zur Startseite"
      className="group flex min-h-11 items-center gap-2.5 rounded-[var(--radius-pill)] pr-2">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-red text-xs font-medium text-on-accent">TTT</span>
      <span className="leading-tight">
        <span className="block text-sm font-medium text-ink">Tim Tebow Tournament</span>
        <span className="block text-xs text-text-muted">Saison {CURRENT_SEASON}</span>
      </span>
    </Link>
  );
}

function ManagerDot({ id }: { id: string }) {
  return <span aria-hidden className="h-2.5 w-[3px] shrink-0 rounded-[1px]" style={{ backgroundColor: MANAGER_COLORS[id] }} />;
}

// One row of the sidebar or sheet. The current page: a raised row with an amber edge.
function NavRow({ link, active, onClick, roomy }: { link: NavLink; active: boolean; onClick?: () => void; roomy?: boolean }) {
  const Icon = link.icon ? LINK_ICONS[link.icon] : null;
  return (
    <Link href={link.href} onClick={onClick} aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-2.5 rounded-[var(--radius-pill)] px-2.5 text-sm transition-colors ${roomy ? "min-h-12" : "min-h-9"} ${
        active
          ? "bg-surface-2 text-ink before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full before:bg-red"
          : "text-text-secondary hover:bg-surface-2 hover:text-ink"}`}>
      {Icon && <Icon size={16} aria-hidden className={active ? "text-red" : "text-text-muted"} />}
      {link.label}
    </Link>
  );
}

function ManagerGrid({ links, pathname, onClick, roomy }: { links: NavLink[]; pathname: string; onClick?: () => void; roomy?: boolean }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-1">
      {links.map((l) => {
        const active = linkActive(l, pathname);
        return (
          <Link key={l.href} href={l.href} onClick={onClick} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-[var(--radius-pill)] px-2.5 text-sm transition-colors ${roomy ? "min-h-11" : "min-h-8"} ${
              active ? "bg-surface-2 text-ink" : "text-text-secondary hover:bg-surface-2 hover:text-ink"}`}>
            <ManagerDot id={l.label} />{l.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<string | null>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const close = () => setSheet(null);

  // Close the sheet on outside tap and Escape (links close it on tap)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!mobileRef.current?.contains(e.target as Node)) setSheet(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  const openGroup = NAV_GROUPS.find((g) => g.label === sheet);

  return (
    <>
      {/* Desktop: every destination visible in a fixed sidebar, one click away */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto border-r border-border bg-paper-3 px-3 py-4 [scrollbar-width:none] lg:flex">
        <div className="px-1 pb-4"><Brand /></div>
        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-5">
          <NavRow link={{ label: "Start", href: "/", icon: "home" }} active={pathname === "/"} />
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1 text-xs text-text-faint">{g.label}</div>
              <div className="flex flex-col gap-0.5">
                {g.links.filter((l) => !isManager(l)).map((l) => (
                  <NavRow key={l.href} link={l} active={linkActive(l, pathname)} />
                ))}
              </div>
              {g.links.some(isManager) && <ManagerGrid links={g.links.filter(isManager)} pathname={pathname} />}
            </div>
          ))}
        </nav>
      </aside>

      {/* Below lg: the name on top, the tab bar within reach of the thumb */}
      <div className="flex h-14 items-center border-b border-border bg-paper-3 px-4 sm:px-6 lg:hidden">
        <Brand onClick={close} />
      </div>

      <div ref={mobileRef} className="lg:hidden">
        {openGroup && (
          <div className="fixed inset-x-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-[var(--radius-card)] border-t border-border bg-paper-2 px-3 pb-3 pt-2"
            style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
            <div className="px-2.5 pb-1 pt-2 text-sm font-medium text-ink">{openGroup.label}</div>
            <div className="flex flex-col gap-0.5">
              {openGroup.links.filter((l) => !isManager(l)).map((l) => (
                <NavRow key={l.href} link={l} active={linkActive(l, pathname)} onClick={close} roomy />
              ))}
            </div>
            {openGroup.links.some(isManager) && (
              <ManagerGrid links={openGroup.links.filter(isManager)} pathname={pathname} onClick={close} roomy />
            )}
          </div>
        )}
        <nav aria-label="Bereiche" className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-between border-t border-border bg-paper-3 px-1"
          style={{ height: "calc(4rem + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Link href="/" onClick={close} aria-current={pathname === "/" ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${
              pathname === "/" && !sheet ? "text-ink" : "text-text-muted"}`}>
            <House size={20} aria-hidden className={pathname === "/" && !sheet ? "text-red" : ""} />Start
          </Link>
          {NAV_GROUPS.map((g) => {
            const Icon = GROUP_ICONS[g.icon];
            const isOpen = sheet === g.label;
            const active = isOpen || (!sheet && groupActive(g, pathname));
            return (
              <button key={g.label} type="button" aria-expanded={isOpen} aria-haspopup="true"
                onClick={() => setSheet(isOpen ? null : g.label)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${
                  active ? "text-ink" : "text-text-muted"} ${isOpen ? "bg-surface-2" : ""}`}>
                <Icon size={20} aria-hidden className={active ? "text-red" : ""} />{g.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
