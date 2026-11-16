import { supabase } from "@/lib/supabase";
import { isBlunder, achievementLabel } from "@/lib/classifications";
import { MANAGERS, MANAGER_COLORS } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import TrophyTabs, { type TrophyCard } from "./TrophyTabs";
import Link from "next/link";
import { notFound } from "next/navigation";

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORY_ORDER = ["champion", "season", "matchup", "draft", "roster"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  champion: "Champion Badges",
  season:   "Season Badges",
  matchup:  "Matchup Badges",
  draft:    "Draft Badges",
  roster:   "Roster Badges",
};

// Medal keys shown separately at the top
const MEDAL_KEYS: Record<string, { icon: string; label: string; rank: number }> = {
  champion:    { icon: "🥇", label: "Champion",   rank: 1 },
  runner_up:   { icon: "🥈", label: "Runner Up",  rank: 2 },
  third_place: { icon: "🥉", label: "3rd Place",  rank: 3 },
};

interface Achievement {
  achievement_key: string;
  achievement_category: string;
  manager_id: string;
  season_year: number;
  value: string | null;
  description: string;
  weekly_matchups: { week: number } | null;
}

export async function generateStaticParams() {
  return MANAGERS.map((m) => ({ manager: encodeURIComponent(m) }));
}

export default async function ManagerTrophyPage({
  params,
}: {
  params: Promise<{ manager: string }>;
}) {
  const { manager } = await params;
  const name = decodeURIComponent(manager);

  if (!(MANAGERS as readonly string[]).includes(name)) notFound();

  const { data } = await supabase
    .from("achievements")
    .select("*, weekly_matchups(week)")
    .eq("manager_id", name)
    .order("season_year", { ascending: true });

  const achievements: Achievement[] = data ?? [];

  const positive = achievements.filter((a) => !isBlunder(a.achievement_key));
  const blunders  = achievements.filter((a) => isBlunder(a.achievement_key));

  // Medals — sorted by rank then year
  const medals = achievements
    .filter((a) => MEDAL_KEYS[a.achievement_key])
    .sort((a, b) => {
      const rd = (MEDAL_KEYS[a.achievement_key]?.rank ?? 9) - (MEDAL_KEYS[b.achievement_key]?.rank ?? 9);
      return rd !== 0 ? rd : a.season_year - b.season_year;
    });

  // Group an array of achievements by key → Record<key, Achievement[]>
  function groupByKey(items: Achievement[]) {
    const map: Record<string, Achievement[]> = {};
    for (const a of items) (map[a.achievement_key] ??= []).push(a);
    return map;
  }

  // Positive achievements grouped by category then by key
  const byCategory: Record<string, Record<string, Achievement[]>> = {};
  for (const a of positive) {
    const cat = a.achievement_category;
    if (!byCategory[cat]) byCategory[cat] = {};
    if (!byCategory[cat][a.achievement_key]) byCategory[cat][a.achievement_key] = [];
    byCategory[cat][a.achievement_key].push(a);
  }

  const blundersByKey = groupByKey(blunders);

  const categories = CATEGORY_ORDER
    .map((cat) => ({
      key: cat as string,
      label: CATEGORY_LABELS[cat],
      cards: Object.entries(byCategory[cat] ?? {})
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([key, items]) => toCard(key, items)),
    }))
    .filter((c) => c.cards.length > 0);

  const blunderCards = Object.entries(blundersByKey)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([key, items]) => toCard(key, items));

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-3">
          <span aria-hidden className="inline-block h-8 w-1.5 rounded-full sm:h-10" style={{ backgroundColor: MANAGER_COLORS[name] }} />
          {name}
        </span>}
        description={`Trophy Room: ${positive.length} Achievements, ${blunders.length} Blunders, ${achievements.length} Badges gesamt`}
        crumbs={[{ label: "Trophy Room", href: "/trophies" }]}
      >
        <Link href={`/manager/${name}`} className="btn">Profil</Link>
      </PageHeader>

      <TrophyTabs
        medals={medals.map((m) => {
          const medal = MEDAL_KEYS[m.achievement_key];
          return { icon: medal.icon, label: medal.label, rank: medal.rank, year: m.season_year };
        })}
        categories={categories}
        blunders={blunderCards}
      />
    </div>
  );
}

function toCard(key: string, items: Achievement[]): TrophyCard {
  const labels = items
    .slice()
    .sort((a, b) => a.season_year - b.season_year || (a.weekly_matchups?.week ?? 0) - (b.weekly_matchups?.week ?? 0))
    .map((a) => a.weekly_matchups?.week ? `${a.season_year} W${a.weekly_matchups.week}` : `${a.season_year}`);
  return {
    key,
    title: achievementLabel(key),
    count: items.length,
    labels,
    description: items[0]?.description ?? null,
    values: items.map((a) => a.value).filter((v): v is string => Boolean(v)),
  };
}
