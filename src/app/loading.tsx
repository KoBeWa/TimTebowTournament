// Shown at once while a page loads, so a tap never looks ignored
export default function Loading() {
  return (
    <div role="status" aria-label="Lädt" className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-10 w-56 rounded-2xl bg-surface-2" />
        <div className="h-4 w-80 max-w-full rounded-full bg-surface" />
      </div>
      <div className="h-11 w-72 max-w-full rounded-full bg-surface" />
      <div className="cell h-72" />
    </div>
  );
}
