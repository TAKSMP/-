// =============================================================
//  ちょうむしカードゲーム：カードを つくる
// -------------------------------------------------------------
//  ・図鑑の 虫 1ぴき → ノーマル（N）カード
//  ・ストーリーモードで レベル30／40／50 に そだてると
//    レア（R）／スーパーレア（SR）／ウルトラレア（UR）カードも つかえる
//    （さいきょうわざが 1／2／3つ はいる）
//  ・かずは 紙の カード（v4）と おなじ きまり：
//    たいりょく 60〜100、ダメージは 5きざみ（1かい さいだい 45）、
//    ふつうの こうげき 15〜30、わざの かいすうは つよさで 1〜3かい
//  ・わざは「エンジンが そのまま つかえる かたち」（CardMove）に なおし、
//    カードに かく せつめい文も ここで つくる
// =============================================================
import type { CaughtBug, MoveTarget, SpecialMoveV2, StatusKey } from '../../types'
import { battleStatsV2 } from '../battleSetup'
import { ULTIMATE_MOVES } from '../moveLibrary'
import {
  allMovesOf,
  levelOf,
  ULTIMATE_LEVELS,
  ultimateMoveFor,
  ultimatesOf,
  type StorySave,
} from '../story'

export type Tier = 'N' | 'R' | 'SR' | 'UR'
export const TIERS: Tier[] = ['N', 'R', 'SR', 'UR']
export type ChipStat = 'attack' | 'defense' | 'speed'
export type MoveKind = 'attack' | 'status' | 'heal' | 'power'

interface TierInfo {
  level: number // この レベルで つかえる ように なる
  ults: number // さいきょうわざの かず
  hp: number // たいりょく ボーナス
  mul: number // ダメージ・かいふくの ばいりつ
  spd: number // すばやさ ボーナス
  label: string
}
export const TIER_INFO: Record<Tier, TierInfo> = {
  N: { level: 1, ults: 0, hp: 0, mul: 1.0, spd: 0, label: 'ノーマル' },
  R: { level: 30, ults: 1, hp: 5, mul: 1.15, spd: 2, label: 'レア' },
  SR: { level: 40, ults: 2, hp: 10, mul: 1.3, spd: 3, label: 'スーパーレア' },
  UR: { level: 50, ults: 3, hp: 15, mul: 1.45, spd: 5, label: 'ウルトラレア' },
}

export const HP_CAP = 100
export const DMG_CAP = 45 // 1かいの ダメージの さいだい（2かいで まけない ように）
export const POISON_DMG = 10 // どくの ダメージ（ラウンドの おわり）

export interface ChipChange {
  who: 'self' | 'foe' | 'foes' | 'ally' | 'selfSide'
  stat: ChipStat
  n: number // ＋で ふえる、－で へる（1かいで さいだい ±2）
  need: number // サイコロが この め いじょうで おこる（1 = かならず）
}

// エンジンが つかう わざの かたち
export interface CardMove {
  id: string
  name: string
  emoji: string
  kind: MoveKind
  ultimate: boolean
  uses: number
  target: MoveTarget
  priority: number
  // --- こうげき ---
  dmg?: number // 1かいぶんの ダメージ
  hits?: [number, number] // れんぞく（おなじ かずなら きまった かいすう、ちがえば サイコロ）
  missOn?: number // サイコロが この め いかなら はずれ（0/なし = かならず あたる）
  crit?: boolean // 🎲6 で きゅうしょ（ダメージ ＋はんぶん）
  charge?: 'hide' | 'hold' // 【かくれる】【ためる】
  rest?: boolean // 【やすみ】
  delay?: number // ⏳ この ラウンドかず あとに あたる
  plusFoeStatus?: number
  plusSelfStatus?: number
  plusLate?: number
  plusFoeUlt?: number
  drain?: number // あたえた ダメージの わりあいを かいふく
  recoil?: number // あたえた ダメージの わりあいを じぶんも うける
  hpCost?: number // じぶんの たいりょくを はらう（かず）
  selfHeal?: number // こうげきの あと じぶんが かいふく（かず）＋ じょうたいいじょうも なおる
  // --- ついか こうか ---
  inflict?: { status: StatusKey; need: number; deep?: boolean }
  chips?: ChipChange[]
  heal?: number
  restSleep?: boolean
  regen?: { per: number; n: number }
  leech?: { per: number; n: number }
  cure?: 'all' | StatusKey
  restore?: boolean
  flatten?: boolean
  steal?: boolean
  swap?: boolean
  copy?: boolean
  hpToOne?: boolean
  revive?: { ratio: number; need: number }
  chaos?: 'normal' | 'super'
  counter?: number // この ラウンドで うけた ダメージ × この ばい を かえす
  guard?: number // かまえ：こうげき されたら この ダメージを かえす
  seal?: boolean
  guardBoosts?: boolean
  // --- ひょうじ ---
  text: string
  big: string
  bigUnit: string
}

