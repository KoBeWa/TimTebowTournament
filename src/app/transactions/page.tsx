import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/players";
import TransactionDashboard, { type VTxRow, type FaTxRow } from "./TransactionDashboard";

export const dynamic = "force-dynamic";

const VTX_COLS = "season_year,transaction_id,transaction_type,team_name,transaction_week,transaction_at,add_players,add_positions,drop_players,drop_positions,gain_value,loss_value,net_value,scored_value,is_meaningful";
const FATX_COLS = "season_year,team_name,transaction_type,item_direction,player_name,position,nfl_team,item_value,transaction_week";

// Page through everything in a stable order; a fixed number of ranges silently drops rows once the table grows
async function getAllVtx(): Promise<VTxRow[]> {
  const rows = await fetchAll<VTxRow>((from, to) => supabase.from("v_transaction_values").select(VTX_COLS)
    .order("season_year").order("transaction_id").order("team_name").range(from, to));
  return rows.map(r => ({
    ...r,
    gain_value:   Number(r.gain_value),
    loss_value:   Number(r.loss_value),
    net_value:    Number(r.net_value),
    scored_value: r.scored_value != null ? Number(r.scored_value) : null,
  }));
}

async function getAllFatx(): Promise<FaTxRow[]> {
  const rows = await fetchAll<FaTxRow>((from, to) => supabase.from("fa_transactions").select(FATX_COLS)
    .order("id").range(from, to));
  return rows.map(r => ({ ...r, item_value: Number(r.item_value) }));
}

export default async function TransactionsPage() {
  const [vtx, fatx] = await Promise.all([getAllVtx(), getAllFatx()]);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="mb-8" style={{ borderBottom: "2px solid var(--color-border-strong)", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Statistiken</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Transactions</h1>
        <p className="text-text-muted mt-1 text-sm">Waiver Moves &amp; Trades — Value Analysis</p>
      </div>

      <TransactionDashboard vtx={vtx} fatx={fatx} />
    </div>
  );
}
