# Design handover: from pictures to something a coding agent can build

The spec behind the `handover` skill. It also works on its own as a prompt. Give it to a coding agent (Claude Code, Cursor, Codex…) with your
designs, and it produces a handover that can be built **without anyone reverse-engineering the
pictures**.

**How I use it:** I design in Claude Design, then use this to carry the design into Claude Code.

**Also works when:**
- you designed something yourself (Claude Design, Figma, a screenshot, a sketch) and want a coding
  agent to build it properly;
- you're a designer handing off to developers who work with AI;
- you're a designer who wants your work built well, not "roughly like the mockup";
- you're an engineer who has been handed a Figma file and needs to know what it actually says.

Every rule below came from something that cost real time on a real project. The cost is given with
each rule, so you can argue with the reason rather than the rule.

---

## How to use it

Paste this into your agent:

```
Read spec.md. Then look at the designs in <path, export or screenshots>.
Produce the handover it describes, in docs/design/<area>/.
Where the designs don't answer something, don't guess: list it as a question for me,
and wait for my answers before you mark it closed.
```

To see what comes back, look at [`example/`](example/README.md): a made-up Loans screen, the design that went in, and the full handover that came out.

Then answer its questions. **That conversation is most of the value.** A picture can't tell anyone
what happens when a list is empty, and neither can an agent looking at one.

### Instructions for the agent

- **Never invent a value.** If a size, colour or state isn't stated or measurable from the source,
  mark it *open* and ask. A plausible guess is worse than a gap, because nobody can see it.
- **Say where every value came from:** stated by the human, measured from source (HTML/CSS, Figma
  inspect), or read off a picture (lowest confidence: flag it).
- **Ask, don't infer, for the behavioural register (§7).** Put the questions to the human in one
  batch, then record their answers.
- **Run the checklist (§13) at the end** and report every *no* as a named gap.

---

## 0 · The one rule everything else serves

**State, at the top of the handover, what binds and what is just a picture.**

For example: *the state tables and stated values bind; example content is illustrative; where the
spec and a picture disagree, the spec wins; where the spec is silent, the picture is the reference.*

Without that sentence every value is ambiguous, and the ambiguity is invisible. Nobody can see that
they're guessing.

**Corollary: silence is the thing a reader can't notice.** A spec that speaks confidently about nine
things and says nothing about a tenth reads exactly like a complete spec. §11 exists because of this.

---

## A · What files come back

A handover is not one document. Use a **spine plus leaves**: the spine is read once to understand the
system; a leaf is read when you're building that one thing.

```
docs/design/<area>/
  README.md            index: what came back, reading order, status of each file
  spec.md              BINDING · the §0 rule, scope, interaction language,
                       token gaps, vocabulary mapping, accessibility floor
  parts/
    inventory.md       the parts inventory (§2.1) + decomposition map (§2.2)
    p01-<slug>.md      one file per part, using the ten-heading template (§4)
    p02-<slug>.md
  behaviour.md         the behavioural register (§7): questions, answered
  findings.md          disagreements, with named alternatives (§10)
  data.md              example content + what test data must exist (§8)
  artefacts/
    README.md          fidelity disclosure, breakpoints, what each file shows
    parts/<slug>.html  one part sheet per part (§11.1)
    screens/<slug>.html  composition sheets (§11.2)
```

**Every file declares three things in its first five lines:**

| Declaration | Options | Why |
|---|---|---|
| Status | binding · illustrative | §0's rule, per file |
| Life | living · closed | whether a later reader may extend it or must start their own |
| Reader | who picks this up, and when | a file with no reader is a file nobody maintains |

**Every part, question, finding and gap gets a stable ID** (`P07`, `B12`, `F03`, `T05`), assigned
once and never reused or renumbered. Cite by ID *and* link, never a bare number.

> *Why:* two pieces of work extended the same numbered list in parallel. The second to merge
> renumbered it, and rows 33–38 silently became 36–40. Meanwhile dozens of code comments justified
> decisions by citing "row 28".

