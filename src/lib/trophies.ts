import { supabase } from "./supabase";

export interface Achievement {
  achievement_key: string;
  manager_id: string;
}

export interface RecordHolder {
  record_key: string;
  record_label: string;
  manager_id: string;
}

// Only the columns this page counts and groups by; the tables themselves are far wider
export async function loadTrophyData() {
  const [{ data: ach, error: achError }, { data: current, error: curError }] = await Promise.all([
    supabase.from("achievements").select("achievement_key, manager_id"),
    supabase.from("record_timeline").select("record_key, record_label, manager_id").eq("is_current", true).order("record_label"),
  ]);
  if (achError || curError) throw new Error((achError ?? curError)!.message);
  return { achievements: (ach ?? []) as Achievement[], records: (current ?? []) as RecordHolder[] };
}
