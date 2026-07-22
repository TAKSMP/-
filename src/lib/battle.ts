// =============================================================
//  バトル（虫どうしの たいせん）
// -------------------------------------------------------------
//  ・記録した虫に「バトルステータス」をつける
//    たいりょく(1〜20) / こうげき(1〜10) / ぼうぎょ(1〜10) / ひっさつわざ
//  ・ステータスが未設定でも、レア度から自動でつくって すぐ遊べる
//  ・ステータスは AI（ChatGPT）にバランスよく考えさせて登録できる
//  ・かんたんな せんとうロジック（ダメージ計算・かいひ判定）
// =============================================================
import type { BattleStats, CaughtBug, MoveEffect, SpecialMove } from '../types'

export const HP_MIN = 1
export const HP_MAX = 20
export const STAT_MIN = 1
export const STAT_MAX = 10
export const POWER_MIN = 1
export const POWER_MAX = 6

// かいひ（こうげきを よける）かくりつ
export const DODGE_CHANCE = 0.12

export function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(Number.isFinite(v) ? v : lo)
  return Math.max(lo, Math.min(hi, n))
}

// こうかの ひょうじ用データ
export interface EffectInfo {
  key: MoveEffect
  label: string // かなの表示名
  emoji: string
  hint: string // どんな効果か
  strong: boolean // つよい技（つかえる回数が1回になる）
}

export const EFFECTS: EffectInfo[] = [
  {
    key: 'powerStrike',
    label: 'つよいいちげき',
    emoji: '💥',
    hint: 'こうげき力＋で 大ダメージ（1かいだけ）',
    strong: true,
  },
  {
    key: 'doubleAttack',
    label: 'にかいこうげき',
    emoji: '⚡',
    hint: '2かい つづけて こうげき（1かいだけ）',
    strong: true,
  },
  {
    key: 'heal',
    label: 'かいふく',
    emoji: '💚',
    hint: 'たいりょくを かいふくする',
    strong: false,
  },
  {
    key: 'attackUp',
    label: 'こうげきアップ',
    emoji: '🔺',
    hint: 'こうげき力が あがる（さいごまで）',
    strong: false,
  },
  {
    key: 'defenseUp',
    label: 'ぼうぎょアップ',
    emoji: '🛡️',
    hint: 'ぼうぎょ力が あがる（さいごまで）',
    strong: false,
  },
]

export function effectInfo(key: MoveEffect): EffectInfo {
  return EFFECTS.find((e) => e.key === key) ?? EFFECTS[0]
}

// つよい技は1回、それ以外は2回つかえる（ゲームバランス）
export function usesForEffect(effect: MoveEffect): number {
  return effectInfo(effect).strong ? 1 : 2
}

// レア度などから、バトルステータスを自動でつくる（未設定の虫用）。
export function defaultBattle(bug: CaughtBug): BattleStats {
  const r = clampInt(bug.rarity, 1, 5)
  const hp = clampInt(8 + r * 2, HP_MIN, HP_MAX) // 10〜18
  const attack = clampInt(3 + r, STAT_MIN, STAT_MAX) // 4〜8
  const defense = clampInt(2 + r, STAT_MIN, STAT_MAX) // 3〜7
  // レアな虫ほど つよい技をもちやすい
  const effect: MoveEffect = r >= 4 ? 'powerStrike' : r === 3 ? 'doubleAttack' : 'attackUp'
  const power = clampInt(2 + Math.ceil(r / 2), POWER_MIN, POWER_MAX)
  const move: SpecialMove = {
    name: `${bug.name}アタック`,
    effect,
    power,
    uses: usesForEffect(effect),
    desc: 'その虫ならではの とくいわざ。',
  }
  return { hp, attack, defense, move }
}

// 虫のバトルステータス（未設定なら自動生成）
export function battleStatsOf(bug: CaughtBug): BattleStats {
  return bug.battle ?? defaultBattle(bug)
}

// ステータスをきれいな範囲におさめる（保存まえ）
export function normalizeStats(s: BattleStats): BattleStats {
  return {
    hp: clampInt(s.hp, HP_MIN, HP_MAX),
    attack: clampInt(s.attack, STAT_MIN, STAT_MAX),
    defense: clampInt(s.defense, STAT_MIN, STAT_MAX),
    move: {
      name: s.move.name.trim() || 'ひっさつわざ',
      effect: s.move.effect,
      power: clampInt(s.move.power, POWER_MIN, POWER_MAX),
      uses: usesForEffect(s.move.effect),
      desc: s.move.desc.trim() || 'とくいわざ。',
    },
  }
}

// こうげき力・ぼうぎょ力から、通常こうげきの ダメージをきめる。
// ぼうぎょは 半分ぶんだけ ダメージを へらす（1いじょうは必ず入る）。
export function computeDamage(attack: number, defense: number): number {
  return Math.max(1, Math.round(attack - defense / 2))
}

