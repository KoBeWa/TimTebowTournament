import PlayerDetail from "./PlayerDetail";

export default async function PlayerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <PlayerDetail playerKey={decodeURIComponent(key)} />;
}
