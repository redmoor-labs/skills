**Status** illustrative · **Life** closed · **Reader** anyone opening a sheet

# Loans: artefacts

| File | Shows |
|---|---|
| `parts/p01-status-pill.html` | all four pill variants |
| `parts/p02-filter-chip.html` | every chip state, at 1280 and 375 |
| `parts/p03-loan-row.html` | both content shapes and every row state, at 1280 and 375 |
| `screens/loans-1280.html` | the parts assembled. **Values are not taken from here** |

Every specimen carries `data-part`, `data-state` and `data-breakpoint`, so a tool can select it
without searching for its text.

## Fidelity disclosure

- **Fonts:** the sheets use the system UI font and `ui-monospace`. The product uses Inter and
  JetBrains Mono, so text widths here are approximate.
- **Data:** all made up.
- **Not shown:** motion (120ms transitions on the chip), the confirm dialog, the toast.

## Breakpoints

- **1280:** real target.
- **375:** real target. Volunteers use phones on Saturdays.
- **768:** must not break; not separately designed.
