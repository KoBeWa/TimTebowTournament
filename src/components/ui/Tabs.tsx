"use client";

// The one tab control of the site. `size="sm"` for filters inside a card.
export default function Tabs<T extends string | number>({ tabs, value, onChange, size = "md", label }: {
  tabs: readonly { key: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <div role="tablist" aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={String(t.key)} type="button" role="tab" aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`${pad} whitespace-nowrap rounded-lg font-medium transition-colors ${
              active ? "bg-surface-3 text-ink" : "text-text-muted hover:text-ink"}`}>
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 tabular-nums text-text-faint">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
