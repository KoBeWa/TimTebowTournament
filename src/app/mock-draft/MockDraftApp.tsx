"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DraftSlot, Prospect, MockDraftSummary } from "./page";

// ── Position color map ─────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#c0392b",
  RB: "#2563eb",
  WR: "#16a34a",
  TE: "#7c3aed",
  OT: "#d97706",
  IOL: "#d97706",
  OL: "#d97706",
  EDGE: "#0891b2",
  DL: "#475569",
  LB: "#be185d",
  CB: "#ea580c",
  S: "#4f46e5",
  DB: "#4f46e5",
};

function posColor(pos: string) {
  return POS_COLORS[pos] ?? "#666";
}

// ── Countdown ──────────────────────────────────────────────────────────────
const DRAFT_DATE = new Date("2026-04-23T20:00:00-04:00"); // 8PM ET

function useCountdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = DRAFT_DATE.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

// ── Types ──────────────────────────────────────────────────────────────────
type PickMap = Record<number, number>; // pick_number → prospect_id
type View = "edit" | "overview";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MockDraftApp({
  slots,
  prospects,
  initialMocks,
}: {
  slots: DraftSlot[];
  prospects: Prospect[];
  initialMocks: MockDraftSummary[];
}) {
  const [view, setView] = useState<View>("edit");
  const [userName, setUserName] = useState("");
  const [mockId, setMockId] = useState<number | null>(null);
  const [picks, setPicks] = useState<PickMap>({});
  const [activePick, setActivePick] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mocks, setMocks] = useState(initialMocks);
  const [entered, setEntered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState<string | null>(null);

  const countdown = useCountdown();
  const prospectMap = useMemo(
    () => new Map(prospects.map((p) => [p.id, p])),
    [prospects]
  );

  // Picked prospect IDs for the current mock
  const pickedIds = useMemo(() => new Set(Object.values(picks)), [picks]);

  // Positions list from prospects
  const positions = useMemo(() => {
    const set = new Set(prospects.map((p) => p.position));
    return [...set].sort();
  }, [prospects]);

  // ── Enter mock (load or create) ────────────────────────────────────────
  const enterMock = useCallback(async () => {
    if (!userName.trim()) return;
    const name = userName.trim();

    // Check if mock exists
    const { data: existing } = await supabase
      .from("mock_drafts")
      .select("id, is_locked")
      .eq("manager_id", name)
      .eq("draft_year", 2026)
      .single();

    if (existing) {
      // Load existing
      const { data: existingPicks } = await supabase
        .from("mock_draft_picks")
        .select("pick_number, prospect_id")
        .eq("mock_draft_id", existing.id);

      const pm: PickMap = {};
      for (const p of existingPicks ?? []) pm[p.pick_number] = p.prospect_id;
      setPicks(pm);
      setMockId(existing.id);
      setIsLocked(existing.is_locked);
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from("mock_drafts")
        .insert({ manager_id: name, draft_year: 2026 })
        .select("id")
        .single();

      if (error) {
        alert("Fehler beim Erstellen: " + error.message);
        return;
      }
      setMockId(created!.id);
      setPicks({});
      setIsLocked(false);
    }

    setEntered(true);
    setActivePick(1);
  }, [userName]);

  // ── Save a single pick ─────────────────────────────────────────────────
  const savePick = useCallback(
    async (pickNumber: number, prospectId: number) => {
      if (!mockId || isLocked) return;
      setSaving(true);

      // Upsert
      const { error } = await supabase.from("mock_draft_picks").upsert(
        {
          mock_draft_id: mockId,
          pick_number: pickNumber,
          prospect_id: prospectId,
        },
        { onConflict: "mock_draft_id,pick_number" }
      );

      if (error) {
        // Might be duplicate prospect
        if (error.code === "23505") {
          alert("Dieser Spieler wurde bereits in einem anderen Pick ausgewählt.");
        } else {
          alert("Fehler: " + error.message);
        }
        setSaving(false);
        return;
      }

      setPicks((prev) => ({ ...prev, [pickNumber]: prospectId }));

      // Update timestamp
      await supabase
        .from("mock_drafts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", mockId);

      setSaving(false);

      // Auto-advance to next empty pick
      for (let i = pickNumber + 1; i <= 32; i++) {
        if (!picks[i] && i !== pickNumber) {
          setActivePick(i);
          return;
        }
      }
    },
    [mockId, isLocked, picks]
  );

  // ── Remove a pick ──────────────────────────────────────────────────────
  const removePick = useCallback(
    async (pickNumber: number) => {
      if (!mockId || isLocked) return;
      await supabase
        .from("mock_draft_picks")
        .delete()
        .eq("mock_draft_id", mockId)
        .eq("pick_number", pickNumber);

      setPicks((prev) => {
        const next = { ...prev };
        delete next[pickNumber];
        return next;
      });
      setActivePick(pickNumber);
    },
    [mockId, isLocked]
  );

  // ── Refresh mocks list ─────────────────────────────────────────────────
  const refreshMocks = useCallback(async () => {
    const { data: freshMocks } = await supabase
      .from("mock_drafts")
      .select("id, manager_id, is_locked, updated_at")
      .eq("draft_year", 2026)
      .order("updated_at", { ascending: false });

    const { data: allPicks } = await supabase
      .from("mock_draft_picks")
      .select("mock_draft_id, pick_number, prospect_id");

    const picksByMock = new Map<
      number,
      { pick_number: number; prospect_id: number }[]
    >();
    for (const p of allPicks ?? []) {
      if (!picksByMock.has(p.mock_draft_id))
        picksByMock.set(p.mock_draft_id, []);
      picksByMock.get(p.mock_draft_id)!.push({
        pick_number: p.pick_number,
        prospect_id: p.prospect_id,
      });
    }

    setMocks(
      (freshMocks ?? []).map((m) => ({
        id: m.id,
        manager_id: m.manager_id,
        is_locked: m.is_locked,
        updated_at: m.updated_at,
        picks: picksByMock.get(m.id) ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    if (view === "overview") refreshMocks();
  }, [view, refreshMocks]);

  // ── Filtered prospects for the selector ─────────────────────────────────
  const filteredProspects = useMemo(() => {
    let list = prospects;
    if (posFilter) list = list.filter((p) => p.position === posFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          p.college.toLowerCase().includes(q)
      );
    }
    return list;
  }, [prospects, posFilter, searchQuery]);

  const activeSlot = slots.find((s) => s.pick_number === activePick);
  const filledCount = Object.keys(picks).length;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* ── Countdown ── */}
      <div
        className="flex items-center justify-between mb-6 py-3 px-4"
        style={{ background: "#c0392b" }}
      >
        <div className="label-nav text-xs text-white">
          {countdown.expired
            ? "DER DRAFT HAT BEGONNEN!"
            : `DRAFT IN ${countdown.days}T ${countdown.hours}H ${countdown.minutes}M ${countdown.seconds}S`}
        </div>
        <div className="label-nav text-xs text-white opacity-80">
          Pittsburgh · 23. April · 20:00 ET
        </div>
      </div>

      {/* ── Tab Switch ── */}
      <div className="flex gap-2 mb-6">
        {(["edit", "overview"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="label-nav text-xs px-5 py-2.5 transition-colors"
            style={{
              background: view === v ? "#1a1a1a" : "transparent",
              color: view === v ? "#f2ede4" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {v === "edit" ? "Mein Mock Draft" : `Alle Mocks (${mocks.length})`}
          </button>
        ))}
      </div>

      {/* ═══════════════════ EDIT VIEW ═══════════════════ */}
      {view === "edit" && !entered && (
        <div className="cell p-8 max-w-md mx-auto text-center">
          <div className="kicker mb-3">Mock Draft erstellen</div>
          <p className="text-text-muted text-sm mb-6">
            Gib deinen Namen ein um einen neuen Mock Draft zu starten oder
            deinen bestehenden zu bearbeiten.
          </p>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enterMock()}
            placeholder="Dein Name..."
            className="w-full px-4 py-3 border border-border bg-cream text-ink text-center text-lg focus:outline-none focus:border-ink"
            style={{ fontFamily: "var(--font-inter)" }}
          />
          <button
            onClick={enterMock}
            disabled={!userName.trim()}
            className="mt-4 w-full label-nav text-xs px-6 py-3 transition-colors"
            style={{
              background: userName.trim() ? "#1a1a1a" : "var(--color-border)",
              color: userName.trim() ? "#f2ede4" : "var(--color-text-muted)",
              cursor: userName.trim() ? "pointer" : "not-allowed",
            }}
          >
            Mock Draft starten →
          </button>
        </div>
      )}

      {view === "edit" && entered && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="display-title text-xl text-ink">
                {userName}
              </span>
              <span className="label-nav text-xs text-text-muted">
                {filledCount}/32 Picks
              </span>
              {isLocked && (
                <span
                  className="label-nav text-xs px-2 py-0.5"
                  style={{ background: "rgba(192,57,43,0.1)", color: "#c0392b" }}
                >
                  LOCKED
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setEntered(false);
                setMockId(null);
                setPicks({});
                setUserName("");
              }}
              className="label-nav text-xs text-text-muted hover:text-ink transition-colors"
            >
              ← Zurück
            </button>
          </div>

          {/* Main layout: Left picks + Right editor */}
          <div className="flex gap-0" style={{ minHeight: "75vh" }}>
            {/* ── LEFT: Pick List ── */}
            <div
              className="w-64 flex-shrink-0 border border-border overflow-y-auto"
              style={{ maxHeight: "75vh" }}
            >
              {slots.map((slot) => {
                const prospect = picks[slot.pick_number]
                  ? prospectMap.get(picks[slot.pick_number])
                  : null;
                const isActive = slot.pick_number === activePick;

                return (
                  <button
                    key={slot.pick_number}
                    onClick={() => setActivePick(slot.pick_number)}
                    className="w-full text-left px-3 py-2.5 border-b border-border-light transition-colors"
                    style={{
                      background: isActive
                        ? "#1a1a1a"
                        : prospect
                        ? "rgba(26,26,26,0.03)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="label-nav text-xs w-6 flex-shrink-0"
                        style={{
                          color: isActive
                            ? "#f2ede4"
                            : "var(--color-text-faint)",
                        }}
                      >
                        {slot.pick_number}
                      </span>
                      <span
                        className="label-nav text-xs flex-shrink-0 w-8"
                        style={{
                          color: isActive
                            ? "#c0392b"
                            : "var(--color-text-secondary)",
                          fontWeight: 700,
                        }}
                      >
                        {slot.team_abbr}
                      </span>
                      {prospect ? (
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-xs font-medium truncate block"
                            style={{
                              color: isActive ? "#f2ede4" : "#1a1a1a",
                            }}
                          >
                            {prospect.player_name}
                          </span>
                          <span
                            className="text-xs block"
                            style={{
                              color: isActive
                                ? "rgba(255,255,255,0.5)"
                                : posColor(prospect.position),
                              fontSize: "10px",
                            }}
                          >
                            {prospect.position} · {prospect.college}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="text-xs"
                          style={{
                            color: isActive
                              ? "rgba(255,255,255,0.4)"
                              : "var(--color-text-faint)",
                          }}
                        >
                          —
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── RIGHT: On the Clock + Prospect List ── */}
            <div className="flex-1 border-t border-r border-b border-border overflow-y-auto" style={{ maxHeight: "75vh" }}>
              {activeSlot && (
                <>
                  {/* On the Clock Header */}
                  <div
                    className="px-5 py-4 border-b border-border"
                    style={{ background: "rgba(26,26,26,0.04)" }}
                  >
                    <div className="kicker text-xs mb-1">
                      Round 1, Pick {activeSlot.pick_number}
                    </div>
                    <div className="display-title text-2xl text-ink leading-tight">
                      {activeSlot.team_name}
                    </div>
                    <div className="label-nav text-xs text-text-muted mt-0.5">
                      {activeSlot.conference}
                      {activeSlot.note && (
                        <span className="text-text-faint">
                          {" "}
                          · {activeSlot.note}
                        </span>
                      )}
                    </div>

                    {/* Needs */}
                    <div className="flex gap-1.5 mt-3">
                      <span className="label-nav text-text-faint mr-1" style={{ fontSize: "10px" }}>
                        NEEDS
                      </span>
                      {activeSlot.needs.map((n) => (
                        <span
                          key={n.position}
                          className="label-nav text-xs px-2 py-0.5"
                          style={{
                            background: `${posColor(n.position)}18`,
                            color: posColor(n.position),
                            fontWeight: n.priority <= 2 ? 700 : 400,
                            border:
                              n.priority === 1
                                ? `1px solid ${posColor(n.position)}40`
                                : "1px solid transparent",
                          }}
                        >
                          {n.position}
                        </span>
                      ))}
                    </div>

                    {/* Current pick display */}
                    {picks[activeSlot.pick_number] && (
                      <div
                        className="mt-3 flex items-center justify-between p-3"
                        style={{
                          border: "1px solid #1a1a1a",
                          background: "rgba(26,26,26,0.06)",
                        }}
                      >
                        <div>
                          <div className="font-semibold text-ink">
                            {prospectMap.get(picks[activeSlot.pick_number])
                              ?.player_name ?? "—"}
                          </div>
                          <div className="label-nav text-xs text-text-muted">
                            {prospectMap.get(picks[activeSlot.pick_number])
                              ?.position ?? ""}{" "}
                            ·{" "}
                            {prospectMap.get(picks[activeSlot.pick_number])
                              ?.college ?? ""}
                          </div>
                        </div>
                        {!isLocked && (
                          <button
                            onClick={() =>
                              removePick(activeSlot.pick_number)
                            }
                            className="label-nav text-xs text-red hover:underline"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Prospect search & filter */}
                  {!isLocked && (
                    <div
                      className="px-5 py-3 border-b border-border-light flex flex-wrap gap-2 items-center"
                      style={{ position: "sticky", top: 0, background: "var(--color-cream)", zIndex: 10 }}
                    >
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Spieler suchen..."
                        className="px-3 py-1.5 border border-border bg-cream text-ink text-sm flex-1 min-w-[140px] focus:outline-none focus:border-ink"
                      />
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setPosFilter(null)}
                          className="label-nav px-2 py-1 text-xs transition-colors"
                          style={{
                            background: !posFilter ? "#1a1a1a" : "transparent",
                            color: !posFilter
                              ? "#f2ede4"
                              : "var(--color-text-muted)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          ALLE
                        </button>
                        {positions.map((pos) => (
                          <button
                            key={pos}
                            onClick={() =>
                              setPosFilter(posFilter === pos ? null : pos)
                            }
                            className="label-nav px-2 py-1 transition-colors"
                            style={{
                              fontSize: "10px",
                              background:
                                posFilter === pos
                                  ? posColor(pos)
                                  : "transparent",
                              color:
                                posFilter === pos
                                  ? "#fff"
                                  : posColor(pos),
                              border: `1px solid ${posColor(pos)}40`,
                            }}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prospect Table */}
                  <table
                    className="w-full text-sm"
                    style={{ borderCollapse: "collapse" }}
                  >
                    <thead>
                      <tr
                        className="text-left"
                        style={{
                          borderBottom: "2px solid #1a1a1a",
                          position: "sticky",
                          top: isLocked ? 0 : 46,
                          background: "var(--color-cream)",
                          zIndex: 5,
                        }}
                      >
                        <th className="label-nav text-xs text-text-muted py-2 px-5 w-10">
                          #
                        </th>
                        <th className="label-nav text-xs text-text-muted py-2">
                          Spieler
                        </th>
                        <th className="label-nav text-xs text-text-muted py-2 w-14">
                          Pos
                        </th>
                        <th className="label-nav text-xs text-text-muted py-2">
                          College
                        </th>
                        <th className="label-nav text-xs text-text-muted py-2 w-16 text-right pr-5">
                          {!isLocked ? "Pick" : ""}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProspects.map((p) => {
                        const isPicked = pickedIds.has(p.id);
                        const isNeed = activeSlot?.needs.some(
                          (n) => n.position === p.position
                        );

                        return (
                          <tr
                            key={p.id}
                            style={{
                              borderBottom:
                                "1px solid var(--color-border-light)",
                              opacity: isPicked ? 0.3 : 1,
                              background: isNeed && !isPicked
                                ? `${posColor(p.position)}08`
                                : "transparent",
                            }}
                          >
                            <td className="py-2 px-5 font-mono text-xs text-text-faint">
                              {p.consensus_rank}
                            </td>
                            <td className="py-2">
                              <span className="font-medium text-ink text-sm">
                                {p.player_name}
                              </span>
                              {isNeed && !isPicked && (
                                <span
                                  className="ml-1.5"
                                  style={{
                                    fontSize: "9px",
                                    color: posColor(p.position),
                                    fontWeight: 700,
                                  }}
                                >
                                  NEED
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              <span
                                className="label-nav text-xs font-semibold"
                                style={{ color: posColor(p.position) }}
                              >
                                {p.position}
                              </span>
                            </td>
                            <td className="py-2 text-xs text-text-muted">
                              {p.college}
                            </td>
                            <td className="py-2 text-right pr-5">
                              {!isLocked && !isPicked && (
                                <button
                                  onClick={() =>
                                    savePick(activePick, p.id)
                                  }
                                  disabled={saving}
                                  className="label-nav text-xs px-2.5 py-1 transition-colors hover:bg-ink hover:text-cream"
                                  style={{
                                    border: "1px solid #1a1a1a",
                                    color: "#1a1a1a",
                                  }}
                                >
                                  PICK
                                </button>
                              )}
                              {isPicked && (
                                <span className="label-nav text-xs text-text-faint">
                                  ✓
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ OVERVIEW VIEW ═══════════════════ */}
      {view === "overview" && (
        <div>
          {mocks.length === 0 ? (
            <div className="cell p-12 text-center">
              <div className="text-text-muted text-sm">
                Noch keine Mock Drafts erstellt.
              </div>
              <button
                onClick={() => setView("edit")}
                className="mt-4 label-nav text-xs px-5 py-2.5"
                style={{
                  background: "#1a1a1a",
                  color: "#f2ede4",
                }}
              >
                Ersten Mock Draft erstellen →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {mocks.map((mock) => (
                <MockCard
                  key={mock.id}
                  mock={mock}
                  slots={slots}
                  prospectMap={prospectMap}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mock Card for overview ───────────────────────────────────────────────
function MockCard({
  mock,
  slots,
  prospectMap,
}: {
  mock: MockDraftSummary;
  slots: DraftSlot[];
  prospectMap: Map<number, Prospect>;
}) {
  const [expanded, setExpanded] = useState(false);
  const pickMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const p of mock.picks) m[p.pick_number] = p.prospect_id;
    return m;
  }, [mock.picks]);

  const filled = mock.picks.length;
  const lastUpdate = new Date(mock.updated_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="cell">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center justify-between"
      >
        <div>
          <span className="display-title text-xl text-ink">
            {mock.manager_id}
          </span>
          <span className="label-nav text-xs text-text-muted ml-3">
            {filled}/32 Picks
          </span>
          {mock.is_locked && (
            <span
              className="label-nav text-xs ml-2 px-2 py-0.5"
              style={{ background: "rgba(192,57,43,0.1)", color: "#c0392b" }}
            >
              LOCKED
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="label-nav text-xs text-text-faint">{lastUpdate}</span>
          <span className="text-text-muted">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 px-5 w-10">
                  #
                </th>
                <th className="label-nav text-xs text-text-muted text-left py-2 w-14">
                  Team
                </th>
                <th className="label-nav text-xs text-text-muted text-left py-2">
                  Pick
                </th>
                <th className="label-nav text-xs text-text-muted text-left py-2 w-14">
                  Pos
                </th>
                <th className="label-nav text-xs text-text-muted text-left py-2">
                  College
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const prospect = pickMap[slot.pick_number]
                  ? prospectMap.get(pickMap[slot.pick_number])
                  : null;

                return (
                  <tr
                    key={slot.pick_number}
                    style={{
                      borderBottom: "1px solid var(--color-border-light)",
                    }}
                  >
                    <td className="py-2 px-5 font-mono text-xs text-text-faint">
                      {slot.pick_number}
                    </td>
                    <td className="py-2 label-nav text-xs text-text-secondary font-semibold">
                      {slot.team_abbr}
                    </td>
                    {prospect ? (
                      <>
                        <td className="py-2 font-medium text-ink text-sm">
                          {prospect.player_name}
                        </td>
                        <td className="py-2">
                          <span
                            className="label-nav text-xs font-semibold"
                            style={{ color: posColor(prospect.position) }}
                          >
                            {prospect.position}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-text-muted">
                          {prospect.college}
                        </td>
                      </>
                    ) : (
                      <>
                        <td
                          className="py-2 text-xs text-text-faint"
                          colSpan={3}
                        >
                          —
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
