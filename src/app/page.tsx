import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { CURRENT_SEASON, MANAGER_COLORS } from "@/lib/constants";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";

type Standing = { manager_id: string; reg_rank: number; wins: number; losses: number; ties: number; points_for: number };
type Matchup = { week: number; manager_a: string; score_a: number; manager_b: string; score_b: number; is_playoff: boolean };

async function getCurrentSeason() {
  const [{ data: standings }, { data: matchups }] = await Promise.all([
    supabase.from("season_results")
      .select("manager_id, reg_rank, wins, losses, ties, points_for")
      .eq("season_year", CURRENT_SEASON).order("reg_rank"),
    supabase.from("weekly_matchups")
      .select("week, manager_a, score_a, manager_b, score_b, is_playoff")
      .eq("season_year", CURRENT_SEASON).order("week", { ascending: false }).order("id").limit(8),
  ]);
  const week = matchups?.[0]?.week ?? null;
  return {
    standings: (standings ?? []) as Standing[],
    week,
    games: ((matchups ?? []) as Matchup[]).filter((m) => m.week === week),
  };
}

async function getLeagueRecords() {
  const { data } = await supabase
    .from("record_timeline")
    .select("record_label, manager_id, record_value")
    .eq("is_current", true)
    .order("record_label")
    .limit(6);
  return data ?? [];
}

const pts = (n: number) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Side({ id, score, won, align }: { id: string; score: number; won: boolean; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <ManagerName id={id} plain className={`${align === "right" ? "flex-row-reverse" : ""} text-base ${won ? "font-semibold text-ink" : "text-text-muted"}`} />
      <span className={`ml-auto display-title text-xl sm:text-2xl tabular-nums ${align === "right" ? "ml-0 mr-auto" : ""} ${won ? "text-ink" : "text-text-faint"}`}>{pts(score)}</span>
    </div>
  );
}

