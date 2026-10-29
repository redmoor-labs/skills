export type Needed = 'now' | 'before' | 'default' | 'whenever'
export type Kind = 'gate' | 'shaping' | 'plan-changing' | 'minor'
export type Status = 'open' | 'answered' | 'withdrawn' | 'superseded'
export type AnsweredBy = 'panel' | 'hub' | 'chat' | 'default'

export type Option = { letter: string; label: string; detail?: string }
export type Recommendation = { option: string; reason: string; wrongIf: string }
export type Where = { cwd: string; branch?: string; head?: string }

export type Fields = {
  title: string
  stakes: string
  context: string
  options: Option[]
  recommendation: Recommendation
  needed: Needed
  when?: string
  kind: Kind
  artefacts?: string[]
}

export type Event =
  | ({ type: 'ask'; id: string; at: string; where: Where } & Fields)
  | { type: 'revise'; id: string; at: string; changes: Partial<Fields>; reason: string }
  | { type: 'answer'; id: string; at: string; by: AnsweredBy; choice?: string; text: string }
  | { type: 'withdraw'; id: string; at: string; by: 'agent' | 'panel' | 'hub'; reason: string }
  | { type: 'supersede'; id: string; at: string; by: string; reason: string }
  | { type: 'revision-asked'; id: string; at: string; text: string }

// What the hub's inbox holds: an answer given on the hub, waiting for this session to apply it.
export type InboxItem =
  | { seq: number; id: string; action: 'answer'; choice?: string; text?: string }
  | { seq: number; id: string; action: 'withdraw'; text?: string }
  | { seq: number; id: string; action: 'revise'; text: string }

export type View = 'list' | 'detail'
export type GroupBy = 'urgency' | 'kind' | 'none'
export type FilterBy = 'open' | 'all' | 'closed' | 'blocking'
export type SortBy = 'urgency' | 'newest' | 'oldest'

declare module 'claude-code' {
  interface PluginState {
    'decision-queue': {
      events: Event[]
      selected: string
      draft: string
      logPath: string
      view: View
      groupBy: GroupBy
      filterBy: FilterBy
      sortBy: SortBy
    }
  }
}
