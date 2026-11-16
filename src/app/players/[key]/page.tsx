import { loadPlayer } from "@/lib/players";
import PlayerDetail from "./PlayerDetail";

// Players are generated on first visit and then served as static pages, revalidated with the layout
export function generateStaticParams() {
  return [];
}

export default async function PlayerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const playerKey = decodeURIComponent(key);
  const data = await loadPlayer(playerKey);
  return <PlayerDetail playerKey={playerKey} initial={data} />;
}
