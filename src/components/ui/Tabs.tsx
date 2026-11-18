"use client";

import { useEffect, useRef } from "react";

// The one tab control of the site: a segmented strip on the deepest step. `size="sm"` for filters inside a card.
export default function Tabs<T extends string | number>({ tabs, value, onChange, size = "md", label }: {
  tabs: readonly { key: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  // Keep the selected tab in view when the strip is wider than the screen.
  // Only the strip scrolls: scrollIntoView would also move the page.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const btn = activeRef.current;
    const strip = btn?.parentElement;
    if (!btn || !strip) return;
    strip.scrollLeft = btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2;
  }, [value]);

  const pad = size === "sm" ? "min-h-7 px-2.5 text-xs" : "min-h-8 px-3 text-sm";
  return (
    <div role="tablist" aria-label={label}
      className="relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[var(--radius-pill)] border border-border bg-paper-3 p-0.5 [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={String(t.key)} ref={active ? activeRef : undefined} type="button" role="tab" aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`${pad} whitespace-nowrap rounded-[5px] font-medium transition-colors ${
              active ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]" : "text-text-muted hover:text-ink"}`}>
            {t.label}
            {t.count !== undefined && <span className={`measured ml-1.5 text-xs ${active ? "text-text-secondary" : "text-text-faint"}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
