// =============================================================
//  ちょうむしカードゲーム：たたかいの きまり（エンジン）
// -------------------------------------------------------------
//  紙の カードゲームの ルールブックと おなじ うごきを する。
//  ・デッキ 4まい：まえに 2ひき・ひかえに 2ひき（デッキの じゅんばん）
//  ・ラウンドごとに、まえの 虫ぜんいんの わざ（または こうげき）を きめる
//  ・すばやい じゅんに うごく（⚡さきに うごく わざが いちばん さき）
//  ・ダメージ ＝ わざの かず ＋ じぶんの 🔺×5 － あいての 🛡️×5（さいてい 5）
//  ・ラウンドの おわり：⏳・☠️どく・☀️・🩸 → たおれた虫の かわりに ひかえが でる
//  ・あいての 4ひきを ぜんぶ たおしたら かち
//  乱数は state.seed から つくる（つうしんでは ホストだけが けいさんする）。
// =============================================================
import type { StatusKey } from '../../types'
import { POISON_DMG, r5, STATUS_ICON, type Card, type CardMove, type ChipStat } from './cards'

export type SideId = 'a' | 'b'
export const other = (s: SideId): SideId => (s === 'a' ? 'b' : 'a')

export interface Chips {
  attack: number
  defense: number
  speed: number
}

export interface CF {
  uid: string // 'a0'〜'a3' / 'b0'〜'b3'
  side: SideId
  card: Card
  hp: number
  fainted: boolean
  usesLeft: number[]
  chips: Chips
  status: StatusKey[]
  deep?: boolean // ふかい ねむり（🎲6 で しか おきない）
  charging?: { move: number; target?: string } | null
  hidden?: boolean
  resting?: number
  regen?: { per: number; n: number } | null
  leech: { per: number; n: number; from: string }[]
  sealed?: number
  guardBoosts?: boolean
}

// ひょうじ用の みじかい すがた（イベントごとに のこす）
export interface Snap {
  u: string
  h: number
  f?: 1
  s?: string // ☠️💤⚡
  c?: [number, number, number] // 🔺🛡️💨 の かず（－は 🔻💔🐢）
  x?: string // 🙈 かくれる／✊ ためる／😪 やすみ／☀️／🩸／🔒
}

export type Fx = 'hit' | 'heal' | 'status' | 'faint' | 'miss' | 'buff' | 'debuff' | 'info' | 'enter' | 'big'

export interface CEvent {
  t: string // ぶん（@a0@ は あとで なまえに かえる）
  d?: number // サイコロの め
  a?: string // うごいた 虫
  g?: string[] // ねらわれた 虫
  fx?: Fx
  n?: number // ダメージ・かいふくの かず
  act: Record<SideId, string[]>
  snap: Snap[]
}

export interface CState {
  fighters: CF[]
  active: Record<SideId, string[]>
  round: number
  delayed: { from: string; side: SideId; target: string; dmg: number; at: number; name: string }[]
  over: boolean
  winner: SideId | 'draw' | null
  events: CEvent[]
  seed: number
}

export interface CCommand {
  uid: string
  move: number // -1 = ふつうの こうげき
  target?: string
}

export const MAX_ROUNDS = 40
export const BASIC: Pick<CardMove, 'name' | 'emoji'> = { name: 'こうげき', emoji: '⚔️' }

