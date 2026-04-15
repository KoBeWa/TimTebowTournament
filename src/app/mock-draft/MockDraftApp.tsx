"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { DraftSlot, Prospect, MockDraftSummary } from "./page";

// ── Position color map ─────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#c0392b", RB: "#2563eb", WR: "#16a34a", TE: "#7c3aed",
  OT: "#d97706", IOL: "#d97706", OL: "#d97706", EDGE: "#0891b2",
  DL: "#475569", LB: "#be185d", CB: "#ea580c", S: "#4f46e5", DB: "#4f46e5",
};
function posColor(pos: string) { return POS_COLORS[pos] ?? "#666"; }

// ── Countdown ──────────────────────────────────────────────────────────────
const DRAFT_DATE = new Date("2026-04-23T20:00:00-04:00");

function useCountdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = DRAFT_DATE.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

type PickMap = Record<number, number>;
type View = "edit" | "overview";
type MobilePanel = "picks" | "board";

// ═══════════════════════════════════════════════════════════════════════════
export default function MockDraftApp({
  slots, prospects, initialMocks,
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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("board");
  const scrollRef = useRef<HTMLDivElement>(null);

  const countdown = useCountdown();
  const prospectMap = useMemo(() => new Map(prospects.map((p) => [p.id, p])), [prospects]);
  const pickedIds = useMemo(() => new Set(Object.values(picks)), [picks]);
  const positions = useMemo(() => [...new Set(prospects.map((p) => p.position))].sort(), [prospects]);

  // ── Enter mock ─────────────────────────────────────────────────────────
  const enterMock = useCallback(async () => {
    if (!userName.trim()) return;
    const name = userName.trim();
    const { data: existing } = await supabase
      .from("mock_drafts").select("id, is_locked")
      .eq("manager_id", name).eq("draft_year", 2026).single();

    if (existing) {
      const { data: existingPicks } = await supabase
        .from("mock_draft_picks").select("pick_number, prospect_id")
        .eq("mock_draft_id", existing.id);
      const pm: PickMap = {};
      for (const p of existingPicks ?? []) pm[p.pick_number] = p.prospect_id;
      setPicks(pm);
      setMockId(existing.id);
      setIsLocked(existing.is_locked);
    } else {
      const { data: created, error } = await supabase
        .from("mock_drafts").insert({ manager_id: name, draft_year: 2026 })
        .select("id").single();
      if (error) { alert("Fehler: " + error.message); return; }
      setMockId(created!.id);
      setPicks({});
      setIsLocked(false);
    }
    setEntered(true);
    setActivePick(1);
  }, [userName]);

  // ── Save pick ──────────────────────────────────────────────────────────
  const savePick = useCallback(async (pickNumber: number, prospectId: number) => {
    if (!mockId || isLocked) return;
    setSaving(true);
    const { error } = await supabase.from("mock_draft_picks").upsert(
      { mock_draft_id: mockId, pick_number: pickNumber, prospect_id: prospectId },
      { onConflict: "mock_draft_id,pick_number" }
    );
    if (error) {
      alert(error.code === "23505"
        ? "Dieser Spieler wurde bereits in einem anderen Pick ausgewählt."
        : "Fehler: " + error.message);
      setSaving(false);
      return;
    }
    const newPicks = { ...picks, [pickNumber]: prospectId };
    setPicks(newPicks);
    await supabase.from("mock_drafts").update({ updated_at: new Date().toISOString() }).eq("id", mockId);
    setSaving(false);
    // Auto-advance to next empty
    for (let i = pickNumber + 1; i <= 32; i++) {
      if (!newPicks[i]) { setActivePick(i); setMobilePanel("board"); return; }
    }
    for (let i = 1; i < pickNumber; i++) {
      if (!newPicks[i]) { setActivePick(i); setMobilePanel("board"); return; }
    }
  }, [mockId, isLocked, picks]);

  // ── Remove pick ────────────────────────────────────────────────────────
  const removePick = useCallback(async (pickNumber: number) => {
    if (!mockId || isLocked) return;
    await supabase.from("mock_draft_picks").delete()
      .eq("mock_draft_id", mockId).eq("pick_number", pickNumber);
    setPicks((prev) => { const next = { ...prev }; delete next[pickNumber]; return next; });
    setActivePick(pickNumber);
  }, [mockId, isLocked]);

  // ── Refresh mocks ──────────────────────────────────────────────────────
  const refreshMocks = useCallback(async () => {
    const [{ data: freshMocks }, { data: allPicks }] = await Promise.all([
      supabase.from("mock_drafts").select("id, manager_id, is_locked, updated_at")
        .eq("draft_year", 2026).order("updated_at", { ascending: false }),
      supabase.from("mock_draft_picks").select("mock_draft_id, pick_number, prospect_id"),
    ]);
    const byMock = new Map<number, { pick_number: number; prospect_id: number }[]>();
    for (const p of allPicks ?? []) {
      if (!byMock.has(p.mock_draft_id)) byMock.set(p.mock_draft_id, []);
      byMock.get(p.mock_draft_id)!.push({ pick_number: p.pick_number, prospect_id: p.prospect_id });
    }
    setMocks((freshMocks ?? []).map((m) => ({
      ...m, picks: byMock.get(m.id) ?? [],
    })));
  }, []);

  useEffect(() => { if (view === "overview") refreshMocks(); }, [view, refreshMocks]);

  // ── Filtered prospects ─────────────────────────────────────────────────
  const filteredProspects = useMemo(() => {
    let list = prospects;
    if (posFilter) list = list.filter((p) => p.position === posFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.player_name.toLowerCase().includes(q) || p.college.toLowerCase().includes(q));
    }
    return list;
  }, [prospects, posFilter, searchQuery]);

  const activeSlot = slots.find((s) => s.pick_number === activePick);
  const filledCount = Object.keys(picks).length;

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── Countdown ── */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 py-2.5 sm:py-3 px-3 sm:px-4" style={{ background: "#c0392b" }}>
        <div className="label-nav text-white" style={{ fontSize: "10px" }}>
          {countdown.expired ? "DER DRAFT HAT BEGONNEN!" : (
            <><span className="hidden sm:inline">DRAFT IN </span>{countdown.days}T {countdown.hours}H {countdown.minutes}M {countdown.seconds}S</>
          )}
        </div>
        <div className="label-nav text-white opacity-80 hidden sm:block" style={{ fontSize: "10px" }}>Pittsburgh · 23. April · 20:00 ET</div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        {(["edit", "overview"] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className="label-nav text-xs px-4 sm:px-5 py-2 sm:py-2.5 transition-colors"
            style={{
              background: view === v ? "#1a1a1a" : "transparent",
              color: view === v ? "#f2ede4" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}>
            {v === "edit" ? "Mein Mock" : `Alle Mocks (${mocks.length})`}
          </button>
        ))}
      </div>

      {/* ═══════════ EDIT: Entry ═══════════ */}
      {view === "edit" && !entered && (
        <div className="cell p-6 sm:p-8 max-w-md mx-auto text-center">
          <div className="kicker mb-3">Mock Draft erstellen</div>
          <p className="text-text-muted text-sm mb-6">
            Gib deinen Namen ein um einen neuen Mock Draft zu starten oder deinen bestehenden zu bearbeiten.
          </p>
          <input type="text" value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enterMock()}
            placeholder="Dein Name..."
            className="w-full px-4 py-3 border border-border bg-cream text-ink text-center text-lg focus:outline-none focus:border-ink" />
          <button onClick={enterMock} disabled={!userName.trim()}
            className="mt-4 w-full label-nav text-xs px-6 py-3 transition-colors"
            style={{
              background: userName.trim() ? "#1a1a1a" : "var(--color-border)",
              color: userName.trim() ? "#f2ede4" : "var(--color-text-muted)",
            }}>
            Mock Draft starten →
          </button>
        </div>
      )}

      {/* ═══════════ EDIT: Editor ═══════════ */}
      {view === "edit" && entered && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="display-title text-lg sm:text-xl text-ink truncate">{userName}</span>
              <span className="label-nav text-text-muted flex-shrink-0" style={{ fontSize: "10px" }}>{filledCount}/32</span>
              {isLocked && (
                <span className="label-nav text-xs px-2 py-0.5 flex-shrink-0"
                  style={{ background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>LOCKED</span>
              )}
            </div>
            <button onClick={() => { setEntered(false); setMockId(null); setPicks({}); setUserName(""); }}
              className="label-nav text-xs text-text-muted hover:text-ink transition-colors flex-shrink-0">← Zurück</button>
          </div>

          {/* ── Mobile: Panel toggle ── */}
          <div className="flex gap-1 mb-3 lg:hidden">
            {(["board", "picks"] as MobilePanel[]).map((p) => (
              <button key={p} onClick={() => setMobilePanel(p)}
                className="label-nav text-xs flex-1 py-2 transition-colors text-center"
                style={{
                  background: mobilePanel === p ? "#1a1a1a" : "transparent",
                  color: mobilePanel === p ? "#f2ede4" : "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}>
                {p === "board" ? "Pick auswählen" : `Picks (${filledCount}/32)`}
              </button>
            ))}
          </div>

          {/* ── Layout ── */}
          <div className="flex gap-0" style={{ minHeight: "70vh" }}>

            {/* LEFT: Pick List */}
            <div className={`w-full lg:w-64 lg:flex-shrink-0 border border-border overflow-y-auto ${mobilePanel === "picks" ? "block" : "hidden lg:block"}`}
              style={{ maxHeight: "75vh" }}>
              {slots.map((slot) => {
                const prospect = picks[slot.pick_number] ? prospectMap.get(picks[slot.pick_number]) : null;
                const isActive = slot.pick_number === activePick;
                return (
                  <button key={slot.pick_number}
                    onClick={() => { setActivePick(slot.pick_number); setMobilePanel("board"); }}
                    className="w-full text-left px-3 py-2.5 border-b border-border-light transition-colors"
                    style={{ background: isActive ? "#1a1a1a" : prospect ? "rgba(26,26,26,0.03)" : "transparent" }}>
                    <div className="flex items-center gap-2">
                      <span className="label-nav text-xs w-6 flex-shrink-0"
                        style={{ color: isActive ? "#f2ede4" : "var(--color-text-faint)" }}>{slot.pick_number}</span>
                      <span className="label-nav text-xs flex-shrink-0 w-8"
                        style={{ color: isActive ? "#c0392b" : "var(--color-text-secondary)", fontWeight: 700 }}>{slot.team_abbr}</span>
                      {prospect ? (
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block"
                            style={{ color: isActive ? "#f2ede4" : "#1a1a1a" }}>{prospect.player_name}</span>
                          <span className="text-xs block truncate"
                            style={{ color: isActive ? "rgba(255,255,255,0.5)" : posColor(prospect.position), fontSize: "10px" }}>
                            {prospect.position} · {prospect.college}</span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: isActive ? "rgba(255,255,255,0.4)" : "var(--color-text-faint)" }}>—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RIGHT: On the Clock + Prospects */}
            <div className={`flex-1 border border-border lg:border-l-0 overflow-y-auto ${mobilePanel === "board" ? "block" : "hidden lg:block"}`}
              style={{ maxHeight: "75vh" }} ref={scrollRef}>
              {activeSlot && (<>

                {/* On the Clock */}
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-border" style={{ background: "rgba(26,26,26,0.04)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="kicker text-xs mb-0.5">Round 1, Pick {activeSlot.pick_number}</div>
                      <div className="display-title text-xl sm:text-2xl text-ink leading-tight">{activeSlot.team_name}</div>
                    </div>
                    {/* Mobile: quick nav arrows */}
                    <div className="flex gap-1 lg:hidden flex-shrink-0">
                      <button onClick={() => setActivePick(Math.max(1, activePick - 1))}
                        className="w-8 h-8 flex items-center justify-center border border-border text-text-muted hover:text-ink text-sm">←</button>
                      <button onClick={() => setActivePick(Math.min(32, activePick + 1))}
                        className="w-8 h-8 flex items-center justify-center border border-border text-text-muted hover:text-ink text-sm">→</button>
                    </div>
                  </div>

                  <div className="label-nav text-xs text-text-muted mt-0.5">
                    {activeSlot.conference}
                    {activeSlot.note && <span className="text-text-faint"> · {activeSlot.note}</span>}
                  </div>

                  {/* Needs */}
                  <div className="flex gap-1 sm:gap-1.5 mt-2 flex-wrap">
                    <span className="label-nav text-text-faint mr-0.5 self-center" style={{ fontSize: "9px" }}>NEEDS</span>
                    {activeSlot.needs.map((n) => (
                      <span key={n.position} className="label-nav text-xs px-1.5 py-0.5"
                        style={{
                          background: `${posColor(n.position)}18`, color: posColor(n.position),
                          fontWeight: n.priority <= 2 ? 700 : 400,
                          border: n.priority === 1 ? `1px solid ${posColor(n.position)}40` : "1px solid transparent",
                        }}>{n.position}</span>
                    ))}
                  </div>

                  {/* Current pick */}
                  {picks[activeSlot.pick_number] && (
                    <div className="mt-2.5 flex items-center justify-between p-2.5"
                      style={{ border: "1px solid #1a1a1a", background: "rgba(26,26,26,0.06)" }}>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink text-sm truncate">
                          {prospectMap.get(picks[activeSlot.pick_number])?.player_name ?? "—"}</div>
                        <div className="label-nav text-xs text-text-muted">
                          {prospectMap.get(picks[activeSlot.pick_number])?.position} · {prospectMap.get(picks[activeSlot.pick_number])?.college}</div>
                      </div>
                      {!isLocked && (
                        <button onClick={() => removePick(activeSlot.pick_number)}
                          className="label-nav text-xs text-red hover:underline flex-shrink-0 ml-2">×</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search + Filter */}
                {!isLocked && (
                  <div className="px-3 sm:px-5 py-2 border-b border-border-light flex flex-col sm:flex-row gap-2"
                    style={{ position: "sticky", top: 0, background: "var(--color-cream)", zIndex: 10 }}>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Spieler suchen..."
                      className="px-3 py-1.5 border border-border bg-cream text-ink text-sm w-full sm:flex-1 focus:outline-none focus:border-ink" />
                    <div className="flex gap-1 flex-wrap overflow-x-auto">
                      <button onClick={() => setPosFilter(null)}
                        className="label-nav px-2 py-1 transition-colors flex-shrink-0"
                        style={{ fontSize: "10px", background: !posFilter ? "#1a1a1a" : "transparent",
                          color: !posFilter ? "#f2ede4" : "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>ALLE</button>
                      {positions.map((pos) => (
                        <button key={pos} onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                          className="label-nav px-1.5 py-1 transition-colors flex-shrink-0"
                          style={{ fontSize: "10px", background: posFilter === pos ? posColor(pos) : "transparent",
                            color: posFilter === pos ? "#fff" : posColor(pos), border: `1px solid ${posColor(pos)}40` }}>{pos}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Desktop: Table */}
                <table className="w-full text-sm hidden sm:table" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="text-left" style={{ borderBottom: "2px solid #1a1a1a", position: "sticky", top: isLocked ? 0 : 78, background: "var(--color-cream)", zIndex: 5 }}>
                      <th className="label-nav text-xs text-text-muted py-2 px-5 w-10">#</th>
                      <th className="label-nav text-xs text-text-muted py-2">Spieler</th>
                      <th className="label-nav text-xs text-text-muted py-2 w-14">Pos</th>
                      <th className="label-nav text-xs text-text-muted py-2">College</th>
                      <th className="label-nav text-xs text-text-muted py-2 w-16 text-right pr-5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.map((p) => {
                      const isPicked = pickedIds.has(p.id);
                      const isNeed = activeSlot?.needs.some((n) => n.position === p.position);
                      return (
                        <tr key={p.id} style={{
                          borderBottom: "1px solid var(--color-border-light)", opacity: isPicked ? 0.3 : 1,
                          background: isNeed && !isPicked ? `${posColor(p.position)}08` : "transparent",
                        }}>
                          <td className="py-2 px-5 font-mono text-xs text-text-faint">{p.consensus_rank}</td>
                          <td className="py-2">
                            <span className="font-medium text-ink text-sm">{p.player_name}</span>
                            {isNeed && !isPicked && <span className="ml-1.5" style={{ fontSize: "9px", color: posColor(p.position), fontWeight: 700 }}>NEED</span>}
                          </td>
                          <td className="py-2"><span className="label-nav text-xs font-semibold" style={{ color: posColor(p.position) }}>{p.position}</span></td>
                          <td className="py-2 text-xs text-text-muted">{p.college}</td>
                          <td className="py-2 text-right pr-5">
                            {!isLocked && !isPicked && (
                              <button onClick={() => savePick(activePick, p.id)} disabled={saving}
                                className="label-nav text-xs px-2.5 py-1 transition-colors hover:bg-ink hover:text-cream"
                                style={{ border: "1px solid #1a1a1a", color: "#1a1a1a" }}>PICK</button>
                            )}
                            {isPicked && <span className="label-nav text-xs text-text-faint">✓</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile: Card list */}
                <div className="sm:hidden">
                  {filteredProspects.map((p) => {
                    const isPicked = pickedIds.has(p.id);
                    const isNeed = activeSlot?.needs.some((n) => n.position === p.position);
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-light"
                        style={{ opacity: isPicked ? 0.3 : 1, background: isNeed && !isPicked ? `${posColor(p.position)}08` : "transparent" }}>
                        <span className="font-mono text-xs text-text-faint w-6 text-right flex-shrink-0">{p.consensus_rank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-ink text-sm truncate">{p.player_name}</span>
                            {isNeed && !isPicked && <span style={{ fontSize: "8px", color: posColor(p.position), fontWeight: 700 }}>NEED</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="label-nav font-semibold" style={{ fontSize: "10px", color: posColor(p.position) }}>{p.position}</span>
                            <span className="text-text-muted" style={{ fontSize: "10px" }}>{p.college}</span>
                          </div>
                        </div>
                        {!isLocked && !isPicked && (
                          <button onClick={() => savePick(activePick, p.id)} disabled={saving}
                            className="label-nav text-xs px-3 py-1.5 flex-shrink-0 transition-colors active:bg-ink active:text-cream"
                            style={{ border: "1px solid #1a1a1a", color: "#1a1a1a" }}>PICK</button>
                        )}
                        {isPicked && <span className="label-nav text-xs text-text-faint flex-shrink-0">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ OVERVIEW ═══════════ */}
      {view === "overview" && (
        <div>
          {mocks.length === 0 ? (
            <div className="cell p-8 sm:p-12 text-center">
              <div className="text-text-muted text-sm">Noch keine Mock Drafts erstellt.</div>
              <button onClick={() => setView("edit")}
                className="mt-4 label-nav text-xs px-5 py-2.5" style={{ background: "#1a1a1a", color: "#f2ede4" }}>
                Ersten Mock Draft erstellen →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {mocks.map((mock) => (
                <MockCard key={mock.id} mock={mock} slots={slots} prospectMap={prospectMap} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mock Card ────────────────────────────────────────────────────────────
function MockCard({ mock, slots, prospectMap }: {
  mock: MockDraftSummary; slots: DraftSlot[]; prospectMap: Map<number, Prospect>;
}) {
  const [expanded, setExpanded] = useState(false);
  const pickMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const p of mock.picks) m[p.pick_number] = p.prospect_id;
    return m;
  }, [mock.picks]);

  const filled = mock.picks.length;
  const lastUpdate = new Date(mock.updated_at).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="cell">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="display-title text-lg sm:text-xl text-ink truncate block">{mock.manager_id}</span>
          <span className="label-nav text-text-muted" style={{ fontSize: "10px" }}>
            {filled}/32 Picks · {lastUpdate}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {mock.is_locked && (
            <span className="label-nav text-xs px-2 py-0.5"
              style={{ background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>LOCKED</span>
          )}
          <span className="text-text-muted text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Desktop table */}
          <table className="w-full text-sm hidden sm:table" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 px-5 w-10">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 w-14">Team</th>
                <th className="label-nav text-xs text-text-muted text-left py-2">Pick</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 w-14">Pos</th>
                <th className="label-nav text-xs text-text-muted text-left py-2">College</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const prospect = pickMap[slot.pick_number] ? prospectMap.get(pickMap[slot.pick_number]) : null;
                return (
                  <tr key={slot.pick_number} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                    <td className="py-2 px-5 font-mono text-xs text-text-faint">{slot.pick_number}</td>
                    <td className="py-2 label-nav text-xs text-text-secondary font-semibold">{slot.team_abbr}</td>
                    {prospect ? (<>
                      <td className="py-2 font-medium text-ink text-sm">{prospect.player_name}</td>
                      <td className="py-2"><span className="label-nav text-xs font-semibold" style={{ color: posColor(prospect.position) }}>{prospect.position}</span></td>
                      <td className="py-2 text-xs text-text-muted">{prospect.college}</td>
                    </>) : (
                      <td className="py-2 text-xs text-text-faint" colSpan={3}>—</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile list */}
          <div className="sm:hidden">
            {slots.map((slot) => {
              const prospect = pickMap[slot.pick_number] ? prospectMap.get(pickMap[slot.pick_number]) : null;
              return (
                <div key={slot.pick_number} className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                  <span className="font-mono text-xs text-text-faint w-6 text-right flex-shrink-0">{slot.pick_number}</span>
                  <span className="label-nav text-xs text-text-secondary font-semibold w-8 flex-shrink-0">{slot.team_abbr}</span>
                  {prospect ? (
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-ink truncate block">{prospect.player_name}</span>
                      <span style={{ fontSize: "10px", color: posColor(prospect.position) }}>{prospect.position}</span>
                      <span className="text-text-muted" style={{ fontSize: "10px" }}> · {prospect.college}</span>
                    </div>
                  ) : <span className="text-xs text-text-faint">—</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
