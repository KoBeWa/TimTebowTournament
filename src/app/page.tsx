import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { CURRENT_SEASON, MANAGERS } from "@/lib/constants";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import StatTile from "@/components/ui/StatTile";
import { closestToHalf, fmtPct } from "@/lib/playoffs";
import { fmtNum } from "@/lib/format";

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

// Latest playoff odds, for the "Playoff-Rennen" tile; empty before the first odds exist
async function getRaceOdds() {
  const { data } = await supabase.from("playoff_odds").select("week, manager_id, playoff_pct")
    .eq("season_year", CURRENT_SEASON).order("week", { ascending: false }).limit(MANAGERS.length);
  const week = data?.[0]?.week;
  return (data ?? []).filter((r) => r.week === week).map((r) => ({ week: r.week as number, manager_id: r.manager_id as string, playoff_pct: Number(r.playoff_pct) }));
}

const pts = (n: number) => fmtNum(Number(n));

function Side({ id, score, won, align }: { id: string; score: number; won: boolean; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <ManagerName id={id} plain className={`${align === "right" ? "flex-row-reverse" : ""} text-sm sm:text-base ${won ? "font-medium text-ink" : "text-text-muted"}`} />
      <span className={`measured text-lg sm:text-xl ${align === "right" ? "mr-auto" : "ml-auto"} ${won ? "font-medium text-ink" : "text-text-muted"}`}>{pts(score)}</span>
    </div>
  );
}