**A file past ~400 lines is doing two jobs.** Split it. And a document people read to make decisions
must not also be where a log accumulates: amendments go at the end.

> *Why:* the one defect found in an 800-line spec was a merged table row three-quarters of the way
> down, hiding three decisions in one. Nobody proofreads row 40 of table 9.

---

## 1 · Scope: a closed list

List the surfaces designed, and the containers each one appears in (page, drawer, modal…). Then
state what is **deliberately not designed**, and what happens if it's needed.

**Test:** anyone can answer "is this screen in the handover?" with yes or no, without judgement.

> *Why:* naming the out-of-scope areas is the only reason nobody built a half-version of them.

---

## 2 · Parts, not screens

### 2.1 The parts inventory

List every **visually distinct part**, not every screen. Per part:

| Field | Content |
|---|---|
| Name | what it's called, used everywhere after |
| Appears in | every screen and region it appears in, not just the first |
| Variants | how many *real* variants it has |
| Varies by | **treatment**, **content**, or **content shape** |

- **Different words are not a variant.** Two regions showing different text are one part.
- **Different treatment is a variant** of one part.
- **Different structure is a content shape**: e.g. a history entry that adds a `before → after`
  pair. One part, with named shapes.

**Test:** every region of every screen is covered by a part in this list, **or** by a named owner
outside the handover ("that's the existing data grid; don't build a second one").

> *Why:* a handover that gave screens instead of parts got the same bordered button built **three
> times, privately, slightly differently**, before anyone noticed it was one part. Another screen was
> built as a single 600-line component, reviewed three times, with each review missing what the next
> one found. The owner's diagnosis: *"we kind of just one-shotted it."* The inventory is what stops it
> being one shot.

### 2.2 The decomposition map

A proposal, not a binding: which parts are built from which. Per part, *built from* and *used in*. A
part built from nothing is a primitive; say so.

The designer is uniquely placed to decide:
- whether two regions on two screens are **the same part**;
- whether a difference is **treatment or content**.

The developer still decides whether a part **already exists** in the codebase, the build order, and
which part owns state.

**Test:** every part is defined exactly once, used any number of times, and there are no cycles.

---

## 3 · The interaction language: rules across every part

State these once, so they aren't re-derived per part:

- **Type and density**: one row per *role*, never per appearance.
- **Focus**: the treatment, and where it differs from what exists.
- **Numbers and identifiers**: font, alignment, tabular figures.
- **Truncation**: what truncates, where, and how to see the full value.
- **Empty, loading, error**: the wording, and which is which.
- **Disabled vs not permitted**: different states, and they must look different.
- **Icons**: the set, and its licence.
- **Colour**: what each colour may mean, and what it must never mean.

> *Why one role per row:* a type table opened with *"Screen title, record ID, section headings — Bold
> 16–34px"*. Three roles on one line, and two were wrong: the designs actually drew the ID in a mono
> font and the section heading as a small uppercase label. **The disagreement was invisible in a
> screenshot.** A merged row doesn't state a decision, it hides three.

---

## 4 · One spec per part, against a fixed template

```
## P## · <PartName>

1.  Purpose        — one line: what it is for
2.  Anatomy        — the sub-parts, named, in DOM order
3.  States         — every state: default · hover · focus · active · selected ·
                     disabled · not-permitted · empty · loading · error
4.  Values         — per state: type, size, weight, colour, spacing, border,
                     radius, shadow, motion (see §5)
5.  Interaction    — what a click does, what a drag does, single or multi-select
6.  Keyboard       — tab stops, arrows, Enter / Escape / Backspace,
                     and WHO OWNS the keyboard: the part, or its container
7.  Breakpoints    — what changes at each width, and what is REMOVED
8.  Failure states — the error or contradictory state, and how it's reached
9.  Reuse          — the parts it's built from, and where it's used
10. Open           — what the designer couldn't settle
```

**Test:** every part has an entry, with all ten headings, including the ones that say "n/a" and why.

