// Types and helpers shared by the transaction tabs
export interface VTxRow {
  season_year: number;
  transaction_id: string;
  transaction_type: string;
  team_name: string;
  transaction_week: number;
  transaction_at: string;
  add_players: string | null;
  add_positions: string | null;
  drop_players: string | null;
  drop_positions: string | null;
  gain_value: number;
  loss_value: number;
  net_value: number;
  scored_value: number | null;
  is_meaningful: boolean;
}

export interface FaTxRow {
  season_year: number;
  team_name: string;
  transaction_type: string;
  item_direction: string;
  player_name: string;
  position: string;
  nfl_team: string;
  item_value: number;
  transaction_week: number;
}

export function fmt(v: number, digits = 1) {
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}
export function valTone(v: number) {
  return v >= 0 ? "text-positive" : "text-negative";
}
export function pct(n: number, d: number) {
  return d === 0 ? "—" : Math.round((n / d) * 100) + "%";
}

export const POS_LIST = ["QB", "RB", "WR", "TE", "K", "DEF"];
export const POS_LABEL: Record<string, string> = {
  QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver",
  TE: "Tight End", K: "Kicker", DEF: "Defense / ST",
};

// Table header cell base classes
export const TH = "py-2.5 text-xs font-medium text-text-muted";
