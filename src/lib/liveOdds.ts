// Live playoff odds while a week is being played.
//
// The weekly sync (Scrape playoff_odds.py) computes the odds after each completed week. During the
// next game day this module re-runs the same Monte Carlo with what is known right now:
//   - the current week: each team's live points (Sleeper) plus the projected points of starters who
//     have not finished (full projection before kick-off, half while their game runs, none after),
//     with a spread that shrinks as fewer points are left to score;
//   - later weeks: the expected scores and spreads of the weekly sync (playoff_schedule);
//   - the table: wins first, then points for; the top PLAYOFF_TEAMS make the playoffs.
// Runs on the server (route /api/live-odds, cached for a minute), never in the browser.

import { supabase } from "@/lib/supabase";
import { CURRENT_SEASON } from "@/lib/constants";

const LEAGUE_ID = "1321866747418001408"; // Sleeper league of the 2026 season
const SLEEPER = "https://api.sleeper.app/v1";
const SLEEPER_API = "https://api.sleeper.com";
const PLAYOFF_TEAMS = 4;
const SIMS = 10000;
const PRIOR_GAMES_MEAN = 3;
const PRIOR_GAMES_SD = 6;
const MIN_SD = 15;
const IN_PROGRESS_SHARE = 0.5; // share of a starter's projection still expected while his game runs

export type LiveTeam = {
  manager: string;
  opponent: string | null;
  wins: number; losses: number; ties: number; points_for: number;
  live: number;            // points so far this week
  projected: number;       // live + projected points still to come
  left: number;            // starters whose game has not finished
  starters: number;
  win_prob: number | null; // of this week's game
  playoff_pct: number;     // live
  before_pct: number | null; // after the last completed week (weekly sync)
  if_win: number | null;   // playoff odds if this week's game is won / lost
  if_loss: number | null;
  seed_pct: number[];
};
export type LiveOdds = {
  season: number;
  week: number;
  status: "pre" | "live" | "final";
  games: { total: number; started: number; finished: number };
  updated_at: string;
  sims: number;
  teams: LiveTeam[];       // sorted by live playoff odds, best first
};

type Sleeper = Record<string, unknown>;
type MatchupEntry = { roster_id: number; matchup_id: number | null; points?: number; starters?: string[]; starters_points?: number[] };
type NflGame = { week: number; home: string; away: string; status: string };

async function sleeper<T>(url: string): Promise<T> {
  const r = await fetch(url, { next: { revalidate: 60 } });
  if (!r.ok) throw new Error(`Sleeper ${r.status} for ${url}`);
  return r.json() as Promise<T>;
}

// Seeded random numbers, so a refresh without new data shows the same numbers
function rng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  return () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = uniform();
    v = uniform();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}

// Shrunk mean and spread per team, as playoff_odds.team_params
function teamParams(played: Record<string, number[]>) {
  const all = Object.values(played).flat();
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const leagueMean = all.length ? mean(all) : 110;
  const resid: number[] = [];
  for (const v of Object.values(played)) if (v.length > 1) { const m = mean(v); for (const x of v) resid.push(x - m); }
  const variance = (xs: number[]) => { const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1); };
  const leagueSd = resid.length > 2 ? Math.max(MIN_SD, Math.sqrt(variance(resid))) : 25;
  const mu: Record<string, number> = {}, sd: Record<string, number> = {};
  for (const [m, v] of Object.entries(played)) {
    const n = v.length;
    mu[m] = (v.reduce((s, x) => s + x, 0) + PRIOR_GAMES_MEAN * leagueMean) / (n + PRIOR_GAMES_MEAN);
    const vr = n > 1 ? variance(v) : leagueSd ** 2;
    sd[m] = Math.max(MIN_SD, Math.sqrt((n * vr + PRIOR_GAMES_SD * leagueSd ** 2) / (n + PRIOR_GAMES_SD)));
  }
  return { mu, sd };
}

