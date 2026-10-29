import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { fold, problems, queue } from '../hooks/model'
import type { Event } from '../types'

const ASK = 'mcp__decision-queue__decision_ask'
const UPDATE = 'mcp__decision-queue__decision_update'
const RESOLVE = 'mcp__decision-queue__decision_resolve'
const LIST = 'mcp__decision-queue__decision_list'

const DECISION: Record<string, unknown> & { options: { letter: string; label: string }[]; recommendation: Record<string, string> } = {
  title: 'Where the archive lives',
  stakes: 'Whether an audit can see a worker after its worktree is released.',
  context: 'Each session writes its own log.',
  options: [
    { letter: 'A', label: 'One log per machine' },
    { letter: 'B', label: 'One log per worktree' },
  ],
  recommendation: { option: 'A', reason: 'It outlives the worktree.', wrongIf: 'the log must travel with the journal.' },
  needed: 'whenever',
  kind: 'minor',
}

const PANE = {
  plugin: 'decision-queue',
  component: 'Pane',
  requestId: 'decisions',
  props: {
    title: 'Decisions',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// The engine beneath the plugin: what it writes and submits is kept for the assertions.
function engine(on: On) {
  const seen = { writes: [] as string[], submitted: [] as string[] }
  mock.env(on, { HOME: '/home/t' })
  on('tool.register', (_, e) => ({ value: { tool: `mcp__decision-queue__${e.name}` } }))
  on('command.register', () => ({ value: { command: 'decisions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', () => ({ value: '' }))
  for (const call of ['ui.status', 'ui.toast', 'ui.log'] as const) on(call, () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }))
  on('fs.write', (_, e) => {
    seen.writes.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => {
    seen.submitted.push(e.text)
    return { text: e.text }
  })
  return { seen, session: mock.session(on) }
}

async function start($: Engine) {
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
}

// What the model reads back from a call: the result on success, the refusal otherwise.
const said = (r: { text?: unknown; result?: unknown; deny?: string }) => String(r.deny ?? r.text ?? r.result)
const refused = (r: { deny?: string; isError?: boolean }) => r.deny !== undefined || r.isError === true

const lastLog = (writes: string[]) => (writes.at(-1) ?? '').trim().split('\n').filter(Boolean)

describe('the fold', () => {
  test('a revision, then an answer, leaves one answered decision carrying both', async () => {
    const at = '2026-10-21T10:00:00Z'
    const events: Event[] = [
      ({ type: 'ask', id: 'D1', at, where: { cwd: '/r' }, ...DECISION }) as Event,
      { type: 'revise', id: 'D1', at, changes: { title: 'Renamed' }, reason: 'facts moved' },
      { type: 'answer', id: 'D1', at, by: 'chat', choice: 'B', text: '1B' },
    ]
    const [d] = fold(events)
    expect(d?.status).toBe('answered')
    expect(d?.title).toBe('Renamed')
    expect(d?.revisions.length).toBe(1)
    expect(d?.answer?.choice).toBe('B')
  })

  test('an open "now" decision sorts above an older open "whenever" one, and closed ones go last', async () => {
    const ask = (id: string, needed: string, at: string): Event =>
      ({ type: 'ask', id, at, where: { cwd: '/r' }, ...DECISION, needed } as never)
    const events: Event[] = [
      ask('D1', 'whenever', '2026-10-21T09:00:00Z'),
      ask('D2', 'now', '2026-10-21T10:00:00Z'),
      ask('D3', 'now', '2026-10-21T08:00:00Z'),
      { type: 'withdraw', id: 'D3', at: '2026-10-21T11:00:00Z', by: 'agent', reason: 'moot' },
    ]
    expect(queue(fold(events)).map(d => d.id)).toEqual(['D2', 'D1', 'D3'])
  })

  test('a decision with no wrongIf and one option is reported as not answerable cold', async () => {
    const bad = problems({ ...(DECISION as object), options: DECISION.options.slice(0, 1), recommendation: { option: 'A', reason: 'r', wrongIf: '' } }, true)
    expect(bad).toContain('give at least two lettered options')
    expect(bad.some(p => p.includes('wrongIf'))).toBe(true)
  })
})

describe('the tools', () => {
  test('an ask missing its wrongIf is refused and writes nothing to the log', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    const r = await $.tool.call({ tool: ASK, ...DECISION, recommendation: { option: 'A', reason: 'r', wrongIf: '' } } as never)
    expect(refused(r)).toBe(true)
    expect(seen.writes.length).toBe(0)
  })

  test('an ask whose recommendation is not an option letter is refused', async ($, on) => {
    engine(on)
    await start($)
    const r = await $.tool.call({ tool: ASK, ...DECISION, recommendation: { ...DECISION.recommendation, option: 'C' } } as never)
    expect(refused(r)).toBe(true)
  })

  test('a filed decision is D1, is returned as a block to print, and is the one line in the log', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    const r = await $.tool.call({ tool: ASK, ...DECISION } as never)
    expect(said(r)).toContain('Filed D1')
    expect(said(r)).toContain('**Recommendation: A.**')
    const log = lastLog(seen.writes)
    expect(log.length).toBe(1)
    expect(JSON.parse(log[0] as string)).toMatchObject({ type: 'ask', id: 'D1', where: { branch: 'main' } })
  })

  test('revising, then resolving from the chat, appends two events and lists D1 as answered', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const revised = await $.tool.call({ tool: UPDATE, id: 'D1', reason: 'new fact', changes: { needed: 'now' } } as never)
    expect(said(revised)).toContain('blocking now')
    await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'answered', by: 'chat', choice: 'B', text: '1B' } as never)
    expect(lastLog(seen.writes).map(l => JSON.parse(l).type)).toEqual(['ask', 'revise', 'answer'])
    const listed = await $.tool.call({ tool: LIST } as never)
    expect(said(listed)).toContain('D1 · Where the archive lives: answered')
  })

  test('superseding by an id that was never filed is refused, and D1 stays open', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const r = await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'superseded', supersededBy: 'D9' } as never)
    expect(refused(r)).toBe(true)
    const listed = await $.tool.call({ tool: LIST } as never)
    expect(said(listed)).toContain('**D1 ·')
  })

  test('resolving a decision a second time is refused', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'withdrawn', reason: 'moot' } as never)
    const again = await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'answered', text: 'x' } as never)
    expect(refused(again)).toBe(true)
  })
})