export interface Card {
  key: string // `${bugId}:${tier}`
  bugId: string
  name: string
  order: string
  tier: Tier
  hp: number
  speed: number
  basic: number // ふつうの こうげきの ダメージ
  moves: CardMove[]
}

// -------------------------------------------------------------
//  けいさんの どうぐ
// -------------------------------------------------------------
export const r5 = (x: number, lo = 5): number => Math.max(lo, Math.floor(x / 5 + 0.5) * 5)
const eng = (power: number, a: number, d = 5): number => (((power / 10) * (a + 2)) / (d / 2 + 3)) * 0.72 + 1
const FD = 2.5 // アプリの ダメージ → カードの ダメージ

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// かくりつ → サイコロの め（この め いじょうで おこる）
export function needOf(chance: number | undefined): number {
  const c = chance ?? 1
  if (c >= 0.99) return 1
  if (c >= 0.5) return 4
  if (c >= 0.3) return 5
  return 6
}
export const needText = (need: number): string =>
  need <= 1 ? '' : need === 4 ? '🎲4〜6で ' : need === 5 ? '🎲5・6で ' : '🎲6で '

function missOf(acc: number | null | undefined): number {
  if (acc == null || acc >= 95) return 0
  if (acc >= 80) return 1
  if (acc >= 65) return 2
  return 3
}
export const missText = (m: number, verb = 'はずれ'): string =>
  m <= 0 ? '' : m === 1 ? `🎲1は ${verb}` : m === 2 ? `🎲1・2は ${verb}` : `🎲1〜3は ${verb}`

export const STATUS_ICON: Record<StatusKey, string> = { poison: '☠️', sleep: '💤', paralysis: '⚡' }
export const STATUS_NAME: Record<StatusKey, string> = { poison: 'どく', sleep: 'ねむり', paralysis: 'まひ' }
export const CHIP_UP: Record<ChipStat, string> = { attack: '🔺', defense: '🛡️', speed: '💨' }
export const CHIP_DOWN: Record<ChipStat, string> = { attack: '🔻', defense: '💔', speed: '🐢' }
const chipStat = (s: string): ChipStat =>
  s === 'defense' || s === 'evasion' ? 'defense' : s === 'speed' ? 'speed' : 'attack'

const WHO: Record<string, string> = {
  oneFoe: 'あいて1ぴき',
  allFoes: 'あいて2ひき',
  allOthers: 'みんな（みかたにも）',
  self: 'じぶん',
  ally: 'みかた1ぴき',
  selfSide: 'みかた ぜんいん',
  fallenAlly: 'たおれた みかた',
}

// -------------------------------------------------------------
//  カードの ステータス
// -------------------------------------------------------------
function baseHp(hp: number, def: number): number {
  const eff = (hp * (def / 2 + 3)) / 5.5
  return 60 + 5 * Math.max(0, Math.min(6, Math.round((eff - 20) / 9)))
}
function baseSpeed(bug: CaughtBug, speed: number, attack: number): number {
  const h = (hashStr(bug.name) % 3) - 1
  return Math.max(1, Math.min(15, Math.round(speed * 1.5 + (attack - 5) * 0.2 + h * 0.5)))
}

// -------------------------------------------------------------
//  わざ → カードの わざ
// -------------------------------------------------------------
function classify(m: SpecialMoveV2): MoveKind {
  if ((m.power ?? 0) > 0 || m.fixedDamage) return 'attack'
  if (m.healRatio || m.restSleep || m.regen || m.cureStatus || m.cureStatusKey || m.leech || m.revive || m.restoreStats)
    return 'heal'
  if (m.inflict || m.hpToOne || m.sealMoves || m.chaos || m.superChaos || m.copyMove) return 'status'
  return 'power'
}

