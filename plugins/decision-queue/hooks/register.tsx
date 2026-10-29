import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Event, Fields, FilterBy, GroupBy, SortBy, View, Where } from '../types'
import {
  counts,
  fold,
  fromJsonl,
  nextId,
  problems,
  arrange,
  cycle,
  FILTERS,
  group,
  GROUPS,
  queue,
  SORTS,
  recommendationIsAnOption,
  render,
  toJsonl,
  urgency,
} from './model'
import type { Decision } from './model'
import { PROTOCOL, TOOLS } from './protocol'

const PLUGIN = 'decision-queue'
const PANE = 'decisions'

const events = atom({ plugin: 'decision-queue', key: 'events' } as const, [] as Event[])
const selected = atom({ plugin: 'decision-queue', key: 'selected' } as const, '')
const draft = atom({ plugin: 'decision-queue', key: 'draft' } as const, '')
const logPath = atom({ plugin: 'decision-queue', key: 'logPath' } as const, '')
const view = atom({ plugin: 'decision-queue', key: 'view' } as const, 'list' as View)
const groupBy = atom({ plugin: 'decision-queue', key: 'groupBy' } as const, 'urgency' as GroupBy)
const filterBy = atom({ plugin: 'decision-queue', key: 'filterBy' } as const, 'open' as FilterBy)
const sortBy = atom({ plugin: 'decision-queue', key: 'sortBy' } as const, 'urgency' as SortBy)

// Module state, lost on a reload: whether the main loop is mid-turn, and answers sent into it.
let isTurnRunning = false
let lastToolDoneAt = 0
let sentIntoTurn: { at: number; text: string }[] = []

const now = () => new Date().toISOString()

async function record($: EngineInterface, event: Event): Promise<Decision[]> {
  const all = await update($, events, list => [...(list ?? []), event])
  const path = await read($, logPath)
  if (path) await $.fs.write(path, toJsonl(all)).catch(() => $.ui.log(`${PLUGIN}: could not write ${path}`))
  const { open, now: urgent } = counts(fold(all))
  $.ui.status(open ? `decisions: ${open} open${urgent ? `, ${urgent} blocking now` : ''}` : undefined)
  return fold(all)
}

async function find($: EngineInterface, id: string): Promise<Decision | undefined> {
  return fold(await read($, events)).find(d => d.id === id)
}

async function where($: EngineInterface): Promise<Where> {
  const cwd = await $.session.cwd()
  const git = async (...args: string[]) => {
    const r = await $.process.run(['git', ...args], { timeoutMs: 5000 }).catch(() => undefined)
    return r && r.exitCode === 0 ? r.stdout.trim() : undefined
  }
  return { cwd, branch: await git('rev-parse', '--abbrev-ref', 'HEAD'), head: await git('rev-parse', '--short', 'HEAD') }
}

// An answer from the panel reaches the model inside a running turn, or starts a turn when idle.
async function deliver($: EngineInterface, text: string): Promise<void> {
  if (isTurnRunning) {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
    await $.session.append({ message: { type: 'system', content: [{ type: 'text', text: `Sent to the running turn: ${text}` }] } })
    sentIntoTurn.push({ at: Date.now(), text })
  } else {
    void $.prompt.submit({ text })
  }
}