describe('the list screen', () => {
  test('a withdrawn decision is hidden under "Show: open" and listed under "Closed" once the filter reaches "all"', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await $.tool.call({ tool: ASK, ...DECISION, title: 'Second', needed: 'now' } as never)
    await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'withdrawn', reason: 'moot' } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ key: 'row-D1' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Blocking now \(1\)/ })).toBeDefined()
    await ui.press({ key: 'filter' })
    await ui.press({ key: 'filter' })
    expect((await ui.find({ key: 'filter' }))?.text).toContain('all')
    expect(await ui.find({ key: 'row-D1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Closed \(1\)/ })).toBeDefined()
    await ui.unmount()
  })

  test('opening a decision shows its options, and "All decisions" returns to the list', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ key: 'opt-A' })).toBeUndefined()
    await ui.press({ key: 'row-D1' })
    expect(await ui.find({ key: 'opt-A' })).toBeDefined()
    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'opt-A' })).toBeUndefined()
    expect(await ui.find({ key: 'row-D1' })).toBeDefined()
    await ui.unmount()
  })

  test('grouping by kind heads the row "Minor" instead of "Not blocking yet"', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: /Not blocking yet/ })).toBeDefined()
    await ui.press({ key: 'group' })
    expect(await ui.find({ type: 'Text', text: /^Minor \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Not blocking yet/ })).toBeUndefined()
    await ui.unmount()
  })
})

describe('the pane', () => {
  test('pressing B while idle records a panel answer and submits a prompt naming D1 and B', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'row-D1' })
    await ui.press({ key: 'opt-B' })
    expect(seen.submitted.length).toBe(1)
    expect(seen.submitted[0]).toContain('D1')
    expect(seen.submitted[0]).toContain('B (One log per worktree)')
    expect(JSON.parse(lastLog(seen.writes).at(-1) as string)).toMatchObject({ type: 'answer', by: 'panel', choice: 'B' })
    await ui.unmount()
  })

  test('pressing B mid-turn appends to the conversation instead of submitting a prompt', async ($, on) => {
    const { seen, session } = engine(on)
    on('turn.start', (_, e) => ({ turnId: e.turnId }))
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await $.turn.start({ text: '', turnId: 't1' })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'row-D1' })
    await ui.press({ key: 'opt-B' })
    expect(seen.submitted.length).toBe(0)
    expect(JSON.stringify(session.appended())).toContain('answered in the decision panel')
    await ui.unmount()
  })

  test('an answer appended after the turn\'s last tool result is submitted again when the turn ends', async ($, on) => {
    const { seen } = engine(on)
    on('turn.start', (_, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await $.turn.start({ text: '', turnId: 't1' })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'row-D1' })
    await ui.press({ key: 'opt-A' })
    expect(seen.submitted.length).toBe(0)
    await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
    expect(seen.submitted.length).toBe(1)
    expect(seen.submitted[0]).toContain('A (One log per machine)')
    await ui.unmount()
  })

  test('"Not needed" with a note withdraws D1 by the panel and tells the agent', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await ui.press({ key: 'row-D1' })
    await ui.input({ key: 'note', text: 'overtaken', kind: 'change' })
    await ui.press({ key: 'withdraw' })
    expect(JSON.parse(lastLog(seen.writes).at(-1) as string)).toMatchObject({ type: 'withdraw', by: 'panel', reason: 'overtaken' })
    expect(seen.submitted[0]).toContain('not needed: overtaken')
    await ui.unmount()
  })

  test('"Ask to revise" with an empty note sends nothing', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'row-D1' })
    await ui.press({ key: 'revise' })
    expect(seen.submitted.length).toBe(0)
    await ui.unmount()
  })
})

describe('the desktop pane', () => {
  test('the list shows a card with a pill, and the detail marks the recommendation and answers on Choose', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: /^ Later $/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /D1 · Minor/ })).toBeDefined()
    await ui.press({ key: 'row-D1' })
    expect(await ui.find({ type: 'Text', text: /Recommended/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Wrong if/ })).toBeDefined()
    expect((await ui.find({ key: 'opt-A' }))?.text).toContain('Choose A')
    await ui.press({ key: 'opt-A' })
    expect(JSON.parse(lastLog(seen.writes).at(-1) as string)).toMatchObject({ type: 'answer', by: 'panel', choice: 'A' })
    await ui.unmount()
  })
})
