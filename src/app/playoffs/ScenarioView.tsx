"use client";

import { useId, useState } from "react";
import ManagerName from "@/components/ui/ManagerName";
import { closestToHalf, fmtPct, type OddsRow, type RivalGrid, type RivalLimit, type ScenarioRow } from "@/lib/playoffs";

// "Ritz höchstens 1 von 3 Spielen gewinnt", in the plainest words that fit
function limitText(l: RivalLimit) {
  if (l.max_wins === 0) return l.games === 1 ? `${l.rival} sein letztes Spiel verliert` : `${l.rival} keins seiner ${l.games} Spiele gewinnt`;
  if (l.max_wins === l.games - 1) return `${l.rival} mindestens ein Spiel verliert`;
  return `${l.rival} höchstens ${l.max_wins} von ${l.games} Spielen gewinnt`;
}

// Several rivals with the same limit read as one clause: "Benni und Ritz jeweils mindestens ein Spiel verlieren"
function needsText(needs: RivalLimit[]) {
  const same = needs.every((l) => l.max_wins === needs[0].max_wins && l.games === needs[0].games);
  if (needs.length < 2 || !same) return join(needs.map(limitText));
  const who = join(needs.map((l) => l.rival));
  const l = needs[0];
  if (l.max_wins === 0) return l.games === 1 ? `${who} jeweils ihr letztes Spiel verlieren` : `${who} keins ihrer ${l.games} Spiele gewinnen`;
  if (l.max_wins === l.games - 1) return `${who} jeweils mindestens ein Spiel verlieren`;
  return `${who} jeweils höchstens ${l.max_wins} von ${l.games} Spielen gewinnen`;
}

function outText(o: NonNullable<ScenarioRow["out_if"]>) {
  if (o.min_wins === o.games) return `${o.rival} alle ${o.games} Spiele gewinnt`;
  if (o.min_wins === 1) return `${o.rival} noch ein Spiel gewinnt`;
  return `${o.rival} mindestens ${o.min_wins} von ${o.games} Spielen gewinnt`;
}

function winsLabel(a: number, n: number) {
  if (a === n) return n === 1 ? "Sieg im letzten Spiel" : `Alle ${n} Spiele gewonnen`;
  if (a === 0) return "Kein Sieg mehr";
  return `${a} von ${n} Spielen gewonnen`;
}