const TAGS = { now: 'NOW', before: 'before', default: 'default', whenever: 'later' } as const
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n))
const KIND_SHORT = { gate: 'gate', 'plan-changing': 'plan', shaping: 'design', minor: 'minor' } as const
// Desktop only: words for the pills and meta lines, and a theme colour per urgency.
const KIND_LABEL = { gate: 'Approval', 'plan-changing': 'Could change the plan', shaping: 'Design input', minor: 'Minor' } as const
const PILL = { now: 'Blocking now', before: 'Needed before a step', default: 'Proceeding on a default', whenever: 'Not blocking yet' } as const
const DOT = { now: '#e5484d', before: '#f5a524', default: '#3e8ed0', whenever: '#8b8d98' } as const
const DOT_ANSWERED = '#30a46c'
const DOT_CLOSED = '#8b8d98'
// Selection colours: blue for the recommendation, green for the option picked. Red is kept for blocking.
const RECOMMENDED = '#6cb6ff'
const PICKED = '#57c785'
function ago(iso: string, short = false): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  const span = mins < 60 ? `${mins}m` : mins < 2880 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`
  return short ? span : `${span} ago`
}
const tag = (d: Decision) => (d.status === 'open' ? TAGS[d.needed] : d.status)
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const byWhom = (d: Decision) =>
  ({ panel: 'in the panel', chat: 'in the chat', default: 'by default' })[d.answer?.by ?? 'chat']

function invalid(lines: string[]) {
  return { deny: `Not filed. Fix and call again:\n- ${lines.join('\n- ')}` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    for (const spec of TOOLS) await $.tool.register({ ...spec, isDeferred: false })
    await $.command.register({ name: 'decisions', description: 'Open the decision queue for this session' })

    const home = await $.env.get('HOME')
    const dir = (await $.env.get('DECISION_QUEUE_DIR')) ?? `${home}/.claude/decision-queue`
    const path = `${dir}/${await $.session.id()}.jsonl`
    await $.process.run(['mkdir', '-p', dir]).catch(() => undefined)
    await update($, logPath, () => path)
    const saved = await $.fs.read(path).catch(() => '')
    if (typeof saved === 'string' && saved && (await read($, events)).length === 0) {
      await update($, events, () => fromJsonl(saved))
    }
    const { open } = counts(fold(await read($, events)))
    if (open) $.ui.status(`decisions: ${open} open`)
    return started
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return { sections: [...composed.sections, { id: `${PLUGIN}:protocol`, text: PROTOCOL, scope: 'session' }] }
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) isTurnRunning = true
    return next(e)
  })

  // A row appended after the turn's last tool result was never read: send it again as a prompt.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      isTurnRunning = false
      const unread = sentIntoTurn.filter(s => s.at > lastToolDoneAt)
      sentIntoTurn = []
      for (const s of unread) void $.prompt.submit({ text: s.text })
    }
    return done
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) lastToolDoneAt = Date.now()
    return ran
  })

  on('tool.call', { tool: 'mcp__decision-queue__decision_ask' }, async ($, e) => {
    const f = e as unknown as Fields
    const bad = problems(f, true)
    if (!bad.length && !recommendationIsAnOption(f)) bad.push('recommendation.option must be one of the option letters')
    if (bad.length) return invalid(bad)
    const id = nextId(await read($, events))
    const fields: Fields = {
      title: f.title, stakes: f.stakes, context: f.context, options: f.options,
      recommendation: f.recommendation, needed: f.needed, when: f.when, kind: f.kind, artefacts: f.artefacts,
    }
    const all = await record($, { type: 'ask', id, at: now(), where: await where($), ...fields })
    const filed = all.find(d => d.id === id) as Decision
    $.ui.toast(`${id} filed: ${f.title}`)
    if (f.needed === 'now' || f.kind === 'plan-changing') void $.ui.notify(`${id}: ${f.title}`, { title: 'Decision needed' })
    void $.ui.open({ id: PANE, title: 'Decisions' })
    return { result: `Filed ${id}. Print this block in your reply:\n\n${render(filed)}` }
  })

  on('tool.call', { tool: 'mcp__decision-queue__decision_update' }, async ($, e) => {
    const { id, reason, changes } = e as unknown as { id: string; reason: string; changes: Partial<Fields> }
    const d = await find($, id)
    if (!d) return { deny: `No decision ${id}.` }
    if (d.status !== 'open') return { deny: `${id} is ${d.status}; file a new decision instead.` }
    const merged = { ...d, ...changes }
    const bad = problems(merged, false)
    if (!recommendationIsAnOption(merged)) bad.push('recommendation.option must be one of the option letters')
    if (bad.length) return { deny: `Not revised:\n- ${bad.join('\n- ')}` }
    const all = await record($, { type: 'revise', id, at: now(), changes, reason })
    return { result: `Revised ${id}. Reprint it:\n\n${render(all.find(x => x.id === id) as Decision)}` }
  })

  on('tool.call', { tool: 'mcp__decision-queue__decision_resolve' }, async ($, e) => {
    const a = e as unknown as {
      id: string; outcome: 'answered' | 'withdrawn' | 'superseded'
      by?: 'chat' | 'default'; choice?: string; text?: string; supersededBy?: string; reason?: string
    }
    const d = await find($, a.id)
    if (!d) return { deny: `No decision ${a.id}.` }
    if (d.status !== 'open') return { deny: `${a.id} is already ${d.status}.` }
    const at = now()
    if (a.outcome === 'answered') {
      if (!a.text) return { deny: "answered needs text: the user's words, or what you proceeded on." }
      if (a.choice && !d.options.some(o => o.letter === a.choice)) return { deny: `${a.choice} is not an option of ${a.id}.` }
      await record($, { type: 'answer', id: a.id, at, by: a.by ?? 'chat', choice: a.choice, text: a.text })
    } else if (a.outcome === 'withdrawn') {
      if (!a.reason) return { deny: 'withdrawn needs a reason.' }
      await record($, { type: 'withdraw', id: a.id, at, by: 'agent', reason: a.reason })
    } else {
      if (!a.supersededBy || !(await find($, a.supersededBy))) return { deny: 'superseded needs supersededBy: an id already filed.' }
      await record($, { type: 'supersede', id: a.id, at, by: a.supersededBy, reason: a.reason ?? '' })
    }
    return { result: `${a.id} is ${a.outcome}.` }
  })

  on('tool.call', { tool: 'mcp__decision-queue__decision_list' }, async $ => {
    const all = queue(fold(await read($, events)))
    if (!all.length) return { result: 'The queue is empty.' }
    const open = all.filter(d => d.status === 'open').map(render)
    const closed = all.filter(d => d.status !== 'open').map(d => `- ${d.id} · ${d.title}: ${d.status}`)
    return { result: [...open, closed.length ? `Closed:\n${closed.join('\n')}` : ''].filter(Boolean).join('\n\n') }
  })

  on('command.run', { command: 'decisions' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Decisions', focus: true })
    const { open, now: urgent } = counts(fold(await read($, events)))
    return { text: `Decision queue: ${open} open${urgent ? `, ${urgent} blocking now` : ''}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text>The decision queue answers on the terminal or the desktop app.</Text>
    }
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const all = fold(await read($, events))
    const pick = await read($, selected)
    const note = await read($, draft)
    const screen = await read($, view)
    const by = await read($, groupBy)
    const show = await read($, filterBy)
    const order = await read($, sortBy)

    const openDetail = (id: string) => async () => {
      await update($, selected, () => id)
      await update($, view, () => 'detail')
    }
    const back = () => void update($, view, () => 'list')
    const clearNote = () => update($, draft, () => '')
    const heading = (text: string) => <Text dimColor bold>{text}</Text>

    const answer = (d: Decision, choice: string | undefined, words: string) => async () => {
      const text = words.trim()
      if (!choice && !text) return
      await record($, { type: 'answer', id: d.id, at: now(), by: 'panel', choice, text: text || `Option ${choice}` })
      await clearNote()
      const picked = choice ? `${choice} (${d.options.find(o => o.letter === choice)?.label ?? ''})` : ''
      await deliver($, `Decision ${d.id} (“${d.title}”) answered in the decision panel: ` +
        `${[picked, text].filter(Boolean).join(' — ')}. It is recorded; act on it.`)
    }
    const withdraw = (d: Decision) => async () => {
      await record($, { type: 'withdraw', id: d.id, at: now(), by: 'panel', reason: note.trim() || 'no reason given' })
      await clearNote()
      await deliver($, `The user marked decision ${d.id} (“${d.title}”) as not needed` +
        `${note.trim() ? `: ${note.trim()}` : ''}. It is closed; do not act on it.`)
    }
    const askRevision = (d: Decision) => async () => {
      if (!note.trim()) return
      await record($, { type: 'revision-asked', id: d.id, at: now(), text: note.trim() })
      await clearNote()
      await deliver($, `The user asks you to revise decision ${d.id} (“${d.title}”): ${note.trim()}. ` +
        'Rewrite it with decision_update and reprint it.')
    }

    const { open: n, now: urgent } = counts(all)
    const current = all.find(d => d.id === pick)

    if (e.surface === 'desktop') {
      const { Markdown, Svg } = $.ui.resolve(e)
      // Urgency as a small dot and a coloured word, never a filled block.
      const dotColor = (d: Decision) => d.status === 'open' ? DOT[d.needed] : d.status === 'answered' ? DOT_ANSWERED : DOT_CLOSED
      const dot = (d: Decision) => (
        <Svg alt={d.status === 'open' ? PILL[d.needed] : d.status} width={8} height={8}
          source={`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="${dotColor(d)}"/></svg>`} />
      )
      const section = (text: string) => <Text size="caption" weight="semibold" color="subtle">{text}</Text>
      const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
      const whenLine = (d: Decision) =>
        d.status !== 'open' || !d.when ? ''
          : d.needed === 'before' ? `Needed by: ${d.when}`
            : d.needed === 'default' ? `Going with ${d.recommendation.option} unless you say otherwise · final ${lower(d.when)}` : ''

      if (screen === 'detail' && current) {
        const shown = arrange(all, show, order)
        const at = shown.findIndex(d => d.id === current.id)
        const prev = at > 0 ? shown[at - 1] : undefined
        const next = at >= 0 && at < shown.length - 1 ? shown[at + 1] : undefined
        const rec = current.recommendation.option
        const isOpen = current.status === 'open'
        const label = isOpen ? PILL[current.needed] : sentence(current.status)
        return (
          <Box flexDirection="column" gap="md" padding="sm">
            <Box flexDirection="row" gap="xs" justifyContent="space-between">
              <Button key="back" variant="secondary" onPress={back}>← All decisions</Button>
              <Box flexDirection="row" gap="xs">
                {prev ? <Button key="prev" variant="secondary" onPress={openDetail(prev.id)}>‹ {prev.id}</Button> : null}
                {next ? <Button key="next" variant="secondary" onPress={openDetail(next.id)}>{next.id} ›</Button> : null}
              </Box>
            </Box>

            <Box flexDirection="column" gap="xs">
              <Box flexDirection="row" gap="xs" alignItems="center">
                {dot(current)}
                <Text size="caption" weight="semibold" color={isOpen && current.needed === 'now' ? 'error' : 'subtle'}>{label}</Text>
                <Text size="caption" color="subtle">· {current.id} · {KIND_LABEL[current.kind]} · {ago(current.createdAt)}
                  {current.revisions.length ? ` · revised ${current.revisions.length}×` : ''}</Text>
              </Box>
              <Text size="title" weight="semibold">{current.title}</Text>
              {whenLine(current) ? <Text size="footnote" color="subtle">{whenLine(current)}</Text> : null}
            </Box>

            <Text weight="medium">{current.stakes}</Text>
            <Markdown text={current.context} dimColor />

            <Box flexDirection="column" gap="sm">
              {section('OPTIONS')}
              {current.options.map(o => {
                const isRec = o.letter === rec
                const isChosen = current.answer?.choice === o.letter
                return (
                  <Box key={`card-${o.letter}`} flexDirection="row" gap="sm" alignItems="flex-start"
                    borderStyle="round" borderColor={isChosen ? PICKED : isRec ? RECOMMENDED : 'subtle'} borderDimColor={!(isRec || isChosen)} padding="sm">
                    {isOpen ? (
                      <Button key={`opt-${o.letter}`} variant={isRec ? 'primary' : 'secondary'}
                        onPress={answer(current, o.letter, note)}>{`Choose ${o.letter}`}</Button>
                    ) : (
                      <Text weight="bold" color={isChosen ? 'success' : 'subtle'}>{isChosen ? `✓ ${o.letter}` : o.letter}</Text>
                    )}
                    <Box flexDirection="column" flexGrow={1} flexShrink={1} gap="xs">
                      <Text weight="semibold">{o.label}{isRec ? <Text size="caption" weight="semibold" color={RECOMMENDED}>{'   Recommended'}</Text> : null}</Text>
                      {o.detail ? <Text size="footnote" color="subtle">{o.detail}</Text> : null}
                    </Box>
                  </Box>
                )
              })}
            </Box>

            <Box flexDirection="column" gap="xs">
              {section(`WHY ${rec}`)}
              <Text>{current.recommendation.reason}</Text>
              <Text size="footnote" italic color="subtle">Wrong if {lower(current.recommendation.wrongIf)}</Text>
            </Box>

            {current.artefacts?.length ? (
              <Box flexDirection="column" gap="xs">
                {section('LOOK AT')}
                <Markdown text={current.artefacts.map(a => `- ${a}`).join('\n')} />
              </Box>
            ) : null}

            {current.revisions.length ? (
              <Box flexDirection="column" gap="xs">
                {section('REVISIONS')}
                {current.revisions.map(r => <Text key={`r-${r.at}`} size="footnote" color="subtle">{ago(r.at)}: {r.reason}</Text>)}
              </Box>
            ) : null}

            {isOpen ? (
              <Box flexDirection="column" gap="sm" alignItems="stretch">
                {section('YOUR ANSWER')}
                <Input key="note" rows={3} value={note} submitLabel="Send"
                  placeholder="A note to go with your choice, or your answer in words"
                  onInput={(value: string) => void update($, draft, () => value)}
                  onSubmit={(value: string) => void answer(current, undefined, value)()} />
                <Box flexDirection="row" gap="xs" alignItems="center">
                  <Button key="withdraw" variant="secondary" onPress={withdraw(current)}>Not needed</Button>
                  <Button key="revise" variant="secondary" onPress={askRevision(current)}>Ask to revise</Button>
                </Box>
              </Box>
            ) : (
              <Box flexDirection="column" gap="xs">
                {section('OUTCOME')}
                <Text>
                  {current.status === 'answered'
                    ? `Answered${current.answer?.choice ? ` ${current.answer.choice}` : ''} ${byWhom(current)}: ${current.answer?.text}`
                    : `${sentence(current.status)}: ${current.closedReason ?? ''}${current.supersededBy ? ` (by ${current.supersededBy})` : ''}`}
                </Text>
              </Box>
            )}
          </Box>
        )
      }

      const shown = arrange(all, show, order)
      const groups = group(shown, by)
      return (
        <Box flexDirection="column" gap="md" padding="sm">
          <Box flexDirection="column" gap="xs">
            <Text size="title" weight="semibold">Decisions</Text>
            <Text size="footnote" color="subtle">
              {all.length ? `${n} open${urgent ? ` · ${urgent} blocking now` : ''} · ${all.length - n} closed` : 'No decisions yet. They appear here as the agent files them.'}
            </Text>
          </Box>
          <Box flexDirection="row" gap="xs" flexWrap="wrap">
            <Button key="filter" hotkey="f" variant="secondary" onPress={() => void update($, filterBy, () => cycle(FILTERS, show))}>Show: {show}</Button>
            <Button key="group" hotkey="g" variant="secondary" onPress={() => void update($, groupBy, () => cycle(GROUPS, by))}>Group: {by}</Button>
            <Button key="sort" hotkey="s" variant="secondary" onPress={() => void update($, sortBy, () => cycle(SORTS, order))}>Sort: {order}</Button>
          </Box>
          {shown.length === 0 && all.length ? <Text color="subtle">Nothing matches “{show}”.</Text> : null}
          {groups.map(([title, rows]) => (
            <Box key={`g-${title}`} flexDirection="column" gap="sm">
              {title ? section(`${title} (${rows.length})`) : null}
              {rows.map(d => (
                <Box key={`card-${d.id}`} flexDirection="row" gap="sm" alignItems="flex-start">
                  <Box paddingTop="xs">{dot(d)}</Box>
                  <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                    <Button key={`row-${d.id}`} plain dimColor={d.status !== 'open'} onPress={openDetail(d.id)}>
                      <Text weight="medium">{d.title}</Text>
                    </Button>
                    <Text size="caption" color="subtle">
                      {d.id} · {KIND_LABEL[d.kind]} · {ago(d.createdAt)}{d.revisionAsked ? ' · revision asked' : ''}
                    </Text>
                    {whenLine(d) ? <Text size="caption" color="subtle">{whenLine(d)}</Text> : null}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )
    }

    if (screen === 'detail' && current) {
      const shown = arrange(all, show, order)
      const at = shown.findIndex(d => d.id === current.id)
      const prev = at > 0 ? shown[at - 1] : undefined
      const next = at >= 0 && at < shown.length - 1 ? shown[at + 1] : undefined
      const rec = current.recommendation.option
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="back" onPress={back}>← All decisions</Button>
            {prev ? <Button key="prev" onPress={openDetail(prev.id)}>‹ {prev.id}</Button> : null}
            {next ? <Button key="next" onPress={openDetail(next.id)}>{next.id} ›</Button> : null}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{current.id} · {current.title}</Text>
            <Text dimColor>
              {current.status === 'open' ? sentence(urgency(current)) : sentence(current.status)} · {current.kind} · filed {ago(current.createdAt)}
              {current.where.branch ? ` · ${current.where.branch}` : ''}
              {current.revisions.length ? ` · revised ${current.revisions.length}×` : ''}
            </Text>
          </Box>
          <Box marginTop={1}><Text>{current.stakes}</Text></Box>
          <Box marginTop={1}><Text>{current.context}</Text></Box>
          <Box flexDirection="column" marginTop={1} gap={1}>
            {heading('Options')}
            {current.options.map(o => (
              <Box key={`o-${o.letter}`} flexDirection="row" gap={1}>
                {current.status === 'open' ? (
                  <Button key={`opt-${o.letter}`} variant={o.letter === rec ? 'primary' : undefined}
                    onPress={answer(current, o.letter, note)}>{o.letter}</Button>
                ) : (
                  <Text bold={current.answer?.choice === o.letter}>{current.answer?.choice === o.letter ? '✓' : ' '} {o.letter}</Text>
                )}
                <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                  <Text bold>{o.label}{o.letter === rec ? <Text color="green">  ★ recommended</Text> : ''}</Text>
                  {o.detail ? <Text dimColor>{o.detail}</Text> : null}
                </Box>
              </Box>
            ))}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {heading('Recommendation')}
            <Text><Text bold>{rec}.</Text> {current.recommendation.reason}</Text>
            <Text italic dimColor>Wrong if {current.recommendation.wrongIf}</Text>
          </Box>
          {current.artefacts?.length ? (
            <Box flexDirection="column" marginTop={1}>
              {heading('Look at')}
              {current.artefacts.map(a => <Text key={`a-${a}`}>{a}</Text>)}
            </Box>
          ) : null}
          {current.revisions.length ? (
            <Box flexDirection="column" marginTop={1}>
              {heading('Revisions')}
              {current.revisions.map(r => <Text key={`r-${r.at}`} dimColor>{ago(r.at)}: {r.reason}</Text>)}
            </Box>
          ) : null}
          {current.status === 'open' ? (
            <Box flexDirection="column" marginTop={1}>
              {heading('Your answer')}
              <Text dimColor>Press a letter to pick it; any note below goes with it. Or type an answer and press Enter.</Text>
              <Box borderStyle="single" borderDimColor paddingX={1}>
                <Input key="note" rows={2} value={note} placeholder="Note or answer in words"
                  onInput={(value: string) => void update($, draft, () => value)}
                  onSubmit={(value: string) => void answer(current, undefined, value)()} />
              </Box>
              <Box flexDirection="row" gap={1}>
                <Button key="withdraw" onPress={withdraw(current)}>Not needed</Button>
                <Button key="revise" onPress={askRevision(current)}>Ask to revise</Button>
                <Text dimColor>(both send the note)</Text>
              </Box>
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              {heading('Outcome')}
              <Text>
                {current.status === 'answered'
                  ? `Answered${current.answer?.choice ? ` ${current.answer.choice}` : ''} ${byWhom(current)}: ${current.answer?.text}`
                  : `${sentence(current.status)}: ${current.closedReason ?? ''}${current.supersededBy ? ` (by ${current.supersededBy})` : ''}`}
              </Text>
            </Box>
          )}
        </Box>
      )
    }

    const shown = arrange(all, show, order)
    const groups = group(shown, by)
    const width = Math.max(16, (e.props.bodyColumns ?? 80) - 30)
    return (
      <Box flexDirection="column">
        <Text bold>
          {all.length ? `Decisions · ${n} open${urgent ? `, ${urgent} blocking now` : ''} · ${all.length - n} closed` : 'No decisions yet.'}
        </Text>
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button key="filter" hotkey="f" onPress={() => void update($, filterBy, () => cycle(FILTERS, show))}>Show: {show}</Button>
          <Button key="group" hotkey="g" onPress={() => void update($, groupBy, () => cycle(GROUPS, by))}>Group: {by}</Button>
          <Button key="sort" hotkey="s" onPress={() => void update($, sortBy, () => cycle(SORTS, order))}>Sort: {order}</Button>
        </Box>
        {shown.length === 0 && all.length ? <Box marginTop={1}><Text dimColor>Nothing matches “{show}”.</Text></Box> : null}
        {groups.map(([title, rows]) => (
          <Box key={`g-${title}`} flexDirection="column" marginTop={1}>
            {title ? heading(`${title} (${rows.length})`) : null}
            {rows.map(d => (
              <Button key={`row-${d.id}`} plain dimColor={d.status !== 'open'} onPress={openDetail(d.id)}>
                <Text bold={d.needed === 'now' && d.status === 'open'}>{tag(d).padEnd(8)}</Text>
                {d.id.padEnd(4)} {clip(d.title, width)}
                <Text dimColor> {KIND_SHORT[d.kind].padEnd(6)} {ago(d.createdAt, true).padStart(4)}{d.revisionAsked ? ' ✎' : ''}</Text>
              </Button>
            ))}
          </Box>
        ))}
        {all.length ? <Box marginTop={1}><Text dimColor>Press a decision to open it · f g s change the view · ✎ revision asked</Text></Box> : null}
      </Box>
    )
  })
}
