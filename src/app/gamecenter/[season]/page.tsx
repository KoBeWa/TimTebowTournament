import { redirect } from "next/navigation";

export default async function GamecenterSeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  redirect(`/gamecenter?s=${season}`);
}
