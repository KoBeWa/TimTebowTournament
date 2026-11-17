import ManagerName from "@/components/ui/ManagerName";
import { fmtPct, type GameRow, type OddsRow } from "@/lib/playoffs";

// Gold for likely wins, grey for likely losses; the stronger the odds, the stronger the tint
function tint(p: number) {
  return p >= 0.5
    ? `rgb(230 190 98 / ${(0.07 + (p - 0.5) * 0.7).toFixed(3)})`
    : `rgb(150 150 150 / ${(0.05 + (0.5 - p) * 0.45).toFixed(3)})`;
}

// Remaining games per manager with win chance; the last column is the strength of schedule
export default function ScheduleMatrix({ odds, games }: { odds: OddsRow[]; games: GameRow[] }) {
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  const by = new Map(games.map((g) => [`${g.manager_id}:${g.week}`, g]));
  return (
    <div>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-muted">
              <th className="sticky left-0 bg-solid px-4 pb-2.5 pt-4 font-medium sm:pl-5">Manager</th>
              {weeks.map((w) => <th key={w} className="px-1.5 pb-2.5 pt-4 text-center font-medium">Woche {w}</th>)}
              <th className="whitespace-nowrap px-3 pb-2.5 pt-4 text-right font-medium">Ø Siegchance</th>
            </tr>
          </thead>
          <tbody>
            {odds.map((o) => {
              const mine = games.filter((g) => g.manager_id === o.manager_id);
              const avg = mine.length ? mine.reduce((n, g) => n + g.win_prob, 0) / mine.length : null;
              return (
                <tr key={o.manager_id} className="border-t border-border-light">
                  <td className="sticky left-0 bg-solid py-1.5 pl-4 pr-3 sm:pl-5">
                    <ManagerName id={o.manager_id} className="min-h-11 font-medium text-ink" />
                  </td>
                  {weeks.map((w) => {
                    const g = by.get(`${o.manager_id}:${w}`);
                    return (
                      <td key={w} className="p-1">
                        {g ? (
                          <div className="min-w-24 rounded-lg px-2.5 py-1.5 text-center" style={{ backgroundColor: tint(g.win_prob) }}>
                            <div className="text-ink">{g.opponent_id}</div>
                            <div className="text-xs tabular-nums text-text-secondary">{fmtPct(g.win_prob)}</div>
                          </div>
                        ) : <div className="text-center text-text-faint">–</div>}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{avg == null ? "–" : fmtPct(avg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-xs text-text-faint">Zahl unter dem Gegner: Chance auf einen Sieg. Je goldener, desto wahrscheinlicher, je grauer, desto unwahrscheinlicher.</p>
    </div>
  );
}