> *Why heading 6 names an owner:* on one feature, the container owned the keyboard, computed the
> summary text, and the child was forbidden to know the field it filtered. Three facts that decided
> the whole component tree, all of them *inferred*. Inferred wrong is a rebuild, not a patch.

---

## 5 · Values: written, not drawn

**This is the biggest ask of the designer, and it removes the most work from the builder.**

Every value is **written as text**. A picture showing a 2px border is not a statement that the border
is 2px. Where a design token exists, name it. Where it doesn't, add it to the gap list (§6). A bare
number with neither is incomplete.

**Test:** someone can build the part without opening a picture. The picture should confirm, never
inform.

> *Why:* a component was signed off as **done** against a screenshot that looked right. The first
> diff of computed styles found five wrong choices, including **a 2px border invented from a picture
> that had no border anywhere**. A sweep found six more. Recovering values from pictures became an
> entire stage of the workflow, costing millions of tokens on one feature. This section moves that
> work to the cheap end.

---

## 6 · Token gaps, name mapping, component deviations

Three separate tables.

1. **Token gaps.** Values the design needs that existing tokens don't express. *Need · value ·
   note.* A gap is a list entry. The designer doesn't edit the token files.
2. **Name mapping**, whenever the design tool and the codebase name things differently
   (`--radius-md` vs `--corner-md`). **Name the layer, not just the token**: some tokens resolve in
   one part of an app and not another, and that failure looks exactly like a typo except the build
   won't catch it. Include a row for anything that exists on only one side.
3. **Component deviations.** Where the design uses a component the codebase can't use as-is: why,
   and what its values are.

> *Why:* a design built against one naming system had **no equivalent at all** for the codebase's
> control-border token, so every input silently lost its border.

**Test:** no value reaches the builder as a name that doesn't resolve in the codebase.

---

## 7 · The questions a picture can't answer

A numbered list of **questions with forced answers**, each answered by a person. Not "the picker
supports selection" but *"can someone pick more than one value, on every field or only some?"*

Ask these once per screen, and again per part only where the answer differs:

| # | Question | Why a picture can't answer it |
|---|---|---|
| 1 | What does it do when it holds nothing? Is an empty or zero state inert, or does it still respond to a click? | A static picture shows a greyed row and can't tell you which |
| 2 | How many things can be chosen, and by whom? | Easily confused with how much data there is |
| 3 | Who owns the keyboard, and what does each key do? | Nothing in a picture implies a tab order |
| 4 | What changes at the smallest screen size, and what is **removed**? | And whether removing it strands a journey with no other route |
| 5 | What is the failure or contradictory state, and how do you get there? | If no real path reaches it, it can't be tested |

Questions an existing doc already answers are closed by citing it, so the list stays short enough to
read.

**Test:** every row has an answer, and it came from a person, not a plausible guess.

> *Why:* four questions of exactly this shape went unasked on one feature. Up front, each would
> have taken a minute. Afterwards, they cost **four review rounds** of work already built on the
> wrong answer, and two had to be unwound rather than patched.

---

## 8 · Example content and test data

1. **Where the example content came from**, so it's reproducible, and a plain statement that no
   example value is a requirement.
2. **The data obligation:** every field, option and state the screen can show must have data behind
   it. Name the fields and what must be non-empty.

**Test:** every state in §4 has data that reaches it.

> *Why:* a filter panel offered 35 fields against test data that answered 4. Most choices led to a
> blank pane, and one count was always zero, while **hundreds of unit tests stayed green**, because
> each part was only ever tested on its own.

---

## 9 · The accessibility floor

Contrast minimums, target sizes at each breakpoint, focus visibility, and what a screen reader should
announce for each interactive part.

**Say which of these the designer verified and which they're asserting.** "Checked with a screen
reader" and "structured correctly" are different claims, and the difference is invisible afterwards.

---

## 10 · Findings: raised, never absorbed

Where the design disagrees with an existing doc, a built screen or a past decision, write it up as a
**finding with a named alternative**, never a silent change. What disagrees with what, the
alternative chosen, and what still needs deciding.

When a finding goes out of date, annotate it. Don't rewrite it: *"a finding edited to agree with the
code is a finding that never taught anybody anything."*

