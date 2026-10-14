import type { PlayerEvent, PlayerGame } from "@/lib/players";

export interface Stint {
  manager_id: string;
  from: number;
  to: number;
  weeks: number;
  starts: number;
  points: number;
}

export type TimelineItem =
  | { type: "event"; week: number; event: PlayerEvent }
  | { type: "stint"; week: number; stint: Stint };

/** Consecutive weeks on the same roster within a season. */
export function stints(games: PlayerGame[]): Stint[] {
  const out: Stint[] = [];
  for (const g of games) {
    const last = out[out.length - 1];
    const starter = g.is_starter ? g.points : 0;
    if (last && last.manager_id === g.manager_id && g.week === last.to + 1) {
      last.to = g.week;
      last.weeks += 1;
      last.starts += g.is_starter ? 1 : 0;
      last.points += starter;
    } else {
      out.push({ manager_id: g.manager_id, from: g.week, to: g.week, weeks: 1, starts: g.is_starter ? 1 : 0, points: starter });
    }
  }
  return out;
}

const ORDER: Record<PlayerEvent["kind"], number> = { draft: 0, drop: 1, trade_out: 1, add: 2, trade_in: 2 };

/** Season -> chronological items: draft, roster moves and roster stints. */
export function timeline(events: PlayerEvent[], games: PlayerGame[]) {
  const seasons = new Set<number>([...events.map((e) => e.season_year), ...games.map((g) => g.season_year)]);
  return [...seasons].sort((a, b) => b - a).map((season) => {
    const items: TimelineItem[] = [
      ...events.filter((e) => e.season_year === season).map((event) => ({ type: "event" as const, week: event.week, event })),
      ...stints(games.filter((g) => g.season_year === season)).map((stint) => ({ type: "stint" as const, week: stint.from, stint })),
    ];
    items.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      // moves of a week come before the stint they start
      const ra = a.type === "event" ? ORDER[a.event.kind] : 3;
      const rb = b.type === "event" ? ORDER[b.event.kind] : 3;
      if (ra !== rb) return ra - rb;
      const ta = a.type === "event" ? a.event.event_at ?? "" : "";
      const tb = b.type === "event" ? b.event.event_at ?? "" : "";
      return ta.localeCompare(tb);
    });
    return { season, items };
  });
}
