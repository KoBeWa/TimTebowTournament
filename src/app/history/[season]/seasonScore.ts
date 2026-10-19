// Season score 0-100: one number for how good a season was.
//   35 %  all-play win share (strength, independent of the schedule)
//   25 %  regular season win share (results)
//   15 %  points for, scaled within the season (lowest 0, highest 1)
//   25 %  final placement (champion 1, last place 0; the table position while a season runs)

export const SCORE_WEIGHTS = { allPlay: 0.35, record: 0.25, points: 0.15, finish: 0.25 };

export interface ScoreInput {
  manager_id: string;
  apPct: number | null;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  rank: number; // final rank, or regular season rank while the season runs
}

export function seasonScores(rows: ScoreInput[]): Record<string, number> {
  const pfs = rows.map((r) => r.pf);
  const minPf = Math.min(...pfs), maxPf = Math.max(...pfs);
  const n = rows.length;
  return Object.fromEntries(rows.map((r) => {
    const games = r.wins + r.losses + r.ties;
    const record = games ? (r.wins + r.ties / 2) / games : 0;
    const points = maxPf > minPf ? (r.pf - minPf) / (maxPf - minPf) : 0.5;
    const finish = n > 1 ? (n - r.rank) / (n - 1) : 1;
    const w = SCORE_WEIGHTS;
    const score = w.allPlay * (r.apPct ?? record) + w.record * record + w.points * points + w.finish * finish;
    return [r.manager_id, Math.round(score * 100)];
  }));
}
