# Design handover

**A Claude skill that turns visual designs into something a coding agent can build without
guessing.**

You design a screen in Claude Design, Figma or anything else. You hand the picture to a coding
agent. It builds something that looks *roughly* right: a border that isn't in the design, a button
built three times slightly differently, an empty state nobody asked about.

This skill sits in between. It breaks the design into **parts, not screens**, writes every state and
value down **as text**, asks you **the questions a picture can't answer** (what happens when the
list is empty? what disappears on a phone?), and renders **every state of every part side by side**
so you can check it at a glance.

I use it to take designs from Claude Design into Claude Code.

## What it produces

```
docs/design/[area]/
  README.md          index, reading order, checklist gaps
  spec.md            what binds, scope, type and colour rules, tokens, accessibility
  parts/             one file per part, against a fixed ten-heading template
  behaviour.md       the questions a picture can't answer, and who answered them
  findings.md        where the design disagrees with existing rules
  data.md            the test data every state needs
  artefacts/         HTML part sheets: every state, static, labelled
```

See the [worked example](plugins/design-handover/skills/handover/example/README.md): a made-up Loans
screen for a tool library, the design that went in, and the full handover that came out.

## Install

**Claude Code, as a plugin:**

```
/plugin marketplace add [github-user]/design-handover
/plugin install design-handover@redmoor
```

Then ask for a design handover, or run `/design-handover:handover`.

**Claude Code, by hand:** copy `plugins/design-handover/skills/handover/` to
`~/.claude/skills/handover/`.

**claude.ai or Claude Desktop:** zip the `handover/` folder and upload it under Settings as a custom
skill (needs code execution enabled).

**Anything else:** give your agent `spec.md` and your designs, and ask it to produce the handover it
describes.

## Using it

```
Make a design handover for the designs in ./exports/settings. Area: settings.
```

It will read the spec, break the design into parts, then **stop and ask you** a short batch of
questions. Answer them. That conversation is most of the value.

## Where this came from

Every rule in [`spec.md`](plugins/design-handover/skills/handover/spec.md) came from something that
cost real time on a real project: a component signed off against a screenshot with a border that
wasn't in the design, the same button built three times, a filter panel with 35 options and data
behind 4. The cost is written next to each rule, so you can argue with the reason rather than the
rule.

It's been used for about a dozen handovers on one project. It hasn't been used anywhere else yet.
**A spec that's never been used is a draft**: if something doesn't hold for you, open an issue.

## Licence

MIT. George Thomas, [Redmoor Labs](https://redmoor.io).
