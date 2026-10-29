// What the model reads: the protocol section and the four tools' schemas.

export const PROTOCOL = `# Decisions for the user: the decision queue

When you need the user to make a call, file it with \`decision_ask\` and then print the block it returns in your reply, as you would anyway. The queue is the record. The chat is still where the user reads it, so file it AND print it.

Only file a real decision: one where two answers lead to materially different work and nobody has chosen. A consequence of a choice already made, a question you can settle from the code, or "shall I continue" is not a decision. Settle those yourself and say so.

Write each decision for a reader who has read nothing: not your brief, not earlier messages, not the other decisions. Give a title, one sentence on what is at stake, the context that makes it a choice, lettered options with what each costs and leads to, and a recommendation with the reason and what would make it wrong. The test is the reply: if "1B, 2A" would not be a complete answer, it is not a decision yet.

Say how urgent it is with \`needed\`:
- \`now\`: you cannot go on without it. Stop after filing.
- \`before\`: you can work on until a named step (\`when\`), and stop there if it is still open.
- \`default\`: you will proceed on your recommendation now. It stays reversible until \`when\`. Only use this when the choice is genuinely reversible, and never for anything you have been told needs the user's own approval.
- \`whenever\`: it does not block anything yet.

And what kind it is with \`kind\`: \`gate\` (an approval your instructions say the user must give), \`shaping\` (design input, usually with renders: put their links in \`artefacts\`), \`plan-changing\` (it could change the plan itself), or \`minor\`.

Keep the queue true as the work moves:
- When the facts behind an open decision change, call \`decision_update\` with the change and why, and reprint the block.
- When it stops mattering, resolve it as \`withdrawn\` with the reason. When a new question replaces it, file the new one, then resolve the old one as \`superseded\` by the new id.
- When the user answers in the chat, call \`decision_resolve\` with \`answered\`, their choice and their words verbatim, before acting on it. A reply like "1B, 2A" answers several decisions: resolve each.
- When a \`default\` decision reaches its \`when\` unanswered, resolve it as \`answered\` by \`default\` and say so in your reply. A default never stands in for an approval the user must give.

Answers given in the user's decision panel arrive as a message naming the decision. They are already recorded, so do not resolve them again: act on them. A "revise" request from the panel asks you to rewrite that decision with \`decision_update\`.

Use \`decision_list\` to see the queue, for example after your context has been summarised.`

const OPTION = {
  type: 'object',
  properties: {
    letter: { type: 'string', description: 'A, B, C …' },
    label: { type: 'string', description: 'The option in a line: what it is.' },
    detail: { type: 'string', description: 'What it costs, what it buys, and what happens next if it is picked.' },
  },
  required: ['letter', 'label'],
}

const RECOMMENDATION = {
  type: 'object',
  properties: {
    option: { type: 'string', description: 'The letter you recommend.' },
    reason: { type: 'string' },
    wrongIf: { type: 'string', description: 'What would make this recommendation wrong.' },
  },
  required: ['option', 'reason', 'wrongIf'],
}

const FIELDS = {
  title: { type: 'string' },
  stakes: { type: 'string', description: 'One sentence on what is at stake.' },
  context: { type: 'string', description: 'The facts needed to answer it cold. A path or an ID is a footnote, never the explanation.' },
  options: { type: 'array', items: OPTION, minItems: 2 },
  recommendation: RECOMMENDATION,
  needed: { type: 'string', enum: ['now', 'before', 'default', 'whenever'] },
  when: { type: 'string', description: 'For needed "before" or "default": the step or the time.' },
  kind: { type: 'string', enum: ['gate', 'shaping', 'plan-changing', 'minor'] },
  artefacts: { type: 'array', items: { type: 'string' }, description: 'Links to renders, pages or PRs.' },
}

export const TOOLS = [
  {
    name: 'decision_ask',
    description: 'File a decision for the user in the decision queue. Returns its id and the block to print in your reply.',
    inputSchema: {
      type: 'object',
      properties: FIELDS,
      required: ['title', 'stakes', 'context', 'options', 'recommendation', 'needed', 'kind'],
    },
  },
  {
    name: 'decision_update',
    description: 'Revise an open decision when its facts, options, recommendation or urgency change. Returns the revised block.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        reason: { type: 'string', description: 'What changed.' },
        changes: { type: 'object', properties: FIELDS },
      },
      required: ['id', 'reason', 'changes'],
    },
  },
  {
    name: 'decision_resolve',
    description: 'Close a decision: answered (by the user in the chat, or by default at its deadline), withdrawn, or superseded by another.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        outcome: { type: 'string', enum: ['answered', 'withdrawn', 'superseded'] },
        by: { type: 'string', enum: ['chat', 'default'], description: 'For answered: who answered.' },
        choice: { type: 'string', description: 'For answered: the letter chosen, if any.' },
        text: { type: 'string', description: "For answered: the user's words, verbatim. For a default: what you proceeded on." },
        supersededBy: { type: 'string', description: 'For superseded: the id that replaces it.' },
        reason: { type: 'string', description: 'For withdrawn or superseded: why.' },
      },
      required: ['id', 'outcome'],
    },
  },
  {
    name: 'decision_list',
    description: 'List the decision queue: every open decision in full, then the closed ones in a line each.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const
