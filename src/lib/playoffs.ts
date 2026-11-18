import { fmtNum } from "./format";
// Shared types and formatting for the playoff odds (page /playoffs and the home page tile).
// Numbers in the database are fractions (0..1); the helpers below format them German style.

export type OddsRow = {
  week: number;
  manager_id: string;
  model: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  playoff_pct: number;
  last_pct: number;
  seed_pct: number[];
  proj_wins: number;
  proj_pf: number;
  games_left: number;
  odds_if_win: number | null;
  odds_if_loss: number | null;
  // k more wins -> [chance of exactly k more wins, playoff odds with k more wins]
  odds_by_wins: Record<string, [number, number | null]>;
  sims: number;
};
export type TrendRow = { week: number; manager_id: string; playoff_pct: number };
export type GameRow = {
  week: number;
  manager_id: string;
  opponent_id: string;
  proj_points: number;
  opp_proj_points: number;
  win_prob: number;
};

const NBSP = " ";

export { fmtNum };

// 0.586 -> "58,6 %", tiny values -> "< 1 %", near-certain -> "> 99 %"
export function fmtPct(p: number) {
  const v = p * 100;
  if (v <= 0) return `0${NBSP}%`;
  if (v < 1) return `<${NBSP}1${NBSP}%`;
  if (v >= 100) return `100${NBSP}%`;
  if (v > 99) return `>${NBSP}99${NBSP}%`;
  return `${fmtNum(v)}${NBSP}%`;
}

// The manager whose race is most open: odds closest to 50 %
export function closestToHalf<T extends { playoff_pct: number }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => Math.abs(a.playoff_pct - 0.5) - Math.abs(b.playoff_pct - 0.5))[0];
}