// -------------------------------------------------------------
//  AI（ChatGPT）に ステータスを考えさせる 質問文 と とりこみ
// -------------------------------------------------------------

export function buildBattlePrompt(name: string, fact?: string): string {
  const factLine = fact && fact.trim() ? `この虫のとくちょう: ${fact.trim()}\n` : ''
  return `日本の昆虫「${name}」の、たいせんゲーム用のステータスを、バランスを考えてきめてください。
${factLine}その虫の じっさいの とくちょう（大きさ・力・すばやさ・ハサミや毒など）を いかしつつ、
1ぴきだけ きょくたんに つよくならないように してください。

ひっさつわざは、その虫ならではの とくちょうを わざ名にしてください
（れい: カブトムシなら「ヘラクレスなげ」、カマキリなら「かまのいちげき」）。
こうかは つぎの5つから1つ えらんでください:
・つよいいちげき（大ダメージ・1回だけ）
・にかいこうげき（2回こうげき・1回だけ）
・かいふく（たいりょくを回復）
・こうげきアップ（こうげき力があがる）
・ぼうぎょアップ（ぼうぎょ力があがる）

答えは、下の7行だけを ` +
    '```' +
    ` （コードブロック）で かこんで、かな中心で 出力してください。
コードブロックの そとには 何も書かないでください。

` +
    '```' +
    `
たいりょく: （1〜20の数字）
こうげき: （1〜10の数字）
ぼうぎょ: （1〜10の数字）
わざ: （ひっさつわざの名前）
こうか: （つよいいちげき / にかいこうげき / かいふく / こうげきアップ / ぼうぎょアップ のどれか）
こうかりょう: （1〜6の数字。こうかの大きさ）
わざせつめい: （その わざの せつめい・かなで みじかく）
` +
    '```'
}

function pickLine(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`^\\s*[*\\-・]?\\s*${label}\\s*[:：]\\s*(.+)$`, 'm')
    const m = text.match(re)
    if (m && m[1].trim()) return m[1].trim()
  }
  return undefined
}

function parseEffect(raw: string): MoveEffect | undefined {
  const t = raw.replace(/\s/g, '')
  if (/つよい|いちげき|大ダメージ|強/.test(t)) return 'powerStrike'
  if (/にかい|2かい|２かい|ダブル|二回/.test(t)) return 'doubleAttack'
  if (/かいふく|回復|ヒール/.test(t)) return 'heal'
  if (/こうげきアップ|攻撃アップ|こうげきUP/i.test(t)) return 'attackUp'
  if (/ぼうぎょアップ|防御アップ|ぼうぎょUP/i.test(t)) return 'defenseUp'
  return undefined
}

// ChatGPTの答え（テキスト）を バトルステータスに よみとる。
// 1つも よみとれなければ null。
export function parseBattleAnswer(text: string): BattleStats | null {
  const hpRaw = pickLine(text, ['たいりょく', '体力', 'HP', 'ＨＰ'])
  const atkRaw = pickLine(text, ['こうげき', '攻撃', 'こうげきりょく'])
  const defRaw = pickLine(text, ['ぼうぎょ', '防御', 'ぼうぎょりょく'])
  const moveRaw = pickLine(text, ['わざ', '技', 'ひっさつわざ', '必殺技'])
  const effRaw = pickLine(text, ['こうか', '効果'])
  const powRaw = pickLine(text, ['こうかりょう', '効果量', 'いりょく', '威力'])
  const descRaw = pickLine(text, ['わざせつめい', 'せつめい', '説明', 'こうかせつめい'])

  const num = (s?: string): number | undefined => {
    if (!s) return undefined
    const m = s.match(/-?\d+/)
    return m ? Number(m[0]) : undefined
  }

  const hp = num(hpRaw)
  const attack = num(atkRaw)
  const defense = num(defRaw)
  const effect = effRaw ? parseEffect(effRaw) : undefined

  // なにも よみとれなかった
  if (
    hp === undefined &&
    attack === undefined &&
    defense === undefined &&
    !moveRaw &&
    !effect
  ) {
    return null
  }

  const eff: MoveEffect = effect ?? 'powerStrike'
  return {
    hp: clampInt(hp ?? 12, HP_MIN, HP_MAX),
    attack: clampInt(attack ?? 6, STAT_MIN, STAT_MAX),
    defense: clampInt(defense ?? 5, STAT_MIN, STAT_MAX),
    move: {
      name: (moveRaw ?? 'ひっさつわざ').replace(/[（(【].*$/, '').trim(),
      effect: eff,
      power: clampInt(num(powRaw) ?? 3, POWER_MIN, POWER_MAX),
      uses: usesForEffect(eff),
      desc: (descRaw ?? 'とくいわざ。').trim(),
    },
  }
}
