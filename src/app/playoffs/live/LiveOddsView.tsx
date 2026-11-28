"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import { fmtNum } from "@/lib/format";
import { fmtPct } from "@/lib/playoffs";
import type { LiveOdds, LiveTeam } from "@/lib/liveOdds";

const REFRESH_MS = 60_000;
type Payload = LiveOdds | { status: "off" } | { status: "error"; message: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function Delta({ now, before }: { now: number; before: number | null }) {
  if (before == null) return null;
  const d = (now - before) * 100;
  if (Math.abs(d) < 0.05) return <span className="measured text-text-faint">±0</span>;
  return <span className={`measured ${d > 0 ? "text-positive" : "text-negative"}`}>{d > 0 ? "+" : "−"}{fmtNum(Math.abs(d))}</span>;
}

// A slim bar for a chance; amber marks the playoff line (4 teams)
function Bar({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
      <div className={`h-full rounded-full ${strong ? "bg-red" : "bg-ink-2"}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

function statusLine(d: LiveOdds) {
  if (d.status === "pre") return `Woche ${d.week} beginnt bald. Bis zum ersten Kick-off zählen nur die Projektionen.`;
  if (d.status === "final") return `Alle Spiele von Woche ${d.week} sind beendet. Die offizielle Berechnung folgt mit dem wöchentlichen Sync.`;
  const running = d.games.started - d.games.finished;
  const now = running === 0 ? "gerade läuft keins" : running === 1 ? "eins läuft gerade" : `${running} laufen gerade`;
  return `Woche ${d.week} läuft: ${d.games.finished} von ${d.games.total} NFL-Spielen beendet, ${now}.`;
}

function Table({ d }: { d: LiveOdds }) {
  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-text-muted">
            <th className="w-10 py-3 pl-4 text-left font-medium sm:pl-5">#</th>
            <th className="px-3 py-3 text-left font-medium">Manager</th>
            <th className="px-3 py-3 text-right font-medium">Live</th>
            <th className="hidden px-3 py-3 text-left font-medium md:table-cell">Spiel der Woche</th>
            <th className="px-3 py-3 text-right font-medium">Playoffs jetzt</th>
            <th className="hidden w-40 px-3 py-3 font-medium lg:table-cell"><span className="sr-only">Balken</span></th>
            <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">Vor dem Spieltag</th>
            <th className="py-3 pl-3 pr-4 text-right font-medium sm:pr-5">Δ Pp.</th>
          </tr>
        </thead>
        <tbody>
          {d.teams.map((t, i) => (
            <tr key={t.manager} className={`border-t ${i === 4 ? "border-border-strong" : "border-border-light"}`}>
              <td className="measured py-3 pl-4 text-text-muted sm:pl-5">{i + 1}</td>
              <td className="px-3 py-3">
                <ManagerName id={t.manager} className="font-medium text-ink" />
                <div className="measured mt-0.5 text-xs text-text-faint">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</div>
              </td>
              <td className="px-3 py-3 text-right">
                <div className="measured text-ink">{fmtNum(t.live)}</div>
                <div className="whitespace-nowrap text-xs text-text-faint">proj. <span className="measured">{fmtNum(t.projected)}</span></div>
              </td>
              <td className="hidden px-3 py-3 md:table-cell">
                {t.opponent && t.win_prob != null ? (
                  <>
                    <div className="text-text-secondary">gegen {t.opponent}</div>
                    <div className="text-xs text-text-faint">Siegchance <span className="measured">{fmtPct(t.win_prob)}</span></div>
                  </>
                ) : <span className="text-text-faint">spielfrei</span>}
              </td>
              <td className="measured px-3 py-3 text-right text-base font-medium text-ink">{fmtPct(t.playoff_pct)}</td>
              <td className="hidden px-3 py-3 lg:table-cell"><Bar value={t.playoff_pct} strong={i < 4} /></td>
              <td className="measured hidden px-3 py-3 text-right text-text-muted sm:table-cell">{t.before_pct == null ? "–" : fmtPct(t.before_pct)}</td>
              <td className="py-3 pl-3 pr-4 text-right sm:pr-5"><Delta now={t.playoff_pct} before={t.before_pct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-light px-4 py-2.5 text-xs text-text-faint sm:px-5">
        Die Linie nach Platz 4 trennt die Playoff-Plätze. Δ Pp.: Veränderung gegenüber dem Stand vor dem Spieltag, in Prozentpunkten.
      </p>
    </div>
  );
}

function Side({ t, align }: { t: LiveTeam; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <div className={`min-w-0 ${right ? "text-right" : ""}`}>
      <div className={`flex ${right ? "justify-end" : ""}`}><ManagerName id={t.manager} className="font-medium text-ink" /></div>
      <div className="measured mt-1 text-2xl text-ink">{fmtNum(t.live)}</div>
      <div className="text-xs text-text-faint">
        proj. <span className="measured">{fmtNum(t.projected)}</span>, noch <span className="measured">{t.left}</span> von <span className="measured">{t.starters}</span> Spielern
      </div>
    </div>
  );
}

function Stakes({ t }: { t: LiveTeam }) {
  if (t.if_win == null || t.if_loss == null) return null;
  return (
    <p className="text-xs text-text-muted">
      {t.manager}: mit Sieg <span className="measured text-text-secondary">{fmtPct(t.if_win)}</span>, mit Niederlage <span className="measured text-text-secondary">{fmtPct(t.if_loss)}</span>
    </p>
  );
}

function Games({ d }: { d: LiveOdds }) {
  const byName = new Map(d.teams.map((t) => [t.manager, t]));
  const pairs: [LiveTeam, LiveTeam][] = [];
  for (const t of d.teams) {
    const o = t.opponent ? byName.get(t.opponent) : undefined;
    if (o && t.manager < o.manager) pairs.push([t, o]);
  }
  // The game that moves the playoff race the most first
  const stake = (t: LiveTeam) => (t.if_win ?? 0) - (t.if_loss ?? 0);
  pairs.sort((x, y) => Math.max(stake(y[0]), stake(y[1])) - Math.max(stake(x[0]), stake(x[1])));

  return (
    <ul className="cell divide-y divide-border-light">
      {pairs.map(([a, b]) => (
        <li key={a.manager} className="space-y-3 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
            <Side t={a} align="left" />
            <div className="pt-7 text-xs text-text-faint">gegen</div>
            <Side t={b} align="right" />
          </div>
          {a.win_prob != null && (
            <div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-paper-3" role="img"
                aria-label={`Siegchance ${a.manager} ${fmtPct(a.win_prob)}, ${b.manager} ${fmtPct(1 - a.win_prob)}`}>
                <div className="h-full bg-ink-2" style={{ width: `${a.win_prob * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-text-muted">
                <span className="measured">{fmtPct(a.win_prob)}</span>
                <span>Siegchance</span>
                <span className="measured">{fmtPct(1 - a.win_prob)}</span>
              </div>
            </div>
          )}
          <div className="grid gap-1 sm:grid-cols-2">
            <Stakes t={a} />
            <div className="sm:text-right"><Stakes t={b} /></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function LiveOddsView() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/live-odds", { cache: "no-store" });
      const j = (await r.json()) as Payload;
      if (!r.ok || j.status === "error") throw new Error();
      setData(j);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh every minute while the page is visible
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!document.hidden) await load();
      if (!cancelled) timer.current = setTimeout(tick, REFRESH_MS);
    };
    tick();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const live = data && "teams" in data ? data : null;

  if (!data && loading) {
    return (
      <div role="status" aria-label="Lädt" className="cell divide-y divide-border-light motion-safe:animate-pulse">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-3 w-6 rounded-sm bg-surface-2" /><div className="h-3 w-28 rounded-sm bg-surface-2" />
            <div className="ml-auto h-3 w-16 rounded-sm bg-surface-2" />
          </div>
        ))}
      </div>
    );
  }

  if (!live) {
    return (
      <div className="cell space-y-3 p-5 text-sm text-text-secondary">
        <p>{failed ? "Die Live-Daten konnten nicht geladen werden." : "Gerade läuft kein Spieltag der Hauptrunde. Die Live-Prognose startet mit der nächsten Woche."}</p>
        {failed && <button type="button" className="btn" onClick={load}>Erneut versuchen</button>}
      </div>
    );
  }

  return (
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{statusLine(live)}</p>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          {failed && <span className="text-negative">Aktualisierung fehlgeschlagen</span>}
          <span>Stand <span className="measured">{time(live.updated_at)}</span></span>
          <button type="button" className="btn" onClick={load} disabled={loading} aria-label="Jetzt aktualisieren">
            <RefreshCw size={15} aria-hidden className={loading ? "motion-safe:animate-spin" : ""} />
            Aktualisieren
          </button>
        </div>
      </div>

      <section>
        <h2 className="section-title mb-1">Playoff-Chancen live</h2>
        <p className="mb-4 text-sm text-text-muted">Alle Teams im Vergleich, neu gerechnet aus den aktuellen Punkten und den Projektionen der noch offenen Spieler.</p>
        <Table d={live} />
      </section>

      <section>
        <h2 className="section-title mb-1">Die Spiele der Woche</h2>
        <p className="mb-4 text-sm text-text-muted">Das Spiel, das das Playoff-Rennen am meisten bewegt, steht oben.</p>
        <Games d={live} />
      </section>

      <details className="cell group">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-medium text-text-secondary hover:text-ink sm:px-5">So wird live gerechnet</summary>
        <div className="space-y-2 px-4 pb-5 pt-1 text-sm text-text-muted sm:px-5">
          <p>Jede Minute wird die Restsaison {fmtNum(live.sims, 0)}-mal durchgespielt. Für diese Woche zählen die Live-Punkte von Sleeper plus die Projektion jedes Starters, dessen Spiel noch nicht vorbei ist: die ganze Projektion vor dem Kick-off, die Hälfte während das Spiel läuft.</p>
          <p>Je weniger Punkte noch offen sind, desto kleiner wird die Streuung. Die späteren Wochen rechnen mit denselben Werten wie die wöchentliche Prognose.</p>
        </div>
      </details>
    </div>
  );
}
