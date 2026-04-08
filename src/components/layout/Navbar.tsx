"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, LEAGUE_NAME } from "@/lib/constants";
import {
  Trophy,
  Tv,
  ListOrdered,
  ArrowLeftRight,
  Swords,
  Award,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  trophy: Trophy,
  tv: Tv,
  "list-ordered": ListOrdered,
  "arrow-left-right": ArrowLeftRight,
  swords: Swords,
  award: Award,
};

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-[--spacing-page]">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 border border-gold/20 group-hover:bg-gold/20 transition-colors">
              <Trophy size={18} className="text-gold" />
            </div>
            <span
              className="text-xl tracking-widest text-text-primary"
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
            >
              {LEAGUE_NAME}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-gold bg-gold/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                  }`}
                >
                  {Icon && <Icon size={16} />}
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border pt-3 mt-1">
            {NAV_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-gold bg-gold/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                  }`}
                >
                  {Icon && <Icon size={18} />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
