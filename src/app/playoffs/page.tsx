import { supabase } from "@/lib/supabase";
import { CURRENT_SEASON, MANAGERS } from "@/lib/constants";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import type { GameRow, OddsRow, TrendRow } from "@/lib/playoffs";
import OddsTable from "./OddsTable";
import PlayoffTabs from "./PlayoffTabs";
import { fmtInt } from "@/lib/format";

// Revalidated hourly with the layout; the numbers change once a week.
// A failed query throws, so a stale copy of the page stays up instead of an empty one.
async function load() {
  const [latest, trend, schedule] = await Promise.all([
    supabase.from("playoff_odds")
      .select("week, manager_id, model, wins, losses, ties, points_for, playoff_pct, last_pct, seed_pct, proj_wins, proj_pf, games_left, odds_if_win, odds_if_loss, odds_by_wins, scenarios, sims")
      .eq("season_year", CURRENT_SEASON).order("week", { ascending: false }).limit(MANAGERS.length),
    supabase.from("playoff_odds").select("week, manager_id, playoff_pct")
      .eq("season_year", CURRENT_SEASON).order("week"),
    supabase.from("playoff_schedule")
      .select("week, manager_id, opponent_id, proj_points, opp_proj_points, win_prob")
      .eq("season_year", CURRENT_SEASON).order("week"),
  ]);
  for (const r of [latest, trend, schedule]) if (r.error) throw new Error(r.error.message);

  const week = Math.max(0, ...(trend.data ?? []).map((t) => t.week));
  const odds = ((latest.data ?? []) as OddsRow[])
    .filter((o) => o.week === week)
    .map((o) => ({
      ...o,
      points_for: Number(o.points_for), playoff_pct: Number(o.playoff_pct), last_pct: Number(o.last_pct),
      seed_pct: (o.seed_pct ?? []).map(Number), proj_wins: Number(o.proj_wins), proj_pf: Number(o.proj_pf),
      odds_if_win: o.odds_if_win == null ? null : Number(o.odds_if_win),
      odds_if_loss: o.odds_if_loss == null ? null : Number(o.odds_if_loss),
    }))
    .sort((a, b) => b.playoff_pct - a.playoff_pct || b.wins - a.wins || b.points_for - a.points_for);
  return {
    week, odds,
    trend: (trend.data ?? []).map((t) => ({ ...t, playoff_pct: Number(t.playoff_pct) })) as TrendRow[],
    games: (schedule.data ?? []).map((g) => ({
      ...g, proj_points: Number(g.proj_points), opp_proj_points: Number(g.opp_proj_points), win_prob: Number(g.win_prob),
    })) as GameRow[],
  };
}

export default async function PlayoffsPage() {
  const { week, odds, trend, games } = await load();

  if (odds.length === 0) {
    return (
      <div>
        <PageHeader title="Playoff-Chancen" />
        <div className="cell p-6 text-sm text-text-secondary">
          Für die Saison {CURRENT_SEASON} gibt es noch keine Playoff-Chancen. Sie erscheinen nach Woche 1 und werden jede Woche neu gerechnet.
        </div>
      </div>
    );
  }

  const previous = Object.fromEntries(trend.filter((t) => t.week === week - 1).map((t) => [t.manager_id, t.playoff_pct]));
  const sims = fmtInt(odds[0].sims);

  return (
    <div className="space-y-8">
      <PageHeader title="Playoff-Chancen" description={`Stand nach Woche ${week}, berechnet aus ${sims} simulierten Saisonverläufen.`}>
        <Link href="/playoffs/live" className="btn">Live-Prognose</Link>
      </PageHeader>
      <OddsTable rows={odds} previous={previous} />
      <PlayoffTabs odds={odds} trend={trend} games={games} season={CURRENT_SEASON} />
      <details className="cell group">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-medium text-text-secondary hover:text-ink sm:px-5">So wird gerechnet</summary>
        <div className="space-y-2 px-4 pb-5 pt-1 text-sm text-text-muted sm:px-5">
          <p>Die Restsaison wird {sims}-mal durchgespielt. In jeder Woche bekommt jedes Team eine zufällige Punktzahl um seinen Erwartungswert.</p>
          <p>Der Erwartungswert mischt die Projektion von Sleeper für die bestmögliche Aufstellung mit dem Saisonschnitt des Teams. Byes und Verletzte zählen dabei als 0 Punkte.</p>
          <p>Die Tabelle wird nach Siegen sortiert, bei Gleichstand nach Punkten. Die ersten vier Teams erreichen die Playoffs, das letzte bekommt den Sacko.</p>
          <p>Die Wochen vor der aktuellen sind nur aus Saisondurchschnitten gerechnet, deshalb schwankt der Verlauf dort weniger realistisch.</p>
        </div>
      </details>
    </div>
  );
}
