"use client";

import { useState } from "react";
import type { PlayerSummary } from "@/lib/players";

// Headshot, or the player's initials when there is none or it fails to load
export default function PlayerAvatar({ p, size = 36 }: { p: Pick<PlayerSummary, "headshot" | "player_name" | "position">; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (p.headshot && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small remote headshots, sized by the caller
      <img src={p.headshot} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)}
        className="shrink-0 rounded-full bg-surface-3 object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-border bg-paper-3 text-xs font-medium text-text-muted"
      style={{ width: size, height: size }}>
      {p.position === "DST" ? "DST" : p.player_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
  );
}
