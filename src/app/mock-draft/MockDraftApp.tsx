"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { DraftSlot, Prospect, MockDraftSummary } from "./page";

// ── Helpers ──────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#c0392b", RB: "#2563eb", WR: "#16a34a", TE: "#7c3aed",
  OT: "#d97706", IOL: "#d97706", OL: "#d97706", T: "#d97706", EDGE: "#0891b2",
  DL: "#475569", DT: "#475569", LB: "#be185d", CB: "#ea580c", S: "#4f46e5", SAF: "#4f46e5", DB: "#4f46e5",
  C: "#d97706", G: "#d97706", K: "#666", P: "#666", LS: "#666", FB: "#666", SPEC: "#666",
};
function posColor(pos: string) { return POS_COLORS[pos] ?? "#666"; }

function parseNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? null : n;
}

function headshotSrc(url: string | null): string | null {
  if (!url) return null;
  return url.replace("{formatInstructions}", "t_headshot_desktop");
}

function fmtHeight(h: string | null): string {
  const n = parseNum(h);
  if (!n) return "—";
  const feet = Math.floor(n / 12);
  const inches = Math.round(n % 12);
  return `${feet}'${inches}"`;
}

// ── Countdown ────────────────────────────────────────────────────────
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
type DetailTab = "overview" | "combine" | "grades";

// ═══════════════════════════════════════════════════════════════════════
// PROSPECT DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════

