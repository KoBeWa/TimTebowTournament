import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import { LEAGUE_NAME } from "@/lib/constants";
import Link from "next/link";
import {
  Trophy,
  Tv,
  ListOrdered,
  ArrowLeftRight,
  Swords,
  Award,
} from "lucide-react";

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

export default async function HomePage() {
  const [seasons, stats] = await Promise.all([
    getSeasonSummaries(),
    getLeagueStats(),
  ]);

  const latestSeason = seasons[0];
  const totalSeasons = seasons.length;

  const quickLinks = [
    { label: "History", href: "/history", icon: Trophy, desc: "Season-by-season Chronik" },
    { label: "Gamecenter", href: "/gamecenter", icon: Tv, desc: "Matchups & Lineups" },
    { label: "Drafts", href: "/drafts", icon: ListOrdered, desc: "Pick-by-Pick Analyse" },
    { label: "Transactions", href: "/transactions", icon: ArrowLeftRight, desc: "Waiver Wire Moves" },
    { label: "Head to Head", href: "/h2h", icon: Swords, desc: "Manager vs. Manager" },
    { label: "Trophy Room", href: "/trophies", icon: Award, desc: "Records & Achievements" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative py-16 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent rounded-3xl" />
        <div className="relative">
          <h1 className="page-header gold-gradient mb-4">{LEAGUE_NAME}</h1>
          <p className="text-text-secondary text-lg">
            {totalSeasons} Seasons · 8 Managers · One Legacy
          </p>
          <div className="flex justify-center gap-12 mt-10">
            <div className="text-center">
              <div className="stat-value text-4xl text-text-primary">{totalSeasons}</div>
              <div className="stat-label mt-1">Seasons</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-4xl text-text-primary">{stats.totalGames}</div>
              <div className="stat-label mt-1">Games Played</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-4xl text-text-primary">
                {Math.round(stats.totalPoints).toLocaleString("de-DE")}
              </div>
              <div className="stat-label mt-1">Total Points</div>
            </div>
          </div>
        </div>
      </section>

      {/* Reigning Champion */}
      {latestSeason && (
        <section className="card p-8 text-center" style={{ borderColor: "var(--color-gold-dark)", borderWidth: "1px" }}>
          <div className="stat-label mb-2">Reigning Champion {latestSeason.year}</div>
          <div className="text-5xl tracking-wider gold-gradient" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
            {latestSeason.champion}
          </div>
          <div className="text-text-muted text-sm mt-2">
            Runner-Up: {latestSeason.runner_up} · Sacko: {latestSeason.sacko}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section>
        <h2 className="section-header text-text-primary mb-6">Explore</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="card-hover p-6 group">
              <link.icon size={24} className="text-gold mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-lg font-semibold text-text-primary">{link.label}</div>
              <div className="text-sm text-text-muted mt-1">{link.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Champions Timeline */}
      <section>
        <h2 className="section-header text-text-primary mb-6">Champions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {seasons.map((s) => (
            <Link key={s.year} href={`/history/${s.year}`} className="card-hover p-4 text-center group">
              <div className="stat-label">{s.year}</div>
              <div
                className="text-2xl tracking-wide text-gold mt-1 group-hover:text-gold-light transition-colors"
                style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
              >
                {s.champion}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
