// =============================================================
//  ちょうむしカードゲーム：コンピューター（CPU）
// -------------------------------------------------------------
//  ・わざえらび：とどめを させる あいてを ねらう／ピンチなら かいふく／
//    じょうたいいじょうが ない あいてに ☠️💤⚡ …など、かんたんな かんがえかた
//  ・つよさ（よわい・ふつう・つよい）で、まちがえる かくりつと デッキの レア度が かわる
// =============================================================
import type { CaughtBug } from '../../types'
import type { StorySave } from '../story'
import { buildCard, type Card, type CardMove, type Tier } from './cards'
import {
  activeOf,
  needsCommand,
  other,
  targetKind,
  type CCommand,
  type CF,
  type CState,
  type SideId,
} from './engine'

export type CpuLevel = 'easy' | 'normal' | 'hard'
export const CPU_LEVELS: { key: CpuLevel; label: string; emoji: string; desc: string }[] = [
  { key: 'easy', label: 'よわい', emoji: '🐣', desc: 'ノーマル 4まい。はじめての ひとに' },
  { key: 'normal', label: 'ふつう', emoji: '🐛', desc: 'レアが 1まい はいっている' },
  { key: 'hard', label: 'つよい', emoji: '🦂', desc: 'スーパーレアと ウルトラレア！' },
]

const MISTAKE: Record<CpuLevel, number> = { easy: 0.45, normal: 0.15, hard: 0 }

function expectedDmg(f: CF, m: CardMove | null, t: CF): number {
  const base = m ? m.dmg ?? 0 : f.card.basic
  if (!base) return 0
  const hits = m?.hits ? (m.hits[0] + m.hits[1]) / 2 : 1
  let v = Math.max(5, base + 5 * f.chips.attack - 5 * t.chips.defense)
  if (m?.plusFoeStatus && t.status.length) v += m.plusFoeStatus
  v *= hits
  if (m?.missOn) v *= 1 - m.missOn / 6
  if (m?.charge) v *= 0.6
  if (m?.delay) v *= 0.7
  if (m?.rest) v *= 0.75
  return v
}