function chipText(c: ChipChange, tgt: MoveTarget): string {
  const icons = (c.n > 0 ? CHIP_UP : CHIP_DOWN)[c.stat].repeat(Math.abs(c.n))
  const w =
    c.who === 'self' ? 'じぶんに' : c.who === 'ally' ? 'みかたに' : c.who === 'selfSide' ? 'みかた ぜんいんに'
      : c.who === 'foes' || tgt === 'allFoes' ? 'あいて2ひきに' : 'あいてに'
  return `${needText(c.need)}${w} ${icons}`
}

export function convertMove(m: SpecialMoveV2, attack: number, hp: number, tier: Tier): CardMove {
  const mul = TIER_INFO[tier].mul
  const tgt: MoveTarget = m.target ?? 'oneFoe'
  const kind = classify(m)
  const spread = tgt === 'allFoes' || tgt === 'allOthers'
  const cm: CardMove = {
    id: m.id,
    name: m.name,
    emoji: m.emoji ?? '✨',
    kind,
    ultimate: !!m.ultimate,
    uses: 3,
    target: tgt,
    priority: m.priority ?? 0,
    text: '',
    big: '',
    bigUnit: '',
  }
  const parts: string[] = []
  let raw = 0 // 1かいで あたえる ダメージ（かいすう きめ よう）

  if (kind === 'attack') {
    const hits = m.hits
    const multi = !!hits && hits[1] > 1
    let per: number
    if (m.fixedDamage) {
      per = Math.min(DMG_CAP, r5(m.fixedDamage * 1.8 * mul, 10))
    } else {
      const crit9 = (m.critStage ?? 0) >= 9 ? 1.5 : 1
      per = r5(eng(m.power, attack) * FD * mul * (spread ? 0.75 : 1) * crit9, multi ? 5 : 10)
    }
    if (multi && hits) per = Math.min(per, Math.max(5, r5(50 / hits[1]))) // れんぞくは ごうけい 50くらいまで
    else per = Math.min(per, DMG_CAP)
    cm.dmg = per
    if (hits && multi) cm.hits = [hits[0], hits[1]]
    if (m.chargeTurns) {
      cm.charge = m.hideWhileCharging ? 'hide' : 'hold'
      parts.push(m.hideWhileCharging ? '【かくれる】' : '【ためる】')
    }
    if (m.delayTurns) {
      cm.delay = Math.max(1, Math.min(3, m.delayTurns))
      parts.push(`⏳${cm.delay}ラウンドあとに`)
    }
    let main: string
    if (cm.hits && cm.hits[0] !== cm.hits[1]) {
      main = `${WHO[tgt]}に ${per}ダメージを 🎲の かず（${cm.hits[0]}〜${cm.hits[1]}かい）`
      cm.big = String(per)
      cm.bigUnit = '×🎲'
      raw = per * 3
    } else if (cm.hits) {
      main = `${WHO[tgt]}に ${per}ダメージを ${cm.hits[0]}かい`
      cm.big = String(per)
      cm.bigUnit = `×${cm.hits[0]}`
      raw = per * cm.hits[0]
    } else {
      main = `${WHO[tgt]}に ${per}ダメージ`
      cm.big = String(per)
      raw = per
    }
    parts.push(main + (m.delayTurns ? '（🛡️むし）' : ''))
    const plus = (ratio?: number) => (ratio && ratio > 1 ? r5(per * (ratio - 1)) : 0)
    if ((cm.plusFoeStatus = plus(m.boostIfFoeStatus) || undefined)) parts.push(`あいてが ☠️💤⚡なら ＋${cm.plusFoeStatus}`)
    if ((cm.plusSelfStatus = plus(m.boostIfSelfStatus) || undefined)) parts.push(`じぶんが ☠️💤⚡なら ＋${cm.plusSelfStatus}`)
    if ((cm.plusLate = plus(m.boostIfLate) || undefined)) parts.push(`あとから うごくと ＋${cm.plusLate}`)
    if ((cm.plusFoeUlt = plus(m.boostIfFoeUltimate) || undefined)) parts.push(`あいてが 👑わざを もっていたら ＋${cm.plusFoeUlt}`)
    if (m.critStage && m.critStage < 9) {
      cm.crit = true
      parts.push('🎲6で きゅうしょ（＋はんぶん）')
    }
    if (m.drainRatio) {
      cm.drain = m.drainRatio
      parts.push(`じぶんは ${r5(raw * m.drainRatio)} かいふく`)
    }
    if (m.recoilRatio) {
      cm.recoil = m.recoilRatio
      parts.push(`じぶんも ${r5(raw * m.recoilRatio)}ダメージ`)
    }
    if (m.hpCostRatio) {
      cm.hpCost = r5(hp * m.hpCostRatio)
      parts.push(`じぶんの たいりょくを ${cm.hpCost} つかう`)
    }
    if (m.selfHealRatio) {
      cm.selfHeal = r5(hp * m.selfHealRatio)
      parts.push(`じぶん ${cm.selfHeal} かいふく＋☠️💤⚡を なおす`)
    }
    if (m.rechargeTurns) {
      cm.rest = true
      parts.push('【やすみ】')
    }
  } else {
    if (m.hpCostRatio) {
      cm.hpCost = r5(hp * m.hpCostRatio)
      parts.push(`じぶんの たいりょくを ${cm.hpCost} つかって`)
    }
    if (m.restSleep) {
      cm.restSleep = true
      cm.big = 'ぜんぶ'
      cm.bigUnit = 'かいふく'
      parts.push('たいりょくを ぜんぶ かいふく。でも 💤ねむりに なる')
    } else if (m.healRatio) {
      cm.heal = Math.min(60, r5(hp * m.healRatio * mul))
      cm.big = `+${cm.heal}`
      parts.push(`${WHO[tgt]} ${cm.heal} かいふく`)
    }
    if (m.regen) {
      const per = r5(hp * m.regen.ratio * mul)
      const n = Math.min(5, m.regen.turns)
      cm.regen = { per, n }
      parts.push(`☀️を ${n}こ。ラウンドの おわりに ${per} かいふく`)
      if (!cm.big) {
        cm.big = `+${per}`
        cm.bigUnit = '×☀️'
      }
    }
    if (m.leech) {
      const per = r5(hp * m.leech.ratio * mul)
      const n = Math.min(5, m.leech.turns)
      cm.leech = { per, n }
      parts.push(`あいてに 🩸を ${n}こ。ラウンドの おわりに ${per} すいとる`)
      if (!cm.big) {
        cm.big = String(per)
        cm.bigUnit = '×🩸'
      }
    }
    if (m.revive) {
      cm.revive = { ratio: m.revive.ratio, need: needOf(m.revive.chance) }
      parts.push(`${needText(cm.revive.need)}たおれた みかたを ふっかつ（たいりょく ${Math.round(m.revive.ratio * 100)}%）`)
      if (!cm.big) cm.big = '😇'
    }
    if (m.cureStatus) {
      cm.cure = 'all'
      parts.push(`${WHO[tgt]}の ☠️💤⚡を なおす`)
      if (!cm.big) cm.big = '💊'
    } else if (m.cureStatusKey) {
      cm.cure = m.cureStatusKey
      parts.push(`${WHO[tgt]}の ${STATUS_ICON[m.cureStatusKey]}${STATUS_NAME[m.cureStatusKey]}を なおす`)
      if (!cm.big) cm.big = '💊'
    }
    if (m.restoreStats) {
      cm.restore = true
      parts.push('じぶんの 🔻💔🐢を ぜんぶ とる')
      if (!cm.big) cm.big = '✨'
    }
    if (m.inflict) {
      const ic = STATUS_ICON[m.inflict.status]
      cm.inflict = { status: m.inflict.status, need: needOf(m.inflict.chance), deep: m.deepSleep || undefined }
      parts.push(
        `${needText(cm.inflict.need)}${WHO[tgt]}を ${ic}${STATUS_NAME[m.inflict.status]}に${m.deepSleep ? '（🎲6で しか おきない）' : ''}`,
      )
      if (!cm.big) cm.big = ic
    }
    if (m.hpToOne) {
      cm.hpToOne = true
      parts.push('あいての たいりょくを のこり 5に する')
      if (!cm.big) cm.big = '5'
    }
    if (m.stealStats) {
      cm.steal = true
      parts.push('あいての 🔺🛡️💨を ぜんぶ もらう')
      if (!cm.big) cm.big = '🫳'
    }
    if (m.swapStats) {
      cm.swap = true
      parts.push('あいてと チップを とりかえる')
      if (!cm.big) cm.big = '🔄'
    }
    if (m.flattenBoosts) {
      cm.flatten = true
      parts.push(`${tgt === 'allFoes' ? 'あいて2ひき' : 'あいて'}の 🔺🛡️💨を ぜんぶ とる`)
      if (!cm.big) cm.big = '🧹'
    }
    if (m.copyMove) {
      cm.copy = true
      parts.push('あいての わざを 1つ まねして つかう')
      if (!cm.big) cm.big = '🪞'
    }
    if (m.chaos || m.superChaos) {
      cm.chaos = m.superChaos ? 'super' : 'normal'
      parts.push(`🎲で なにが おこるか おたのしみ${m.superChaos ? '（つよい）' : ''}`)
      if (!cm.big) cm.big = '🎲'
    }
    if (m.counterRatio) {
      cm.counter = m.counterRatio
      cm.priority = Math.min(cm.priority, -5)
      parts.push(`さいごに うごく。この ラウンドで うけた ダメージを ${m.counterRatio}ばいで かえす`)
      if (!cm.big) cm.big = '↩️'
    }
    if (m.counterGuard) {
      cm.guard = Math.min(DMG_CAP, r5(eng(60, attack) * FD * mul, 10))
      cm.priority = Math.max(cm.priority, 4)
      parts.push(`かまえる：この ラウンドで こうげき されたら ${cm.guard}ダメージ かえす`)
      if (!cm.big) cm.big = '🛡️'
    }
    if (m.sealMoves) {
      cm.seal = true
      parts.push('あいては 2ラウンド「こうげき」しか できない')
      if (!cm.big) cm.big = '🔒'
    }
    if (m.guardBoosts) {
      cm.guardBoosts = true
      parts.push('じぶんの チップを とられなくなる')
    }
  }

  // のうりょく チップ（こうげき・へんか どちらにも つく）
  const chips: ChipChange[] = []
  for (const ch of m.statChanges ?? []) {
    const n = Math.max(-2, Math.min(2, ch.stage))
    if (!n) continue
    const who: ChipChange['who'] =
      ch.to === 'self' ? (tgt === 'selfSide' ? 'selfSide' : 'self') : ch.to === 'ally' ? 'ally' : tgt === 'allFoes' ? 'foes' : 'foe'
    const c: ChipChange = { who, stat: chipStat(ch.stat), n, need: needOf(ch.chance) }
    const same = chips.find((x) => x.who === c.who && x.stat === c.stat && x.need === c.need && Math.sign(x.n) === Math.sign(c.n))
    if (same) same.n = Math.max(-3, Math.min(3, same.n + c.n))
    else chips.push(c)
  }
  if (chips.length) {
    cm.chips = chips
    for (const c of chips) parts.push(chipText(c, tgt))
    if (!cm.big) {
      const c = chips[0]
      cm.big = (c.n > 0 ? CHIP_UP : CHIP_DOWN)[c.stat].repeat(Math.min(2, Math.abs(c.n)))
    }
  }
  if (kind === 'attack' && m.inflict) {
    cm.inflict = { status: m.inflict.status, need: needOf(m.inflict.chance), deep: m.deepSleep || undefined }
    parts.push(`${needText(cm.inflict.need)}${STATUS_ICON[m.inflict.status]}${STATUS_NAME[m.inflict.status]}に`)
  }
  if (kind === 'attack' && m.sealMoves) {
    cm.seal = true
    parts.push('あいては 2ラウンド「こうげき」だけ')
  }
  const needAcc = kind === 'attack' || !!cm.inflict || !!cm.hpToOne || (cm.chips?.some((c) => c.who === 'foe' || c.who === 'foes') ?? false)
  if (needAcc && !(m.chargeTurns && m.hideWhileCharging)) {
    const miss = missOf(m.accuracy)
    if (miss) {
      cm.missOn = miss
      parts.push(missText(miss, kind === 'attack' ? 'はずれ' : 'しっぱい'))
    }
  }
  if (cm.priority > 0 && !cm.guard) parts.unshift('⚡さきに うごく')
  if (!cm.big) cm.big = '✨'
  cm.text = parts.filter(Boolean).join('。') + '。'
  cm.uses = m.ultimate ? 1 : usesOf(m, cm, raw, hp, mul)
  return cm
}

