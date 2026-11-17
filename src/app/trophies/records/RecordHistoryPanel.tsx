"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import RecordChart from "./RecordChart";
import RecordRaceChart, { type RecordHistory } from "./RecordRaceChart";
import type { TimelineEntry } from "./recordUtils";

// Keyed by record in the parent, so each record starts in "loading". Loads the week-by-week values of a record in the browser. Until they arrive the holder chart from the
// timeline stays visible, dimmed; if loading fails it stays with a retry button.
export default function RecordHistoryPanel({ recordKey, periods, label, higher }: {
  recordKey: string; periods: TimelineEntry[]; label: string; higher: boolean;
}) {
  const [history, setHistory] = useState<RecordHistory | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => { setState("loading"); setAttempt((a) => a + 1); }, []);

  useEffect(() => {
    let live = true;
    supabase.rpc("record_history", { p_record_key: recordKey }).then(({ data, error }) => {
      if (!live) return;
      if (error) { setState("error"); return; }
      setHistory((data as RecordHistory | null) ?? null);
      setState("done");
    });
    return () => { live = false; };
  }, [recordKey, attempt]);

  if (state === "done" && history) return <RecordRaceChart history={history} label={label} higher={higher} />;
  if (periods.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className={state === "loading" ? "opacity-60 transition-opacity" : ""} aria-busy={state === "loading"}>
        <RecordChart periods={periods} label={label} />
      </div>
      {state === "error" && (
        <div className="flex flex-wrap items-center gap-3 px-1 text-sm text-text-muted">
          Die Werte je Manager konnten nicht geladen werden.
          <button type="button" className="btn" onClick={retry}>Erneut versuchen</button>
        </div>
      )}
    </div>
  );
}
