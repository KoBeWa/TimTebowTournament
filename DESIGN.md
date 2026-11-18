# Design: Tim Tebow Tournament

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (every route is an app screen: tables, charts, controls)
- Theme: Console, colourway graphite (dealt 1/3, seed private-fantasy-football-league-7309·4d0a4be3·2026-11-18·r0)
- Axes: dark/grotesk-sans/chromatic-amber · posture: restrained

## Tokens
`src/app/tokens.css` is the source of truth (a Tailwind `@theme` block, so every role is a utility:
`bg-paper`, `bg-paper-2`, `bg-paper-3`, `text-ink`, `text-ink-2`, `text-muted`, `border-rule`,
`border-rule-2`, `bg-accent`, `text-accent-ink`, `text-cool`, `text-ok`, `text-bad`, `font-outlier`).
Older names in `globals.css` map onto these roles and keep working: `cream` → paper, `surface*` →
panel steps, `red` → the amber accent, `on-accent` → accent-ink, `border*` → rules,
`text-secondary/muted/faint` → ink-2/muted/faint, `positive/negative` → ok/bad.
```css
:root {
  --color-paper: oklch(17% 0.008 250);  --color-paper-2: oklch(21% 0.009 250);  --color-paper-3: oklch(13.5% 0.007 250);
  --color-ink: oklch(95% 0.005 250);  --color-ink-2: oklch(83% 0.008 250);  --color-muted: oklch(71% 0.01 250);  --color-rule: oklch(31% 0.01 250);
  --color-accent: oklch(82% 0.15 80);  --color-accent-ink: oklch(18% 0.04 75);  --color-focus: oklch(82% 0.15 80);
  --font-display: Host Grotesk;  --font-body: Host Grotesk;  --font-outlier: Atkinson Hyperlegible Mono;
  --radius-card: 10px;  --radius-pill: 6px;  --rule-hair: 1px;  --shadow-card: none;
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

## Rules
- Ground `paper`; panels are `.cell` (paper-2, a 1px rule, 10px, no shadow); the deepest step
  (paper-3) is for the sidebar, the tab bar, inputs and tab tracks. No gradients, glows, blur or shadows.
- Host Grotesk 500 for heads (tight, sentence case), 400 for reading; three weights at most (400, 500, 600).
- Atkinson Hyperlegible Mono (`.measured`, `font-mono`) for what was measured: scores, points,
  records, percentages, dates, ranks, ids. Never on a name, a label, a head or a button.
- Amber marks the current selection, the one primary action and a person's highlight. Cool blue
  marks an instrument (a projection, a trace). ok and bad are wins and losses only.
- Manager colours (`MANAGER_COLORS`) are data colours: a 3px marker beside a name and chart series.
  Never a fill, a background or a text colour for a block.
- `.cell-accent` is the one lead panel of a view (a stronger rule and an amber top edge).
- Tables sit in `<div className="cell overflow-x-auto">`, horizontal rules only, heads sentence case
  in muted, figures right-aligned in mono; secondary columns `hidden md:table-cell`.

## Controls
- Primary: `.btn-primary`, amber fill, accent-ink text, 6px, 36px (44px on touch)
- Secondary: `.btn`, a 1px rule-2 outline on paper-2, same radius and height
- Tabs: `Tabs`, a segmented strip on paper-3; the chosen tab raised with a rule-2 edge

## Motion
- Character: still. Colour changes over `--dur-micro`; no reveals, no hover lifts; reduced motion ends everything at once.

## Exports
`src/app/tokens.css` in this project (Tailwind v4 `@theme`).
