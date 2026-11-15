"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SEASONS, MANAGERS } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { type VTxRow, type FaTxRow, pct } from "./shared";
import OverviewTab from "./OverviewTab";
import RankingsTab from "./RankingsTab";
import MovesTab from "./MovesTab";
import PositionsTab from "./PositionsTab";
import PlayersTeamsTab from "./PlayersTeamsTab";
import LogTab from "./LogTab";

export type { VTxRow, FaTxRow };

type TabKey = "overview" | "rankings" | "moves" | "positions" | "players" | "log";

const SELECT = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink";

export default function TransactionDashboard({ vtx, fatx }: { vtx: VTxRow[]; fatx: FaTxRow[] }) {
  const [season, setSeason] = useState<number | "all">("all");
  const [owner, setOwner]   = useState<string>("all");
  const [tab, setTab]       = useState<TabKey>("overview");

  const ownerFiltered  = owner !== "all";
  const seasonFiltered = season !== "all";
  const isFiltered     = ownerFiltered || seasonFiltered;

  // Rankings and season records only make sense across owners
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Übersicht" },
    ...(ownerFiltered ? [] : [{ key: "rankings" as const, label: "Rankings" }]),
    { key: "moves", label: "Beste & schlechteste Moves" },
    { key: "positions", label: "Positionen" },
    { key: "players", label: "Spieler & Teams" },
    ...(isFiltered ? [{ key: "log" as const, label: "Transaktionsliste" }] : []),
  ];
  // Fall back to the overview when the selected tab is not available for the current filter
  const activeTab: TabKey = tabs.some(t => t.key === tab) ? tab : "overview";

  // Filtered datasets
  const filt = useMemo(() => vtx.filter(r =>
    (season === "all" || r.season_year === season) &&
    (owner === "all" || r.team_name === owner)
  ), [vtx, season, owner]);

  const filtFatx = useMemo(() => fatx.filter(r =>
    (season === "all" || r.season_year === season) &&
    (owner === "all" || r.team_name === owner)
  ), [fatx, season, owner]);

  // Header counts
  const waiverRows   = filt.filter(r => r.transaction_type !== "trade");
  const tradeRows    = filt.filter(r => r.transaction_type === "trade");
  const uniqueTrades = ownerFiltered ? tradeRows.length : Math.round(tradeRows.length / 2);
  const totalTx      = waiverRows.length + uniqueTrades;

  // Owner-specific positive % stats
  const ownerStats = useMemo(() => {
    if (!ownerFiltered) return null;
    const waiverMoves = filt.filter(r => r.transaction_type !== "trade" && r.add_players != null);
    const posWaiver   = waiverMoves.filter(r => r.gain_value > 0).length;
    const tradeSides  = filt.filter(r => r.transaction_type === "trade");
    const posTrades   = tradeSides.filter(r => r.net_value > 0).length;
    return {
      waiverPct: pct(posWaiver, waiverMoves.length),
      tradePct:  pct(posTrades, tradeSides.length),
      waiverN:   waiverMoves.length,
      tradeN:    tradeSides.length,
    };
  }, [filt, ownerFiltered]);

  // Chart data
  const chartData = useMemo(() => {
    const base = ownerFiltered ? vtx.filter(r => r.team_name === owner) : vtx;
    if (seasonFiltered) {
      const rows = base.filter(r => r.season_year === season);
      const maxWeek = Math.max(...rows.map(r => r.transaction_week), 0);
      return Array.from({ length: maxWeek }, (_, i) => {
        const wk = i + 1;
        const wkR = rows.filter(r => r.transaction_week === wk);
        const waiver = wkR.filter(r => r.transaction_type !== "trade").length;
        const trR    = wkR.filter(r => r.transaction_type === "trade").length;
        const trades = ownerFiltered ? trR : Math.round(trR / 2);
        return { label: `W${wk}`, transactions: waiver + trades, trades };
      });
    }
    return SEASONS.map(yr => {
      const yrR    = base.filter(r => r.season_year === yr);
      const waiver = yrR.filter(r => r.transaction_type !== "trade").length;
      const trR    = yrR.filter(r => r.transaction_type === "trade").length;
      const trades = ownerFiltered ? trR : Math.round(trR / 2);
      return { label: String(yr).slice(2), transactions: waiver + trades, trades };
    });
  }, [vtx, owner, season, ownerFiltered, seasonFiltered]);

  return (
    <div>
      <PageHeader title="Transactions" description="Waiver-Moves und Trades mit Wertanalyse">
        <select aria-label="Saison" value={season} onChange={e => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
          className={SELECT}>
          <option value="all">Alle Saisons</option>
          {SEASONS.slice().reverse().map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Owner" value={owner} onChange={e => setOwner(e.target.value)} className={SELECT}>
          <option value="all">Alle Owner</option>
          {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </PageHeader>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs tabs={tabs} value={activeTab} onChange={setTab} label="Transaktions-Bereiche" />
          {seasonFiltered && (
            <Link href={`/transactions/${season}`} className="flex items-center gap-1 text-sm text-text-muted hover:text-ink transition-colors">
              Ganze Saison {season} ansehen <ChevronRight size={15} />
            </Link>
          )}
        </div>

        {activeTab === "overview" && (
          <OverviewTab
            waiverCount={waiverRows.length}
            tradeCount={uniqueTrades}
            totalCount={totalTx}
            ownerStats={ownerStats}
            chartData={chartData}
            chartTitle={seasonFiltered ? `Aktivität pro Woche, ${season}` : "Aktivität pro Saison"}
          />
        )}
        {activeTab === "rankings" && <RankingsTab vtx={vtx} filt={filt} seasonFiltered={seasonFiltered} />}
        {activeTab === "moves" && <MovesTab filt={filt} />}
        {activeTab === "positions" && <PositionsTab filtFatx={filtFatx} />}
        {activeTab === "players" && <PlayersTeamsTab vtx={vtx} filt={filt} filtFatx={filtFatx} isFiltered={isFiltered} />}
        {activeTab === "log" && <LogTab rows={filt} showOwner={!ownerFiltered} showSeason={!seasonFiltered} />}
      </div>
    </div>
  );
}
