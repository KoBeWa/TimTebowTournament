import { loadPlayerList } from "@/lib/players";
import PlayersTable from "./PlayersTable";

// Rendered on the server and revalidated with the layout; the list changes once a week.
// A failed query throws, so a stale copy of the page stays up instead of an empty list.
export default async function PlayersPage() {
  const players = await loadPlayerList();
  return <PlayersTable initialPlayers={players} />;
}