function join(parts: string[]) {
  return parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

function PathRow({ row, n }: { row: ScenarioRow; n: number }) {
  const status =
    row.status === "in" ? <span className="text-positive">Sicher drin</span>
    : row.status === "out" ? <span className="text-negative">Raus</span>
    : row.status === "rare" ? <span className="text-text-faint">Kaum möglich</span>
    : <span className="measured text-ink">{fmtPct(row.pct ?? 0)}</span>;

  const lines: React.ReactNode[] = [];
  if (row.status === "in") lines.push("Egal, wie die anderen spielen.");
  if (row.status === "out") lines.push("Dann reicht es nicht mehr.");
  if (row.status === "rare") lines.push("Kommt in den Simulationen praktisch nicht vor.");
  if (row.status === "open") {
    if (row.needs?.length) {
      const sure = (row.needs_pct ?? 0) >= 0.99;
      lines.push(
        <>
          {sure ? "Sicher drin" : <>Drin mit <span className="measured">{fmtPct(row.needs_pct ?? 0)}</span></>}, wenn {needsText(row.needs)}.
        </>,
      );
    } else {
      lines.push("Hängt an mehreren Ergebnissen und am Ende an den Punkten.");
    }
    if (row.out_if) lines.push(<>Raus, wenn {outText(row.out_if)}.</>);
  }

  return (
    <li className="grid gap-x-6 gap-y-1 px-4 py-3.5 sm:grid-cols-[13rem_7rem_1fr] sm:items-baseline sm:px-5">
      <div>
        <div className="text-sm font-medium text-ink">{winsLabel(row.wins, n)}</div>
        <div className="mt-0.5 text-xs text-text-faint">
          passiert in <span className="measured">{fmtPct(row.share)}</span> der Simulationen
        </div>
      </div>
      <div className="text-sm font-medium">{status}</div>
      <div className="space-y-0.5 text-sm text-text-secondary">
        {lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </li>
  );
}

// Own wins x rival wins -> playoff odds, as a small heatmap in the cool (instrument) colour.
// The fill stays dark enough (at most 45 % cool) that light text reads on every cell.
function Grid({ me, n, g }: { me: string; n: number; g: RivalGrid }) {
  const rows = Array.from({ length: n + 1 }, (_, i) => n - i);
  return (
    <figure className="cell min-w-0 p-4 sm:p-5">
      <figcaption className="mb-3 text-sm text-text-muted">
        Chance von {me} je nach eigenen Siegen und den Siegen von <ManagerName id={g.rival} plain className="text-ink" />
      </figcaption>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="pb-2 pr-3 text-left text-xs font-medium text-text-muted">{me} gewinnt</th>
              {Array.from({ length: g.games + 1 }, (_, b) => (
                <th key={b} className="px-1 pb-2 text-center text-xs font-medium text-text-muted">
                  {g.rival} <span className="measured">{b}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a}>
                <th scope="row" className="pr-3 text-left text-xs font-medium text-text-muted">
                  <span className="measured">{a}</span> von <span className="measured">{n}</span>
                </th>
                {g.grid[a]?.map(([pct, share], b) => (
                  <td key={b} className="p-0.5">
                    {pct == null ? (
                      <div className="flex h-11 min-w-16 items-center justify-center rounded-[4px] border border-border-light"
                        title={`${me} ${a} Siege, ${g.rival} ${b} Siege: kommt kaum vor`}>
                        <span aria-label="kommt kaum vor" className="inline-block h-px w-3 bg-border-strong" />
                      </div>
                    ) : (
                      <div className="measured flex h-11 min-w-16 items-center justify-center rounded-[4px] text-xs text-ink"
                        style={{ backgroundColor: `color-mix(in oklab, var(--color-cool) ${Math.round(pct * 45)}%, var(--color-paper-3))` }}
                        title={`${me} ${a} Siege, ${g.rival} ${b} Siege: ${fmtPct(pct)} (in ${fmtPct(share)} der Simulationen)`}>
                        {fmtPct(pct)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export default function ScenarioView({ odds }: { odds: OddsRow[] }) {
  const selectId = useId();
  const sorted = [...odds].sort((a, b) => a.manager_id.localeCompare(b.manager_id, "de"));
  const [id, setId] = useState(() => closestToHalf(odds)?.manager_id ?? sorted[0].manager_id);
  const row = odds.find((o) => o.manager_id === id)!;
  const sc = row.scenarios;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={selectId} className="text-sm text-text-muted">Manager</label>
        <select id={selectId} value={id} onChange={(e) => setId(e.target.value)} className="min-w-40">
          {sorted.map((o) => <option key={o.manager_id} value={o.manager_id}>{o.manager_id}</option>)}
        </select>
        <span className="text-sm text-text-muted">Aktuell <span className="measured font-medium text-ink">{fmtPct(row.playoff_pct)}</span></span>
      </div>

      {!sc || sc.games === 0 ? (
        <div className="cell p-5 text-sm text-text-secondary">
          {row.games_left === 0
            ? `Für ${id} stehen keine Hauptrunden-Spiele mehr an.`
            : "Die Szenarien erscheinen mit der nächsten wöchentlichen Berechnung."}
        </div>
      ) : (
        <>
          <section>
            <h2 className="section-title mb-1">Wege in die Playoffs</h2>
            <p className="mb-4 text-sm text-text-muted">
              Für jede Zahl eigener Siege in den letzten {sc.games} Spielen: reicht es, und welche Ergebnisse der Konkurrenz es entscheiden.
            </p>
            <ul className="cell divide-y divide-border-light">
              {[...sc.rows].sort((a, b) => b.wins - a.wins).map((r) => <PathRow key={r.wins} row={r} n={sc.games} />)}
            </ul>
          </section>

          {sc.rivals.length > 0 && (
            <section>
              <h2 className="section-title mb-1">Das direkte Rennen</h2>
              <p className="mb-4 text-sm text-text-muted">
                Die Konkurrenten, deren Ergebnisse für {id} am meisten zählen. Je blauer, desto sicherer.
              </p>
              <div className="grid gap-4 xl:grid-cols-2">
                {sc.rivals.map((g) => <Grid key={g.rival} me={id} n={sc.games} g={g} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
