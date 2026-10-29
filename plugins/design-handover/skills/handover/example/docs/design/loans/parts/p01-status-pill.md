**Status** binding · **Life** living · **Reader** whoever builds the status pill

## P01 · StatusPill

1. **Purpose** — shows where a loan is in its life, in one word.

2. **Anatomy** — one element: the label. No icon, no close.

3. **States** — not interactive. Four variants (treatment), no interaction states.
   *default* only; *hover · focus · active · selected · disabled · not-permitted · loading* are n/a
   because it can't be pressed. *empty* and *error*: n/a, every loan has a status.

4. **Values**

   | Variant | Label | Background | Text | Notes |
   |---|---|---|---|---|
   | on-loan | On loan | `--color-accent-weak` | `--color-accent` | |
   | due-today | Due today | `--color-warn-weak` | `--color-warn` | |
   | overdue | Overdue | `--color-warn-weak` | `--color-warn` | **weight 700**, not red: see `F01` |
   | returned | Returned | `--color-surface` | `--color-muted` | 1px `--color-line` border |

   All variants: `--type-xs` UI 12/16 weight 600 (overdue 700); padding 2px 10px; radius
   `--radius-pill`; height 20px; no shadow; no motion. Width fits the label; never stretches.

5. **Interaction** — none. It's a label, not a button.

6. **Keyboard** — not a tab stop. Owner: n/a.

7. **Breakpoints** — unchanged at 375. Nothing removed.

8. **Failure states** — none reachable: status is derived from dates and can't be missing (`B07`).

9. **Reuse** — primitive. Used in P03.

10. **Open** — nothing.
