import type { PlayerInfo, PlayerManagerStats } from "@/lib/players";

export interface Row {
  key: string;
  name: string;
  position: string | null;
  team: string | null;
  headshot: string | null;
  weeks: number;
  starts: number;
  points: number;
  avg: number | null;
  best: number | null;
  first: number | null;
  last: number | null;
  drafted: number;
  adds: number;
  drops: number;
  trades: number;
}

// Defense names (incl. old names) -> team code
export const DST_TEAM: Record<string, string> = {
  "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL", "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR", "Chicago Bears": "CHI", "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL", "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX", "Kansas City Chiefs": "KC",
  "Los Angeles Rams": "LA", "St. Louis Rams": "LA", "Los Angeles Chargers": "LAC", "San Diego Chargers": "LAC",
  "Las Vegas Raiders": "LV", "Oakland Raiders": "LV", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
  "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG", "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT", "Seattle Seahawks": "SEA", "San Francisco 49ers": "SF",
  "Tampa Bay Buccaneers": "TB", "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
  "Washington Football Team": "WAS", "Washington Redskins": "WAS",
};

// Old codes of relocated teams -> current code (as in NFL_TEAMS)
const OLD_CODES: Record<string, string> = { OAK: "LV", SD: "LAC", STL: "LA", LAR: "LA", WSH: "WAS", JAC: "JAX" };
const normTeams = (teams: string | undefined) =>
  teams ? [...new Set(teams.split("/").map((t) => OLD_CODES[t] ?? t))].join("/") : null;

/** One row per player the manager ever had, from the manager's rows of the player tables. */
export function buildRows(data: {
  stats: (PlayerManagerStats & { player_key: string })[];
  events: { player_key: string; kind: string }[];
  teams: { player_key: string; teams: string }[];
  info: PlayerInfo[];
}): Row[] {
  const teamOf = new Map(data.teams.map((t) => [t.player_key, t.teams]));
  const info = new Map(data.info.map((s) => [s.player_key, s]));
  const byKey = new Map<string, Row>();
  const row = (key: string): Row => {
    let r = byKey.get(key);
    if (!r) {
      const s = info.get(key);
      r = {
        key, name: s?.player_name ?? key.replace(/^(DST|N):/, ""), position: s?.position ?? null,
        team: normTeams(teamOf.get(key)) ?? (s?.position === "DST" ? DST_TEAM[s.player_name] ?? null : null),
        headshot: s?.headshot ?? null,
        weeks: 0, starts: 0, points: 0, avg: null, best: null, first: null, last: null,
        drafted: 0, adds: 0, drops: 0, trades: 0,
      };
      byKey.set(key, r);
    }
    return r;
  };
  for (const s of data.stats) {
    Object.assign(row(s.player_key), {
      weeks: s.weeks_rostered, starts: s.starts, points: s.starter_points ?? 0, avg: s.avg_start,
      best: s.best_start, first: s.first_season, last: s.last_season,
    });
  }
  for (const e of data.events) {
    const r = row(e.player_key);
    if (e.kind === "draft") r.drafted += 1;
    else if (e.kind === "add") r.adds += 1;
    else if (e.kind === "drop") r.drops += 1;
    else if (e.kind === "trade_in") r.trades += 1;
  }
  return [...byKey.values()].filter((r) => r.name);
}
