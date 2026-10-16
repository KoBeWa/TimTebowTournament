import { supabase } from "@/lib/supabase";
import { MANAGERS } from "@/lib/constants";

// Cumulative all-time metrics per manager after every league week

export type MetricKey = "wins" | "winPct" | "points" | "elo" | "titles" | "rank";

export interface TrendData {
  weeks: { season: number; week: number }[];
  series: Record<MetricKey, Record<string, (number | null)[]>>;
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

type Matchup = { season_year: number; week: number; manager_a: string; score_a: number; manager_b: string; score_b: number };
type Elo = { season_year: number; week: number; manager_id: string; elo_after: number };
type Champion = { season_year: number; manager_id: string };

export async function getTrendData(): Promise<TrendData> {
  const [matchups, elo, champions] = await Promise.all([
    fetchAll<Matchup>((f, t) => supabase.from("weekly_matchups")
      .select("season_year, week, manager_a, score_a, manager_b, score_b")
      .order("season_year").order("week").order("id").range(f, t)),
    fetchAll<Elo>((f, t) => supabase.from("v_elo_history")
      .select("season_year, week, manager_id, elo_after")
      .order("game_seq").range(f, t)),
    fetchAll<Champion>((f, t) => supabase.from("playoff_results")
      .select("season_year, manager_id").eq("final_rank", 1).range(f, t)),
  ]);

  // League weeks in order
  const weekKey = (s: number, w: number) => `${s}-${w}`;
  const weeks: { season: number; week: number }[] = [];
  const index = new Map<string, number>();
  for (const m of matchups) {
    const k = weekKey(m.season_year, m.week);
    if (!index.has(k)) {
      index.set(k, weeks.length);
      weeks.push({ season: m.season_year, week: m.week });
    }
  }
  const n = weeks.length;
  const empty = () => Object.fromEntries(MANAGERS.map((m) => [m, Array<number | null>(n).fill(null)]));
  const series: TrendData["series"] = {
    wins: empty(), winPct: empty(), points: empty(), elo: empty(), titles: empty(), rank: empty(),
  };

  // Wins, win share and points, carried forward through every week
  const acc = Object.fromEntries(MANAGERS.map((m) => [m, { w: 0, g: 0, t: 0, pts: 0 }]));
  const byWeek = new Map<number, Matchup[]>();
  for (const m of matchups) {
    const i = index.get(weekKey(m.season_year, m.week))!;
    (byWeek.get(i) ?? byWeek.set(i, []).get(i)!).push(m);
  }
  const lastWeekOfSeason = new Map<number, number>();
  weeks.forEach((w, i) => lastWeekOfSeason.set(w.season, i));
  const titleWeeks = new Map<number, string>();
  for (const c of champions) {
    const i = lastWeekOfSeason.get(c.season_year);
    if (i !== undefined) titleWeeks.set(i, c.manager_id);
  }
  const titles = Object.fromEntries(MANAGERS.map((m) => [m, 0]));

  for (let i = 0; i < n; i++) {
    for (const m of byWeek.get(i) ?? []) {
      const a = acc[m.manager_a], b = acc[m.manager_b];
      if (!a || !b) continue;
      const sa = Number(m.score_a), sb = Number(m.score_b);
      a.g += 1; b.g += 1;
      a.pts += sa; b.pts += sb;
      if (sa > sb) a.w += 1; else if (sb > sa) b.w += 1; else { a.t += 1; b.t += 1; }
    }
    const champ = titleWeeks.get(i);
    if (champ && champ in titles) titles[champ] += 1;
    for (const mgr of MANAGERS) {
      const s = acc[mgr];
      series.wins[mgr][i] = s.w;
      series.winPct[mgr][i] = s.g ? Math.round(((s.w + s.t / 2) / s.g) * 1000) / 10 : null;
      series.points[mgr][i] = Math.round(s.pts);
      series.titles[mgr][i] = titles[mgr];
    }
    // Position in the all-time table (wins, then points)
    const order = [...MANAGERS].sort((x, y) => acc[y].w - acc[x].w || acc[y].pts - acc[x].pts);
    order.forEach((mgr, r) => { series.rank[mgr][i] = r + 1; });
  }

  // Elo after each game, carried forward over weeks without a rating
  for (const e of elo) {
    const i = index.get(weekKey(e.season_year, e.week));
    if (i !== undefined && series.elo[e.manager_id]) series.elo[e.manager_id][i] = Math.round(Number(e.elo_after));
  }
  for (const mgr of MANAGERS) {
    const s = series.elo[mgr];
    let last: number | null = null;
    let lastIdx = -1;
    s.forEach((v, i) => { if (v != null) lastIdx = i; });
    for (let i = 0; i <= lastIdx; i++) {
      if (s[i] == null) s[i] = last; else last = s[i];
    }
  }

  return { weeks, series };
}
