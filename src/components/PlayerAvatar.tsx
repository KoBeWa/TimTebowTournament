import type { PlayerSummary } from "@/lib/players";

export default function PlayerAvatar({ p, size = 36 }: { p: Pick<PlayerSummary, "headshot" | "player_name" | "position">; size?: number }) {
  if (p.headshot) {
    return (
      <img src={p.headshot} alt="" width={size} height={size}
        className="rounded-full bg-surface-3 object-cover shrink-0" style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="flex items-center justify-center rounded-full bg-surface-3 text-text-muted text-xs font-semibold shrink-0"
      style={{ width: size, height: size }}>
      {p.position === "DST" ? "DST" : p.player_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
  );
}