// わざの つよさ・べんりさ → つかえる かいすう（つよいほど すくない）
function usesOf(m: SpecialMoveV2, cm: CardMove, raw: number, hp: number, mul: number): number {
  let sc = 0
  const tgt = cm.target
  const wide = tgt === 'allFoes' || tgt === 'allOthers' || tgt === 'selfSide' ? 1.6 : 1
  if (cm.kind === 'attack') {
    let dm = (raw / mul) * (tgt === 'allFoes' ? 1.6 : tgt === 'allOthers' ? 1.3 : 1)
    dm *= cm.missOn ? (cm.missOn >= 2 ? 0.67 : 0.83) : 1
    if (cm.charge) dm *= cm.charge === 'hide' ? 0.8 : 0.65
    if (cm.rest) dm *= 0.7
    if (cm.delay) dm *= 0.9
    if (cm.plusFoeStatus || cm.plusSelfStatus || cm.plusLate || cm.plusFoeUlt) dm *= 1.15
    if (cm.crit) dm *= 1.1
    if (cm.drain) dm *= 1 + cm.drain * 0.7
    if (cm.recoil) dm *= 1 - cm.recoil * 0.5
    sc += dm
    if (cm.inflict) sc += 8 / cm.inflict.need
  } else {
    if (cm.restSleep) sc += (hp * 0.55) / mul
    if (cm.heal) sc += ((cm.heal / mul) * wide * 0.9)
    if (cm.regen) sc += (cm.regen.per * cm.regen.n * 0.7) / mul
    if (cm.leech) sc += (cm.leech.per * cm.leech.n * 1.3) / mul
    if (cm.inflict) sc += ({ poison: 22, sleep: 32, paralysis: 22 }[cm.inflict.status] * wide) / Math.max(1, cm.inflict.need / 2.5)
    if (cm.steal) sc += 28
    if (cm.swap) sc += 24
    if (cm.copy) sc += 26
    if (cm.revive) sc += 45
    if (cm.hpToOne) sc += 40
    if (cm.chaos) sc += 26
    if (cm.flatten) sc += 16
    if (cm.cure) sc += cm.cure === 'all' ? 10 : 7
    if (cm.restore) sc += 9
    if (cm.guard) sc += 22
    if (cm.counter) sc += 18 * cm.counter
    if (cm.seal) sc += 24
    if (cm.hpCost) sc -= cm.hpCost * 0.4
  }
  let nchip = 0
  for (const c of cm.chips ?? []) {
    nchip += Math.abs(c.n)
    sc += (Math.abs(c.n) * 8 * (c.who === 'foes' || c.who === 'selfSide' ? 1.4 : 1)) / Math.max(1, c.need / 2.5)
  }
  if (cm.priority > 0 && !cm.guard) sc += 7
  if (cm.kind !== 'attack' && cm.missOn) sc *= cm.missOn >= 2 ? 0.75 : 0.88
  let uses = sc >= 38 ? 1 : sc >= 23 ? 2 : 3
  if (raw >= 40) uses = Math.min(uses, 2)
  if (nchip >= 2 && cm.kind !== 'attack') uses = Math.min(uses, 2)
  void m
  return uses
}

