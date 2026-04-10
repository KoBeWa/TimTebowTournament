import { supabase } from "@/lib/supabase";
import TransactionDashboard, { type VTxRow, type FaTxRow } from "./TransactionDashboard";

export const dynamic = "force-dynamic";

const VTX_COLS = "season_year,transaction_id,transaction_type,team_name,transaction_week,transaction_at,add_players,add_positions,drop_players,drop_positions,gain_value,loss_value,net_value,scored_value,is_meaningful";
const FATX_COLS = "season_year,team_name,transaction_type,item_direction,player_name,position,nfl_team,item_value,transaction_week";

async function getAllVtx(): Promise<VTxRow[]> {
  const [p1, p2, p3, p4] = await Promise.all([
    supabase.from("v_transaction_values").select(VTX_COLS).range(0, 999),
    supabase.from("v_transaction_values").select(VTX_COLS).range(1000, 1999),
    supabase.from("v_transaction_values").select(VTX_COLS).range(2000, 2999),
    supabase.from("v_transaction_values").select(VTX_COLS).range(3000, 3999),
  ]);
  return [
    ...(p1.data ?? []), ...(p2.data ?? []),
    ...(p3.data ?? []), ...(p4.data ?? []),
  ].map(r => ({
    ...r,
    gain_value:   Number(r.gain_value),
    loss_value:   Number(r.loss_value),
    net_value:    Number(r.net_value),
    scored_value: r.scored_value != null ? Number(r.scored_value) : null,
  }));
}

async function getAllFatx(): Promise<FaTxRow[]> {
  const [p1, p2, p3, p4, p5, p6] = await Promise.all([
    supabase.from("fa_transactions").select(FATX_COLS).range(0, 999),
    supabase.from("fa_transactions").select(FATX_COLS).range(1000, 1999),
    supabase.from("fa_transactions").select(FATX_COLS).range(2000, 2999),
    supabase.from("fa_transactions").select(FATX_COLS).range(3000, 3999),
    supabase.from("fa_transactions").select(FATX_COLS).range(4000, 4999),
    supabase.from("fa_transactions").select(FATX_COLS).range(5000, 5999),
  ]);
  return [
    ...(p1.data ?? []), ...(p2.data ?? []),
    ...(p3.data ?? []), ...(p4.data ?? []),
    ...(p5.data ?? []), ...(p6.data ?? []),
  ].map(r => ({ ...r, item_value: Number(r.item_value) }));
}

export default async function TransactionsPage() {
  const [vtx, fatx] = await Promise.all([getAllVtx(), getAllFatx()]);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="mb-8" style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Statistiken</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Transactions</h1>
        <p className="text-text-muted mt-1 text-sm">Waiver Moves &amp; Trades — Value Analysis</p>
      </div>

      <TransactionDashboard vtx={vtx} fatx={fatx} />
    </div>
  );
}