// -------------------------------------------------------------
//  らんすう（シードつき）
// -------------------------------------------------------------
function makeRng(seed: number) {
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
type Rng = ReturnType<typeof makeRng>

// -------------------------------------------------------------
//  はじめの じょうたい
// -------------------------------------------------------------
export function createGame(deckA: Card[], deckB: Card[], seed = Date.now() & 0x7fffffff): CState {
  const mk = (c: Card, side: SideId, i: number): CF => ({
    uid: `${side}${i}`,
    side,
    card: c,
    hp: c.hp,
    fainted: false,
    usesLeft: c.moves.map((m) => m.uses),
    chips: { attack: 0, defense: 0, speed: 0 },
    status: [],
    leech: [],
  })
  const fighters = [...deckA.map((c, i) => mk(c, 'a', i)), ...deckB.map((c, i) => mk(c, 'b', i))]
  const st: CState = {
    fighters,
    active: { a: ['a0', 'a1'].slice(0, deckA.length), b: ['b0', 'b1'].slice(0, deckB.length) },
    round: 1,
    delayed: [],
    over: false,
    winner: null,
    events: [],
    seed,
  }
  st.events = [mkEvent(st, { t: 'バトル スタート！', fx: 'big' })]
  return st
}

// つうしんで とどいた じょうたいを なおす（Firebase は からの はいれつ・null を おとす）
export function hydrate(raw: CState): CState {
  const s = raw as Partial<CState>
  return {
    fighters: (s.fighters ?? []).map((f) => ({
      ...f,
      card: { ...f.card, moves: f.card.moves ?? [] },
      usesLeft: f.usesLeft ?? [],
      chips: f.chips ?? { attack: 0, defense: 0, speed: 0 },
      status: f.status ?? [],
      leech: f.leech ?? [],
    })),
    active: { a: s.active?.a ?? [], b: s.active?.b ?? [] },
    round: s.round ?? 1,
    delayed: s.delayed ?? [],
    over: !!s.over,
    winner: s.winner ?? null,
    events: (s.events ?? []).map((e) => ({ ...e, act: { a: e.act?.a ?? [], b: e.act?.b ?? [] }, snap: e.snap ?? [] })),
    seed: s.seed ?? 1,
  }
}

// -------------------------------------------------------------
//  しらべる どうぐ
// -------------------------------------------------------------
export const fighter = (st: CState, uid: string): CF => st.fighters.find((f) => f.uid === uid)!
export const alive = (f: CF | null | undefined): f is CF => !!f && !f.fainted
export const activeOf = (st: CState, side: SideId): CF[] =>
  st.active[side].map((u) => fighter(st, u)).filter(alive)
export const benchOf = (st: CState, side: SideId): CF[] =>
  st.fighters.filter((f) => f.side === side && !f.fainted && !st.active[side].includes(f.uid))

export function moveOf(f: CF, idx: number): CardMove | null {
  return idx >= 0 ? f.card.moves[idx] ?? null : null
}

// その虫は この ラウンド わざを えらぶ ひつようが あるか
export function needsCommand(st: CState, f: CF): boolean {
  return !st.over && alive(f) && st.active[f.side].includes(f.uid) && !f.charging && !(f.resting && f.resting > 0)
}

// わざで えらぶ あいて（'foe' あいて1ぴき／'ally' みかた1ぴき／null えらばない）
export function targetKind(m: CardMove | null): 'foe' | 'ally' | null {
  if (!m) return 'foe'
  if (m.target === 'ally') return 'ally'
  if (m.target === 'oneFoe') return 'foe'
  if (m.target === 'allFoes' || m.target === 'allOthers' || m.target === 'selfSide' || m.target === 'fallenAlly') return null
  if (m.chips?.some((c) => c.who === 'foe') || m.steal || m.swap || m.hpToOne || m.leech || m.seal || m.flatten)
    return 'foe'
  if (m.inflict && m.kind !== 'heal') return 'foe'
  return null
}

export function effSpeed(f: CF): number {
  let s = f.card.speed + 3 * f.chips.speed
  if (f.status.includes('paralysis')) s = Math.floor(s / 2)
  return Math.max(1, s)
}

export function snapOf(f: CF): Snap {
  const x =
    (f.hidden ? '🙈' : '') +
    (f.charging && !f.hidden ? '✊' : '') +
    (f.resting ? '😪' : '') +
    (f.regen ? '☀️'.repeat(f.regen.n) : '') +
    (f.leech.length ? '🩸'.repeat(f.leech.reduce((a, l) => a + l.n, 0)) : '') +
    (f.sealed ? '🔒' : '')
  const c: [number, number, number] = [f.chips.attack, f.chips.defense, f.chips.speed]
  const s: Snap = { u: f.uid, h: f.hp }
  if (f.fainted) s.f = 1
  if (f.status.length) s.s = f.status.map((k) => STATUS_ICON[k]).join('')
  if (c.some((v) => v)) s.c = c
  if (x) s.x = x
  return s
}

function mkEvent(st: CState, e: Omit<CEvent, 'act' | 'snap'>): CEvent {
  const ev: CEvent = { ...e, act: { a: [...st.active.a], b: [...st.active.b] }, snap: st.fighters.map(snapOf) }
  for (const k of Object.keys(ev) as (keyof CEvent)[]) if (ev[k] === undefined) delete ev[k]
  return ev
}

const N = (f: CF) => `@${f.uid}@`
const dieFace = (n: number) => `🎲${n}`

// -------------------------------------------------------------
//  1ラウンド すすめる
// -------------------------------------------------------------
export function resolveRound(input: CState, commands: CCommand[]): CState {
  const st: CState = JSON.parse(JSON.stringify(input))
  st.events = []
  const rng = makeRng(st.seed)
  const ctx = new Ctx(st, rng)
  ctx.run(commands)
  st.seed = rng.seed
  return st
}

interface Action {
  f: CF
  moveIdx: number
  move: CardMove | null // null = ふつうの こうげき
  target?: string
  release: boolean // ためた わざを はなつ
  pri: number
  spd: number
  tie: number
}

class Ctx {
  st: CState
  rng: Rng
  acted = new Set<string>()
  dmgTaken = new Map<string, { n: number; by: string }>()
  guards = new Map<string, number>()

  constructor(st: CState, rng: Rng) {
    this.st = st
    this.rng = rng
  }

  ev(e: Omit<CEvent, 'act' | 'snap'>) {
    this.st.events.push(mkEvent(this.st, e))
  }
  dice(): number {
    return 1 + Math.floor(this.rng.next() * 6)
  }
  pick<T>(xs: T[]): T {
    return xs[Math.floor(this.rng.next() * xs.length)]
  }
  isActive(f: CF): boolean {
    return alive(f) && this.st.active[f.side].includes(f.uid)
  }

  run(commands: CCommand[]) {
    const st = this.st
    st.events.push(mkEvent(st, { t: `ラウンド ${st.round}`, fx: 'big' }))
    const actions: Action[] = []
    for (const side of ['a', 'b'] as SideId[]) {
      for (const f of activeOf(st, side)) {
        if (f.resting && f.resting > 0) {
          actions.push({ f, moveIdx: -2, move: null, release: false, pri: 9, spd: 99, tie: 0 })
          continue
        }
        if (f.charging) {
          const m = moveOf(f, f.charging.move)
          actions.push({ f, moveIdx: f.charging.move, move: m, target: f.charging.target, release: true, pri: 0, spd: effSpeed(f), tie: this.rng.next() })
          continue
        }
        const cmd = commands.find((c) => c.uid === f.uid)
        let idx = cmd?.move ?? -1
        if (idx >= 0 && (f.usesLeft[idx] ?? 0) <= 0) idx = -1
        const m = moveOf(f, idx)
        actions.push({ f, moveIdx: idx, move: m, target: cmd?.target, release: false, pri: m?.priority ?? 0, spd: effSpeed(f), tie: this.rng.next() })
      }
    }
    actions.sort((x, y) => y.pri - x.pri || y.spd - x.spd || y.tie - x.tie)
    // かまえ（counterGuard）は うごく まえから かまえている
    for (const a of actions) if (a.move?.guard && !a.release) this.guards.set(a.f.uid, a.move.guard)

    for (const a of actions) {
      if (st.over) break
      if (!this.isActive(a.f)) continue
      this.act(a)
      this.acted.add(a.f.uid)
      this.checkOver()
    }
    if (!st.over) this.endOfRound()
  }

  act(a: Action) {
    const f = a.f
    if (a.moveIdx === -2) {
      f.resting = Math.max(0, (f.resting ?? 1) - 1)
      this.ev({ t: `${N(f)}は つかれて やすんでいる…`, a: f.uid, fx: 'info' })
      return
    }
    // ねむり：🎲4〜6（ふかい ねむりは 6）で おきる
    if (f.status.includes('sleep')) {
      const d = this.dice()
      const need = f.deep ? 6 : 4
      if (d >= need) {
        f.status = f.status.filter((s) => s !== 'sleep')
        f.deep = false
        this.ev({ t: `${dieFace(d)} ${N(f)}は めを さました！`, d, a: f.uid, fx: 'info' })
      } else {
        this.ev({ t: `${dieFace(d)} ${N(f)}は ねむっている… 💤`, d, a: f.uid, fx: 'status' })
        if (a.release) {
          f.charging = null
          f.hidden = false
        }
        return
      }
    }
    // まひ：🎲1 で うごけない
    if (f.status.includes('paralysis')) {
      const d = this.dice()
      if (d === 1) {
        this.ev({ t: `${dieFace(d)} ${N(f)}は しびれて うごけない！ ⚡`, d, a: f.uid, fx: 'status' })
        return
      }
    }
    let move = a.move
    let idx = a.moveIdx
    if (!a.release && move && f.sealed && f.sealed > 0) {
      this.ev({ t: `${N(f)}は わざが つかえない！ 🔒 かわりに こうげき`, a: f.uid, fx: 'info' })
      move = null
      idx = -1
    }
    if (!a.release && idx >= 0) f.usesLeft[idx] = Math.max(0, (f.usesLeft[idx] ?? 1) - 1)

    if (!move) {
      this.ev({ t: `${N(f)}の ⚔️こうげき！`, a: f.uid, fx: 'info' })
      this.attack(f, { name: 'こうげき', emoji: '⚔️', dmg: f.card.basic, target: 'oneFoe' } as CardMove, a.target)
      return
    }
    // ためる・かくれる
    if (move.charge && !a.release) {
      f.charging = { move: idx, target: a.target }
      f.hidden = move.charge === 'hide'
      this.ev({
        t: `${N(f)}の ${move.emoji}${move.name}！ ${move.charge === 'hide' ? 'すがたを かくした！ 🙈' : 'ちからを ためている… ✊'}`,
        a: f.uid,
        fx: 'info',
      })
      return
    }
    if (a.release) {
      f.charging = null
      f.hidden = false
    }
    this.ev({ t: `${N(f)}の ${move.emoji}${move.name}！`, a: f.uid, fx: move.ultimate ? 'big' : 'info' })
    if (move.copy) {
      const foes = activeOf(this.st, other(f.side))
      const pool = foes.flatMap((x) => x.card.moves.filter((m) => !m.copy && !m.charge))
      if (!pool.length) {
        this.ev({ t: 'まねできる わざが なかった…', fx: 'miss' })
        return
      }
      const m = this.pick(pool)
      this.ev({ t: `あいての ${m.emoji}${m.name}を まねした！ 🪞`, a: f.uid, fx: 'info' })
      move = m
    }
    this.doMove(f, move, a.target)
  }

  // ねらう あいてを きめる
  foeTarget(f: CF, want?: string): CF | null {
    const foes = activeOf(this.st, other(f.side))
    const w = want ? foes.find((x) => x.uid === want) : undefined
    if (w) return w
    if (!foes.length) return null
    const visible = foes.filter((x) => !x.hidden)
    return (visible.length ? visible : foes)[0]
  }
  allyTarget(f: CF, want?: string): CF {
    const mine = activeOf(this.st, f.side)
    return (want && mine.find((x) => x.uid === want)) || f
  }

  doMove(f: CF, m: CardMove, want?: string) {
    if (m.hpCost) {
      const pay = Math.min(m.hpCost, Math.max(0, f.hp - 5))
      if (pay > 0) {
        f.hp -= pay
        this.ev({ t: `${N(f)}は たいりょくを ${pay} つかった`, a: f.uid, n: pay, fx: 'hit' })
      }
    }
    if (m.dmg) {
      this.attack(f, m, want)
      return
    }
    if (m.chaos) {
      this.chaos(f, m.chaos === 'super')
      return
    }
    // あいてに かかる へんかわざは 🎲で しっぱい する ことが ある
    const foeSide = targetKind(m) === 'foe' || m.target === 'allFoes'
    if (foeSide && m.missOn) {
      const d = this.dice()
      if (d <= m.missOn) {
        this.ev({ t: `${dieFace(d)} しっぱい…`, d, a: f.uid, fx: 'miss' })
        return
      }
    }
    const foes: CF[] =
      m.target === 'allFoes' ? activeOf(this.st, other(f.side)) : foeSide ? [this.foeTarget(f, want)].filter(alive) : []
    const hiddenOnly = foes.length > 0 && foes.every((x) => x.hidden)
    if (hiddenOnly) {
      this.ev({ t: 'あいては かくれていて とどかない！', fx: 'miss' })
      return
    }
    const live = foes.filter((x) => !x.hidden)
    const friends: CF[] =
      m.target === 'selfSide' ? activeOf(this.st, f.side) : m.target === 'ally' ? [this.allyTarget(f, want)] : [f]

    if (m.restSleep) {
      this.heal(f, f.card.hp)
      this.setStatus(f, 'sleep', false, true)
    }
    if (m.heal) for (const t of friends) this.heal(t, m.heal)
    if (m.cure) for (const t of friends) this.cure(t, m.cure)
    if (m.regen) {
      for (const t of friends) {
        t.regen = { per: m.regen.per, n: m.regen.n }
        this.ev({ t: `${N(t)}に ☀️が ${m.regen.n}こ ついた`, g: [t.uid], fx: 'buff' })
      }
    }
    if (m.restore) {
      for (const t of friends) {
        t.chips = { attack: Math.max(0, t.chips.attack), defense: Math.max(0, t.chips.defense), speed: Math.max(0, t.chips.speed) }
      }
      this.ev({ t: `${N(f)}の 🔻💔🐢が なくなった！`, a: f.uid, fx: 'buff' })
    }
    if (m.revive) this.revive(f, m.revive.ratio, m.revive.need)
    if (m.guard) this.ev({ t: `${N(f)}は かまえている！ こうげき されたら ${m.guard}ダメージ かえす`, a: f.uid, fx: 'buff' })
    if (m.counter) {
      const got = this.dmgTaken.get(f.uid)
      const src = got ? fighter(this.st, got.by) : undefined
      if (!got || !this.isActive(src!)) {
        this.ev({ t: 'でも なにも おこらなかった…', fx: 'miss' })
      } else {
        this.damage(src!, Math.min(60, r5(got.n * m.counter)), f, `${N(f)}の しかえし！`)
      }
    }
    if (m.guardBoosts) {
      f.guardBoosts = true
      this.ev({ t: `${N(f)}の チップは とられなくなった！`, a: f.uid, fx: 'buff' })
    }
    for (const t of live) {
      if (m.inflict && !m.dmg) this.tryInflict(t, m.inflict.status, m.inflict.need, !!m.inflict.deep)
      if (m.hpToOne && t.hp > 5) {
        t.hp = 5
        this.ev({ t: `${N(t)}の たいりょくが 5に なった！`, g: [t.uid], fx: 'hit' })
      }
      if (m.leech) {
        t.leech.push({ per: m.leech.per, n: m.leech.n, from: f.uid })
        this.ev({ t: `${N(t)}に 🩸が ${m.leech.n}こ ついた`, g: [t.uid], fx: 'debuff' })
      }
      if (m.steal) this.steal(f, t)
      if (m.swap) this.swap(f, t)
      if (m.flatten) this.flatten(t)
      if (m.seal) this.seal(t)
    }
    this.applyChips(f, m, live, friends)
  }

  attack(f: CF, m: CardMove, want?: string) {
    const st = this.st
    // ねらう あいて
    let targets: CF[]
    if (m.target === 'allFoes') targets = activeOf(st, other(f.side))
    else if (m.target === 'allOthers') targets = [...activeOf(st, other(f.side)), ...activeOf(st, f.side).filter((x) => x !== f)]
    else {
      const t = this.foeTarget(f, want)
      targets = t ? [t] : []
    }
    if (!targets.length) {
      this.ev({ t: 'でも あいてが いない…', fx: 'miss' })
      return
    }
    // ⏳ あとから あたる
    if (m.delay) {
      for (const t of targets) st.delayed.push({ from: f.uid, side: t.side, target: t.uid, dmg: m.dmg!, at: st.round + m.delay, name: m.name })
      this.ev({ t: `⏳ ${m.delay}ラウンド あとに あたるよ！`, a: f.uid, fx: 'info' })
      if (m.rest) f.resting = 1
      return
    }
    const hiddenHit = targets.filter((t) => t.hidden)
    for (const t of hiddenHit) this.ev({ t: `${N(t)}は かくれていて あたらない！`, g: [t.uid], fx: 'miss' })
    targets = targets.filter((t) => !t.hidden)
    if (!targets.length) {
      if (m.rest) f.resting = 1
      return
    }
    if (m.missOn) {
      const d = this.dice()
      if (d <= m.missOn) {
        this.ev({ t: `${dieFace(d)} はずれた！`, d, a: f.uid, fx: 'miss' })
        if (m.rest) f.resting = 1
        return
      }
    }
    let hits = 1
    if (m.hits) {
      if (m.hits[0] === m.hits[1]) hits = m.hits[0]
      else {
        const d = this.dice()
        hits = Math.max(m.hits[0], Math.min(m.hits[1], d))
        this.ev({ t: `${dieFace(d)} ${hits}かい こうげき！`, d, a: f.uid, fx: 'info' })
      }
    }
    let crit = false
    if (m.crit) {
      const d = this.dice()
      crit = d === 6
      if (crit) this.ev({ t: `${dieFace(d)} きゅうしょに あたった！`, d, a: f.uid, fx: 'big' })
    }
    let total = 0
    for (const t of targets) {
      let sum = 0
      for (let i = 0; i < hits; i++) {
        if (!alive(t)) break
        let v = m.dmg ?? 0
        if (m.plusFoeStatus && t.status.length) v += m.plusFoeStatus
        if (m.plusSelfStatus && f.status.length) v += m.plusSelfStatus
        if (m.plusLate && this.acted.has(t.uid)) v += m.plusLate
        if (m.plusFoeUlt && t.card.moves.some((x) => x.ultimate)) v += m.plusFoeUlt
        v = Math.max(5, v + 5 * f.chips.attack - 5 * t.chips.defense)
        if (crit) v += r5(v / 2, 0)
        sum += this.damage(t, v, f, hits > 1 ? undefined : '', hits > 1)
      }
      if (hits > 1 && sum > 0) this.ev({ t: `${N(t)}に ごうけい ${sum}ダメージ！`, g: [t.uid], n: sum, fx: 'hit' })
      total += sum
      // かまえ（はんげき）
      const g = this.guards.get(t.uid)
      if (g && alive(t) && alive(f) && t.side !== f.side && sum > 0) this.damage(f, g, t, `${N(t)}の はんげき！`)
    }
    if (m.drain && total > 0 && alive(f)) this.heal(f, r5(total * m.drain))
    if (m.recoil && total > 0 && alive(f)) this.damage(f, r5(total * m.recoil), f, `${N(f)}も はんどうを うけた`)
    if (m.selfHeal && alive(f)) {
      this.heal(f, m.selfHeal)
      if (f.status.length) this.cure(f, 'all')
    }
    const live = targets.filter(alive)
    if (m.inflict) {
      const d = m.inflict.need > 1 ? this.dice() : 0
      for (const t of live) this.tryInflict(t, m.inflict.status, m.inflict.need, !!m.inflict.deep, d)
    }
    if (m.seal) for (const t of live) this.seal(t)
    this.applyChips(f, m, live, [f])
    if (m.rest && alive(f)) {
      f.resting = 1
      this.ev({ t: `${N(f)}は つぎの ラウンド やすみ 😪`, a: f.uid, fx: 'info' })
    }
  }

  // ダメージを あたえる（あたえた かずを かえす）。label が '' なら ふつうの ぶん、undefined なら ぶんを ださない
  damage(t: CF, v: number, by: CF, label?: string, quiet = false): number {
    if (!alive(t)) return 0
    const n = Math.min(t.hp, v)
    t.hp -= n
    const prev = this.dmgTaken.get(t.uid)
    this.dmgTaken.set(t.uid, { n: (prev?.n ?? 0) + n, by: by.uid })
    void quiet
    this.ev({ t: `${label ? label + ' ' : ''}${N(t)}に ${v}ダメージ！`, a: by.uid, g: [t.uid], n: v, fx: 'hit' })
    if (t.hp <= 0) this.faint(t)
    return n
  }

  faint(t: CF) {
    t.hp = 0
    t.fainted = true
    t.charging = null
    t.hidden = false
    t.resting = 0
    t.regen = null
    t.leech = []
    t.status = []
    t.chips = { attack: 0, defense: 0, speed: 0 }
    this.ev({ t: `${N(t)}は たおれた！`, g: [t.uid], fx: 'faint' })
  }

  heal(t: CF, v: number) {
    if (!alive(t)) return
    const n = Math.min(v, t.card.hp - t.hp)
    if (n <= 0) {
      this.ev({ t: `${N(t)}の たいりょくは もう いっぱい`, g: [t.uid], fx: 'info' })
      return
    }
    t.hp += n
    this.ev({ t: `${N(t)}は ${n} かいふく！`, g: [t.uid], n, fx: 'heal' })
  }

  cure(t: CF, what: 'all' | StatusKey) {
    const before = t.status.length
    t.status = what === 'all' ? [] : t.status.filter((s) => s !== what)
    if (!t.status.includes('sleep')) t.deep = false
    if (t.status.length < before) this.ev({ t: `${N(t)}の じょうたいいじょうが なおった！ 💊`, g: [t.uid], fx: 'heal' })
  }

  setStatus(t: CF, k: StatusKey, deep: boolean, quietIfHave = false) {
    if (t.status.includes(k)) {
      if (!quietIfHave) this.ev({ t: `${N(t)}は もう ${STATUS_ICON[k]}`, g: [t.uid], fx: 'miss' })
      return
    }
    t.status.push(k)
    if (k === 'sleep') t.deep = deep
    const word = k === 'poison' ? 'どくに なった！' : k === 'sleep' ? 'ねむってしまった！' : 'まひした！'
    this.ev({ t: `${N(t)}は ${STATUS_ICON[k]}${word}`, g: [t.uid], fx: 'status' })
  }

  tryInflict(t: CF, k: StatusKey, need: number, deep: boolean, rolled = 0) {
    if (!alive(t)) return
    if (need > 1) {
      const d = rolled || this.dice()
      if (d < need) {
        this.ev({ t: `${dieFace(d)} ${N(t)}は ${STATUS_ICON[k]}に ならなかった`, d, g: [t.uid], fx: 'miss' })
        return
      }
      this.ev({ t: `${dieFace(d)} あたり！`, d, g: [t.uid], fx: 'info' })
    }
    this.setStatus(t, k, deep)
  }

  addChip(t: CF, stat: ChipStat, n: number) {
    if (!alive(t) || !n) return
    const before = t.chips[stat]
    t.chips[stat] = Math.max(-3, Math.min(3, before + n))
    const got = t.chips[stat] - before
    const up = { attack: '🔺', defense: '🛡️', speed: '💨' }[stat]
    const down = { attack: '🔻', defense: '💔', speed: '🐢' }[stat]
    if (!got) {
      this.ev({ t: `${N(t)}の チップは もう いっぱい`, g: [t.uid], fx: 'info' })
      return
    }
    this.ev({ t: `${N(t)}に ${(got > 0 ? up : down).repeat(Math.abs(got))}`, g: [t.uid], fx: got > 0 ? 'buff' : 'debuff' })
  }

  applyChips(f: CF, m: CardMove, foes: CF[], friends: CF[]) {
    if (!m.chips?.length) return
    let rolled = 0
    for (const c of m.chips) {
      if (c.need > 1) {
        rolled = rolled || this.dice()
        if (rolled < c.need) {
          this.ev({ t: `${dieFace(rolled)} チップは つかなかった`, d: rolled, fx: 'miss' })
          continue
        }
      }
      const who: CF[] =
        c.who === 'self' ? [f]
          : c.who === 'selfSide' ? activeOf(this.st, f.side)
            : c.who === 'ally' ? friends
              : c.who === 'foes' ? activeOf(this.st, other(f.side)).filter((x) => !x.hidden)
                : foes.length ? foes : [this.foeTarget(f)].filter(alive)
      for (const t of who) this.addChip(t, c.stat, c.n)
    }
  }

  steal(f: CF, t: CF) {
    if (t.guardBoosts) {
      this.ev({ t: `${N(t)}の チップは まもられている！`, g: [t.uid], fx: 'miss' })
      return
    }
    let got = false
    for (const k of ['attack', 'defense', 'speed'] as ChipStat[]) {
      if (t.chips[k] > 0) {
        f.chips[k] = Math.min(3, f.chips[k] + t.chips[k])
        t.chips[k] = 0
        got = true
      }
    }
    this.ev({ t: got ? `${N(t)}の チップを もらった！ 🫳` : 'もらえる チップが なかった…', g: [t.uid], fx: got ? 'buff' : 'miss' })
  }
  swap(f: CF, t: CF) {
    if (t.guardBoosts) {
      this.ev({ t: `${N(t)}の チップは まもられている！`, g: [t.uid], fx: 'miss' })
      return
    }
    const c = f.chips
    f.chips = t.chips
    t.chips = c
    this.ev({ t: `${N(f)}と ${N(t)}の チップを とりかえた！ 🔄`, g: [t.uid], fx: 'info' })
  }
  flatten(t: CF) {
    if (t.guardBoosts) {
      this.ev({ t: `${N(t)}の チップは まもられている！`, g: [t.uid], fx: 'miss' })
      return
    }
    t.chips = { attack: Math.min(0, t.chips.attack), defense: Math.min(0, t.chips.defense), speed: Math.min(0, t.chips.speed) }
    this.ev({ t: `${N(t)}の 🔺🛡️💨が なくなった！ 🧹`, g: [t.uid], fx: 'debuff' })
  }
  seal(t: CF) {
    t.sealed = 3 // この ラウンドの おわりで 1 へるので、つぎの 2ラウンド
    this.ev({ t: `${N(t)}は 2ラウンド わざが つかえない！ 🔒`, g: [t.uid], fx: 'debuff' })
  }

  revive(f: CF, ratio: number, need: number) {
    const fallen = this.st.fighters.filter((x) => x.side === f.side && x.fainted)
    if (!fallen.length) {
      this.ev({ t: 'たおれた みかたが いない…', fx: 'miss' })
      return
    }
    if (need > 1) {
      const d = this.dice()
      if (d < need) {
        this.ev({ t: `${dieFace(d)} ふっかつ しっぱい…`, d, fx: 'miss' })
        return
      }
      this.ev({ t: `${dieFace(d)} せいこう！`, d, fx: 'info' })
    }
    const t = fallen[0]
    t.fainted = false
    t.hp = Math.max(5, r5(t.card.hp * ratio))
    this.st.active[t.side] = this.st.active[t.side].filter((u) => u !== t.uid)
    this.ev({ t: `${N(t)}が ふっかつ！ ひかえに もどった 😇`, g: [t.uid], fx: 'heal' })
  }

  chaos(f: CF, strong: boolean) {
    const d = this.dice()
    const foes = activeOf(this.st, other(f.side))
    const foe = foes.length ? this.pick(foes) : null
    const k = strong ? Math.max(2, d) : d
    this.ev({ t: `${dieFace(d)} なにが おこるかな…？`, d, a: f.uid, fx: 'info' })
    if (k === 1) this.ev({ t: 'なにも おこらなかった！', fx: 'miss' })
    else if (k === 2) this.heal(f, strong ? 40 : 25)
    else if (k === 3 && foe) this.damage(foe, strong ? 40 : 25, f, '')
    else if (k === 4) for (const t of foes) this.setStatus(t, 'poison', false)
    else if (k === 5 && foe) this.setStatus(foe, 'sleep', false)
    else if (k === 6) {
      this.addChip(f, 'attack', 2)
      this.addChip(f, 'speed', 1)
      if (strong) for (const t of foes) this.damage(t, 20, f, '')
    }
  }

  checkOver() {
    const st = this.st
    const aLeft = st.fighters.some((x) => x.side === 'a' && !x.fainted)
    const bLeft = st.fighters.some((x) => x.side === 'b' && !x.fainted)
    if (aLeft && bLeft) return
    st.over = true
    st.winner = !aLeft && !bLeft ? 'draw' : aLeft ? 'a' : 'b'
  }

  endOfRound() {
    const st = this.st
    // ⏳
    for (const d of st.delayed.filter((x) => x.at <= st.round)) {
      let t = fighter(st, d.target)
      if (!this.isActive(t)) t = activeOf(st, d.side)[0]
      const by = fighter(st, d.from)
      if (t) this.damage(t, d.dmg, by, `⏳${d.name}が おちてきた！`)
      this.checkOver()
      if (st.over) return
    }
    st.delayed = st.delayed.filter((x) => x.at > st.round)
    for (const side of ['a', 'b'] as SideId[]) {
      for (const f of activeOf(st, side)) {
        if (f.status.includes('poison')) this.damage(f, POISON_DMG, f, '☠️どくの ダメージ。')
        if (alive(f) && f.regen) {
          this.heal(f, f.regen.per)
          f.regen.n -= 1
          if (f.regen.n <= 0) f.regen = null
        }
        if (alive(f) && f.leech.length) {
          for (const l of f.leech) {
            if (!alive(f)) break
            const src = fighter(st, l.from)
            this.damage(f, l.per, src ?? f, '🩸すいとられた。')
            if (src && this.isActive(src)) this.heal(src, l.per)
            l.n -= 1
          }
          f.leech = f.leech.filter((l) => l.n > 0)
        }
        if (f.sealed) f.sealed -= 1
        this.checkOver()
        if (st.over) return
      }
    }
    // たおれた虫の かわりに ひかえが でる
    for (const side of ['a', 'b'] as SideId[]) {
      st.active[side] = st.active[side].filter((u) => alive(fighter(st, u)))
      while (st.active[side].length < 2) {
        const next = benchOf(st, side)[0]
        if (!next) break
        st.active[side].push(next.uid)
        this.ev({ t: `${N(next)}が でてきた！`, g: [next.uid], fx: 'enter' })
      }
    }
    st.round += 1
    if (!st.over && st.round > MAX_ROUNDS) {
      // ながすぎる ときは のこりの たいりょくで きめる
      const left = (s: SideId) => st.fighters.filter((x) => x.side === s).reduce((a, x) => a + x.hp / x.card.hp, 0)
      const a = left('a')
      const b = left('b')
      st.over = true
      st.winner = Math.abs(a - b) < 0.01 ? 'draw' : a > b ? 'a' : 'b'
      this.ev({ t: 'じかんぎれ！ のこりの たいりょくで きめるよ', fx: 'big' })
    }
  }
}

// @uid@ を なまえに かえる（じぶんの がわ から 見た いいかた）
export function renderText(st: CState, text: string, me: SideId): string {
  return text.replace(/@([ab]\d)@/g, (_, uid: string) => {
    const f = st.fighters.find((x) => x.uid === uid)
    if (!f) return ''
    return f.side === me ? f.card.name : `あいての ${f.card.name}`
  })
}
