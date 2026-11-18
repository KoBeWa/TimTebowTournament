<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on this project

## Delegate to cheaper agents
The lead model plans, decides and reviews. Hand the rest to the agents in `.claude/agents/`:
- `ttt-expert` (mid-size model): ask it how the project, the sync or the database works instead of
  reading the code yourself. It answers with a summary and file references.
- `ttt-helper` (small model): mechanical edits, searches, running type check and lint, summarising
  logs and diffs.
Research across many files, audits and page-by-page rewrites also go to a mid-size model agent with
a written brief. Keep design decisions, anything touching the production database, and the final
review of a change with the lead model.

## Design system
`DESIGN.md` is the locked system (Hallmark, theme Console, graphite). Read it before any UI work.
- Graphite ground, hairline panels (`.cell`: a 1px rule, 10px, no shadow), the deepest step for
  the sidebar, the tab bar, inputs and tab tracks. No gradients, glows, blur or shadows.
- Host Grotesk for words (heads 500, tight); Atkinson Hyperlegible Mono (`.measured`, `font-mono`)
  for figures only: scores, points, records, percentages, dates. Never on names, labels or buttons.
- Amber (the token is still called `red`: `bg-red`, `text-red`; text on it `text-on-accent`) marks
  the current selection and the one primary action. Losses, blunders and errors use `negative`.
  Greys are neutral.
- Navigation groups live in `NAV_GROUPS` (`src/lib/constants.ts`). From `lg` up a fixed sidebar
  shows every destination. Below that: tab bar at the bottom, a tab opens its pages in a sheet.
- Every page uses `PageHeader` (the home page is the exception: its title is the current week);
  every tab, pill or segmented control uses `Tabs`; stat tiles use `StatTile`; manager names use
  `ManagerName` (`src/components/ui/`).
- Buttons are `.btn` (outline) or `.btn-primary`; one primary action per section.
- One colour per manager: `MANAGER_COLORS`, as a 3px marker or a chart series, never a fill.
- `.cell-accent` is the one lead panel of a view; never a card inside a card.
- One purpose per view, at most about three content blocks visible at once; split longer pages
  into tabs. Related things sit together, unrelated things get space, not borders.
- Every control is at least 44px tall on touch screens (handled in `globals.css` for buttons,
  inputs, selects and tabs; give other tap targets `min-h-11`).
- Every action answers at once: `loading.tsx` covers navigation; client components keep the old
  content dimmed while new data loads, and show what went wrong with a retry button on failure.
- Tables sit in `<div className="cell overflow-x-auto">`; secondary columns are hidden on phones
  with `hidden md:table-cell`.
- No uppercase or tracked labels, no eyebrows above headings, no emoji as icons, no dashes in
  sentences (a dash inside a record like 7–3 is fine). German, sentence case, plain words.
- Before handing back UI work run `node ~/.claude/skills/hallmark/scripts/sloplint.mjs <files> --scope app --genre modern-minimal`
  and fix every FAIL.

## Mock draft
The game runs before the NFL draft in late April and is closed the rest of the year
(`MOCK_DRAFT_OPEN = false` in `src/lib/constants.ts`: the page shows a notice and the navigation
hides it). The game lives in `src/app/mock-draft/MockDraftPage.tsx` and `MockDraftApp.tsx`.
To reopen it for a new year:
1. Load the new draft order, results table, team needs and prospects. The page reads
   `nfl_draft_order_2026`, `nfl_draft_results_2026` and `mock_drafts.draft_year = 2026`; switch these
   to the new year in `MockDraftPage.tsx`.
2. Writes from the browser are switched off in the database while the game is closed (anon has
   only SELECT on `mock_drafts` and `mock_draft_picks`). Reopening needs write access again; do it
   per mock draft (for example a secret edit token per mock, checked in an RPC function), not with
   an open `ALL ... USING (true)` policy, so nobody can overwrite someone else's mock.
3. Set `MOCK_DRAFT_OPEN = true` and add `export const dynamic = "force-dynamic";` to
   `src/app/mock-draft/page.tsx`. The page still uses the older styling; bring it to `DESIGN.md`
   when reopening.
