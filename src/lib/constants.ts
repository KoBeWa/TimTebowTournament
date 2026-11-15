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

export type NavLink = { label: string; href: string; desc?: string };
export type NavGroup = { label: string; href?: string; links?: NavLink[] };

// Top navigation: four groups by what you are looking for, plus the mini game
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Saison",
    links: [
      { label: "Gamecenter", href: "/gamecenter", desc: "Matchups und Lineups jeder Woche" },
      { label: `Tabelle ${CURRENT_SEASON}`, href: `/history/${CURRENT_SEASON}`, desc: "Standings und Playoffs" },
    ],
  },
  {
    label: "Liga",
    links: [
      { label: "History", href: "/history", desc: "Ewige Tabelle und alle Seasons" },
      { label: "Rankings", href: "/rankings", desc: "Wer draftet, managt und coacht am besten" },
      { label: "Trophy Room", href: "/trophies", desc: "Rekorde und Achievements" },
    ],
  },
  {
    label: "Manager",
    links: [
      { label: "Head to Head", href: "/h2h", desc: "Direkter Vergleich zweier Manager" },
      ...MANAGERS.map((m) => ({ label: m, href: `/manager/${m}` })),
    ],
  },
  {
    label: "Spieler",
    links: [
      { label: "Spieler", href: "/players", desc: "Alle Spieler und ihre Historie" },
      { label: "Drafts", href: "/drafts", desc: "Beste und schlechteste Picks" },
      { label: "Transactions", href: "/transactions", desc: "Waiver und Trades" },
    ],
  },
  { label: "Mock Draft", href: "/mock-draft" },
];
