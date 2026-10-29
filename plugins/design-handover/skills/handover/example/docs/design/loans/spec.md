**Status** binding · **Life** living · **Reader** whoever builds Loans, first, before any part file

# Loans: spec

## 0 · What binds

**The values and state tables in this handover bind. Names, tools, dates and counts in the pictures
are examples. Where this spec and a picture disagree, the spec wins. Where the spec is silent, the
picture is the reference — and that silence is a gap: raise it.**

## 1 · Scope

**Designed (closed list):**

| Surface | Container | Notes |
|---|---|---|
| Loans list | full page, inside the app shell | at 1280 and 375 |

**Deliberately not designed:**

- **The app shell** (top bar and nav). It exists; mount it. Don't restyle it.
- **The loan detail page.** A row's tool name links to it; the page is out of scope.
- **"Mark returned" confirmation.** Uses the existing confirm dialog, unchanged (see `B05`).
- **Sorting.** The list has a fixed order (`B06`). If sorting is needed, ask: it's a new design.

## 2 · Interaction language

Stated once here; the part files only state where they differ.

### 2.1 Type: one role per row

| Role | Token | Font | Size / line | Weight |
|---|---|---|---|---|
| Page title | `--type-title` | UI | 24 / 32 | 700 |
| Tool name | `--type-base` | UI | 15 / 22 | 600 |
| Borrower line | `--type-sm` | UI | 13 / 18 | 400 |
| Due date | `--type-sm` | **mono** | 13 / 18 | 400 |
| Chip label | `--type-sm` | UI | 13 / 18 | 500 |
| Chip count | `--type-xs` | **mono** | 12 / 16 | 400 |
| Pill label | `--type-xs` | UI | 12 / 16 | 600 |

**Rule:** numbers and identifiers (dates, counts, member numbers) are mono with tabular figures, so
columns line up. Prose is not mono.

### 2.2 Other rules

- **Focus:** 2px `--color-focus` outline, 2px offset, on every interactive element. Never removed.
- **Truncation:** tool names truncate with an ellipsis at one line; the full name is in `title` and
  on the detail page. Borrower names never truncate (they're short; `B07`).
- **Empty / loading / error:** see `B01`–`B03`. Wording is in `data.md` §3.
- **Disabled vs not permitted:** *disabled* means "not now" (greyed, still focusable, tooltip says
  why). *Not permitted* means "not you" (hidden). Volunteers without the *returns* role don't see
  *Mark returned* at all.
- **Icons:** none on this screen.
- **Colour:** green = on loan / selected. Amber = needs attention soon. **Red is reserved for errors**
  in this project, which the design broke: see `F01`.

## 3 · Tokens

### 3.1 Token gaps

| ID | Need | Value used | Note |
|---|---|---|---|
| T01 | Chip count background | `#eef1f4` | no neutral-weak token exists; propose `--color-surface-weak` |

### 3.2 Name mapping

The design tool uses palette names; the codebase uses role names. Layer: everything below resolves
in `tokens/base.css`, which every page loads.

| Design name | Codebase name |
|---|---|
| `--green-600` | `--color-accent` |
| `--green-50` | `--color-accent-weak` |
| `--amber-700` | `--color-warn` |
| `--amber-50` | `--color-warn-weak` |
| `--red-600` | `--color-danger` (errors only; see `F01`) |
| `--grey-900` | `--color-ink` |
| `--grey-600` | `--color-muted` |
| `--grey-300` | `--color-line` |
| `--grey-100` | *none* → `T01` |
| `--font-num` | `--font-mono` |
| *none* | `--color-focus` (the design has no focus colour; use this) |

### 3.3 Component deviations

None. All three parts are new; nothing from the design tool's library is mounted.

## 4 · Accessibility floor

| Check | Verified or asserted |
|---|---|
| Text contrast ≥ 4.5:1 for all pill and chip text on their backgrounds | **verified** (contrast checker, all four pill variants and both chip treatments) |
| Targets ≥ 44 × 44px at 375 | **asserted**: chips are 32px tall and rely on 6px padding above and below the band. Check in the build |
| Focus visible on every interactive element | **verified** on the part sheets |
| Filter chips announce "Due today, 3 loans, selected" | **asserted**: structure is a `radiogroup`; not tested with a screen reader |
| Status is not conveyed by colour alone | **verified**: every pill has a text label |
