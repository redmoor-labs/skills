**Status** index, nothing here binds · **Life** living · **Reader** anyone picking up the Loans
screen, before any other file here

# Loans: design handover

Delivered 29 Oct. Source: `designs/loans.html`, exported from the design tool, plus a 40-minute
review with the owner who answered `behaviour.md`.

**Loans** is the list of everything currently borrowed from the tool library, with filters for
what's due and what's late, and one act per row: *Mark returned*.

## Reading order

| File | Status | Life | Read it when |
|---|---|---|---|
| [spec.md](spec.md) | binding | living | first: the §0 rule, scope, interaction language, tokens, accessibility |
| [parts/inventory.md](parts/inventory.md) | binding | living | before breaking the screen into components |
| [parts/p01-status-pill.md](parts/p01-status-pill.md) | binding | living | building the status pill |
| [parts/p02-filter-chip.md](parts/p02-filter-chip.md) | binding | living | building the filter chips |
| [parts/p03-loan-row.md](parts/p03-loan-row.md) | binding | living | building a row |
| [behaviour.md](behaviour.md) | binding | living | a question the picture can't answer |
| [findings.md](findings.md) | binding | living | the design disagrees with an existing rule |
| [data.md](data.md) | illustrative (examples) · binding (test data) | living | writing fixtures |
| [artefacts/README.md](artefacts/README.md) | illustrative | closed | before opening a sheet |

## Status of each part

| ID | Part | Spec | Sheet | Open questions |
|---|---|---|---|---|
| P01 | Status pill | ✅ | ✅ | none |
| P02 | Filter chip | ✅ | ✅ | none |
| P03 | Loan row | ✅ | ✅ | B08 (see behaviour.md) |

## Amendments

| Date | Change |
|---|---|
| 29 Oct | Delivered |
