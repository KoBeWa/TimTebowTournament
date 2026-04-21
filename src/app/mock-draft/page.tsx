import { supabase } from "@/lib/supabase";
import MockDraftApp from "./MockDraftApp";

export const dynamic = "force-dynamic";

export interface DraftSlot {
  pick_number: number;
  team_abbr: string;
  team_name: string;
  team_logo: string | null;
  conference: string;
  note: string | null;
  needs: { position: string; priority: number }[];
}

export interface Prospect {
  id: number;
  player_name: string;
  position: string;
  college: string;
  consensus_rank: string | null;
  headshot_url: string | null;
  college_logo_url: string | null;
  first_name: string | null;
  last_name: string | null;
  hometown: string | null;
  college_class: string | null;
  height: string | null;
  weight: string | null;
  arm_length: string | null;
  hand_size: string | null;
  wingspan: string | null;
  forty_yard_dash: string | null;
  ten_yard_split: string | null;
  twenty_yard_shuttle: string | null;
  three_cone_drill: string | null;
  broad_jump: string | null;
  vertical_jump: string | null;
  bench_press: string | null;
  draft_grade: string | null;
  draft_projection: string | null;
  nfl_comparison: string | null;
  overview: string | null;
  strengths: string | null;
  weaknesses: string | null;
  bio: string | null;
  sources_tell_us: string | null;
  athleticism_score: string | null;
  production_score: string | null;
  position_group: string | null;
  notes: string | null;
}

export interface MockDraftSummary {
  id: number;
  manager_id: string;
  is_locked: boolean;
  updated_at: string;
  picks: { pick_number: number; prospect_id: number }[];
}

async function getData() {
  const [
    { data: order },
    { data: teams },
    { data: needs },
    { data: prospects },
    { data: mocks },
    { data: allPicks },
  ] = await Promise.all([
    supabase
      .from("nfl_draft_order_2026")
      .select("pick_number, team_abbr, note")
      .order("pick_number"),
    supabase.from("nfl_teams_draft").select("team_abbr, team_name, conference, logo_url"),
    supabase
      .from("nfl_team_needs")
      .select("team_abbr, position, priority")
      .order("priority"),
    supabase
      .from("mock_draft_prospects")
      .select("*")
      .order("consensus_rank"),
    supabase
      .from("mock_drafts")
      .select("id, manager_id, is_locked, updated_at")
      .eq("draft_year", 2026)
      .order("updated_at", { ascending: false }),
    supabase.from("mock_draft_picks").select("mock_draft_id, pick_number, prospect_id"),
  ]);

  const teamMap = new Map(
    (teams ?? []).map((t) => [t.team_abbr, t])
  );
  const needsMap = new Map<string, { position: string; priority: number }[]>();
  for (const n of needs ?? []) {
    if (!needsMap.has(n.team_abbr)) needsMap.set(n.team_abbr, []);
    needsMap.get(n.team_abbr)!.push({ position: n.position, priority: n.priority });
  }

  const slots: DraftSlot[] = (order ?? []).map((o) => {
    const team = teamMap.get(o.team_abbr);
    return {
      pick_number: o.pick_number,
      team_abbr: o.team_abbr,
      team_name: team?.team_name ?? o.team_abbr,
      team_logo: team?.logo_url ?? null,
      conference: team?.conference ?? "",
      note: o.note,
      needs: needsMap.get(o.team_abbr) ?? [],
    };
  });

  const picksByMock = new Map<number, { pick_number: number; prospect_id: number }[]>();
  for (const p of allPicks ?? []) {
    if (!picksByMock.has(p.mock_draft_id)) picksByMock.set(p.mock_draft_id, []);
    picksByMock.get(p.mock_draft_id)!.push({
      pick_number: p.pick_number,
      prospect_id: p.prospect_id,
    });
  }

  const mockSummaries: MockDraftSummary[] = (mocks ?? []).map((m) => ({
    id: m.id,
    manager_id: m.manager_id,
    is_locked: m.is_locked,
    updated_at: m.updated_at,
    picks: picksByMock.get(m.id) ?? [],
  }));

  return {
    slots,
    prospects: (prospects ?? []) as Prospect[],
    mocks: mockSummaries,
  };
}

export default async function MockDraftPage() {
  const { slots, prospects, mocks } = await getData();

  return (
    <div>
      <div
        className="mb-8"
        style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}
      >
        <div className="kicker mb-1">Mini-Games</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">
          Mock Draft 2026
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          32 Picks, deine Predictions — NFL Draft in Pittsburgh, 23. April
        </p>
      </div>

      <MockDraftApp slots={slots} prospects={prospects} initialMocks={mocks} />
    </div>
  );
}
