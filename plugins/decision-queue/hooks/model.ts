// The decision log: an append-only list of events, and the decisions folded from it.
// Pure: no `$`, so the tests and the pane read the same fold.

import type { AnsweredBy, Event, Fields, FilterBy, GroupBy, Kind, Needed, SortBy, Status, Where } from '../types'

export type { Event, Fields }

export type Decision = Fields & {
  id: string
  where: Where
  status: Status
  createdAt: string
  updatedAt: string
  revisions: { at: string; reason: string }[]
  answer?: { by: AnsweredBy; choice?: string; text: string; at: string }
  closedReason?: string
  supersededBy?: string
  revisionAsked?: string
}

const NEEDED_ORDER: Record<Needed, number> = { now: 0, before: 1, default: 2, whenever: 3 }

export function fold(events: readonly Event[]): Decision[] {
  const byId = new Map<string, Decision>()
  for (const e of events) {
    if (e.type === 'ask') {
      const { type: _type, at, ...rest } = e
      byId.set(e.id, { ...rest, status: 'open', createdAt: at, updatedAt: at, revisions: [] })
      continue
    }
    const d = byId.get(e.id)
    if (!d) continue
    d.updatedAt = e.at
    if (e.type === 'revise') {
      Object.assign(d, e.changes)
      d.revisions.push({ at: e.at, reason: e.reason })
      d.revisionAsked = undefined
    } else if (e.type === 'answer') {
      d.status = 'answered'
      d.answer = { by: e.by, choice: e.choice, text: e.text, at: e.at }
    } else if (e.type === 'withdraw') {
      d.status = 'withdrawn'
      d.closedReason = e.by === 'panel' ? `marked not needed: ${e.reason}` : e.reason
    } else if (e.type === 'supersede') {
      d.status = 'superseded'
      d.supersededBy = e.by
      d.closedReason = e.reason
    } else if (e.type === 'revision-asked') {
      d.revisionAsked = e.text
    }
  }
  return [...byId.values()]
}

// Open first, most urgent first, oldest first within a class; then closed, newest first.
export function queue(decisions: readonly Decision[]): Decision[] {
  const open = decisions
    .filter(d => d.status === 'open')
    .sort((a, b) => NEEDED_ORDER[a.needed] - NEEDED_ORDER[b.needed] || a.createdAt.localeCompare(b.createdAt))
  const closed = decisions
    .filter(d => d.status !== 'open')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return [...open, ...closed]
}

export function nextId(events: readonly Event[]): string {
  const n = events.filter(e => e.type === 'ask').length
  return `D${n + 1}`
}

// What a decision lacks to be answerable cold; empty when nothing.
export function problems(f: Partial<Fields>, isNew: boolean): string[] {
  const out: string[] = []
  const need = <K extends keyof Fields>(k: K) => isNew && (f[k] === undefined || f[k] === '')
  for (const k of ['title', 'stakes', 'context', 'needed', 'kind'] as const) if (need(k)) out.push(`${k} is required`)
  if (f.options !== undefined || isNew) {
    const opts = f.options ?? []
    if (opts.length < 2) out.push('give at least two lettered options')
    const letters = opts.map(o => o.letter)
    if (new Set(letters).size !== letters.length) out.push('option letters must be distinct')
  }
  if (f.recommendation !== undefined || isNew) {
    const r = f.recommendation
    if (!r || !r.option || !r.reason || !r.wrongIf) {
      out.push('recommendation needs option, reason and wrongIf (what would make it wrong)')
    }
  }
  if ((f.needed === 'before' || f.needed === 'default') && !f.when) {
    out.push(`needed "${f.needed}" requires when: the step or time it applies to`)
  }
  return out
}

export function recommendationIsAnOption(d: Pick<Fields, 'options' | 'recommendation'>): boolean {
  return d.options.some(o => o.letter === d.recommendation.option)
}

export function urgency(d: Pick<Fields, 'needed' | 'when'>): string {
  if (d.needed === 'now') return 'blocking now'
  if (d.needed === 'before') return `needed before ${d.when}`
  if (d.needed === 'default') return `proceeding on the recommendation; final when: ${d.when}`
  return 'not blocking yet'
}

// The block as the chat shows it. The tool returns it so the pane and the chat agree.
export function render(d: Decision): string {
  const lines = [
    `**${d.id} · ${d.title}** (${urgency(d)}; ${d.kind})`,
    '',
    d.stakes,
    '',
    d.context,
    '',
    ...d.options.map(o => `- **${o.letter}.** ${o.label}${o.detail ? ` — ${o.detail}` : ''}`),
    '',
    `**Recommendation: ${d.recommendation.option}.** ${d.recommendation.reason} ` +
      `*Wrong if* ${d.recommendation.wrongIf}`,
  ]
  if (d.artefacts?.length) lines.push('', `Look at: ${d.artefacts.join(', ')}`)
  return lines.join('\n')
}

export function counts(decisions: readonly Decision[]): { open: number; now: number } {
  const open = decisions.filter(d => d.status === 'open')
  return { open: open.length, now: open.filter(d => d.needed === 'now').length }
}

export function toJsonl(events: readonly Event[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '')
}

export function fromJsonl(text: string): Event[] {
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Event)
}

export const FILTERS: readonly FilterBy[] = ['open', 'blocking', 'all', 'closed']
export const GROUPS: readonly GroupBy[] = ['urgency', 'kind', 'none']
export const SORTS: readonly SortBy[] = ['urgency', 'newest', 'oldest']

export function cycle<T>(values: readonly T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length] as T
}

// The list screen's rows: filtered, then ordered. Open rows always come before closed ones.
export function arrange(decisions: readonly Decision[], show: FilterBy, order: SortBy): Decision[] {
  const kept = decisions.filter(d =>
    show === 'all' ? true
      : show === 'closed' ? d.status !== 'open'
        : show === 'blocking' ? d.status === 'open' && (d.needed === 'now' || d.needed === 'before')
          : d.status === 'open')
  if (order === 'urgency') return queue(kept)
  const sign = order === 'newest' ? -1 : 1
  return [...kept].sort((a, b) =>
    Number(a.status !== 'open') - Number(b.status !== 'open') || sign * a.createdAt.localeCompare(b.createdAt))
}

const NEEDED_TITLES: Record<Needed, string> = {
  now: 'Blocking now', before: 'Needed before a step', default: 'Proceeding on a default', whenever: 'Not blocking yet',
}
const KIND_TITLES: Record<Kind, string> = {
  gate: 'Approvals', 'plan-changing': 'Could change the plan', shaping: 'Design input', minor: 'Minor',
}

// Groups in a fixed order, keeping the arranged order inside each; closed rows form their own group.
export function group(decisions: readonly Decision[], by: GroupBy): [string, Decision[]][] {
  if (by === 'none') return decisions.length ? [['', [...decisions]]] : []
  const titles = by === 'urgency' ? NEEDED_TITLES : KIND_TITLES
  const out = new Map<string, Decision[]>(Object.values(titles).map(t => [t, []]))
  out.set('Closed', [])
  for (const d of decisions) {
    const key = d.status !== 'open' ? 'Closed' : by === 'urgency' ? NEEDED_TITLES[d.needed] : KIND_TITLES[d.kind]
    out.get(key)?.push(d)
  }
  return [...out.entries()].filter(([, rows]) => rows.length)
}