// -------------------------------------------------------------
//  カードを くみたてる
// -------------------------------------------------------------
// N カードの わざ：図鑑で おぼえている ふつうの わざ 3つ
// R〜UR：さいきょうわざ（1〜3つ）と、のこりの わくに ふつうの わざ
function ultimatesForTier(bug: CaughtBug, save: StorySave, tier: Tier): SpecialMoveV2[] {
  const need = TIER_INFO[tier].ults
  if (need === 0) return []
  const lv = Math.max(levelOf(save, bug.id).level, TIER_INFO[tier].level)
  const owned = ultimatesOf(save, bug.id, lv).slice(0, need)
  const out = [...owned]
  // まだ おぼえていない ぶんは、その虫に にあう さいきょうわざで うめる（CPU の カードなど）
  for (const u of ULTIMATE_LEVELS) {
    if (out.length >= need) break
    if (out.some((m) => m.ultimate === u.group)) continue
    const pick = ultimateMoveFor(bug, u.group, out)
    if (pick) out.push(pick)
  }
  for (const m of ULTIMATE_MOVES) {
    if (out.length >= need) break
    if (!out.some((x) => x.id === m.id)) out.push({ ...m })
  }
  return out.slice(0, need)
}

export function buildCard(bug: CaughtBug, save: StorySave, tier: Tier): Card {
  const st = battleStatsV2(bug)
  const info = TIER_INFO[tier]
  const hp = Math.min(HP_CAP, baseHp(st.hp, st.defense) + info.hp)
  const attack = st.attack
  const normal = allMovesOf(save, bug).filter((m) => !m.ultimate && !m.supreme).slice(0, 3)
  const ults = ultimatesForTier(bug, save, tier)
  // よわい わざから さいきょうわざと いれかえる
  const normalCards = normal.map((m) => convertMove(m, attack, hp, tier))
  const strength = (c: CardMove) => (c.kind === 'attack' ? Number(c.big) || 20 : 18) / c.uses
  let keep = normalCards.map((c, i) => ({ c, i }))
  while (keep.length > 3 - ults.length) {
    const atk = keep.filter((x) => x.c.kind === 'attack')
    const noAtk = keep.filter((x) => x.c.kind !== 'attack')
    const pool = atk.length === 1 && noAtk.length && ults.every((u) => (u.power ?? 0) <= 0) ? noAtk : keep
    const weakest = pool.reduce((a, b) => (strength(b.c) < strength(a.c) ? b : a))
    keep = keep.filter((x) => x !== weakest)
  }
  const moves = [...keep.sort((a, b) => a.i - b.i).map((x) => x.c), ...ults.map((u) => convertMove(u, Math.max(attack, 6), hp, tier))]
  return {
    key: `${bug.id}:${tier}`,
    bugId: bug.id,
    name: bug.name,
    order: bug.order,
    tier,
    hp,
    speed: Math.min(20, baseSpeed(bug, st.speed, st.attack) + info.spd),
    basic: Math.min(30, r5(eng(40, attack) * FD * info.mul * 1.3, 15)),
    moves,
  }
}