export async function liveOdds(): Promise<LiveOdds | null> {
  const season = CURRENT_SEASON;
  const [oddsQ, schedQ, playedQ] = await Promise.all([
    supabase.from("playoff_odds").select("week, manager_id, wins, losses, ties, points_for, playoff_pct")
      .eq("season_year", season).order("week", { ascending: false }).limit(8),
    supabase.from("playoff_schedule").select("week, manager_id, opponent_id, proj_points").eq("season_year", season),
    supabase.from("weekly_matchups").select("week, manager_a, score_a, manager_b, score_b, is_playoff")
      .eq("season_year", season).eq("is_playoff", false),
  ]);
  for (const q of [oddsQ, schedQ, playedQ]) if (q.error) throw new Error(q.error.message);
  const odds = oddsQ.data ?? [];
  if (!odds.length) return null;
  const done = Math.max(...odds.map((o) => o.week));
  const base = odds.filter((o) => o.week === done);
  const week = done + 1;
  const sched = (schedQ.data ?? []).filter((g) => g.week >= week);
  const thisWeek = sched.filter((g) => g.week === week);
  if (!thisWeek.length) return null; // regular season over

  const managers = base.map((o) => o.manager_id).sort();
  const played: Record<string, number[]> = Object.fromEntries(managers.map((m) => [m, []]));
  for (const g of playedQ.data ?? []) {
    if (g.week > done) continue;
    played[g.manager_a]?.push(Number(g.score_a));
    played[g.manager_b]?.push(Number(g.score_b));
  }
  const { sd } = teamParams(played);

  // Sleeper: this week's matchups, last week's (to map rosters to managers), NFL schedule, projections
  const pos = ["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => `position[]=${p}`).join("&");
  const [entries, lastEntries, nfl, proj] = await Promise.all([
    sleeper<MatchupEntry[]>(`${SLEEPER}/league/${LEAGUE_ID}/matchups/${week}`),
    sleeper<MatchupEntry[]>(`${SLEEPER}/league/${LEAGUE_ID}/matchups/${done}`),
    sleeper<NflGame[]>(`${SLEEPER_API}/schedule/nfl/regular/${season}`),
    sleeper<Sleeper[]>(`${SLEEPER_API}/projections/nfl/${season}/${week}?season_type=regular&${pos}`),
  ]);

  // roster -> manager: last week's points in Sleeper match the stored scores
  const scoreOf: Record<string, number> = {};
  for (const g of playedQ.data ?? []) if (g.week === done) { scoreOf[g.manager_a] = Number(g.score_a); scoreOf[g.manager_b] = Number(g.score_b); }
  const rosterManager = new Map<number, string>();
  for (const e of lastEntries) {
    const pts = Number(e.points ?? 0);
    const hit = managers.filter((m) => !Array.from(rosterManager.values()).includes(m) && Math.abs((scoreOf[m] ?? -1) - pts) < 0.011);
    if (hit.length === 1) rosterManager.set(e.roster_id, hit[0]);
  }
  if (rosterManager.size !== managers.length) throw new Error("Rosters could not be matched to managers");

  const projOf = new Map<string, { pts: number; team: string | null }>();
  for (const p of proj) {
    const st = (p.stats ?? {}) as Record<string, number>;
    if (p.player_id != null) projOf.set(String(p.player_id), { pts: Number(st.pts_half_ppr ?? 0), team: (p.team as string) ?? null });
  }
  const gameStatus = new Map<string, string>();
  const weekGames = nfl.filter((g) => g.week === week);
  for (const g of weekGames) { gameStatus.set(g.home, g.status); gameStatus.set(g.away, g.status); }
  const started = weekGames.filter((g) => g.status !== "pre_game").length;
  const finished = weekGames.filter((g) => g.status === "complete").length;

  // This week, per team: live points and what is still to come
  const now: Record<string, { live: number; rest: number; full: number; left: number; starters: number }> = {};
  for (const e of entries) {
    const m = rosterManager.get(e.roster_id);
    if (!m) continue;
    let rest = 0, full = 0, left = 0, n = 0;
    (e.starters ?? []).forEach((pid) => {
      if (!pid || pid === "0") return;
      n++;
      const pj = projOf.get(pid);
      const pts = pj?.pts ?? 0;
      const team = pj?.team ?? (/^[A-Z]{2,3}$/.test(pid) ? pid : null);
      const status = team ? gameStatus.get(team) : undefined;
      full += pts;
      if (status === "pre_game") { rest += pts; left++; }
      else if (status === "in_progress") { rest += pts * IN_PROGRESS_SHARE; left++; }
    });
    now[m] = { live: Number(e.points ?? 0), rest, full, left, starters: n };
  }

  // Monte Carlo over this week (live) and the remaining weeks
  const games = sched.map((g) => g).filter((g) => g.manager_id < g.opponent_id);
  const expected = new Map(sched.map((g) => [`${g.week}:${g.manager_id}`, Number(g.proj_points)]));
  const idx = new Map(managers.map((m, i) => [m, i]));
  const T = managers.length;
  const normal = rng(week * 7919 + Math.round(Object.values(now).reduce((s, t) => s + t.live * 10, 0)));
  const madeCount = new Array(T).fill(0);
  const seedCount = Array.from({ length: T }, () => new Array(T).fill(0));
  const wonThis = new Array(T).fill(0), madeIfWin = new Array(T).fill(0), madeIfLoss = new Array(T).fill(0);
  const wins = new Float64Array(T), pf = new Float64Array(T), won = new Uint8Array(T);
  const baseRec = new Map(base.map((o) => [o.manager_id, o]));

  for (let s = 0; s < SIMS; s++) {
    managers.forEach((m, i) => { const o = baseRec.get(m)!; wins[i] = o.wins; pf[i] = Number(o.points_for); won[i] = 0; });
    for (const g of games) {
      const a = idx.get(g.manager_id)!, b = idx.get(g.opponent_id)!;
      const score = (m: string) => {
        if (g.week === week && now[m]) {
          const t = now[m];
          const spread = sd[m] * Math.sqrt(t.full > 0 ? Math.min(1, t.rest / t.full) : 0);
          return Math.max(t.live, t.live + t.rest + spread * normal());
        }
        return (expected.get(`${g.week}:${m}`) ?? 110) + sd[m] * normal();
      };
      const sa = score(g.manager_id), sb = score(g.opponent_id);
      if (sa > sb) wins[a]++; else wins[b]++;
      pf[a] += sa; pf[b] += sb;
      if (g.week === week) { if (sa > sb) won[a] = 1; else won[b] = 1; }
    }
    const order = managers.map((_, i) => i).sort((x, y) => (wins[y] - wins[x]) || (pf[y] - pf[x]));
    order.forEach((i, rank) => {
      seedCount[i][rank]++;
      const made = rank < PLAYOFF_TEAMS;
      if (made) madeCount[i]++;
      if (won[i]) { wonThis[i]++; if (made) madeIfWin[i]++; } else if (made) madeIfLoss[i]++;
    });
  }

  const opp = new Map(thisWeek.map((g) => [g.manager_id, g.opponent_id]));
  const teams: LiveTeam[] = managers.map((m, i) => {
    const o = baseRec.get(m)!;
    const t = now[m] ?? { live: 0, rest: 0, full: 0, left: 0, starters: 0 };
    const w = wonThis[i];
    return {
      manager: m, opponent: opp.get(m) ?? null,
      wins: o.wins, losses: o.losses, ties: o.ties, points_for: Number(o.points_for),
      live: round(t.live, 2), projected: round(t.live + t.rest, 1), left: t.left, starters: t.starters,
      win_prob: opp.has(m) ? round(w / SIMS, 4) : null,
      playoff_pct: round(madeCount[i] / SIMS, 4),
      before_pct: o.playoff_pct == null ? null : Number(o.playoff_pct),
      if_win: w > 0 ? round(madeIfWin[i] / w, 4) : null,
      if_loss: SIMS - w > 0 ? round(madeIfLoss[i] / (SIMS - w), 4) : null,
      seed_pct: seedCount[i].map((c) => round(c / SIMS, 4)),
    };
  }).sort((a, b) => b.playoff_pct - a.playoff_pct || b.wins - a.wins);

  return {
    season, week,
    status: started === 0 ? "pre" : finished === weekGames.length ? "final" : "live",
    games: { total: weekGames.length, started, finished },
    updated_at: new Date().toISOString(),
    sims: SIMS,
    teams,
  };
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
