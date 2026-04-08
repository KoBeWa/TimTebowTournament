import { supabase } from "./supabase";

// Champions are derived from playoff_results, not stored in seasons
export async function getChampionsBySeason() {
  const { data } = await supabase
    .from("playoff_results")
    .select("season_year, manager_id, final_rank")
    .in("final_rank", [1, 2, 8])
    .order("season_year", { ascending: false });

  const bySeason: Record<
    number,
    { champion: string; runner_up: string; sacko: string }
  > = {};

  for (const row of data ?? []) {
    if (!bySeason[row.season_year]) {
      bySeason[row.season_year] = { champion: "", runner_up: "", sacko: "" };
    }
    if (row.final_rank === 1) bySeason[row.season_year].champion = row.manager_id;
    if (row.final_rank === 2) bySeason[row.season_year].runner_up = row.manager_id;
    if (row.final_rank === 8) bySeason[row.season_year].sacko = row.manager_id;
  }

  return bySeason;
}

export interface SeasonSummary {
  year: number;
  champion: string;
  runner_up: string;
  sacko: string;
  reg_season_weeks: number;
  total_managers: number;
  playoff_teams: number;
}

export async function getSeasonSummaries(): Promise<SeasonSummary[]> {
  const [{ data: seasons }, champMap] = await Promise.all([
    supabase.from("seasons").select("*").order("year", { ascending: false }),
    getChampionsBySeason(),
  ]);

  return (seasons ?? []).map((s) => ({
    year: s.year,
    champion: champMap[s.year]?.champion ?? "—",
    runner_up: champMap[s.year]?.runner_up ?? "—",
    sacko: champMap[s.year]?.sacko ?? "—",
    reg_season_weeks: s.reg_season_weeks,
    total_managers: s.total_managers,
    playoff_teams: s.playoff_teams,
  }));
}
