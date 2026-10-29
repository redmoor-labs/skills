---
name: handover
description: Turn visual designs (a Claude Design export, Figma, HTML mockups or screenshots) into a structured design handover a coding agent can build from without guessing. Breaks the design into parts, writes every state and value as text, asks the human the questions a picture can't answer, and renders static part sheets. Use when handing a design to a coding agent or developer, or when asked to spec, hand over or "make buildable" a design.
---

# Design handover

Turn designs into a handover that can be built **without anyone reverse-engineering the pictures**.

## Rules that never bend

1. **Never invent a value.** If a size, colour or state isn't stated by the human or measurable from
   source (HTML/CSS, Figma inspect), mark it *open* and ask. A plausible guess is worse than a gap,
   because nobody can see it.
2. **Say where every value came from:** *stated* (by the human), *measured* (from source) or *read
   off a picture* (lowest confidence; flag it).
3. **Ask, don't infer, the behaviour questions.** Put them to the human in one batch and record
   their answers. A question with no human answer stays open.
4. **Raise disagreements as findings.** If the design breaks an existing rule in the codebase, write
   a finding with an alternative. Never silently fix it, never silently follow it.

## Workflow

1. **Find the inputs.** Ask for the designs (path, export or screenshots) and the *area* name. Check
   whether the codebase has design tokens and existing components; note what exists.
2. **Read [spec.md](spec.md).** It defines every file and every rule. Don't work from memory of it.
3. **If unsure what "good" looks like, read [example/](example/README.md)**: a small Loans screen,
   the design that went in, and the full handover that came out. Match its level of detail, not its
   content.
4. **Inventory parts, not screens** (spec §2). Decide which regions are the same part, which
   differences are treatment vs content, and which regions belong to existing components.
5. **Draft values from source** (spec §5–§6). Prefer HTML/CSS or design-tool inspect over pictures.
   Map design-tool names to codebase tokens; list gaps.
6. **Ask the human** the behaviour questions (spec §7), plus anything you marked *open*, in one
   batch. Wait for answers.
7. **Write the handover** into `docs/design/[area]/` using [templates/](templates/). One file per
   part. Stable IDs (`P01`, `B01`, `F01`, `T01`), never renumbered.
8. **Render the part sheets** (spec §11): every state static and labelled, with `data-part` /
   `data-state` / `data-breakpoint`. Open or screenshot them and check they match the spec; fix
   any mismatch (or raise it as a finding).
9. **Run the checklist** (spec §13). Report every *no* as a named gap, at the top of the area README.

## Output

```
docs/design/[area]/
  README.md  spec.md  behaviour.md  findings.md  data.md
  parts/inventory.md  parts/p01-[slug].md …
  artefacts/README.md  artefacts/sheet.css
  artefacts/parts/[slug].html  artefacts/screens/[slug].html
```

Finish with a short summary for the human: parts found, questions still open, findings raised, and
checklist gaps.
