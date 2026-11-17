"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, Award, CalendarDays, ChartNoAxesColumn, History, House, ListOrdered, Shirt, Swords,
  Table2, Target, Trophy, Tv, Users, type LucideIcon,
} from "lucide-react";
import {
  MANAGER_COLORS, NAV_GROUPS, CURRENT_SEASON, type NavGroup, type NavIconName, type NavLink,
} from "@/lib/constants";

const GROUP_ICONS = { calendar: CalendarDays, trophy: Trophy, users: Users, shirt: Shirt } as const;
const LINK_ICONS: Record<NavIconName, LucideIcon> = {
  home: House, tv: Tv, table: Table2, history: History, ranking: ChartNoAxesColumn, award: Award, target: Target,
  swords: Swords, players: Shirt, draft: ListOrdered, moves: ArrowLeftRight,
};

const isManager = (l: NavLink) => l.href.startsWith("/manager/");

// The season table lives under /history but belongs to "Saison"
function linkActive(l: NavLink, pathname: string) {
  const season = `/history/${CURRENT_SEASON}`;
  if (l.href === "/history") return pathname.startsWith("/history") && !pathname.startsWith(season);
  return pathname === l.href || pathname.startsWith(`${l.href}/`);
}
const groupActive = (g: NavGroup, pathname: string) => g.links.some((l) => linkActive(l, pathname));

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="group flex min-h-11 items-center gap-2.5 rounded-full pr-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red display-title text-base text-on-accent">TTT</span>
      <span className="leading-tight">
        <span className="block display-title text-lg text-ink">Tim Tebow Tournament</span>
        <span className="block text-xs text-text-muted">Saison {CURRENT_SEASON}</span>
      </span>
    </Link>
  );
}

function ManagerDot({ id }: { id: string }) {
  return <span aria-hidden className="h-2.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: MANAGER_COLORS[id] }} />;
}

// One row of the sidebar or sheet. The current page is the white pill.
function NavRow({ link, active, onClick, roomy }: { link: NavLink; active: boolean; onClick?: () => void; roomy?: boolean }) {
  const Icon = link.icon ? LINK_ICONS[link.icon] : null;
  return (
    <Link href={link.href} onClick={onClick} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors ${roomy ? "min-h-12" : "min-h-10"} ${
        active ? "bg-red text-on-accent shadow-sm" : "text-text-secondary hover:bg-white/10 hover:text-ink"}`}>
      {Icon && <Icon size={17} className={active ? "text-on-accent" : "text-text-muted"} />}
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
            className={`flex items-center gap-2 rounded-xl px-3 text-sm transition-colors ${roomy ? "min-h-11" : "min-h-9"} ${
              active ? "bg-red font-medium text-on-accent" : "text-text-secondary hover:bg-white/10 hover:text-ink"}`}>
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
      <aside className="glass fixed bottom-3 left-3 top-3 z-40 hidden w-64 flex-col overflow-y-auto rounded-[28px] p-3 [scrollbar-width:none] lg:flex">
        <div className="px-1 pb-3 pt-1"><Brand /></div>
        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-4">
          <NavRow link={{ label: "Start", href: "/", icon: "home" }} active={pathname === "/"} />
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1 text-xs font-medium text-text-faint">{g.label}</div>
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
      <div className="px-3 pt-3 sm:px-6 lg:hidden">
        <div className="glass flex h-14 items-center rounded-full pl-2.5 pr-4"><Brand onClick={close} /></div>
      </div>

      <div ref={mobileRef} className="lg:hidden">
        {openGroup && (
          <div className="glass fixed inset-x-3 z-50 mx-auto max-h-[70dvh] max-w-lg overflow-y-auto rounded-[28px] p-2"
            style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>
            <div className="px-3 pb-1 pt-2 text-xs font-medium text-text-muted">{openGroup.label}</div>
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
        <nav aria-label="Bereiche" className="glass fixed inset-x-3 z-50 mx-auto flex h-16 max-w-lg items-stretch justify-between rounded-full px-2"
          style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <Link href="/" onClick={close} aria-current={pathname === "/" ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium ${
              pathname === "/" && !sheet ? "text-ink" : "text-text-muted"}`}>
            <House size={21} className={pathname === "/" && !sheet ? "text-red" : ""} />Start
          </Link>
          {NAV_GROUPS.map((g) => {
            const Icon = GROUP_ICONS[g.icon];
            const isOpen = sheet === g.label;
            const active = isOpen || (!sheet && groupActive(g, pathname));
            return (
              <button key={g.label} type="button" aria-expanded={isOpen} aria-haspopup="true"
                onClick={() => setSheet(isOpen ? null : g.label)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium ${
                  active ? "text-ink" : "text-text-muted"} ${isOpen ? "bg-white/15" : ""}`}>
                <Icon size={21} className={active ? "text-red" : ""} />{g.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