function scoreMove(st: CState, f: CF, m: CardMove | null, foes: CF[], friends: CF[]): { s: number; target?: string } {
  const tk = targetKind(m)
  // こうげき
  if (!m || m.dmg) {
    if (m && (m.target === 'allFoes' || m.target === 'allOthers')) {
      let s = foes.reduce((a, t) => a + Math.min(t.hp, expectedDmg(f, m, t)) + (expectedDmg(f, m, t) >= t.hp ? 25 : 0), 0)
      if (m.target === 'allOthers') s -= friends.filter((x) => x !== f).reduce((a, t) => a + expectedDmg(f, m, t), 0)
      return { s }
    }
    let best = { s: -1, target: foes[0]?.uid }
    for (const t of foes) {
      const e = expectedDmg(f, m, t)
      let s = Math.min(t.hp, e) + (e >= t.hp ? 30 : 0) - (t.hidden ? 100 : 0)
      if (m?.inflict && !t.status.includes(m.inflict.status)) s += 8 / m.inflict.need
      if (s > best.s) best = { s, target: t.uid }
    }
    // ふつうの こうげきより わざを すこし ひいきする（さいごまで のこさない）
    if (m && !m.ultimate) best.s += 2
    if (m?.ultimate) best.s += 6
    return best
  }
  let s = 0
  let target: string | undefined
  const hpRate = f.hp / f.card.hp
  if (m.heal || m.restSleep || m.regen) {
    const who = m.target === 'ally' ? friends.reduce((a, b) => (b.hp / b.card.hp < a.hp / a.card.hp ? b : a)) : f
    const lost = who.card.hp - who.hp
    s += Math.min(lost, m.heal ?? (m.regen ? m.regen.per * m.regen.n * 0.7 : who.card.hp)) * (who.hp / who.card.hp < 0.5 ? 1.3 : 0.6)
    if (m.restSleep) s -= 15
    target = who.uid
  }
  if (m.cure) {
    const sick = friends.filter((x) => x.status.length)
    if (sick.length) {
      s += 18
      target = target ?? sick[0].uid
    }
  }
  if (m.inflict) {
    const t = foes.filter((x) => !x.status.includes(m.inflict!.status) && !x.hidden)
    if (t.length) {
      s += ({ poison: 18, sleep: 24, paralysis: 20 }[m.inflict.status] * (m.target === 'allFoes' ? t.length : 1)) / Math.max(1, m.inflict.need / 3)
      target = t.reduce((a, b) => (b.hp > a.hp ? b : a)).uid
    }
  }
  for (const c of m.chips ?? []) {
    const n = Math.abs(c.n)
    if (c.who === 'self' || c.who === 'selfSide' || c.who === 'ally') {
      const have = f.chips[c.stat]
      s += c.n > 0 && have < 2 ? 9 * n * (st.round <= 3 ? 1.3 : 0.8) : 0
    } else s += c.n < 0 ? 7 * n : 0
  }
  if (m.steal || m.swap || m.flatten) {
    const rich = foes.filter((x) => x.chips.attack + x.chips.defense + x.chips.speed > 0)
    if (rich.length) {
      s += 22
      target = rich[0].uid
    }
  }
  if (m.leech) s += foes.length ? m.leech.per * m.leech.n * 0.8 : 0
  if (m.hpToOne) {
    const big = foes.filter((x) => x.hp > 30)
    if (big.length) {
      s += big[0].hp * 0.6
      target = big[0].uid
    }
  }
  if (m.revive) s += st.fighters.some((x) => x.side === f.side && x.fainted) ? 40 : -50
  if (m.guard) s += 14
  if (m.counter) s += hpRate > 0.5 ? 12 : 4
  if (m.seal) s += 18
  if (m.chaos) s += 18
  if (m.copy) s += 16
  if (m.guardBoosts) s += 3
  if (m.hpCost) s -= m.hpCost * 0.5
  if (tk === 'foe' && !target) target = foes.find((x) => !x.hidden)?.uid ?? foes[0]?.uid
  if (tk === 'ally' && !target) target = f.uid
  return { s, target }
}

export function cpuCommands(st: CState, side: SideId, level: CpuLevel, rand: () => number = Math.random): CCommand[] {
  const out: CCommand[] = []
  const foes = activeOf(st, other(side))
  const friends = activeOf(st, side)
  for (const f of friends) {
    if (!needsCommand(st, f)) continue
    const options: { move: number; s: number; target?: string }[] = []
    const b = scoreMove(st, f, null, foes, friends)
    options.push({ move: -1, ...b })
    f.card.moves.forEach((m, i) => {
      if ((f.usesLeft[i] ?? 0) <= 0) return
      const r = scoreMove(st, f, m, foes, friends)
      options.push({ move: i, ...r })
    })
    options.sort((x, y) => y.s - x.s)
    let choice = options[0]
    if (rand() < MISTAKE[level]) choice = options[Math.floor(rand() * options.length)]
    if (f.sealed && choice.move >= 0) choice = options.find((o) => o.move === -1) ?? choice
    out.push({ uid: f.uid, move: choice.move, target: choice.target })
  }
  return out
}

// CPU の デッキ（図鑑の 虫から えらぶ）
export function cpuDeck(bugs: CaughtBug[], save: StorySave, level: CpuLevel, avoid: string[] = [], rand: () => number = Math.random): Card[] {
  const pool = [...bugs].sort(() => rand() - 0.5)
  const prefer = pool.filter((b) => !avoid.includes(b.id))
  const picks = (prefer.length >= 4 ? prefer : pool).slice(0, 4)
  const tiers: Tier[] =
    level === 'easy' ? ['N', 'N', 'N', 'N'] : level === 'normal' ? ['N', 'R', 'N', 'N'] : ['SR', 'N', 'UR', 'N']
  return picks.map((b, i) => buildCard(b, save, tiers[i]))
}
