import { CURRENT_SEASON } from "@/lib/constants";
import { loadSeasonWeeks, loadWeek } from "@/lib/gamecenter";
import GamecenterBrowser from "./GamecenterBrowser";

// The current season's latest week is rendered on the server; other weeks load in the browser.
// A failed query throws, so a stale copy of the page stays up instead of an empty one.
export default async function GamecenterPage() {
  const weeks = await loadSeasonWeeks(CURRENT_SEASON);
  const matchups = await loadWeek(CURRENT_SEASON, weeks.latest);
  return <GamecenterBrowser initial={{ season: CURRENT_SEASON, week: weeks.latest, weeks, matchups }} />;
}
