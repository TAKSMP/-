// =============================================================
//  ちょうむしページワン：きまり（エンジン）
// -------------------------------------------------------------
//  トランプの「ページワン」を ちょうむしカードで あそぶ。
//  ・ばの いちばん うえの カードと「おなじ 目（もく）」か「おなじ たいりょく」なら だせる
//  ・だせない ときは 山から 1まい ひく → だせたら そのまま だす／だせなければ
//    てふだに いれて つぎの ひとの ばん
//  ・ルールへんこう：だせる カードが でるまで ひきつづける（'until'）
//  ・のこり 1まいに なったら「ページワン！」、さいしょに 0まいに なった ひとの かち
//  カードは かず（cards の なんばんめか）で もつ。乱数は seed から つくる。
// =============================================================
import type { CpuLevel } from '../cardGame/cpu'
import type { Card } from '../cardGame/cards'

export type DrawMode = 'one' | 'until'

// ページワンで つかう カード（カードバトルの カード そのもの）
export interface PCard extends Card {
  p?: number // しゃしんの ばんごう（つうしん よう）
}

export interface POPlayer {
  id: string
  name: string
  cpu?: CpuLevel
}

export interface POEvent {
  t: 'start' | 'play' | 'draw' | 'keep' | 'pass' | 'pageone' | 'win' | 'reshuffle' | 'leave' | 'call' | 'early' | 'forgot'
  pid?: string
  card?: number
  n?: number
}

export interface POState {
  players: POPlayer[]
  hands: Record<string, number[]>
  pile: number[]
  discard: number[] // さいごが ばの いちばん うえ
  turn: number
  drawMode: DrawMode
  handSize: number
  winner: string | null
  called?: string // この ばんに「ちょうむしワン！！」と いった ひと
  out?: POPlayer[] // いいわすれて まけた ひと
  log: POEvent[] // さいごの 1てで おきた こと
  seq: number // てを すすめる たびに ふえる
  seed: number
}

export type POAction = { type: 'play'; card: number } | { type: 'draw' } | { type: 'call' }
export const CALL_WORD = 'ちょうむしワン！！'

// -------------------------------------------------------------
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    get seed() {
      return s
    },
  }
}
function shuffle<T>(xs: T[], r: { next(): number }): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const HAND_MIN = 4
export const HAND_MAX = 7
export const HAND_DEFAULT = 4
export const MAX_PLAYERS = 6

export function canPlay(cards: PCard[], c: number, top: number | undefined): boolean {
  if (top === undefined) return true
  const a = cards[c]
  const b = cards[top]
  return !!a && !!b && (a.order === b.order || a.hp === b.hp)
}
export const topOf = (st: POState): number | undefined => st.discard[st.discard.length - 1]
export const current = (st: POState): POPlayer | undefined => st.players[st.turn]
export const playableOf = (st: POState, cards: PCard[], pid: string): number[] =>
  (st.hands[pid] ?? []).filter((c) => canPlay(cards, c, topOf(st)))

export function createPageOne(
  cardCount: number,
  players: POPlayer[],
  drawMode: DrawMode,
  handSize = HAND_DEFAULT,
  seed = Date.now() & 0x7fffffff,
): POState {
  const r = rng(seed)
  const deck = shuffle(
    Array.from({ length: cardCount }, (_, i) => i),
    r,
  )
  const size = Math.max(HAND_MIN, Math.min(HAND_MAX, handSize))
  const hands: Record<string, number[]> = {}
  for (const p of players) hands[p.id] = deck.splice(0, size)
  const first = deck.shift()
  const start = Math.floor(r.next() * players.length)
  return {
    players,
    hands,
    pile: deck,
    discard: first === undefined ? [] : [first],
    turn: start,
    drawMode,
    handSize: size,
    winner: null,
    log: [{ t: 'start', pid: players[start]?.id, card: first }],
    seq: 1,
    seed: r.seed,
  }
}

// つうしんで とどいた じょうたいを なおす（からの はいれつは とどかない）
export function hydratePO(raw: POState): POState {
  const s = raw as Partial<POState>
  const players = s.players ?? []
  const hands: Record<string, number[]> = {}
  for (const p of players) hands[p.id] = s.hands?.[p.id] ?? []
  return {
    players,
    hands,
    pile: s.pile ?? [],
    discard: s.discard ?? [],
    turn: s.turn ?? 0,
    drawMode: s.drawMode ?? 'one',
    handSize: s.handSize ?? HAND_DEFAULT,
    winner: s.winner ?? null,
    called: s.called ?? undefined,
    out: s.out ?? [],
    log: s.log ?? [],
    seq: s.seq ?? 0,
    seed: s.seed ?? 1,
  }
}

const clone = (st: POState): POState => JSON.parse(JSON.stringify(st))

// 山が なくなったら、ばの カード（いちばん うえ いがい）を まぜて 山に もどす
function drawOne(st: POState, pid: string, r: { next(): number }, log: POEvent[]): number | undefined {
  if (!st.pile.length && st.discard.length > 1) {
    const top = st.discard.pop()!
    st.pile = shuffle(st.discard, r)
    st.discard = [top]
    log.push({ t: 'reshuffle' })
  }
  const c = st.pile.shift()
  if (c !== undefined) st.hands[pid].push(c)
  return c
}

