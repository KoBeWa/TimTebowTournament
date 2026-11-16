import { notFound } from "next/navigation";
import { loadMatchup } from "@/lib/matchup";
import MatchupView from "./MatchupView";

// Matchups are generated on first visit and then served as static pages, revalidated with the layout.
// The public URL stays /gamecenter/<season>/<week>?a=<manager>&b=<manager> (see rewrites in next.config.ts).
export function generateStaticParams() {
  return [];
}

export default async function MatchupPage({
  params,
}: {
  params: Promise<{ season: string; week: string; a: string; b: string }>;
}) {
  const p = await params;
  const season = parseInt(p.season);
  const week = parseInt(p.week);
  const a = decodeURIComponent(p.a);
  const b = decodeURIComponent(p.b);
  if (isNaN(season) || isNaN(week)) notFound();

  const data = await loadMatchup(season, week, a, b);
  return <MatchupView season={season} week={week} a={a} b={b} initial={data} />;
}