export default async function HomePage() {
  const [seasons, current, records] = await Promise.all([getSeasonSummaries(), getCurrentSeason(), getLeagueRecords()]);

  const finished = seasons.filter((s) => s.champion !== "—");
  const reigning = finished[0];
  const running = current.standings.length > 0 && !finished.some((s) => s.year === CURRENT_SEASON);
  const playoffTeams = seasons.find((s) => s.year === CURRENT_SEASON)?.playoff_teams ?? 4;

  const titles = Object.entries(finished.reduce<Record<string, number>>((acc, s) => {
    acc[s.champion] = (acc[s.champion] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-12">
      {/* What is happening right now */}
      {running ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-text-muted">Saison {CURRENT_SEASON}</p>
              <h1 className="display-title text-5xl sm:text-6xl text-ink">Woche {current.week}</h1>
            </div>
            {reigning && (
              <Link href={`/history/${reigning.year}`} className="flex items-center gap-2 text-sm text-text-muted hover:text-ink transition-colors">
                <Crown size={15} className="text-gold" /> Titelverteidiger <span className="font-semibold text-ink">{reigning.champion}</span>
              </Link>
            )}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
            <div className="cell overflow-hidden">
              {current.games.map((m) => (
                <Link key={m.manager_a} href={`/gamecenter/${CURRENT_SEASON}/${m.week}?a=${m.manager_a}&b=${m.manager_b}`}
                  className="flex items-center gap-2.5 sm:gap-4 border-b border-border-light px-4 py-4 last:border-0 hover:bg-surface-2 transition-colors sm:px-5">
                  <Side id={m.manager_a} score={m.score_a} won={m.score_a > m.score_b} align="left" />
                  <span className="text-xs text-text-faint">vs</span>
                  <Side id={m.manager_b} score={m.score_b} won={m.score_b > m.score_a} align="right" />
                </Link>
              ))}
              <Link href="/gamecenter" className="flex items-center justify-center gap-1 px-4 py-2.5 text-sm text-text-muted hover:text-ink transition-colors">
                Alle Wochen im Gamecenter <ChevronRight size={15} />
              </Link>
            </div>

            <div className="cell overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted">
                    <th className="py-2.5 pl-4 pr-2 font-medium sm:pl-5">Tabelle</th>
                    <th className="px-2 py-2.5 text-right font-medium">Bilanz</th>
                    <th className="py-2.5 pl-2 pr-4 text-right font-medium sm:pr-5">Punkte</th>
                  </tr>
                </thead>
                <tbody>
                  {current.standings.map((s) => (
                    <tr key={s.manager_id}
                      className={`border-t ${s.reg_rank === playoffTeams + 1 ? "border-border-strong border-dashed" : "border-border-light"}`}>
                      <td className="py-2 pl-4 pr-2 sm:pl-5">
                        <span className="flex items-center gap-3">
                          <span className="w-4 text-right tabular-nums text-text-faint">{s.reg_rank}</span>
                          <ManagerName id={s.manager_id} className="font-medium text-ink" />
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-text-secondary">{s.wins}–{s.losses}{s.ties ? `–${s.ties}` : ""}</td>
                      <td className="py-2 pl-2 pr-4 text-right tabular-nums text-text-secondary sm:pr-5">{pts(s.points_for)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link href={`/history/${CURRENT_SEASON}`} className="flex items-center justify-center gap-1 border-t border-border-light px-4 py-2.5 text-sm text-text-muted hover:text-ink transition-colors">
                Ganze Tabelle <ChevronRight size={15} />
              </Link>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-faint">Die gestrichelte Linie trennt die {playoffTeams} Playoff-Plätze.</p>
        </section>
      ) : reigning && (
        <section>
          <p className="flex items-center gap-2 text-sm text-gold"><Crown size={16} /> Champion {reigning.year}</p>
          <Link href={`/manager/${reigning.champion}`} className="mt-1 block display-title text-7xl sm:text-8xl uppercase text-ink hover:text-gold transition-colors">
            {reigning.champion}
          </Link>
          <p className="mt-3 text-text-secondary">
            Finale gegen {reigning.runner_up}. <Link href={`/history/${reigning.year}`} className="text-ink underline decoration-border-strong underline-offset-4 hover:decoration-red">Zur Saison {reigning.year}</Link>
          </p>
        </section>
      )}

      {/* Every title since the league started, in each champion's colour */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="section-title text-ink">Alle Champions</h2>
          <Link href="/history" className="flex items-center gap-1 text-sm text-text-muted hover:text-ink transition-colors">
            Zur History <ChevronRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-[repeat(11,minmax(0,1fr))]">
          {[...finished].reverse().map((s) => (
            <Link key={s.year} href={`/history/${s.year}`}
              className="group rounded-lg bg-surface px-2.5 pb-2.5 pt-2 transition-colors hover:bg-surface-2"
              style={{ boxShadow: `inset 0 3px 0 ${MANAGER_COLORS[s.champion] ?? "var(--color-border-strong)"}` }}>
              <div className="text-xs tabular-nums text-text-faint">{s.year}</div>
              <div className="truncate font-semibold text-ink">{s.champion}</div>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
          {titles.map(([m, n]) => (
            <span key={m} className="flex items-center gap-1.5">
              <ManagerName id={m} /> <span className="tabular-nums text-text-faint">{n}×</span>
            </span>
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="section-title text-ink">Aktuelle Rekordhalter</h2>
            <Link href="/trophies/records" className="flex items-center gap-1 text-sm text-text-muted hover:text-ink transition-colors">
              Alle Rekorde <ChevronRight size={15} />
            </Link>
          </div>
          <div className="cell grid sm:grid-cols-2">
            {records.map((r) => (
              <div key={r.record_label} className="flex items-center justify-between gap-3 border-b border-border-light px-4 py-3 sm:px-5 sm:[&:nth-last-child(-n+2)]:border-0 last:border-0 sm:odd:border-r">
                <span className="truncate text-sm text-text-secondary">{r.record_label}</span>
                <ManagerName id={r.manager_id} className="shrink-0 text-sm font-medium text-ink" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
