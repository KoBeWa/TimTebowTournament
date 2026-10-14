export const LEAGUE_NAME = "League Legacy";
export const LEAGUE_FOUNDED = 2015;
export const CURRENT_SEASON = 2026;
 
export const MANAGERS = [
  "Benni",
  "Erik",
  "Juschka",
  "Kessi",
  "Marv",
  "Ritz",
  "Simi",
  "Tommy",
] as const;
 
export type ManagerId = (typeof MANAGERS)[number];
 
export const SEASONS = Array.from(
  { length: CURRENT_SEASON - LEAGUE_FOUNDED + 1 },
  (_, i) => LEAGUE_FOUNDED + i
);
 
export const NAV_ITEMS = [
  { label: "History", href: "/history", icon: "trophy", desc: "Alle Seasons & Champions" },
  { label: "Rankings", href: "/rankings", icon: "bar-chart", desc: "Power Rankings & Ratings" },
  { label: "Gamecenter", href: "/gamecenter", icon: "tv", desc: "Matchups & Lineups" },
  { label: "Drafts", href: "/drafts", icon: "list-ordered", desc: "Pick-by-Pick Analyse" },
  { label: "Transactions", href: "/transactions", icon: "arrow-left-right", desc: "Waiver Wire Moves" },
  { label: "Head to Head", href: "/h2h", icon: "swords", desc: "Manager vs. Manager" },
  { label: "Trophy Room", href: "/trophies", icon: "award", desc: "Rekorde & Achievements" },
  { label: "Mock Draft", href: "/mock-draft", icon: "target", desc: "NFL Draft tippen" },
] as const;
