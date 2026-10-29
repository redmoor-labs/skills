# decision-queue

A Claude Code mod that keeps the decisions an agent needs from you in one queue per session, and gives you a pane to triage and answer them.

The agent still prints each decision in the chat as it always has. The mod adds a record beside it, which the agent keeps current as the work moves. That gives you somewhere to see what is open, how urgent each item is, and what was settled and by whom.

## What it adds

- **Four tools the model calls.**
  - `decision_ask` files a decision and returns the block to print. It refuses one that is not answerable cold: fewer than two options, no recommendation, no "wrong if".
  - `decision_update` revises an open decision.
  - `decision_resolve` closes one as answered (in the chat, or by default at its deadline), withdrawn, or superseded.
  - `decision_list` reads the queue back, for example after the context has been summarised.
- **A short protocol in the system prompt.** It covers when something is a decision, how to write one for a reader who has read nothing, the urgency classes, and keeping the queue true.
- **`/decisions`**, a pane with two screens.
  - **The list** shows every decision as one row: how urgent it is, its id, its title, its kind and its age. Three controls change the view: **Show** (open, blocking, all, closed), **Group** (by urgency, by kind, or none) and **Sort** (by urgency, newest or oldest). The `f`, `g` and `s` keys press them.
  - **The detail screen** opens when you press a row. It sets out the decision in labelled sections, with previous and next buttons and a way back to the list. There you can:
    - **pick an option**, optionally with a note;
    - **answer in words** by typing in the note field and pressing Enter;
    - **mark it not needed**;
    - **ask for a revision**: the note goes to the agent, and the agent rewrites the decision.

  An answer from the pane reaches the agent straight away. If a turn is running, it is added to that turn; otherwise it is submitted as a prompt. An answer added after the turn's last tool call would go unread, so it is submitted again when the turn ends.
- **A status-line count** of open decisions. A toast appears when one is filed, and a notification when one is blocking (`needed: now`) or could change the plan.

## Urgency

| `needed` | The agent… |
|---|---|
| `now` | stops after filing |
| `before` | works on until the step named in `when`, and stops there if the decision is still open |
| `default` | proceeds on its recommendation now. The choice stays reversible until `when`, and is closed as "answered by default" if nobody answers by then |
| `whenever` | carries on; nothing is blocked yet |

`kind` is `gate`, `shaping`, `plan-changing` or `minor`. The protocol tells the agent that a default never stands in for an approval you must give yourself.

## Where the record is

One JSON-lines file per session: `~/.claude/decision-queue/<session-id>.jsonl`, or under `$DECISION_QUEUE_DIR` when that is set. It is an append-only event log (ask, revise, answer, withdraw, supersede, revision-asked), so a decision's history survives its revisions. The pane folds the log into the current state. Nothing leaves the machine.

**Conditions.** Written against Claude Code 2.1.306's mod API, which is early access and may change between releases. The pane draws in the terminal and in the Claude desktop app's own Code sessions, but not when you drive a session through Remote Control: answer decisions in the chat there instead. On mobile it says to answer elsewhere. The log is keyed by session id. A resumed session finds its log only if Claude Code resumes it under the same id, which has not been verified.

## Sending decisions to a hub

Set `DECISION_QUEUE_HUB` to a hub's base URL, for example in the `env` block of `~/.claude/settings.json`. Every session then sends its decisions to the hub and takes answers from it, so you can answer the decisions of every session from one page. Leave it unset and nothing leaves the machine.

The log on disk stays the record. A session that has filed nothing makes no requests. A hub that is down never stops a tool: the mod logs it once and catches up when the hub is back.

The protocol is three calls, all JSON, with `{session}` being the Claude Code session id:

| Call | When | Body |
|---|---|---|
| `PUT {hub}/v1/sessions/{session}` | every change to the log | `{ where: { cwd, branch?, head? }, events: [...] }`: the whole event log, the same events as the file on disk |
| `GET {hub}/v1/sessions/{session}/inbox` | every 5 seconds, once the session has filed something | the reply: `{ items: [{ seq, id, action, choice?, text? }] }`, where `action` is `answer`, `withdraw` or `revise` (`revise` needs `text`) |
| `POST {hub}/v1/sessions/{session}/inbox/ack` | after applying the inbox | `{ upTo: seq }`: the hub drops those items |

The mod applies an inbox item just as it applies the same action in the pane, recorded as `by: "hub"`. An item for a decision that is no longer open is skipped: the first answer recorded wins, and the next `PUT` shows the hub that the decision is closed.

## Install

```
/plugin marketplace add redmoor-labs/skills
/plugin install decision-queue@redmoor
```

Or try it without installing: `claude --plugin-dir /path/to/decision-queue`.

Then ask the agent for something with a real choice in it, and type `/decisions`.

## Develop

```bash
claude plugin validate .
claude plugin test .
bunx -p typescript@5.6.3 tsc -p .   # needs .claude-plugin/types, which the engine lays when it loads the mod
```
