**Status** binding · **Life** living · **Reader** whoever breaks Loans into components, before building

# Loans: parts inventory and decomposition map

## 1 · Inventory

| ID | Part | Appears in | Variants | Varies by |
|---|---|---|---|---|
| [P01](p01-status-pill.md) | Status pill | loan row (status column) | 4: on loan · due today · overdue · returned | treatment |
| [P02](p02-filter-chip.md) | Filter chip | filter band (×4) | 1 | content (the four chips differ only in words and count) |
| [P03](p03-loan-row.md) | Loan row | loans list | 1, with 2 content shapes: *standard* · *with note* | content shape (a note adds a second line under the borrower) |

**Not a part, and why:**

- *"Due today" chip vs "Overdue" chip*: same part, different words. One row (P02).
- *"On loan" pill vs "Overdue" pill*: different treatment, so they're variants of P01, not two parts.
- *Mark returned button*: the project's existing **secondary button**, unchanged. Mount it.

## 2 · Regions owned outside this handover

| Region | Owner |
|---|---|
| Top bar and nav | app shell (existing) |
| Page title | existing `PageHeader` |
| Mark returned button | existing secondary button |
| Confirm dialog | existing confirm dialog (`B05`) |

Every region of the screen is now either a part above or one of these.

## 3 · Decomposition map (a proposal)

```
LoansPage
├── PageHeader            (existing)
├── FilterBand
│   └── P02 FilterChip ×4
└── LoanList
    └── P03 LoanRow ×n
        ├── P01 StatusPill
        └── SecondaryButton (existing)
```

| Part | Built from | Used in |
|---|---|---|
| P01 | nothing (primitive) | P03 |
| P02 | nothing (primitive) | FilterBand |
| P03 | P01, SecondaryButton | LoanList |

**Owned by the builder, not this map:** whether `FilterBand` already exists elsewhere, build order,
and where filter state lives (but see `B04`: the band owns selection, not the chip).
