"use client";

import { useId, useState } from "react";
import ManagerName from "@/components/ui/ManagerName";
import StatTile from "@/components/ui/StatTile";
import { closestToHalf, fmtNum, fmtPct, type GameRow, type OddsRow } from "@/lib/playoffs";

const wins = (n: number) => `${n} ${n === 1 ? "Sieg" : "Siege"}`;

// One plain sentence about what the manager needs, computed from the odds by number of wins
function needSentence(name: string, games: number, odds: (number | null)[]) {
  const o = (k: number) => odds[k];
  const first = o(0);
  if (first != null && first >= 0.99) return `${name} ist schon sicher dabei, auch ohne weiteren Sieg liegen die Chancen bei ${fmtPct(first)}.`;
  const best = o(games);
  if (best != null && best < 0.5) return `${name} schafft es ohne fremde Hilfe nicht mehr: Selbst mit allen ${games} Siegen sind es nur ${fmtPct(best)}.`;
  const k = odds.findIndex((v) => v != null && v >= 0.9);
  if (k === -1) return `${name} braucht alle ${games} Siege, und selbst dann sind es nur ${best != null ? fmtPct(best) : "wenig"}.`;
  const lower = k > 0 ? o(k - 1) : null;
  return `${name} braucht wahrscheinlich ${wins(k)} aus ${games}: damit ${fmtPct(o(k)!)}${lower != null ? `, mit ${k - 1} nur ${fmtPct(lower)}` : ""}.`;
}

export default function PathToPlayoffs({ odds, games }: { odds: OddsRow[]; games: GameRow[] }) {
  const selectId = useId();
  const sorted = [...odds].sort((a, b) => a.manager_id.localeCompare(b.manager_id, "de"));
  const [id, setId] = useState(() => closestToHalf(odds)?.manager_id ?? sorted[0].manager_id);
  const row = odds.find((o) => o.manager_id === id)!;
  const mine = games.filter((g) => g.manager_id === id).sort((a, b) => a.week - b.week);
  const next = mine[0];
  const M = row.games_left;
  const byWins = Array.from({ length: M + 1 }, (_, k) => {
    const e = row.odds_by_wins?.[String(k)];
    return { k, prob: e ? Number(e[0]) : null, odds: e && e[1] != null ? Number(e[1]) : null };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={selectId} className="text-sm text-text-muted">Manager</label>
        <select id={selectId} value={id} onChange={(e) => setId(e.target.value)} className="min-w-40">
          {sorted.map((o) => <option key={o.manager_id} value={o.manager_id}>{o.manager_id}</option>)}
        </select>
        <span className="text-sm text-text-muted">Aktuell <span className="font-semibold text-ink tabular-nums">{fmtPct(row.playoff_pct)}</span></span>
      </div>

      {M === 0 || row.odds_if_win == null || row.odds_if_loss == null ? (
        <div className="cell p-5 text-sm text-text-secondary">
          Für {id} stehen keine Hauptrunden-Spiele mehr an. Die Chance liegt bei {fmtPct(row.playoff_pct)}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <StatTile label={`Bei Sieg in Woche ${next?.week ?? row.week + 1}`} value={fmtPct(row.odds_if_win)} tone="positive"
              hint={next ? `Gegner ${next.opponent_id}, Siegchance ${fmtPct(next.win_prob)}` : undefined} />
            <StatTile label="Bei Niederlage" value={fmtPct(row.odds_if_loss)} tone="negative"
              hint={next ? `Niederlage gegen ${next.opponent_id}` : undefined} />
          </div>

          <section className="cell p-4 sm:p-5">
            <p className="text-sm text-ink">{needSentence(id, M, byWins.map((b) => b.odds))}</p>
            <p className="mb-3 mt-4 text-xs text-text-muted">Playoff-Chance nach Zahl der Siege aus den letzten {M} Spielen</p>
            <ul className="space-y-3">
              {byWins.map((b) => (
                <li key={b.k} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[10rem_1fr]">
                  <div>
                    <div className="text-sm text-text-secondary">{b.k} von {M} {M === 1 ? "Sieg" : "Siegen"}</div>
                    <div className="text-xs text-text-faint">tritt zu {b.prob != null ? fmtPct(b.prob) : "–"} ein</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2" role="img"
                      aria-label={`Mit ${wins(b.k)}: ${b.odds != null ? fmtPct(b.odds) : "unmöglich"}`}>
                      {b.odds != null && <div className="h-full rounded-full bg-red" style={{ width: `${Math.max(b.odds > 0 ? 1.5 : 0, b.odds * 100)}%` }} />}
                    </div>
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink">{b.odds != null ? fmtPct(b.odds) : "–"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="pb-2.5 pl-4 pr-2 pt-4 font-medium sm:pl-5">Woche</th>
                  <th className="px-2 pb-2.5 pt-4 font-medium">Gegner</th>
                  <th className="px-2 pb-2.5 pt-4 text-right font-medium">Proj. Punkte</th>
                  <th className="pb-2.5 pl-2 pr-4 pt-4 font-medium sm:pr-5">Siegchance</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((g) => (
                  <tr key={g.week} className="border-t border-border-light">
                    <td className="py-2 pl-4 pr-2 tabular-nums text-text-secondary sm:pl-5">{g.week}</td>
                    <td className="px-2 py-2"><ManagerName id={g.opponent_id} className="min-h-11 font-medium text-ink" /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-text-secondary">
                      {fmtNum(g.proj_points)} : {fmtNum(g.opp_proj_points)}
                    </td>
                    <td className="py-2 pl-2 pr-4 sm:pr-5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-8 overflow-hidden rounded-full bg-surface-2 sm:w-20" aria-hidden>
                          <div className="h-full rounded-full bg-red" style={{ width: `${g.win_prob * 100}%` }} />
                        </div>
                        <span className="w-14 shrink-0 text-right tabular-nums text-ink">{fmtPct(g.win_prob)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
