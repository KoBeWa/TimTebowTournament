"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import StatTile from "@/components/ui/StatTile";
import { type FaTxRow, POS_LIST, POS_LABEL, fmt } from "./shared";

const POS_TABS = POS_LIST.map(p => ({ key: p, label: p }));

export default function PositionsTab({ filtFatx }: { filtFatx: FaTxRow[] }) {
  const [posTab, setPosTab] = useState("QB");

  const posStats = useMemo(() => POS_LIST.map(pos => {
    const rows   = filtFatx.filter(r => pos === "DEF" ? (r.position === "DEF" || r.position === "DST") : r.position === pos);
    const gains  = rows.filter(r => r.item_direction === "gain");
    const losses = rows.filter(r => r.item_direction === "loss");
    return {
      pos, totalAdded: gains.length, totalDropped: losses.length,
      topAdd:    [...gains].sort((a, b) => b.item_value - a.item_value)[0] ?? null,
      worstDrop: [...losses].sort((a, b) => b.item_value - a.item_value)[0] ?? null,
    };
  }), [filtFatx]);
  const cur = posStats.find(p => p.pos === posTab)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title text-ink">{POS_LABEL[posTab] ?? posTab}</h2>
        <Tabs tabs={POS_TABS} value={posTab} onChange={setPosTab} label="Position" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Hinzugefügt" value={cur.totalAdded} />
        <StatTile label="Bester Add"
          value={cur.topAdd ? fmt(cur.topAdd.item_value) : "—"}
          hint={cur.topAdd ? `${cur.topAdd.player_name}, ${cur.topAdd.team_name} ${cur.topAdd.season_year}` : undefined} />
        <StatTile label="Gedroppt" value={cur.totalDropped} />
        <StatTile label="Schlechtester Drop"
          value={cur.worstDrop ? fmt(cur.worstDrop.item_value) : "—"}
          tone={cur.worstDrop ? "negative" : undefined}
          hint={cur.worstDrop ? `${cur.worstDrop.player_name}, ${cur.worstDrop.team_name} ${cur.worstDrop.season_year}` : undefined} />
      </div>
    </div>
  );
}
