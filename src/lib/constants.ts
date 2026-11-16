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
 
// One fixed colour per manager, used wherever a manager is drawn or named.
// Validated as a set against the card surface (#111a2c).
export const MANAGER_COLORS: Record<string, string> = {
  Benni: "#3987e5", Erik: "#d95926", Juschka: "#199e70", Kessi: "#c98500",
  Marv: "#d55181", Ritz: "#008300", Simi: "#9085e9", Tommy: "#e66767",
};

export type NavIconName =
  | "home" | "tv" | "table" | "history" | "ranking" | "award" | "target" | "swords" | "players" | "draft" | "moves";
export type NavLink = { label: string; href: string; desc?: string; icon?: NavIconName };
export type NavGroup = { label: string; icon: "calendar" | "trophy" | "users" | "shirt"; links: NavLink[] };

// Navigation: four groups by what you are looking for
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Saison",
    icon: "calendar",
    links: [
      { label: "Gamecenter", href: "/gamecenter", icon: "tv", desc: "Matchups und Lineups jeder Woche" },
      { label: `Tabelle ${CURRENT_SEASON}`, href: `/history/${CURRENT_SEASON}`, icon: "table", desc: "Standings und Playoffs" },
    ],
  },
  {
    label: "Liga",
    icon: "trophy",
    links: [
      { label: "History", href: "/history", icon: "history", desc: "Ewige Tabelle und alle Seasons" },
      { label: "Rankings", href: "/rankings", icon: "ranking", desc: "Wer draftet, managt und coacht am besten" },
      { label: "Trophy Room", href: "/trophies", icon: "award", desc: "Rekorde und Achievements" },
      { label: "Mock Draft", href: "/mock-draft", icon: "target", desc: "Den NFL Draft tippen" },
    ],
  },
  {
    label: "Spieler",
    icon: "shirt",
    links: [
      { label: "Spieler", href: "/players", icon: "players", desc: "Alle Spieler und ihre Historie" },
      { label: "Drafts", href: "/drafts", icon: "draft", desc: "Beste und schlechteste Picks" },
      { label: "Transactions", href: "/transactions", icon: "moves", desc: "Waiver und Trades" },
    ],
  },
  {
    label: "Manager",
    icon: "users",
    links: [
      { label: "Head to Head", href: "/h2h", icon: "swords", desc: "Direkter Vergleich zweier Manager" },
      ...MANAGERS.map((m) => ({ label: m, href: `/manager/${m}` })),
    ],
  },
];
