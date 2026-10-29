**Status** binding · **Life** living · **Reader** whoever builds the filter chips

## P02 · FilterChip

1. **Purpose** — narrows the loans list to one group, and shows how many loans are in it.

2. **Anatomy** — in DOM order: label · count.

3. **States** — default · hover · focus · selected · selected+focus · zero-count · loading.
   *active*: same as hover. *disabled*: n/a (`B01`: zero-count chips stay pressable).
   *not-permitted*: n/a, every volunteer can filter. *error*: n/a, see loading.

4. **Values**

   | State | Background | Border | Label | Count |
   |---|---|---|---|---|
   | default | `--color-surface` | 1px `--color-line` | `--color-ink` | bg `#eef1f4` (`T01`), text `--color-ink` |
   | hover | `--color-surface-weak`* | 1px `--color-muted` | `--color-ink` | as default |
   | focus | as current | as current | as current | + 2px `--color-focus` outline, 2px offset |
   | selected | `--color-accent-weak` | 1px `--color-accent` | `--color-accent` | bg `--color-surface`, text `--color-accent` |
   | zero-count | `--color-surface` | 1px `--color-line` | `--color-muted` | text `--color-muted`, shows `0` |
   | loading | as default | as default | as default | count replaced by a 16 × 12px `--color-line` block, no number |

   \* `--color-surface-weak` is the `T01` gap.

   All states: height 32px; padding 0 12px; gap 6px; radius `--radius-pill`. Label `--type-sm` UI
   13/18 weight 500. Count `--type-xs` **mono** 12/16, padding 0 6px, radius `--radius-pill`,
   tabular figures. No shadow. Motion: background and border 120ms ease-out; nothing else animates.

5. **Interaction** — click selects this chip and deselects the others. **One chip is always
   selected** (`B04`); clicking the selected chip does nothing.

6. **Keyboard** — **the band owns the keyboard, not the chip.** The band is one tab stop
   (`radiogroup`). Left / right arrows move selection and focus together. Home / End go to first /
   last. Enter and Space do nothing extra (selection already moved). Escape: nothing.

7. **Breakpoints** — at 375 the band scrolls horizontally; chips never wrap or shrink. The selected
   chip scrolls into view. Nothing is removed.

8. **Failure states** — counts fail to load: chips stay usable with no number (the *loading* treatment
   persists). Reached by the counts request failing; the list itself still loads (`B03`).

9. **Reuse** — primitive. Used ×4 in FilterBand.

10. **Open** — nothing.
