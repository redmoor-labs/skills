# Redmoor Labs skills

Claude skills I've built for real client work, cleaned up and shared. Each one came out of something
that cost time on a real project.

## Install

In Claude Code, add the marketplace once:

```
/plugin marketplace add redmoor-labs/skills
```

Then install whichever skills you want:

| Skill | What it does | Install |
|---|---|---|
| [design-handover](plugins/design-handover/README.md) | Turns visual designs (Claude Design, Figma, mockups) into a handover a coding agent can build from without guessing | `/plugin install design-handover@redmoor` |
| [decision-queue](plugins/decision-queue/README.md) | Queues the decisions an agent needs from you in a side panel, by urgency, so it stops blocking on you. Uses Claude Code's early-access mod API | `/plugin install decision-queue@redmoor` |

Each skill's README also covers installing by hand and using it in claude.ai.

## Feedback

These have been used hard on one project each, and not much anywhere else yet. If something doesn't
hold for you, open an issue.

## Licence

MIT. George Thomas, [Redmoor Labs](https://redmoor.io).
