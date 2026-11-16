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
- Two layers, after Apple's Liquid Glass guidance: controls and navigation float on the `.glass`
  material (top bar, phone tab bar, menus, sheets, `Tabs`); content sits on opaque `.cell` cards.
  Do not put glass on content, and do not stack glass on glass.
- Navigation groups live in `NAV_GROUPS` (`src/lib/constants.ts`). Desktop: floating bar with
  menus. Phones: tab bar at the bottom, a tab opens its pages in a sheet.
- Every page uses `PageHeader` (the home page is the exception: its title is the current week);
  every tab, pill or segmented control uses `Tabs`; stat tiles use `StatTile`; manager names use
  `ManagerName` (`src/components/ui/`).
- Buttons are `.btn` (quiet) or `.btn-primary`; one primary action per section.
- One colour per manager: `MANAGER_COLORS`. Use it for anything drawn per manager.
- One purpose per view, at most about three content blocks visible at once; split longer pages
  into tabs. Related things sit together, unrelated things get space, not borders.
- Every control is at least 44px tall on touch screens (handled in `globals.css` for buttons,
  inputs, selects and tabs; give other tap targets `min-h-11`).
- Every action answers at once: `loading.tsx` covers navigation; client components keep the old
  content dimmed while new data loads, and show what went wrong with a retry button on failure.
- Tables sit in `<div className="cell overflow-x-auto">`; secondary columns are hidden on phones
  with `hidden md:table-cell`.
- No uppercase labels above headings. German, sentence case, plain words.
