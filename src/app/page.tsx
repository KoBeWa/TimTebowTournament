import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { LEAGUE_NAME, LEAGUE_FOUNDED } from "@/lib/constants";
import Link from "next/link";

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

  const quickLinks = [
    { label: "History", href: "/history", desc: "Season-by-season Chronik" },
    { label: "Gamecenter", href: "/gamecenter", desc: "Matchups & Lineups" },
    { label: "Drafts", href: "/drafts", desc: "Pick-by-Pick Analyse" },
    { label: "Transactions", href: "/transactions", desc: "Waiver Wire Moves" },
    { label: "Head to Head", href: "/h2h", desc: "Manager vs. Manager" },
    { label: "Trophy Room", href: "/trophies", desc: "Records & Achievements" },
  ];

  return (
    <div>
      {/* ── MASTHEAD ── */}
      <header
        style={{ borderBottom: "1px solid #1a1a1a" }}
        className="grid grid-cols-3 items-center py-6 mb-0"
      >
        <div className="label-nav text-xs text-text-faint">
          <div>Est. {LEAGUE_FOUNDED}</div>
          <div>{totalSeasons} Seasons</div>
        </div>

        <div className="text-center">
          <div className="display-title text-4xl md:text-5xl text-ink leading-tight">
            {LEAGUE_NAME}
          </div>
          <div
            style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}
            className="label-nav text-xs text-text-muted mt-2 py-1"
          >
            · Die offizielle Ligachronik · Est. {LEAGUE_FOUNDED} ·
          </div>
        </div>

        <div className="label-nav text-xs text-text-faint text-right">
          <div>8 Manager</div>
          <div>Eine Legende</div>
        </div>
      </header>

      {/* ── RED TICKER ── */}
      <div
        className="flex items-center h-[26px] overflow-hidden"
        style={{ background: "#c0392b" }}
      >
        <div
          className="label-nav text-xs text-white px-3 h-full flex items-center shrink-0"
          style={{ background: "#1a1a1a" }}
        >
          Aktuell
        </div>
        <div className="label-nav text-xs text-white px-4 truncate">
          {latestSeason
            ? `Amtierender Champion: ${latestSeason.champion} (${latestSeason.year}) · Runner-Up: ${latestSeason.runner_up} · Sacko: ${latestSeason.sacko}`
            : "Willkommen beim Tim Tebow Tournament"}
        </div>
      </div>

      {/* ── MAIN CONTENT: CHAMPION AREA + SIDEBAR ── */}
      {latestSeason && (
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ borderBottom: "1px solid #1a1a1a" }}
        >
          {/* Champion Area (2/3 width) */}
          <div
            className="md:col-span-2 py-8 pr-0 md:pr-8"
            style={{ borderRight: "1px solid #1a1a1a" }}
          >
            <div className="kicker mb-2">Champion {latestSeason.year}</div>

            <div className="display-title text-5xl md:text-7xl text-ink leading-none mb-4">
              {latestSeason.champion}
            </div>

            {championRecord && (
              <>
                {/* Record badge */}
                <div
                  className="inline-block label-nav text-xs px-3 py-1 mb-6"
                  style={{ border: "1px solid #1a1a1a" }}
                >
                  {championRecord.wins}–{championRecord.losses} Regular Season
                </div>

                {/* 4-cell stat grid */}
                <div
                  className="grid grid-cols-4"
                  style={{ borderTop: "1px solid #1a1a1a", borderLeft: "1px solid #1a1a1a" }}
                >
                  {[
                    { label: "Punkte", value: Math.round(Number(championRecord.points_for)).toLocaleString("de-DE") },
                    { label: "Gegner", value: Math.round(Number(championRecord.points_against)).toLocaleString("de-DE") },
                    { label: "Diff", value: `+${Math.round(Number(championRecord.points_for) - Number(championRecord.points_against)).toLocaleString("de-DE")}` },
                    { label: "Titel", value: seasons.filter((s) => s.champion === latestSeason.champion).length.toString() },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="py-4 px-3 text-center"
                      style={{ borderRight: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}
                    >
                      <div className="display-title text-2xl text-ink">{cell.value}</div>
                      <div className="kicker mt-1" style={{ color: "#666" }}>{cell.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Finalists row */}
            <div className="flex gap-6 mt-4">
              <div>
                <div className="kicker" style={{ color: "#666" }}>Runner-Up</div>
                <div className="font-semibold text-ink">{latestSeason.runner_up}</div>
              </div>
              <div>
                <div className="kicker" style={{ color: "#c0392b" }}>Sacko</div>
                <div className="font-semibold text-ink">{latestSeason.sacko}</div>
              </div>
            </div>
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="py-8 pl-0 md:pl-6">
            {/* Champions History */}
            <div className="kicker mb-3">Champions History</div>
            <div style={{ borderTop: "1px solid #1a1a1a" }}>
              {seasons.slice(0, 8).map((s) => (
                <Link
                  key={s.year}
                  href={`/history/${s.year}`}
                  className="flex items-center justify-between py-2 hover:text-red transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}
                >
                  <span className="label-nav text-xs text-text-faint">{s.year}</span>
                  <span className="text-sm font-medium text-ink">{s.champion}</span>
                </Link>
              ))}
            </div>

            {/* Liga-Rekorde */}
            {records.length > 0 && (
              <div className="mt-6">
                <div className="kicker mb-3">Liga-Rekorde</div>
                <div style={{ borderTop: "1px solid #1a1a1a" }}>
                  {records.map((r) => (
                    <div
                      key={r.record_label}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid var(--color-border-light)" }}
                    >
                      <span className="text-xs text-text-muted truncate pr-2">{r.record_label}</span>
                      <span className="label-nav text-xs text-ink shrink-0">{r.manager_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STATS BAR ── */}
      <div
        className="grid grid-cols-4"
        style={{ borderTop: "3px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}
      >
        {[
          { label: "Seasons", value: totalSeasons.toString() },
          { label: "Manager", value: "8" },
          { label: "Spiele", value: stats.totalGames.toString() },
          { label: "Punkte", value: Math.round(stats.totalPoints).toLocaleString("de-DE") },
        ].map((cell, i) => (
          <div
            key={cell.label}
            className="py-5 text-center"
            style={{ borderRight: i < 3 ? "1px solid #1a1a1a" : "none" }}
          >
            <div className="display-title text-3xl md:text-4xl text-ink">{cell.value}</div>
            <div className="kicker mt-1" style={{ color: "#666" }}>{cell.label}</div>
          </div>
        ))}
      </div>

      {/* ── EXPLORE SECTION ── */}
      <div className="mt-10">
        <div className="kicker mb-1">Archiv</div>
        <h2
          className="display-title text-3xl text-ink mb-6"
          style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "0.5rem" }}
        >
          Explore the Archive
        </h2>

        <div
          className="grid grid-cols-2 md:grid-cols-3"
          style={{ borderTop: "1px solid var(--color-border)", borderLeft: "1px solid var(--color-border)" }}
        >
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="cell-hover p-6 group"
              style={{ borderRight: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="label-nav text-sm text-ink group-hover:text-red transition-colors">
                {link.label} →
              </div>
              <div className="text-xs text-text-muted mt-1">{link.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
