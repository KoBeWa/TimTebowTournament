# Tim Tebow Tournament — UI Redesign Spec
**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

Complete visual redesign of the TTT fantasy football league site. The existing page structure and routing stays intact; only the visual layer (colors, typography, layout patterns, components) is replaced.

**Direction:** Editorial sports journalism — like a printed league chronicle. Clean, high-contrast, zero generic-AI-dark-mode aesthetics. Inspired by newspaper/broadsheet design with data-dense sidebar panels.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--cream` | `#f2ede4` | Background (all pages) |
| `--ink` | `#1a1a1a` | Primary text, borders, headings |
| `--red` | `#c0392b` | Sole accent — kicker labels, arrows, active nav, ticker, section dividers |
| `--border` | `#d5cfca` | Internal dividers between cells/columns |
| `--border-light` | `#e8e2d8` | Subtle row separators |
| `--text-secondary` | `#555` | Nav inactive, meta labels |
| `--text-muted` | `#666` | Captions, subtitles, stat labels |
| `--text-faint` | `#777` | Datelines, season lines |

**No gold.** No dark backgrounds in content areas. All pages share the same cream background throughout.

### Typography

| Role | Font | Weight | Style |
|---|---|---|---|
| Display headlines | Playfair Display | 900 | Italic |
| Section headers | Playfair Display | 700 | Italic |
| Navigation / labels | Roboto Condensed | 700 | Uppercase |
| Body / UI text | Inter | 400–600 | Normal |

**Load via Google Fonts:** `Playfair+Display:ital,wght@0,700;0,900;1,700;1,900` + `Roboto+Condensed:wght@400;700` + `Inter:wght@400;500;600;700`

### Spacing & Borders

- Cards/cells: `1px solid var(--border)` — no border-radius, square corners everywhere
- Section dividers: `2–3px solid var(--ink)` for major breaks
- Page padding: `1.5rem` horizontal
- No shadows, no rounded corners, no glassmorphism

---

## Global Layout

### Navbar
- Full-width, cream background
- `3px solid #1a1a1a` bottom border
- Left: edition info in Roboto Condensed (`Tim Tebow Tournament · Saison XI · 2024`)
- Right: nav links — Roboto Condensed, uppercase, `color: #555`, active = `color: #1a1a1a`
- Height: `36px`

### Masthead (homepage only)
- 3-column grid: meta-left | center | meta-right
- Center: TTT logo (`mix-blend-mode: multiply`, `width: 90px`) above italic Playfair Display title, below: subtitle rule with `· Die offizielle Ligachronik · Est. 2015 ·`
- Meta columns: Roboto Condensed, uppercase, `color: #666`
- Bottom border: `1px solid #1a1a1a`

### Red Ticker Bar
- `background: #c0392b`, height `26px`
- Left label block: `background: #1a1a1a`, white Roboto Condensed text ("Aktuell")
- Ticker text: white, Roboto Condensed, current league news

### Stats Bar
- 4-column grid with `1px solid #1a1a1a` dividers
- Each cell: large Playfair Display italic number + Roboto Condensed label below
- Top border: `3px solid #1a1a1a`

---

## Homepage Layout

```
┌─────────────────────────────────────────┐
│ NAV                                     │
├─────────────────────────────────────────┤
│ MASTHEAD (logo + title + meta)          │
├─────────────────────────────────────────┤
│ RED TICKER                              │
├────────────────────────┬────────────────┤
│ CHAMPION AREA          │ SIDEBAR        │
│ - Kicker label (red)   │ - Champions    │
│ - Big italic name      │   History list │
│ - Season dateline      │ - Liga-Rekorde │
│ - Record badge (boxed) │   list         │
│ - 4-cell data grid     │                │
│ - Finalists row        │                │
├────────────────────────┴────────────────┤
│ STATS BAR (4 cells)                     │
├─────────────────────────────────────────┤
│ "Explore the Archive" section header    │
├─────────────────────────────────────────┤
│ LINKS GRID (3×2, bordered cells)        │
└─────────────────────────────────────────┘
```

**Champion area:** No prose text. All data — champion name in large italic Playfair, record in a bordered box, 4-cell stat grid (Punkte / Gegner / Diff / Titel), finalists row below.

**Sidebar:** Cream background, separated by `1px solid #1a1a1a` vertical border only. Champions History list (year / name / record) + Liga-Rekorde list. Red kicker labels, no background fills.

---

## Inner Page Principle

All inner pages (History, Gamecenter, Drafts, Transactions, H2H, Trophy Room) follow the same system:

- **Cream background** throughout
- **Playfair Display italic** for page titles and section headers
- **Red kicker labels** (Roboto Condensed, uppercase, `color: #c0392b`) above sections
- **Bordered cells/tables** with `1px solid var(--border)` — no card shadows
- **Data-dense layout**: prefer tabular/grid displays over spacious cards
- **No dark sidebar panels** — all columns use the same cream background, separated by lines only
- **Red accent** for active states, hover indicators (→ arrows), important values

### Typical inner page structure:
```
NAV
─── Page Title (Playfair italic, large) ───
Red kicker + section header
[Data grid / table / list with border cells]
[Secondary section if applicable]
```

---

## Logo Usage

- File: `Logo TTT.png` (TTT initials inside a football oval)
- Homepage masthead: `width: 90px`, `mix-blend-mode: multiply` (removes white background on cream)
- Navbar: not shown (text-only nav)
- Favicon: can use the logo

---

## What Does NOT Change

- Page routing and URL structure
- Data fetching / Supabase queries
- Component file locations
- Next.js app structure
- `lib/` files (constants, queries, supabase client)

---

## Out of Scope

- Mobile-specific redesign (responsive adjustments are allowed but mobile-first redesign is not the focus)
- Dark mode toggle
- Animation/transitions beyond simple hover states
