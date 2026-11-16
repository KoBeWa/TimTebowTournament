"use client";

import { useEffect, useRef } from "react";

// The one tab control of the site: a glass capsule. `size="sm"` for filters inside a card.
export default function Tabs<T extends string | number>({ tabs, value, onChange, size = "md", label }: {
  tabs: readonly { key: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  // Keep the selected tab in view when the strip is wider than the screen
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [value]);

  const pad = size === "sm" ? "min-h-8 px-3 text-xs" : "min-h-10 px-4 text-sm";
  return (
    <div role="tablist" aria-label={label}
      className="glass inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1 shadow-none [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={String(t.key)} ref={active ? activeRef : undefined} type="button" role="tab" aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`${pad} whitespace-nowrap rounded-full font-medium transition-colors ${
              active ? "bg-white/15 text-ink" : "text-text-secondary hover:text-ink"}`}>
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 tabular-nums text-text-faint">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
