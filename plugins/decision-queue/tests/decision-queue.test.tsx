import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { fold, latestStatus, problems, projectName, queue } from '../hooks/model'
import type { Event } from '../types'

const ASK = 'mcp__decision-queue__decision_ask'
const UPDATE = 'mcp__decision-queue__decision_update'
const RESOLVE = 'mcp__decision-queue__decision_resolve'
const LIST = 'mcp__decision-queue__decision_list'
const STATUS = 'mcp__decision-queue__status_update'

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
function engine(on: On, { failCwd = false, hub = '', git = {} as Record<string, string> } = {}) {
  const seen = { writes: [] as string[], submitted: [] as string[], logs: [] as string[] }
  mock.env(on, hub ? { HOME: '/home/t', REDMOOR_DECISIONQ_HUB_URL: hub } : { HOME: '/home/t' })
  on('tool.register', (_, e) => ({ value: { tool: `mcp__decision-queue__${e.name}` } }))
  on('command.register', () => ({ value: { command: 'decisions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => {
    if (failCwd) throw new Error('cwd unavailable')
    return { value: '/repo' }
  })
  // git answers 'main' to everything but the commands a test names.
  on('process.run', (_, e) => ({
    value: { exitCode: 0, stdout: `${git[e.argv.slice(1).join(' ')] ?? 'main'}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.read', () => ({ value: '' }))
  for (const call of ['ui.status', 'ui.toast'] as const) on(call, () => ({ value: undefined }))
  on('ui.log', (_, e) => {
    seen.logs.push(e.text)
    return { value: undefined }
  })
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
  test('an ask whose hook throws is refused with a message to ask in the chat, not let through', async ($, on) => {
    const { seen } = engine(on, { failCwd: true })
    await start($)
    const r = await $.tool.call({ tool: ASK, ...DECISION } as never)
    expect(r.deny).toContain('decision-queue could not do this (internal error:')
    expect(r.deny).toContain('Ask the user in the chat instead.')
    expect(seen.writes.length).toBe(0)
  })

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
  test('the list shows the meta line, and the detail marks the recommendation and answers on Choose', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
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

// A hub in memory: what the mod sends it, and an inbox the test fills.
function hubServer(on: On, { down = false } = {}) {
  const calls: { method: string; url: string; body?: unknown }[] = []
  let inbox: unknown[] = []
  on('http.fetch', (_, e) => {
    const method = e.init?.method ?? 'GET'
    calls.push({ method, url: e.url, body: e.init?.body ? JSON.parse(e.init.body) : undefined })
    if (down) throw new Error('connection refused')
    const text = method === 'GET' ? JSON.stringify({ items: inbox }) : ''
    if (e.url.endsWith('/inbox/ack')) inbox = []
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  return { calls, fill: (items: unknown[]) => { inbox = items } }
}

describe('the hub', () => {
  test('with no REDMOOR_DECISIONQ_HUB_URL, filing a decision makes no request', async ($, on) => {
    engine(on)
    const { calls } = hubServer(on)
    mock.clock(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    expect(calls.length).toBe(0)
  })

  test('a filed decision is sent to the hub with the whole log, under the session id', async ($, on) => {
    engine(on, { hub: 'http://hub.test/' })
    const { calls } = hubServer(on)
    const clock = mock.clock(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await clock.advance(0)
    const put = calls.find(c => c.method === 'PUT')
    expect(put?.url).toBe('http://hub.test/v1/sessions/sess-1')
    expect(put?.body).toMatchObject({ where: { cwd: '/repo', branch: 'main' }, events: [{ type: 'ask', id: 'D1' }] })
  })

  test('an answer in the hub\'s inbox is recorded as the hub\'s, told to the agent, and acknowledged', async ($, on) => {
    const { seen } = engine(on, { hub: 'http://hub.test' })
    const hub = hubServer(on)
    const clock = mock.clock(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    hub.fill([{ seq: 7, id: 'D1', action: 'answer', choice: 'B', text: 'per worktree' }])
    await clock.advance(5000)
    expect(JSON.parse(lastLog(seen.writes).at(-1) as string)).toMatchObject({ type: 'answer', by: 'hub', choice: 'B' })
    expect(seen.submitted.at(-1)).toContain('answered on the decision hub: B (One log per worktree) — per worktree')
    expect(hub.calls.find(c => c.url.endsWith('/inbox/ack'))?.body).toEqual({ upTo: 7 })
    expect(hub.calls.filter(c => c.method === 'PUT').at(-1)?.body).toMatchObject({ events: [{ type: 'ask' }, { type: 'answer', by: 'hub' }] })
  })

  test('an inbox answer to a decision already answered in the chat is skipped, and still acknowledged', async ($, on) => {
    const { seen } = engine(on, { hub: 'http://hub.test' })
    const hub = hubServer(on)
    const clock = mock.clock(on)
    await start($)
    await $.tool.call({ tool: ASK, ...DECISION } as never)
    await $.tool.call({ tool: RESOLVE, id: 'D1', outcome: 'answered', choice: 'A', text: '1A' } as never)
    hub.fill([{ seq: 1, id: 'D1', action: 'answer', choice: 'B' }])
    await clock.advance(5000)
    expect(seen.submitted.length).toBe(0)
    expect(fold(lastLog(seen.writes).map(l => JSON.parse(l)))[0]?.answer?.choice).toBe('A')
    expect(hub.calls.some(c => c.url.endsWith('/inbox/ack'))).toBe(true)
  })

  test('a hub that is down does not stop a decision being filed, and is logged once', async ($, on) => {
    const { seen } = engine(on, { hub: 'http://hub.test' })
    hubServer(on, { down: true })
    const clock = mock.clock(on)
    await start($)
    const r = await $.tool.call({ tool: ASK, ...DECISION } as never)
    await clock.advance(15000)
    expect(said(r)).toContain('Filed D1')
    expect(seen.writes.length).toBe(1)
    expect(seen.logs.filter(l => l.includes('could not reach the hub')).length).toBe(1)
  })
})

describe('where a decision comes from', () => {
  test('the project is owner/name from the origin URL, in either form, else the main checkout\'s folder', () => {
    expect(projectName('git@github.com:redmoor-labs/skills.git', undefined)).toBe('redmoor-labs/skills')
    expect(projectName('https://github.com/redmoor-labs/skills', undefined)).toBe('redmoor-labs/skills')
    expect(projectName(undefined, '/home/t/projects/forge/.git')).toBe('forge')
    expect(projectName(undefined, undefined)).toBeUndefined()
  })
})

describe('status updates', () => {
  test('a status is kept in the log, is not a decision, and the latest one wins', () => {
    const at = '2026-10-29T10:00:00Z'
    const events: Event[] = [
      { type: 'status', at, headline: 'Starting the export' },
      ({ type: 'ask', id: 'D1', at, where: { cwd: '/r' }, ...DECISION }) as Event,
      { type: 'status', at, headline: 'Export done, on to the import', bullets: ['PR open'] },
    ]
    expect(fold(events).map(d => d.id)).toEqual(['D1'])
    expect(latestStatus(events)?.headline).toBe('Export done, on to the import')
  })

  test('status_update records the headline and bullets, and refuses an empty or overlong headline', async ($, on) => {
    const { seen } = engine(on)
    await start($)
    expect(refused(await $.tool.call({ tool: STATUS, headline: '  ' } as never))).toBe(true)
    expect(refused(await $.tool.call({ tool: STATUS, headline: 'x'.repeat(141) } as never))).toBe(true)
    const r = await $.tool.call({ tool: STATUS, headline: 'Wiring the hub', bullets: ['tests pass', ' '] } as never)
    expect(said(r)).toContain('Status posted')
    expect(JSON.parse(lastLog(seen.writes).at(-1) as string)).toMatchObject({ type: 'status', headline: 'Wiring the hub', bullets: ['tests pass'] })
  })

  test('a status alone is sent to the hub, with the project and worktree', async ($, on) => {
    engine(on, { hub: 'http://hub.test', git: { 'remote get-url origin': 'git@github.com:acme/app.git', 'rev-parse --show-toplevel': '/w/app-feature' } })
    const { calls } = hubServer(on)
    const clock = mock.clock(on)
    await start($)
    await $.tool.call({ tool: STATUS, headline: 'Wiring the hub' } as never)
    await clock.advance(0)
    expect(calls.find(c => c.method === 'PUT')?.body).toMatchObject({
      where: { project: 'acme/app', worktree: 'app-feature' }, events: [{ type: 'status', headline: 'Wiring the hub' }],
    })
  })

  test('the pane shows the latest status under its heading', async ($, on) => {
    engine(on)
    await start($)
    await $.tool.call({ tool: STATUS, headline: 'Wiring the hub' } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Status .*Wiring the hub/ })).toBeDefined()
    await ui.unmount()
  })
})
