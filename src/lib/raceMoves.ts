// =============================================================
//  レースの ひっさつわざ
// -------------------------------------------------------------
//  ストーリーモードで おぼえた わざを、名前は そのままで
//  レース用の こうか（マリオカートの アイテムの ような もの）に かえる。
//  わざの せってい（こうげき／へんか・ねらう あいて・ついか こうか）から
//  いつも おなじ こうかに なる。バトルの こうかとは べつもの。
// =============================================================
import type { SpecialMoveV2 } from '../types'

export type RaceEffect =
  | 'dash' // ぎゅーんと ダッシュ
  | 'superDash' // ためて ものすごい ダッシュ
  | 'turbo' // しばらく ずっと はやい
  | 'shot' // まえの むしに とんでいって ころばせる
  | 'multiShot' // まっすぐ とぶ たまを いくつも うつ
  | 'wave' // まえの むし ぜんいんを おそくする
  | 'star' // すこし たつと 1いの むしに おちてくる
  | 'sleepShot' // まえの むしを ねむらせる
  | 'poisonTrap' // うしろに どくの みずたまりを おく
  | 'jam' // まえの むしが アクセルを ふめなくなる
  | 'slowShot' // まえの むしを おそくする
  | 'refill' // たいりょくゲージが もどる
  | 'endless' // しばらく たいりょくが へらない
  | 'steal' // まえの むしの たいりょくを すいとる
  | 'shield' // バリアで 1かい ふせぐ
  | 'swap' // まえの むしと いれかわる

export interface RaceMove {
  id: string
  name: string // ストーリーと おなじ 名前
  emoji: string
  effect: RaceEffect
  ultimate: boolean // さいきょうわざ（こうかが つよい）
  wide: boolean // あいて ぜんいん むけ（ひとりでなく みんなに きく）
  count: number // multiShot の たまの かず
  uses: number // レースで つかえる かいすう（もとの わざの かいすう）
}

export const EFFECT_INFO: Record<RaceEffect, { emoji: string; label: string; desc: string; attack: boolean }> = {
  dash: { emoji: '💨', label: 'ダッシュ', desc: 'ぎゅーんと ダッシュ！', attack: false },
  superDash: { emoji: '🚀', label: 'スーパーダッシュ', desc: 'ものすごい いきおいで ダッシュ！', attack: false },
  turbo: { emoji: '⏩', label: 'ターボ', desc: 'しばらく ずっと はやくなる', attack: false },
  shot: { emoji: '🎯', label: 'ねらいうち', desc: 'まえの むしに とんでいって ころばせる', attack: true },
  multiShot: { emoji: '🔫', label: 'れんしゃ', desc: 'まっすぐ とぶ たまを うつ。あたると ころぶ', attack: true },
  wave: { emoji: '🌊', label: 'おおなみ', desc: 'まえに いる むし ぜんいんを おそくする', attack: true },
  star: { emoji: '🌠', label: 'ながれぼし', desc: 'すこし たつと 1いの むしに おちてくる', attack: true },
  sleepShot: { emoji: '💤', label: 'ねむらせ', desc: 'まえの むしを ねむらせて とめる', attack: true },
  poisonTrap: { emoji: '☠️', label: 'どくだまり', desc: 'うしろに どくの みずたまりを おく', attack: true },
  jam: { emoji: '⚡', label: 'しびれ', desc: 'まえの むしが しばらく アクセルを ふめない', attack: true },
  slowShot: { emoji: '🐌', label: 'あしどめ', desc: 'まえの むしを しばらく おそくする', attack: true },
  refill: { emoji: '🍯', label: 'げんき かいふく', desc: 'たいりょくゲージが もどる', attack: false },
  endless: { emoji: '♾️', label: 'むげん たいりょく', desc: 'しばらく アクセルを ふんでも たいりょくが へらない', attack: false },
  steal: { emoji: '🧲', label: 'すいとり', desc: 'まえの むしの たいりょくを すいとって ダッシュ', attack: true },
  shield: { emoji: '🛡️', label: 'バリア', desc: 'こうげきを 1かい ふせぐ', attack: false },
  swap: { emoji: '🔄', label: 'いれかわり', desc: 'まえの むしと ばしょが いれかわる', attack: true },
}

// わざ → レースの こうか
export function raceEffectOf(m: SpecialMoveV2): RaceEffect {
  const wide = m.target === 'allFoes' || m.target === 'allOthers'
  const selfUps = (m.statChanges ?? []).filter((c) => c.to !== 'foe' && c.stage > 0)
  const foeDowns = (m.statChanges ?? []).filter((c) => c.to === 'foe' && c.stage < 0)

  if (m.swapStats) return 'swap'
  if (m.stealStats || m.leech || m.drainRatio) return 'steal'
  if (m.restSleep) return 'endless'
  if (m.regen) return 'endless'
  if (m.healRatio) return 'refill'
  if (m.cureStatus || m.cureStatusKey) return 'shield'
  if (m.counterGuard || m.hideWhileCharging || m.counterRatio) return 'shield'
  if (m.inflict?.status === 'sleep') return 'sleepShot'
  if (m.inflict?.status === 'poison') return 'poisonTrap'
  if (m.inflict?.status === 'paralysis') return 'jam'
  if (m.delayTurns) return 'star'
  if (m.kind === 'attack') {
    if (wide) return 'wave'
    if (m.hits) return 'multiShot'
    if (m.chargeTurns || m.rechargeTurns || m.recoilRatio || m.hpCostRatio) return 'superDash'
    if (m.priority > 0) return 'dash'
    if (selfUps.some((c) => c.stat === 'speed')) return 'turbo'
    if (selfUps.length) return 'dash'
    if (foeDowns.length) return 'slowShot'
    return 'shot'
  }
  // へんかわざ
  if (selfUps.some((c) => c.stat === 'speed')) return 'turbo'
  if (selfUps.some((c) => c.stat === 'defense' || c.stat === 'evasion')) return 'shield'
  if (selfUps.length) return m.hpCostRatio ? 'superDash' : 'dash'
  if (foeDowns.some((c) => c.stat === 'speed')) return 'slowShot'
  if (foeDowns.length) return wide ? 'wave' : 'slowShot'
  return 'dash'
}

export function toRaceMove(m: SpecialMoveV2): RaceMove {
  const effect = raceEffectOf(m)
  const n = m.hits ? Math.max(m.hits[0], m.hits[1]) : 1
  return {
    id: m.id,
    name: m.name,
    emoji: m.emoji || EFFECT_INFO[effect].emoji,
    effect,
    ultimate: !!m.ultimate,
    wide: m.target === 'allFoes' || m.target === 'allOthers',
    count: Math.max(2, Math.min(3, n)),
    uses: Math.max(1, Math.round(m.uses || 1)),
  }
}

// がめんに 出す せつめい（さいきょうわざは「もっと つよい」と わかる ように）
export function raceMoveDesc(m: RaceMove): string {
  const base = EFFECT_INFO[m.effect].desc
  if (m.effect === 'multiShot') return `まっすぐ とぶ たまを ${m.count}こ うつ。あたると ころぶ`
  if (m.wide && (m.effect === 'sleepShot' || m.effect === 'jam' || m.effect === 'slowShot'))
    return base.replace('まえの むし', 'まえの むし ぜんいん')
  if (m.wide && m.effect === 'poisonTrap') return 'うしろに どくの みずたまりを 3つ おく'
  return m.ultimate ? `${base}（さいきょう！）` : base
}
