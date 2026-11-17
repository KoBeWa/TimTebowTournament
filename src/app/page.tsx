import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { CURRENT_SEASON, MANAGER_COLORS } from "@/lib/constants";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import StatTile from "@/components/ui/StatTile";

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
  const rec = (s: Standing) => `${s.wins}–${s.losses}${s.ties ? `–${s.ties}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="grid items-stretch gap-5 xl:grid-cols-3">
        {/* The one highlighted card: what happened this week */}
        {running && top ? (
          <section className="cell-accent flex flex-col justify-between gap-8 p-6 sm:p-8 xl:col-span-2">
            <div>
              <p className="text-sm text-on-accent/75">Saison {CURRENT_SEASON}</p>
              <h1 className="mt-1 display-title text-5xl sm:text-6xl">Woche {current.week}</h1>
              <p className="mt-3 max-w-md text-lg text-on-accent/90">
                {top.id} holt mit {pts(top.score)} Punkten den Wochensieg.
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <dl className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dd className="display-title text-3xl tabular-nums">{pts(top.score)}</dd>
                  <dt className="text-sm text-on-accent/70">Höchster Score</dt>
                </div>
                {closest && (
                  <div>
                    <dd className="display-title text-3xl tabular-nums">{pts(Math.abs(closest.score_a - closest.score_b))}</dd>
                    <dt className="text-sm text-on-accent/70">Knappstes Spiel, {closest.manager_a} gegen {closest.manager_b}</dt>
                  </div>
                )}
                <div>
                  <dd className="display-title text-3xl tabular-nums">{pts(avg)}</dd>
                  <dt className="text-sm text-on-accent/70">Schnitt der Liga</dt>
                </div>
              </dl>
              <Link href="/gamecenter" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-on-accent px-5 text-sm font-semibold text-gold hover:bg-black transition-colors">
                Zum Gamecenter <ChevronRight size={16} />
              </Link>
            </div>
          </section>
        ) : reigning && (
          <section className="cell-accent flex flex-col justify-between gap-8 p-6 sm:p-8 xl:col-span-2">
            <div>
              <p className="flex items-center gap-2 text-sm text-on-accent/75"><Crown size={16} /> Champion {reigning.year}</p>
              <h1 className="mt-1 display-title text-6xl sm:text-7xl uppercase">{reigning.champion}</h1>
              <p className="mt-3 text-lg text-on-accent/90">Finale gegen {reigning.runner_up}.</p>
            </div>
            <Link href={`/history/${reigning.year}`} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-on-accent px-5 text-sm font-semibold text-gold">
              Zur Saison {reigning.year} <ChevronRight size={16} />
            </Link>
          </section>
        )}

        {running && (
          <section className="cell overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="pb-2.5 pl-5 pr-2 pt-4 font-medium">Tabelle</th>
                  <th className="px-2 pb-2.5 pt-4 text-right font-medium">Bilanz</th>
                  <th className="pb-2.5 pl-2 pr-5 pt-4 text-right font-medium">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {current.standings.map((s) => (
                  <tr key={s.manager_id}
                    className={`border-t ${s.reg_rank === playoffTeams + 1 ? "border-dashed border-border-strong" : "border-border-light"}`}>
                    <td className="py-2 pl-5 pr-2">
                      <span className="flex items-center gap-3">
                        <span className="w-4 text-right tabular-nums text-text-faint">{s.reg_rank}</span>
                        <ManagerName id={s.manager_id} className="font-medium text-ink" />
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-secondary">{rec(s)}</td>
                    <td className="py-2 pl-2 pr-5 text-right tabular-nums text-text-secondary">{pts(s.points_for)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href={`/history/${CURRENT_SEASON}`} className="flex min-h-11 items-center justify-center gap-1 border-t border-border-light px-4 text-sm text-text-muted hover:text-ink transition-colors">
              Ganze Tabelle <ChevronRight size={15} />
            </Link>
          </section>
        )}
      </div>

      {running && leader && scorer && (
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          <StatTile label="Tabellenführer" value={leader.manager_id} hint={`Bilanz ${rec(leader)}`} />
          <StatTile label="Meiste Punkte" value={scorer.manager_id} hint={`${pts(scorer.points_for)} Punkte`} />
          {bubble && <StatTile label={`Letzter Playoff-Platz (${playoffTeams}.)`} value={bubble.manager_id} hint={`Bilanz ${rec(bubble)}`} />}
          {reigning && <StatTile label="Titelverteidiger" value={reigning.champion} hint={`Champion ${reigning.year}`} tone="gold" />}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        {running && (
          <section className="cell overflow-hidden xl:col-span-2">
            <h2 className="px-5 pb-1 pt-4 text-sm font-medium text-text-muted">Ergebnisse der Woche</h2>
            {current.games.map((m) => (
              <Link key={m.manager_a} href={`/gamecenter/${CURRENT_SEASON}/${m.week}?a=${m.manager_a}&b=${m.manager_b}`}
                className="flex items-center gap-2.5 border-b border-border-light px-5 py-3.5 last:border-0 hover:bg-white/5 transition-colors sm:gap-4">
                <Side id={m.manager_a} score={m.score_a} won={m.score_a > m.score_b} align="left" />
                <span className="text-xs text-text-faint">vs</span>
                <Side id={m.manager_b} score={m.score_b} won={m.score_b > m.score_a} align="right" />
              </Link>
            ))}
          </section>
        )}

        {records.length > 0 && (
          <section className={`cell overflow-hidden ${running ? "" : "xl:col-span-3"}`}>
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <h2 className="text-sm font-medium text-text-muted">Aktuelle Rekordhalter</h2>
              <Link href="/trophies/records" className="flex items-center gap-0.5 text-sm text-text-muted hover:text-ink transition-colors">
                Alle <ChevronRight size={15} />
              </Link>
            </div>
            {records.map((r) => (
              <div key={r.record_label} className="flex items-center justify-between gap-3 border-b border-border-light px-5 py-2.5 last:border-0">
                <span className="truncate text-sm text-text-secondary">{r.record_label}</span>
                <ManagerName id={r.manager_id} className="shrink-0 text-sm font-medium text-ink" />
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Every title since the league started, in each champion's colour */}
      <section className="cell p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-text-muted">Alle Champions</h2>
          <Link href="/history" className="flex items-center gap-0.5 text-sm text-text-muted hover:text-ink transition-colors">
            Zur History <ChevronRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-[repeat(11,minmax(0,1fr))]">
          {[...finished].reverse().map((s) => (
            <Link key={s.year} href={`/history/${s.year}`}
              className="rounded-xl bg-white/5 px-2.5 pb-2.5 pt-2 transition-colors hover:bg-white/10"
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
    </div>
  );
}
