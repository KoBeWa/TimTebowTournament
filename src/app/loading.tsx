// Shown at once while a page loads, so a tap never looks ignored: a skeleton in the page's shape
export default function Loading() {
  return (
    <div role="status" aria-label="Lädt" className="animate-pulse space-y-8">
      <div className="space-y-3">
        <div className="h-9 w-56 rounded-[var(--radius-pill)] bg-surface-2" />
        <div className="h-4 w-80 max-w-full rounded-[var(--radius-pill)] bg-surface-2" />
      </div>
      <div className="h-9 w-72 max-w-full rounded-[var(--radius-pill)] border border-border bg-paper-3" />
      <div className="cell divide-y divide-border-light">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3 w-6 rounded-sm bg-surface-2" />
            <div className="h-3 w-32 rounded-sm bg-surface-2" />
            <div className="ml-auto h-3 w-16 rounded-sm bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
