import { liveOdds } from "@/lib/liveOdds";

// Recomputed at most once a minute and shared by every visitor
export const revalidate = 60;

export async function GET() {
  try {
    const data = await liveOdds();
    return Response.json(data ?? { status: "off" });
  } catch (e) {
    return Response.json({ status: "error", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
