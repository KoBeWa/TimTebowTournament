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
- Navigation groups live in `NAV_GROUPS` (`src/lib/constants.ts`).
- Every page uses `PageHeader`; every tab, pill or segmented control uses `Tabs`; stat tiles use
  `StatTile`; manager names use `ManagerName` (`src/components/ui/`).
- One colour per manager: `MANAGER_COLORS`. Use it for anything drawn per manager.
- At most about three content blocks visible at once; split longer pages into tabs.
- Tables sit in `<div className="cell overflow-x-auto">`; secondary columns are hidden on phones
  with `hidden md:table-cell`.
- No uppercase labels above headings. German, sentence case, plain words.