function ProspectDetailModal({
  prospect,
  onClose,
}: {
  prospect: Prospect;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");

  const grade = parseNum(prospect.draft_grade);
  const athScore = parseNum(prospect.athleticism_score);
  const prodScore = parseNum(prospect.production_score);

  const combineFields = [
    { label: "40-Yard Dash", value: prospect.forty_yard_dash, unit: "s" },
    { label: "10-Yard Split", value: prospect.ten_yard_split, unit: "s" },
    { label: "Broad Jump", value: prospect.broad_jump, unit: '"' },
    { label: "Vertical Jump", value: prospect.vertical_jump, unit: '"' },
    { label: "Bench Press", value: prospect.bench_press, unit: " reps" },
    { label: "3-Cone Drill", value: prospect.three_cone_drill, unit: "s" },
    { label: "20-Yard Shuttle", value: prospect.twenty_yard_shuttle, unit: "s" },
    { label: "Arm Length", value: prospect.arm_length, unit: '"' },
    { label: "Hand Size", value: prospect.hand_size, unit: '"' },
    { label: "Wingspan", value: prospect.wingspan, unit: '"' },
  ];

  const bulletList = (text: string | null) => {
    if (!text) return null;
    const lines = text.split("\n").map(l => l.replace(/^[\s•*-]+/, "").trim()).filter(Boolean);
    return lines.map((line, i) => (
      <div key={i} className="flex gap-2 py-1.5" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
        <span className="text-text-faint flex-shrink-0 mt-0.5">•</span>
        <span className="text-sm text-text-secondary">{line}</span>
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-cream border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border" style={{ background: "var(--color-cream)" }}>
          <div className="flex items-start gap-4 p-4 sm:p-5">
            {/* Headshot */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-gray-100 border border-border overflow-hidden"
              style={{ borderRadius: "4px" }}>
              {headshotSrc(prospect.headshot_url) ? (
                <img src={headshotSrc(prospect.headshot_url)!} alt={prospect.player_name}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-faint text-2xl font-bold">
                  {prospect.first_name?.[0]}{prospect.last_name?.[0]}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="display-title text-xl sm:text-2xl text-ink leading-tight">
                  {prospect.player_name}
                </span>
                <button onClick={onClose}
                  className="ml-auto label-nav text-xs text-text-muted hover:text-ink flex-shrink-0 px-2 py-1 border border-border">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="label-nav text-xs font-bold px-2 py-0.5"
                  style={{ background: `${posColor(prospect.position)}18`, color: posColor(prospect.position) }}>
                  {prospect.position}
                </span>
                {prospect.college_logo_url && (
                  <img src={prospect.college_logo_url} alt="" className="w-4 h-4 object-contain" />
                )}
                <span className="text-sm text-text-muted">{prospect.college}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-text-muted">
                {prospect.height && <span>{fmtHeight(prospect.height)}</span>}
                {prospect.weight && <span>{parseNum(prospect.weight)} lbs</span>}
                {prospect.hometown && <span>{prospect.hometown}</span>}
                {prospect.college_class && <span>{prospect.college_class}</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {grade && (
                  <span className="label-nav text-xs">
                    <span className="text-text-faint">Grade </span>
                    <span className="font-bold text-ink">{grade.toFixed(1)}</span>
                  </span>
                )}
                {prospect.draft_projection && (
                  <span className="label-nav text-xs text-text-muted">{prospect.draft_projection}</span>
                )}
                {prospect.nfl_comparison && (
                  <span className="label-nav text-xs">
                    <span className="text-text-faint">Comp </span>
                    <span className="text-ink">{prospect.nfl_comparison}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-border">
            {(["overview", "combine", "grades"] as DetailTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 label-nav text-xs py-2.5 text-center transition-colors"
                style={{
                  borderBottom: tab === t ? "2px solid #1a1a1a" : "2px solid transparent",
                  color: tab === t ? "#1a1a1a" : "var(--color-text-muted)",
                  fontWeight: tab === t ? 700 : 400,
                }}>
                {t === "overview" ? "Überblick" : t === "combine" ? "Combine" : "Grades"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5">

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div className="space-y-5">
              {prospect.overview && (
                <div>
                  <div className="kicker text-xs mb-2">Scouting Report</div>
                  <p className="text-sm text-text-secondary leading-relaxed">{prospect.overview}</p>
                </div>
              )}
              {prospect.sources_tell_us && (
                <div className="p-3 border border-border" style={{ background: "rgba(26,26,26,0.03)" }}>
                  <div className="label-nav text-text-faint mb-1" style={{ fontSize: "9px" }}>SOURCES TELL US</div>
                  <p className="text-sm text-text-secondary italic">{prospect.sources_tell_us}</p>
                </div>
              )}
              {prospect.strengths && (
                <div>
                  <div className="kicker text-xs mb-1" style={{ color: "#16a34a" }}>Stärken</div>
                  {bulletList(prospect.strengths)}
                </div>
              )}
              {prospect.weaknesses && (
                <div>
                  <div className="kicker text-xs mb-1" style={{ color: "#c0392b" }}>Schwächen</div>
                  {bulletList(prospect.weaknesses)}
                </div>
              )}
              {prospect.bio && (
                <div>
                  <div className="kicker text-xs mb-2">Karriere</div>
                  <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">{prospect.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* COMBINE TAB */}
          {tab === "combine" && (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {combineFields.map(({ label, value, unit }) => {
                  const num = parseNum(value);
                  return (
                    <div key={label} className="p-3 border border-border">
                      <div className="label-nav text-text-faint mb-1" style={{ fontSize: "9px" }}>{label.toUpperCase()}</div>
                      <div className="text-lg font-bold text-ink">
                        {num ? `${num}${unit}` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 border border-border">
                <div className="label-nav text-text-faint mb-1" style={{ fontSize: "9px" }}>MEASURABLES</div>
                <div className="flex gap-6 text-sm text-text-secondary">
                  <span>{fmtHeight(prospect.height)}</span>
                  <span>{parseNum(prospect.weight) ?? "—"} lbs</span>
                </div>
              </div>
            </div>
          )}

          {/* GRADES TAB */}
          {tab === "grades" && (
            <div className="space-y-4">
              {[
                { label: "Draft Grade", value: grade, max: 100 },
                { label: "Athleticism", value: athScore, max: 100 },
                { label: "Production", value: prodScore, max: 100 },
              ].map(({ label, value, max }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label-nav text-xs text-text-muted">{label}</span>
                    <span className="font-bold text-ink text-sm">{value?.toFixed(1) ?? "—"}</span>
                  </div>
                  <div className="h-2 bg-gray-200 w-full" style={{ borderRadius: "2px" }}>
                    {value && (
                      <div className="h-full transition-all" style={{
                        width: `${Math.min((value / max) * 100, 100)}%`,
                        background: value >= 80 ? "#16a34a" : value >= 60 ? "#d97706" : "#c0392b",
                        borderRadius: "2px",
                      }} />
                    )}
                  </div>
                </div>
              ))}

              {prospect.draft_projection && (
                <div className="mt-4 p-3 border border-border" style={{ background: "rgba(26,26,26,0.03)" }}>
                  <div className="label-nav text-text-faint mb-1" style={{ fontSize: "9px" }}>DRAFT PROJECTION</div>
                  <div className="text-sm font-semibold text-ink">{prospect.draft_projection}</div>
                </div>
              )}
              {prospect.nfl_comparison && (
                <div className="p-3 border border-border" style={{ background: "rgba(26,26,26,0.03)" }}>
                  <div className="label-nav text-text-faint mb-1" style={{ fontSize: "9px" }}>NFL COMPARISON</div>
                  <div className="text-sm font-semibold text-ink">{prospect.nfl_comparison}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

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
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const countdown = useCountdown();
  const effectiveLocked = isLocked || countdown.expired;
  const prospectMap = useMemo(() => new Map(prospects.map((p) => [p.id, p])), [prospects]);
  const pickedIds = useMemo(() => new Set(Object.values(picks)), [picks]);
  const positions = useMemo(() => {
    const posOrder = ["QB", "RB", "WR", "TE", "OT", "IOL", "EDGE", "DL", "LB", "CB", "S"];
    const set = new Set(prospects.map((p) => p.position));
    return posOrder.filter(p => set.has(p));
  }, [prospects]);

  // ── Enter mock ─────────────────────────────────────────────────────
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

  // ── Save pick ──────────────────────────────────────────────────────
  const savePick = useCallback(async (pickNumber: number, prospectId: number) => {
    if (!mockId || effectiveLocked) return;
    setSaving(true);
    const { error } = await supabase.from("mock_draft_picks").upsert(
      { mock_draft_id: mockId, pick_number: pickNumber, prospect_id: prospectId },
      { onConflict: "mock_draft_id,pick_number" }
    );
    if (error) {
      alert(error.code === "23505"
        ? "Dieser Spieler wurde bereits gepickt."
        : "Fehler: " + error.message);
      setSaving(false);
      return;
    }
    const newPicks = { ...picks, [pickNumber]: prospectId };
    setPicks(newPicks);
    await supabase.from("mock_drafts").update({ updated_at: new Date().toISOString() }).eq("id", mockId);
    setSaving(false);
    for (let i = pickNumber + 1; i <= 32; i++) {
      if (!newPicks[i]) { setActivePick(i); setMobilePanel("board"); return; }
    }
    for (let i = 1; i < pickNumber; i++) {
      if (!newPicks[i]) { setActivePick(i); setMobilePanel("board"); return; }
    }
  }, [mockId, effectiveLocked, picks]);

  // ── Remove pick ────────────────────────────────────────────────────
  const removePick = useCallback(async (pickNumber: number) => {
    if (!mockId || effectiveLocked) return;
    await supabase.from("mock_draft_picks").delete()
      .eq("mock_draft_id", mockId).eq("pick_number", pickNumber);
    setPicks((prev) => { const next = { ...prev }; delete next[pickNumber]; return next; });
    setActivePick(pickNumber);
  }, [mockId, effectiveLocked]);

  // ── Refresh mocks ──────────────────────────────────────────────────
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

  // ── Filtered prospects ─────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Detail Modal */}
      {detailProspect && (
        <ProspectDetailModal prospect={detailProspect} onClose={() => setDetailProspect(null)} />
      )}

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

      {/* ═══ EDIT: Entry ═══ */}
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

      {/* ═══ EDIT: Editor ═══ */}
      {view === "edit" && entered && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="display-title text-lg sm:text-xl text-ink truncate">{userName}</span>
              <span className="label-nav text-text-muted flex-shrink-0" style={{ fontSize: "10px" }}>{filledCount}/32</span>
              {effectiveLocked && (
                <span className="label-nav text-xs px-2 py-0.5 flex-shrink-0"
                  style={{ background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>LOCKED</span>
              )}
            </div>
            <button onClick={() => { setEntered(false); setMockId(null); setPicks({}); setUserName(""); }}
              className="label-nav text-xs text-text-muted hover:text-ink transition-colors flex-shrink-0">← Zurück</button>
          </div>

          {/* Mobile panel toggle */}
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

          {/* Layout */}
          <div className="flex gap-0" style={{ minHeight: "70vh" }}>

            {/* LEFT: Pick List with team logos */}
            <div className={`w-full lg:w-72 lg:flex-shrink-0 border border-border overflow-y-auto ${mobilePanel === "picks" ? "block" : "hidden lg:block"}`}
              style={{ maxHeight: "75vh" }}>
              {slots.map((slot) => {
                const prospect = picks[slot.pick_number] ? prospectMap.get(picks[slot.pick_number]) : null;
                const isActive = slot.pick_number === activePick;
                return (
                  <button key={slot.pick_number}
                    onClick={() => { setActivePick(slot.pick_number); setMobilePanel("board"); }}
                    className="w-full text-left px-2.5 py-2 border-b border-border-light transition-colors"
                    style={{ background: isActive ? "#1a1a1a" : prospect ? "rgba(26,26,26,0.03)" : "transparent" }}>
                    <div className="flex items-center gap-2">
                      <span className="label-nav w-5 text-right flex-shrink-0"
                        style={{ fontSize: "10px", color: isActive ? "#f2ede4" : "var(--color-text-faint)" }}>
                        {slot.pick_number}
                      </span>
                      {/* Team logo */}
                      {slot.team_logo ? (
                        <img src={slot.team_logo} alt={slot.team_abbr}
                          className="w-5 h-5 object-contain flex-shrink-0" />
                      ) : (
                        <span className="label-nav text-xs w-5 flex-shrink-0 text-center"
                          style={{ color: isActive ? "#c0392b" : "var(--color-text-secondary)", fontWeight: 700 }}>
                          {slot.team_abbr.slice(0, 2)}
                        </span>
                      )}
                      {prospect ? (
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          {/* Prospect headshot mini */}
                          {headshotSrc(prospect.headshot_url) && (
                            <img src={headshotSrc(prospect.headshot_url)!} alt=""
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-border" />
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium truncate block"
                              style={{ color: isActive ? "#f2ede4" : "#1a1a1a" }}>{prospect.player_name}</span>
                            <span className="text-xs block truncate"
                              style={{ color: isActive ? "rgba(255,255,255,0.5)" : posColor(prospect.position), fontSize: "10px" }}>
                              {prospect.position} · {prospect.college}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-1">
                          <span className="label-nav text-xs font-bold"
                            style={{ color: isActive ? "rgba(255,255,255,0.7)" : "var(--color-text-secondary)" }}>
                            {slot.team_abbr}
                          </span>
                          <span className="text-xs truncate hidden sm:inline"
                            style={{ color: isActive ? "rgba(255,255,255,0.3)" : "var(--color-text-faint)" }}>
                            {slot.note || ""}
                          </span>
                        </div>
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
                    <div className="flex items-center gap-3">
                      {activeSlot.team_logo && (
                        <img src={activeSlot.team_logo} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                      )}
                      <div>
                        <div className="kicker text-xs mb-0.5">Round 1, Pick {activeSlot.pick_number}</div>
                        <div className="display-title text-xl sm:text-2xl text-ink leading-tight">{activeSlot.team_name}</div>
                      </div>
                    </div>
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

                  {/* Current pick with headshot */}
                  {picks[activeSlot.pick_number] && (() => {
                    const p = prospectMap.get(picks[activeSlot.pick_number]);
                    return p ? (
                      <div className="mt-2.5 flex items-center gap-3 p-2.5"
                        style={{ border: "1px solid #1a1a1a", background: "rgba(26,26,26,0.06)" }}>
                        {headshotSrc(p.headshot_url) && (
                          <img src={headshotSrc(p.headshot_url)!} alt=""
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-ink text-sm truncate">{p.player_name}</div>
                          <div className="flex items-center gap-1">
                            <span className="label-nav text-xs" style={{ color: posColor(p.position) }}>{p.position}</span>
                            {p.college_logo_url && <img src={p.college_logo_url} alt="" className="w-3.5 h-3.5 object-contain" />}
                            <span className="text-xs text-text-muted">{p.college}</span>
                          </div>
                        </div>
                        {!effectiveLocked && (
                          <button onClick={() => removePick(activeSlot.pick_number)}
                            className="label-nav text-xs text-red hover:underline flex-shrink-0">×</button>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Search + Filter */}
                {!effectiveLocked && (
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

                {/* Prospect List */}
                <div>
                  {filteredProspects.map((p) => {
                    const isPicked = pickedIds.has(p.id);
                    const isNeed = activeSlot?.needs.some((n) => n.position === p.position_group);
                    return (
                      <div key={p.id}
                        className="flex items-center gap-2.5 px-3 sm:px-4 py-2 border-b border-border-light transition-colors hover:bg-gray-50"
                        style={{ opacity: isPicked ? 0.3 : 1, background: isNeed && !isPicked ? `${posColor(p.position)}06` : undefined }}>
                        {/* Rank */}
                        <span className="font-mono text-xs text-text-faint w-6 text-right flex-shrink-0">{p.consensus_rank}</span>
                        
                        {/* Headshot - clickable */}
                        <button onClick={() => !isPicked && setDetailProspect(p)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden flex-shrink-0 border border-border bg-gray-100 hover:border-ink transition-colors"
                          disabled={isPicked}>
                          {headshotSrc(p.headshot_url) ? (
                            <img src={headshotSrc(p.headshot_url)!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-faint" style={{ fontSize: "10px" }}>
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </div>
                          )}
                        </button>

                        {/* Info - clickable */}
                        <button onClick={() => !isPicked && setDetailProspect(p)}
                          className="flex-1 min-w-0 text-left"
                          disabled={isPicked}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-ink text-sm truncate">{p.player_name}</span>
                            {isNeed && !isPicked && (
                              <span style={{ fontSize: "8px", color: posColor(p.position), fontWeight: 700 }}>NEED</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="label-nav font-semibold" style={{ fontSize: "10px", color: posColor(p.position) }}>{p.position}</span>
                            {p.college_logo_url && <img src={p.college_logo_url} alt="" className="w-3.5 h-3.5 object-contain" />}
                            <span className="text-text-muted truncate" style={{ fontSize: "10px" }}>{p.college}</span>
                            {p.draft_grade && (
                              <span className="text-text-faint ml-auto hidden sm:inline" style={{ fontSize: "10px" }}>
                                {parseNum(p.draft_grade)?.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Action */}
                        {!effectiveLocked && !isPicked && (
                          <button onClick={(e) => { e.stopPropagation(); savePick(activePick, p.id); }} disabled={saving}
                            className="label-nav text-xs px-3 py-1.5 flex-shrink-0 transition-colors hover:bg-ink hover:text-cream active:bg-ink active:text-cream"
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

      {/* ═══ OVERVIEW ═══ */}
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
                <MockCard key={mock.id} mock={mock} slots={slots} prospectMap={prospectMap}
                  onProspectClick={(p) => setDetailProspect(p)} draftLocked={effectiveLocked} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mock Card ────────────────────────────────────────────────────────
function MockCard({ mock, slots, prospectMap, onProspectClick, draftLocked }: {
  mock: MockDraftSummary; slots: DraftSlot[]; prospectMap: Map<number, Prospect>;
  onProspectClick: (p: Prospect) => void;
  draftLocked: boolean;
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

  // Before draft is locked: only show every 5th pick clearly
  const isPickVisible = (_pickNumber: number) => true;

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
          {slots.map((slot) => {
            const prospect = pickMap[slot.pick_number] ? prospectMap.get(pickMap[slot.pick_number]) : null;
            const visible = isPickVisible(slot.pick_number);
            return (
              <div key={slot.pick_number}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border-light"
                style={{ position: "relative" }}>
                <span className="font-mono text-xs text-text-faint w-5 text-right flex-shrink-0">{slot.pick_number}</span>
                {slot.team_logo ? (
                  <img src={slot.team_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                ) : (
                  <span className="label-nav text-xs text-text-secondary font-semibold w-5 flex-shrink-0">{slot.team_abbr.slice(0,2)}</span>
                )}
                {prospect ? (
                  visible ? (
                    /* Visible pick — fully shown */
                    <button onClick={() => onProspectClick(prospect)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left hover:underline">
                      {headshotSrc(prospect.headshot_url) && (
                        <img src={headshotSrc(prospect.headshot_url)!} alt=""
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-border" />
                      )}
                      <span className="text-sm font-medium text-ink truncate">{prospect.player_name}</span>
                      <span className="label-nav text-xs font-semibold flex-shrink-0" style={{ color: posColor(prospect.position) }}>{prospect.position}</span>
                      {prospect.college_logo_url && (
                        <img src={prospect.college_logo_url} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0 hidden sm:block" />
                      )}
                      <span className="text-text-muted truncate hidden sm:inline" style={{ fontSize: "10px" }}>{prospect.college}</span>
                    </button>
                  ) : (
                    /* Hidden pick — blurred */
                    <div className="flex items-center gap-2 flex-1 min-w-0 select-none"
                      style={{ filter: "blur(6px)", WebkitFilter: "blur(6px)", pointerEvents: "none" }}>
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
                      <span className="text-sm font-medium text-ink">Spielername</span>
                      <span className="label-nav text-xs font-semibold text-text-muted">POS</span>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-text-faint">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
