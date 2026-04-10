import { supabase } from "@/lib/supabase";
import { isBlunder, achievementLabel } from "@/lib/classifications";
import { MANAGERS } from "@/lib/constants";
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

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div>
        <Link href="/trophies" className="label-nav text-xs text-text-muted hover:text-ink transition-colors">
          ← Trophy Room
        </Link>
        <h1 className="display-title text-4xl md:text-5xl text-ink mt-2">{name}</h1>
        <p className="text-text-muted text-sm mt-1">
          {positive.length} Achievements &nbsp;·&nbsp; {blunders.length} Blunders &nbsp;·&nbsp; {achievements.length} Total Badges
        </p>
      </div>

      {/* ── Medals ── */}
      {medals.length > 0 && (
        <section>
          <div className="kicker mb-4">Medals</div>
          <div className="flex flex-wrap gap-3">
            {medals.map((m, i) => {
              const medal = MEDAL_KEYS[m.achievement_key];
              return (
                <div key={i} className="cell px-5 py-3 flex items-center gap-3"
                  style={{
                    borderColor: medal.rank === 1 ? "var(--color-gold-dark)" : medal.rank === 2 ? "#9ca3af" : "#b87333",
                    borderWidth: "1px",
                  }}>
                  <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{medal.icon}</span>
                  <div>
                    <div className="label-nav text-xs text-text-muted">{medal.label}</div>
                    <div className="display-title text-lg text-ink">{m.season_year}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Achievement categories ── */}
      {CATEGORY_ORDER.map((cat) => {
        const catMap = byCategory[cat];
        if (!catMap || Object.keys(catMap).length === 0) return null;

        const entries = Object.entries(catMap).sort((a, b) => {
          // Sort by count desc, then alphabetically
          if (b[1].length !== a[1].length) return b[1].length - a[1].length;
          return a[0].localeCompare(b[0]);
        });

        return (
          <section key={cat}>
            <div className="kicker mb-4">{CATEGORY_LABELS[cat]}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entries.map(([key, items]) => (
                <AchievementCard key={key} ach_key={key} items={items} blunder={false} />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Blunders ── */}
      {Object.keys(blundersByKey).length > 0 && (
        <section>
          <div className="kicker mb-4" style={{ color: "var(--color-red)" }}>Blunders</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(blundersByKey)
              .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
              .map(([key, items]) => (
                <AchievementCard key={key} ach_key={key} items={items} blunder={true} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Achievement card ─────────────────────────────────────────────────────────
function AchievementCard({
  ach_key,
  items,
  blunder,
}: {
  ach_key: string;
  items: Achievement[];
  blunder: boolean;
}) {
  const count = items.length;
  const labels = items
    .slice()
    .sort((a, b) => a.season_year - b.season_year || (a.weekly_matchups?.week ?? 0) - (b.weekly_matchups?.week ?? 0))
    .map((a) => a.weekly_matchups?.week ? `${a.season_year} W${a.weekly_matchups.week}` : `${a.season_year}`);
  const description = items[0]?.description;
  const values = items.map((a) => a.value).filter(Boolean);

  return (
    <div
      className="cell p-4"
      style={blunder ? { borderColor: "var(--color-red)", borderWidth: "1px", opacity: 0.9 } : undefined}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-semibold text-ink text-sm leading-snug">
          {achievementLabel(ach_key)}
        </span>
        {count > 1 && (
          <span
            className="label-nav text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: blunder ? "rgba(150,35,35,0.1)" : "rgba(26,26,26,0.08)",
              color: blunder ? "var(--color-red)" : "var(--color-text-muted)",
              fontWeight: 700,
            }}
          >
            ×{count}
          </span>
        )}
      </div>

      {/* Years / matchup labels */}
      <div className="label-nav text-xs text-text-muted mb-1">
        {labels.join(" · ")}
      </div>

      {/* Description */}
      {description && (
        <div className="text-xs text-text-muted leading-snug">{description}</div>
      )}

      {/* Values (if any) */}
      {values.length > 0 && (
        <div className="text-xs font-mono mt-1" style={{ color: blunder ? "var(--color-red)" : "var(--color-text-muted)" }}>
          {values.join(" · ")}
        </div>
      )}
    </div>
  );
}
