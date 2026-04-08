export const LEAGUE_NAME = "League Legacy";
export const LEAGUE_FOUNDED = 2015;
export const CURRENT_SEASON = 2024;

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
  { label: "History", href: "/history", icon: "trophy" },
  { label: "Gamecenter", href: "/gamecenter", icon: "tv" },
  { label: "Drafts", href: "/drafts", icon: "list-ordered" },
  { label: "Transactions", href: "/transactions", icon: "arrow-left-right" },
  { label: "Head to Head", href: "/h2h", icon: "swords" },
  { label: "Trophy Room", href: "/trophies", icon: "award" },
] as const;