---

## 11 · The rendered artefacts

Pictures are still wanted: they answer the spec's silences. But **how they arrive decides what they
cost.** Most handovers send lots of finished screens and one components file. It should be the other
way round.

### 11.1 Part sheets: one per part, and the main artefact

For every part, an HTML sheet showing **every state from §4, all visible at once.**

- **Every state is a static example.** Draw the hover state; don't leave it to be found by hovering.
- **Every state is labelled** in text, with the same name §4 uses.
- **Every variant at every real breakpoint.**
- **The reasoning on the card:** a line or two on why it looks the way it does.
- **Edge cases, not just happy ones:** longest realistic content, empty, zero, the failure state.

**Test:** open one sheet and every state of that part is on screen without clicking anything.

### 11.2 Screen sheets: secondary

The parts assembled into real screens, for layout, density, order and overflow. State at the top that
**values are not taken from here**: values come from §5, states from the part sheets.

### 11.3 Make every example selectable

The cheapest thing on this list. Every example carries stable attributes:

```html
<div data-part="filter-chip" data-state="selected" data-breakpoint="1280"> … </div>
```

> *Why:* without them, a tool comparing the build to the design has to find elements by searching for
> their text and guessing. It guessed wrong four times, and one confident diff against the wrong
> element was written up as fact. Attributes turn that guess into a lookup.

### 11.4 Format

- **Readable source:** HTML and CSS a person can open and diff. Not a bundled export where a script
  writes the page at runtime, so search finds nothing.
- **Small enough to keep in the repo.** Files at a path outside the repo die at handover.
- **One file per part sheet**, so a change produces a diff naming that part.
- **A fidelity disclosure:** what the artefacts show that the real build won't (substitute fonts,
  mock data), and vice versa. Make it checkable: on one project the disclosure itself was wrong, and
  nobody knew for three days.
- **Which breakpoints are real targets** and which just mustn't break.

---

## 12 · What NOT to include

- **CSS class strings** (e.g. Tailwind). Get the look right; the builder translates it using §6.
- **Edits to the token files.** A gap is a list entry.
- **A rationale longer than the thing it justifies.** Put rulings in a decision record.

---

## 13 · The acceptance checklist

Run by the builder (or the agent) when the handover arrives. A **no** isn't a rejection: it's a gap,
named before work starts instead of discovered during the build.

| # | Check | § |
|---|---|---|
| 1 | What binds vs what's illustrative is stated at the top | §0 |
| 2 | Spine-plus-leaves, in one folder with a README | §A |
| 3 | Every file declares status, life and reader | §A |
| 4 | Every part, question, finding and gap has a stable ID | §A |
| 5 | Scope is a closed list, and what's *not* designed is named | §1 |
| 6 | A parts inventory covers every region of every screen | §2.1 |
| 7 | A decomposition map defines every part once, with no cycles | §2.2 |
| 8 | No type row names more than one role | §3 |
| 9 | Every part has all ten headings | §4 |
| 10 | Every part's keyboard model names an owner | §4 |
| 11 | Every value is written as text and resolves to a token or a gap | §5 |
| 12 | A name mapping exists, if the design was made in another system | §6 |
| 13 | Every behavioural question has an answer from a person | §7 |
| 14 | Every state has data that reaches it | §8 |
| 15 | Accessibility claims separate verified from asserted | §9 |
| 16 | Disagreements are findings with named alternatives | §10 |
| 17 | One part sheet per part, every state static and labelled | §11.1 |
| 18 | Every example is selectable by `data-part` / `data-state` | §11.3 |
| 19 | Artefact source is readable without a browser, one file per part | §11.4 |
| 20 | No class strings | §12 |

**If checks 6, 9, 11 and 17 pass, nobody needs to measure the pictures**, and the work goes straight
from breakdown to building. That's the whole point of this document.

---

*A spec that has never been used is a draft. This one was amended five times by the first handover
written against it, within six hours of being merged. If you use it and something doesn't hold,
that's a finding: tell me.*