function nextTurn(st: POState) {
  if (st.players.length) st.turn = (st.turn + 1) % st.players.length
}

// その ひとを ゲームから はずす（てふだは 山の したへ）
function dropPlayer(st: POState, pid: string, log: POEvent[]) {
  const idx = st.players.findIndex((p) => p.id === pid)
  if (idx < 0) return
  st.pile.push(...(st.hands[pid] ?? []))
  st.hands[pid] = []
  const [p] = st.players.splice(idx, 1)
  st.out = [...(st.out ?? []), p]
  if (idx < st.turn) st.turn -= 1
  if (st.turn >= st.players.length) st.turn = 0
  if (st.players.length === 1) {
    st.winner = st.players[0].id
    log.push({ t: 'win', pid: st.winner })
  }
}

function doPlay(st: POState, pid: string, c: number, log: POEvent[], drawn = false) {
  st.hands[pid] = st.hands[pid].filter((x) => x !== c)
  st.discard.push(c)
  log.push({ t: 'play', pid, card: c, n: drawn ? 1 : undefined })
  const left = st.hands[pid].length
  const said = st.called === pid
  st.called = undefined
  if (left === 0) {
    st.winner = pid
    log.push({ t: 'win', pid })
    return
  }
  // のこり 1まいに なる ときに「ちょうむしワン！！」と いって いなければ まけ
  if (left === 1 && !drawn && !said) {
    log.push({ t: 'forgot', pid })
    dropPlayer(st, pid, log)
    return
  }
  if (left === 1) log.push({ t: 'pageone', pid })
  nextTurn(st)
}

// 1て すすめる（できない ことを しようと したら そのまま かえす）
export function applyAction(input: POState, cards: PCard[], pid: string, act: POAction): POState {
  if (input.winner || current(input)?.id !== pid) return input
  const st = clone(input)
  const r = rng(st.seed)
  const log: POEvent[] = []
  if (act.type === 'call') {
    if (st.called === pid) return input
    if ((st.hands[pid]?.length ?? 0) === 2) {
      st.called = pid
      log.push({ t: 'call', pid })
    } else {
      log.push({ t: 'early', pid })
    }
  } else if (act.type === 'play') {
    if (!st.hands[pid]?.includes(act.card) || !canPlay(cards, act.card, topOf(st))) return input
    doPlay(st, pid, act.card, log)
  } else {
    if (playableOf(st, cards, pid).length) return input // だせる カードが ある ときは ひけない
    st.called = undefined
    let count = 0
    for (;;) {
      const c = drawOne(st, pid, r, log)
      if (c === undefined) {
        if (count) log.push({ t: 'draw', pid, n: count })
        log.push({ t: 'pass', pid })
        nextTurn(st)
        break
      }
      count++
      if (canPlay(cards, c, topOf(st))) {
        log.push({ t: 'draw', pid, n: count })
        doPlay(st, pid, c, log, true)
        break
      }
      if (st.drawMode === 'one') {
        log.push({ t: 'draw', pid, n: count })
        log.push({ t: 'keep', pid })
        nextTurn(st)
        break
      }
    }
  }
  st.log = log
  st.seq += 1
  st.seed = r.seed
  for (const e of st.log) for (const k of Object.keys(e) as (keyof POEvent)[]) if (e[k] === undefined) delete e[k]
  return st
}

// とちゅうで ぬけた ひと：てふだを 山の したに もどす
export function removePlayer(input: POState, pid: string): POState {
  const idx = input.players.findIndex((p) => p.id === pid)
  if (idx < 0 || input.winner) return input
  const st = clone(input)
  st.pile.push(...(st.hands[pid] ?? []))
  delete st.hands[pid]
  st.players.splice(idx, 1)
  if (idx < st.turn) st.turn -= 1
  if (st.turn >= st.players.length) st.turn = 0
  st.log = [{ t: 'leave', pid }]
  if (st.called === pid) st.called = undefined
  if (st.players.length === 1) {
    st.winner = st.players[0].id
    st.log.push({ t: 'win', pid: st.winner })
  }
  st.seq += 1
  return st
}

// -------------------------------------------------------------
//  コンピューター
// -------------------------------------------------------------
export function cpuAction(st: POState, cards: PCard[], pid: string, level: CpuLevel = 'normal', rand = Math.random): POAction {
  const ok = playableOf(st, cards, pid)
  if (!ok.length) return { type: 'draw' }
  // のこり 2まいで だせる ときは「ちょうむしワン！！」（ときどき いいわすれる）
  if (st.hands[pid].length === 2 && st.called !== pid && rand() >= (level === 'easy' ? 0.25 : 0.1)) return { type: 'call' }
  if (level === 'easy' || rand() < 0.15) return { type: 'play', card: ok[Math.floor(rand() * ok.length)] }
  // だした あとで つづけて だしやすい カードを えらぶ
  const hand = st.hands[pid]
  let best = ok[0]
  let bestScore = -1
  for (const c of ok) {
    const rest = hand.filter((x) => x !== c)
    const follow = rest.filter((x) => canPlay(cards, x, c)).length
    const s = follow + rand() * 0.5
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return { type: 'play', card: best }
}