export default async function HomePage() {
  const [seasons, current, records, raceOdds] = await Promise.all([getSeasonSummaries(), getCurrentSeason(), getLeagueRecords(), getRaceOdds()]);
  const race = closestToHalf(raceOdds);

  const finished = seasons.filter((s) => s.champion !== "—");
  const reigning = finished[0];
  const running = current.standings.length > 0 && !finished.some((s) => s.year === CURRENT_SEASON);
  const playoffTeams = seasons.find((s) => s.year === CURRENT_SEASON)?.playoff_teams ?? 4;

  const titles = Object.entries(finished.reduce<Record<string, number>>((acc, s) => {
    acc[s.champion] = (acc[s.champion] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  // The week in three numbers
  const sides = current.games.flatMap((m) => [
    { id: m.manager_a, score: Number(m.score_a) }, { id: m.manager_b, score: Number(m.score_b) },
  ]);
  const top = [...sides].sort((a, b) => b.score - a.score)[0];
  const closest = [...current.games].sort((a, b) => Math.abs(a.score_a - a.score_b) - Math.abs(b.score_a - b.score_b))[0];
  const avg = sides.length ? sides.reduce((n, s) => n + s.score, 0) / sides.length : 0;

  const leader = current.standings[0];
  const scorer = [...current.standings].sort((a, b) => Number(b.points_for) - Number(a.points_for))[0];
  const bubble = current.standings.find((s) => s.reg_rank === playoffTeams);
  const rec = (s: Standing) => `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`;

  return (
    <div className="space-y-8">
      <div className="grid items-stretch gap-8 xl:grid-cols-5">
        {/* The one lead panel: what happened this week */}
        {running && top ? (
          <section className="cell-accent flex flex-col justify-between gap-8 p-4 sm:p-5 xl:col-span-3">
            <div>
              <p className="text-sm text-text-muted">Saison {CURRENT_SEASON}</p>
              <h1 className="mt-1 display-title text-4xl text-ink sm:text-5xl">Woche {current.week}</h1>
              <p className="mt-3 max-w-md text-base text-text-secondary">
                {top.id} holt mit <span className="measured text-ink">{pts(top.score)}</span> Punkten den Wochensieg.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <div>
                <dd className="measured text-2xl text-ink">{pts(top.score)}</dd>
                <dt className="mt-1 text-sm text-text-muted">Höchster Score</dt>
              </div>
              {closest && (
                <div>
                  <dd className="measured text-2xl text-ink">{pts(Math.abs(closest.score_a - closest.score_b))}</dd>
                  <dt className="mt-1 text-sm text-text-muted">Knappstes Spiel, {closest.manager_a} gegen {closest.manager_b}</dt>
                </div>
              )}
              <div>
                <dd className="measured text-2xl text-ink">{pts(avg)}</dd>
                <dt className="mt-1 text-sm text-text-muted">Schnitt der Liga</dt>
              </div>
            </dl>
            <div>
              <Link href="/gamecenter" className="btn-primary inline-flex items-center gap-1.5">
                Zum Gamecenter <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          </section>
        ) : reigning && (
          <section className="cell-accent flex flex-col justify-between gap-8 p-4 sm:p-5 xl:col-span-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-text-muted"><Crown size={16} aria-hidden className="text-red" /> Champion {reigning.year}</p>
              <h1 className="mt-1 display-title text-4xl text-ink sm:text-5xl">{reigning.champion}</h1>
              <p className="mt-3 text-base text-text-secondary">Finale gegen {reigning.runner_up}.</p>
            </div>
            <div>
              <Link href={`/history/${reigning.year}`} className="btn-primary inline-flex items-center gap-1.5">
                Zur Saison {reigning.year} <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          </section>
        )}

        {running && (
          <section className="cell overflow-x-auto xl:col-span-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-text-muted">
                  <th className="px-4 py-2.5 font-medium">Tabelle</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bilanz</th>
                  <th className="px-4 py-2.5 text-right font-medium">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {current.standings.map((s) => (
                  <tr key={s.manager_id}
                    className={`border-t ${s.reg_rank === playoffTeams + 1 ? "border-dashed border-border-strong" : "border-border-light"}`}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="measured w-4 text-right text-text-faint">{s.reg_rank}</span>
                        <ManagerName id={s.manager_id} className="font-medium text-ink" />
                      </span>
                    </td>
                    <td className="measured px-4 py-2.5 text-right text-text-secondary">{rec(s)}</td>
                    <td className="measured px-4 py-2.5 text-right text-text-secondary">{pts(s.points_for)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href={`/history/${CURRENT_SEASON}`} className="flex min-h-11 items-center justify-center gap-1 border-t border-border-light px-4 text-sm text-text-muted hover:text-ink transition-colors">
              Ganze Tabelle <ChevronRight size={15} aria-hidden />
            </Link>
          </section>
        )}
      </div>

      {running && leader && scorer && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Tabellenführer" value={leader.manager_id} hint={`Bilanz ${rec(leader)}`} />
          <StatTile label="Meiste Punkte" value={scorer.manager_id} hint={`${pts(scorer.points_for)} Punkte`} />
          {race ? (
            <Link href="/playoffs" className="block transition-opacity hover:opacity-85">
              <StatTile label="Playoff-Rennen" value={race.manager_id} hint={`${fmtPct(race.playoff_pct)} Playoff-Chance`} />
            </Link>
          ) : bubble && <StatTile label={`Letzter Playoff-Platz (${playoffTeams}.)`} value={bubble.manager_id} hint={`Bilanz ${rec(bubble)}`} />}
          {reigning && <StatTile label="Titelverteidiger" value={reigning.champion} hint={`Champion ${reigning.year}`} />}
        </div>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-3">
        {running && (
          <section className="cell overflow-hidden xl:col-span-2">
            <h2 className="px-4 pb-2 pt-4 text-base font-medium text-ink sm:px-5">Ergebnisse der Woche</h2>
            {current.games.map((m) => (
              <Link key={m.manager_a} href={`/gamecenter/${CURRENT_SEASON}/${m.week}?a=${m.manager_a}&b=${m.manager_b}`}
                className="flex min-h-11 items-center gap-2.5 border-t border-border-light px-4 py-2.5 hover:bg-surface-2 transition-colors sm:gap-4 sm:px-5">
                <Side id={m.manager_a} score={m.score_a} won={m.score_a > m.score_b} align="left" />
                <span className="text-xs text-text-faint">vs</span>
                <Side id={m.manager_b} score={m.score_b} won={m.score_b > m.score_a} align="right" />
              </Link>
            ))}
          </section>
        )}

        {records.length > 0 && (
          <section className={`cell overflow-hidden ${running ? "" : "xl:col-span-3"}`}>
            <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:px-5">
              <h2 className="text-base font-medium text-ink">Aktuelle Rekordhalter</h2>
              <Link href="/trophies/records" className="flex min-h-11 items-center gap-0.5 text-sm text-text-muted hover:text-ink transition-colors">
                Alle <ChevronRight size={15} aria-hidden />
              </Link>
            </div>
            <div className="divide-y divide-border-light border-t border-border-light">
              {records.map((r) => (
                <div key={r.record_label} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="truncate text-sm text-text-secondary">{r.record_label}</span>
                  <ManagerName id={r.manager_id} className="shrink-0 text-sm font-medium text-ink" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Every title since the league started */}
      <section className="cell p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-ink">Alle Champions</h2>
          <Link href="/history" className="flex min-h-11 items-center gap-0.5 text-sm text-text-muted hover:text-ink transition-colors">
            Zur History <ChevronRight size={15} aria-hidden />
          </Link>
        </div>
        <div className="overflow-hidden">
        <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6">
          {[...finished].reverse().map((s) => (
            <Link key={s.year} href={`/history/${s.year}`}
              className="flex min-h-11 flex-col gap-0.5 border-l border-t border-border-light px-3 py-2.5 transition-colors hover:bg-surface-2">
              <span className="measured text-xs text-text-faint">{s.year}</span>
              <ManagerName id={s.champion} plain className="font-medium text-ink" />
            </Link>
          ))}
        </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
          {titles.map(([m, n]) => (
            <span key={m} className="flex items-center gap-1.5">
              <ManagerName id={m} /> <span className="measured text-text-faint">{n}×</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
