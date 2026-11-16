import { loadTrophyData } from "@/lib/trophies";
import TrophyRoom from "./TrophyRoom";

// A failed query throws, so a stale copy of the page stays up instead of an empty table
export default async function TrophyRoomPage() {
  return <TrophyRoom initial={await loadTrophyData()} />;
}
