**Status** binding · **Life** living · **Reader** whoever builds Loans, and whoever owns the colour rules

# Loans: findings

Where the design disagrees with something that already exists. Raised, not quietly fixed.

## F01 · The design uses red for "Overdue"; this project reserves red for errors

- **What disagrees:** `designs/loans.html` draws the *Overdue* pill in `--red-600` on `--red-50`. The
  project's colour rule (spec §2.2) says red means *something went wrong in the system*, and nothing
  else.
- **Why it matters:** an overdue drill isn't an error. If overdue is red, a real error banner on the
  same page loses its meaning.
- **Alternative taken:** amber, the same as *Due today*, at weight 700 so overdue reads as stronger.
  See P01.
- **Still to decide:** whether overdue needs a third colour. Owner said amber is fine "for now".

## F02 · The design's chip has no focus treatment

- **What disagrees:** the design tool export has no focus style anywhere. The project requires a
  visible focus outline on every interactive element.
- **Alternative taken:** the project's standard `--color-focus` outline (spec §2.2).
- **Still to decide:** nothing.
