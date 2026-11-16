import { redirect } from "next/navigation";
import { SEASONS } from "@/lib/constants";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

export default async function GamecenterSeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  redirect(`/gamecenter?s=${season}`);
}
