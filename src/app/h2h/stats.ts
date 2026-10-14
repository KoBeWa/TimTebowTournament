// Pure helpers for the Head-to-Head page

export interface H2HMatchup {
  season_year: number;
  week: number;
  myScore: number;
  theirScore: number;
  is_playoff: boolean;
}

export interface LineupRow {
  season_year: number;
  week: number;
  manager_id: string;
  slot: string;
  player_name: string;
  points: number;
  is_starter: boolean;
}

export interface PairRecord {
  manager_id: string;
  opponent_id: string;
  total_games: number;
  wins: number;
  losses: number;
  ties: number;
  avg_score_for: number;
}

export type Side = "me" | "them";

export function resultOf(m: H2HMatchup): Side | "tie" {
  return m.myScore > m.theirScore ? "me" : m.myScore < m.theirScore ? "them" : "tie";
}

export function record(ms: H2HMatchup[]) {
  return {
    wins: ms.filter((m) => resultOf(m) === "me").length,
    losses: ms.filter((m) => resultOf(m) === "them").length,
    ties: ms.filter((m) => resultOf(m) === "tie").length,
  };
}

/** Longest run of wins per side and the streak that is still running. */
export function streaks(ms: H2HMatchup[]) {
  const longest = { me: 0, them: 0 };
  let current: { side: Side | "tie" | null; length: number } = { side: null, length: 0 };
  for (const m of ms) {
    const r = resultOf(m);
    current = r === current.side ? { side: r, length: current.length + 1 } : { side: r, length: 1 };
    if (r !== "tie") longest[r] = Math.max(longest[r], current.length);
  }
  return { longest, current };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function scoring(ms: H2HMatchup[]) {
  return {
    avgMe: avg(ms.map((m) => m.myScore)),
    avgThem: avg(ms.map((m) => m.theirScore)),
    maxMe: Math.max(0, ...ms.map((m) => m.myScore)),
    maxThem: Math.max(0, ...ms.map((m) => m.theirScore)),
    avgMargin: avg(ms.map((m) => Math.abs(m.myScore - m.theirScore))),
  };
}

/** Notable single games of the rivalry. */
export function recordGames(ms: H2HMatchup[]) {
  if (!ms.length) return null;
  const by = (f: (m: H2HMatchup) => number) => [...ms].sort((a, b) => f(b) - f(a))[0];
  const wonMe = ms.filter((m) => resultOf(m) === "me");
  const wonThem = ms.filter((m) => resultOf(m) === "them");
  return {
    biggestMe: wonMe.length ? by((m) => m.myScore - m.theirScore) : null,
    biggestThem: wonThem.length ? by((m) => m.theirScore - m.myScore) : null,
    closest: by((m) => -Math.abs(m.myScore - m.theirScore)),
    highest: by((m) => m.myScore + m.theirScore),
    lowest: by((m) => -(m.myScore + m.theirScore)),
  };
}

/** Average points of a manager over all games (from v_head_to_head). */
export function overallAverage(rows: PairRecord[], manager: string) {
  const own = rows.filter((r) => r.manager_id === manager);
  const games = own.reduce((s, r) => s + r.total_games, 0);
  return games ? own.reduce((s, r) => s + r.avg_score_for * r.total_games, 0) / games : 0;
}

export interface PlayerGame {
  player: string;
  manager: string;
  points: number;
  season_year: number;
  week: number;
}

export function topPerformances(rows: LineupRow[], n = 5): PlayerGame[] {
  return rows
    .filter((r) => r.is_starter)
    .sort((a, b) => b.points - a.points)
    .slice(0, n)
    .map((r) => ({ player: r.player_name, manager: r.manager_id, points: r.points, season_year: r.season_year, week: r.week }));
}

/** Players with the most starter points in the rivalry, per manager. */
export function rivalryKillers(rows: LineupRow[], manager: string, n = 3) {
  const totals = new Map<string, { points: number; games: number; best: number }>();
  for (const r of rows) {
    if (!r.is_starter || r.manager_id !== manager) continue;
    const t = totals.get(r.player_name) ?? { points: 0, games: 0, best: 0 };
    t.points += r.points;
    t.games += 1;
    t.best = Math.max(t.best, r.points);
    totals.set(r.player_name, t);
  }
  return [...totals.entries()]
    .map(([player, t]) => ({ player, ...t }))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

/** Players who started for both managers in this rivalry, most points first. */
export function sideSwitchers(rows: LineupRow[], m1: string, m2: string) {
  const sides = new Map<string, { managers: Set<string>; points: number }>();
  for (const r of rows) {
    if (!r.is_starter || r.slot === "DST") continue;
    const s = sides.get(r.player_name) ?? { managers: new Set<string>(), points: 0 };
    s.managers.add(r.manager_id);
    s.points += r.points;
    sides.set(r.player_name, s);
  }
  return [...sides.entries()]
    .filter(([, s]) => s.managers.has(m1) && s.managers.has(m2))
    .sort((a, b) => b[1].points - a[1].points)
    .map(([player]) => player);
}

export function benchStats(rows: LineupRow[], manager: string) {
  const bench = rows.filter((r) => !r.is_starter && r.manager_id === manager);
  const best = [...bench].sort((a, b) => b.points - a.points)[0] ?? null;
  return { total: bench.reduce((s, r) => s + r.points, 0), best };
}
