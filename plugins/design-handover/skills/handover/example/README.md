# Worked example: the Loans page

A small, made-up example of a handover written against
[`design-handover.md`](../design-handover.md), so you can see the shape before producing your own.

**The product:** *Shed*, a neighbourhood tool library. Members borrow drills, ladders and hedge
trimmers; volunteers track who has what. This example hands over one screen: **Loans**, the list of
everything currently out.

```
example/
  designs/
    loans.html            THE INPUT · the design as it came out of the design tool
  docs/design/loans/      THE OUTPUT · the handover, written against the spec
    README.md
    spec.md
    parts/
      inventory.md
      p01-status-pill.md
      p02-filter-chip.md
      p03-loan-row.md
    behaviour.md
    findings.md
    data.md
    artefacts/
      README.md
      sheet.css
      parts/p01-status-pill.html
      parts/p02-filter-chip.html
      parts/p03-loan-row.html
      screens/loans-1280.html
```

**What to look at first:**

1. Open `designs/loans.html`. That's all a builder would normally get: one picture of one state.
2. Open `artefacts/parts/p02-filter-chip.html`. Every state of one part, side by side, labelled, with
   the reason for each. Nothing to hover or click.
3. Read `behaviour.md`. Eight questions the picture couldn't answer, and who answered them.
4. Read `findings.md`. Where the design disagreed with the project's own rules, raised rather than
   quietly fixed.

It's deliberately small: one screen, three parts. A real handover has more parts, but not more kinds
of file.
