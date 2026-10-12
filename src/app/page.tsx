import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { LEAGUE_FOUNDED, MANAGERS, NAV_ITEMS } from "@/lib/constants";
import Link from "next/link";
import { ArrowRight, ChevronRight, Crown, Medal, TrendingDown } from "lucide-react";
import NavIcon from "@/components/layout/NavIcon";

async function getLeagueStats() {
  const { data: matchups } = await supabase
    .from("weekly_matchups")
    .select("score_a, score_b");

  const totalGames = (matchups?.length ?? 0) * 2;
  const totalPoints =
    matchups?.reduce(
      (sum, m) => sum + Number(m.score_a || 0) + Number(m.score_b || 0),
      0
    ) ?? 0;

  return { totalGames, totalPoints };
}

async function getChampionRecord(year: number, champion: string) {
  const { data } = await supabase
    .from("season_results")
    .select("wins, losses, points_for, points_against")
    .eq("season_year", year)
    .eq("manager_id", champion)
    .single();
  return data;
}

async function getLeagueRecords() {
  const { data } = await supabase
    .from("record_timeline")
    .select("record_label, manager_id, record_value")
    .eq("is_current", true)
    .order("record_label")
    .limit(6);
  return data ?? [];
}

export default async function HomePage() {
  const [seasons, stats, records] = await Promise.all([
    getSeasonSummaries(),
    getLeagueStats(),
    getLeagueRecords(),
  ]);

  const latestSeason = seasons[0];
  const totalSeasons = seasons.length;

  const championRecord = latestSeason
    ? await getChampionRecord(latestSeason.year, latestSeason.champion)
    : null;

  // Title count per manager, most titles first
  const titleCounts = Object.entries(
    seasons.reduce<Record<string, number>>((acc, s) => {
      acc[s.champion] = (acc[s.champion] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

  return (
    <div className="space-y-10">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-2 via-surface to-cream">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-red/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="chip mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-red" />
              Est. {LEAGUE_FOUNDED} · {totalSeasons} Seasons · {MANAGERS.length} Manager
            </div>

            {latestSeason ? (
              <>
                <div className="flex items-center gap-2 text-gold">
                  <Crown size={18} />
                  <span className="label-nav text-sm">Champion {latestSeason.year}</span>
                </div>
                <Link
                  href={`/manager/${latestSeason.champion}`}
                  className="mt-1 block display-title text-6xl sm:text-8xl text-ink uppercase hover:text-gold transition-colors"
                >
                  {latestSeason.champion}
                </Link>
                {championRecord && (
                  <p className="mt-3 text-text-secondary">
                    {championRecord.wins}–{championRecord.losses} in der Regular Season ·{" "}
                    {titleCounts.find(([m]) => m === latestSeason.champion)?.[1] ?? 1}. Titel
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/history/${latestSeason.year}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red/25 hover:bg-red-soft transition-colors"
                  >
                    Season {latestSeason.year} ansehen <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/history"
                    className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface/60 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 transition-colors"
                  >
                    Alle Seasons
                  </Link>
                </div>
              </>
            ) : (
              <h1 className="display-title text-5xl text-ink">Tim Tebow Tournament</h1>
            )}
          </div>

          {latestSeason && (
            <div className="space-y-3">
              {championRecord && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Punkte", value: fmt(Number(championRecord.points_for)) },
                    { label: "Gegner", value: fmt(Number(championRecord.points_against)) },
                    {
                      label: "Diff",
                      value: `${Number(championRecord.points_for) >= Number(championRecord.points_against) ? "+" : ""}${fmt(Number(championRecord.points_for) - Number(championRecord.points_against))}`,
                    },
                  ].map((cell) => (
                    <div key={cell.label} className="rounded-2xl border border-border bg-cream/50 p-4 text-center">
                      <div className="display-title text-2xl sm:text-3xl text-ink">{cell.value}</div>
                      <div className="mt-1 text-xs text-text-muted">{cell.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/manager/${latestSeason.runner_up}`}
                  className="rounded-2xl border border-border bg-cream/50 p-4 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs text-silver">
                    <Medal size={14} /> Runner-Up
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink">{latestSeason.runner_up}</div>
                </Link>
                <Link
                  href={`/manager/${latestSeason.sacko}`}
                  className="rounded-2xl border border-border bg-cream/50 p-4 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs text-negative">
                    <TrendingDown size={14} /> Sacko
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink">{latestSeason.sacko}</div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── LEAGUE STATS ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Seasons", value: totalSeasons.toString() },
          { label: "Manager", value: MANAGERS.length.toString() },
          { label: "Spiele", value: fmt(stats.totalGames) },
          { label: "Punkte gesamt", value: fmt(stats.totalPoints) },
        ].map((cell) => (
          <div key={cell.label} className="cell p-5">
            <div className="text-xs text-text-muted">{cell.label}</div>
            <div className="mt-1 display-title text-3xl md:text-4xl text-ink">{cell.value}</div>
          </div>
        ))}
      </section>

      {/* ── QUICK ACCESS ── */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="kicker mb-1">Schnellzugriff</div>
            <h2 className="section-title text-ink">Wohin willst du?</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="cell-hover group p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/10 text-red group-hover:bg-red group-hover:text-white transition-colors">
                  <NavIcon name={item.icon} size={20} />
                </span>
                <ChevronRight size={18} className="text-text-faint group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-4 font-semibold text-ink">{item.label}</div>
              <div className="mt-0.5 text-xs text-text-muted">{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CHAMPIONS + RECORDS ── */}
      <section className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="cell p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title text-ink">Champions</h2>
            <Link href="/history" className="flex items-center gap-1 text-sm text-text-muted hover:text-ink transition-colors">
              Alle <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {seasons.map((s, i) => (
              <Link
                key={s.year}
                href={`/history/${s.year}`}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-cream/40 px-3 py-2.5 hover:border-border-strong hover:bg-surface-2 transition-colors"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${i === 0 ? "bg-gold/15 text-gold" : "bg-surface-2 text-text-muted"}`}>
                  <Crown size={15} />
                </span>
                <span className="font-semibold text-ink">{s.champion}</span>
                <span className="ml-auto label-nav text-xs text-text-faint">{s.year}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="cell p-5 sm:p-6">
            <h2 className="section-title text-ink mb-4">Titel-Ranking</h2>
            <div className="space-y-2.5">
              {titleCounts.map(([manager, count]) => (
                <Link key={manager} href={`/manager/${manager}`} className="group block">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink group-hover:text-red transition-colors">{manager}</span>
                    <span className="text-text-muted">{count}×</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red to-gold"
                      style={{ width: `${(count / titleCounts[0][1]) * 100}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {records.length > 0 && (
            <div className="cell p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title text-ink">Liga-Rekorde</h2>
                <Link href="/trophies/records" className="flex items-center gap-1 text-sm text-text-muted hover:text-ink transition-colors">
                  Alle <ChevronRight size={16} />
                </Link>
              </div>
              <div className="divide-y divide-border-light">
                {records.map((r) => (
                  <div key={r.record_label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm text-text-secondary truncate">{r.record_label}</span>
                    <span className="chip shrink-0">{r.manager_id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