// その虫で いま つかえる レア度（ストーリーモードの レベルで ふえる）
export function unlockedTiers(save: StorySave, bugId: string): Tier[] {
  const lv = levelOf(save, bugId).level
  return TIERS.filter((t) => lv >= TIER_INFO[t].level)
}

// 図鑑から つかえる カード ぜんぶ
export function availableCards(bugs: CaughtBug[], save: StorySave): Card[] {
  const out: Card[] = []
  for (const b of bugs) for (const t of unlockedTiers(save, b.id)) out.push(buildCard(b, save, t))
  return out
}

// -------------------------------------------------------------
//  デッキの きまり：4まい・おなじ虫は 1まい・R いじょうは 2まいまで・UR は 1まいまで
// -------------------------------------------------------------
export const DECK_SIZE = 4
export function deckProblem(deck: Card[]): string | null {
  if (deck.length < DECK_SIZE) return `あと ${DECK_SIZE - deck.length}まい えらんでね`
  const ids = new Set(deck.map((c) => c.bugId))
  if (ids.size < deck.length) return 'おなじ 虫は 1まい だけ'
  if (deck.filter((c) => c.tier !== 'N').length > 2) return 'R・SR・UR は あわせて 2まいまで'
  if (deck.filter((c) => c.tier === 'UR').length > 1) return 'UR は 1まいまで'
  return null
}
export function canAdd(deck: Card[], c: Card): string | null {
  if (deck.length >= DECK_SIZE) return 'デッキは 4まいまで'
  if (deck.some((d) => d.bugId === c.bugId)) return 'おなじ 虫は 1まい だけ'
  if (c.tier !== 'N' && deck.filter((d) => d.tier !== 'N').length >= 2) return 'R・SR・UR は あわせて 2まいまで'
  if (c.tier === 'UR' && deck.some((d) => d.tier === 'UR')) return 'UR は 1まいまで'
  return null
}
