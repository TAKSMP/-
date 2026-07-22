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
import { canonicalOrder } from '../data/orders'

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

// -------------------------------------------------------------
//  ひっさつわざを、虫の こせいに あわせて 自動でつくる
// -------------------------------------------------------------
// 名前や説明文の「とくちょう」を てがかりに、その虫らしい技をえらぶ。

interface MoveTemplate {
  names: string[] // 技名の候補（虫ごとに 1つ えらぶ）
  effect: MoveEffect
  power: number
  desc: string
}

// 文字列 → かんたんな ハッシュ（虫ごとに いつも同じ技になるように）
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// ① 名前・説明文の「とくちょう」から えらぶ（マニアックな特徴を反映）
const FEATURE_MOVES: { re: RegExp; tpl: MoveTemplate }[] = [
  {
    re: /かま|カマ/,
    tpl: { names: ['かまのいちげき', 'しんくうがま', 'いあいぎり'], effect: 'powerStrike', power: 4, desc: 'するどい カマで つよく きりつける。' },
  },
  {
    re: /つの|ツノ|角/,
    tpl: { names: ['ヘラクレスなげ', 'つのビンタ', 'パワフルなげとばし'], effect: 'powerStrike', power: 5, desc: 'じまんの つので あいてを なげとばす。' },
  },
  {
    re: /はさみ|ハサミ|あご|アゴ|おおあご|きば|キバ|牙/,
    tpl: { names: ['ギガはさみ', 'はさみクラッシュ', 'だいあごがみ'], effect: 'powerStrike', power: 4, desc: 'おおきな あごで はさんで 大ダメージ。' },
  },
  {
    re: /どく|ドク|毒/,
    tpl: { names: ['どくのいちげき', 'もうどくスプレー', 'どくばりショット'], effect: 'powerStrike', power: 4, desc: 'つよい どくで しびれさせる。' },
  },
  {
    re: /はり|ハリ|針|さす|刺/,
    tpl: { names: ['どくばりアタック', 'ぶんぶんスティング', 'れんぞくばり'], effect: 'doubleAttack', power: 3, desc: 'するどい はりで 2かい さす。' },
  },
  {
    re: /とぶ|飛ぶ|はやい|速い|すばやい|ジャンプ|はねる|跳/,
    tpl: { names: ['スピードラッシュ', 'いなずまダッシュ', 'そらとぶれんげき'], effect: 'doubleAttack', power: 3, desc: 'すばやい うごきで 2かい こうげき。' },
  },
  {
    re: /かたい|硬い|こうら|コウラ|よろい|ヨロイ|がいこつ|甲/,
    tpl: { names: ['てっぺきガード', 'こうらシールド', 'ガチガチよろい'], effect: 'defenseUp', power: 3, desc: 'かたい からだで ぼうぎょを かためる。' },
  },
  {
    re: /すう|吸う|しる|じゅえき|樹液|みつ|ミツ|蜜/,
    tpl: { names: ['じゅえきチャージ', 'ちからのみつ', 'エナジードレイン'], effect: 'heal', power: 3, desc: 'あまい しるを すって たいりょく かいふく。' },
  },
  {
    re: /ひかる|光|発光|ホタル/,
    tpl: { names: ['フラッシュビーム', 'ひかりのまい', 'こうりんアタック'], effect: 'attackUp', power: 3, desc: 'まぶしい ひかりで こうげき力アップ。' },
  },
  {
    re: /におい|臭|くさい|ガス|くさ/,
    tpl: { names: ['くさいガス', 'あくしゅうスプレー', 'においばくだん'], effect: 'attackUp', power: 3, desc: 'すごい においで あいてを ひるませ こうげきアップ。' },
  },
  {
    re: /りんぷん|鱗粉|はね|ハネ|羽/,
    tpl: { names: ['りんぷんダンス', 'はねのまい', 'ふわふわかいひ'], effect: 'defenseUp', power: 3, desc: 'りんぷんを まいちらして みをまもる。' },
  },
  {
    re: /おおき|大き|きょだい|巨大|ちから|パワー|力もち|さいだい|最大/,
    tpl: { names: ['パワースラッシュ', 'ちからのいちげき', 'ごうわんクラッシュ'], effect: 'powerStrike', power: 5, desc: 'ありったけの ちからで こうげき。' },
  },
]

// ② 目（もく）から えらぶ（とくちょうが 見つからないとき）
const ORDER_MOVES: Record<string, MoveTemplate> = {
  カマキリ目: { names: ['かまのいちげき', 'いあいぎり', 'しんくうがま'], effect: 'powerStrike', power: 4, desc: 'かまで するどく きりつける。' },
  コウチュウ目: { names: ['ヘラクレスなげ', 'こうらタックル', 'パワースラッシュ'], effect: 'powerStrike', power: 4, desc: 'かたい からだで つっこむ。' },
  チョウ目: { names: ['りんぷんダンス', 'はねのまい', 'ふわふわかいひ'], effect: 'defenseUp', power: 3, desc: 'りんぷんを まいちらして みをまもる。' },
  ハチ目: { names: ['どくばりアタック', 'れんぞくスティング', 'はりのいちげき'], effect: 'doubleAttack', power: 3, desc: 'するどい はりで 2かい さす。' },
  トンボ目: { names: ['スピードダイブ', 'くうちゅうラッシュ', 'いなずまダッシュ'], effect: 'doubleAttack', power: 3, desc: 'すばやく 2かい こうげき。' },
  バッタ目: { names: ['メガジャンプキック', 'とびげり', 'だいジャンプ'], effect: 'powerStrike', power: 4, desc: 'ちからづよい あしで けりとばす。' },
  カメムシ目: { names: ['くさいガス', 'あくしゅうこうげき', 'においばくだん'], effect: 'attackUp', power: 3, desc: 'くさい においで こうげきアップ。' },
  ハエ目: { names: ['ぶんぶんラッシュ', 'こうそくフライト', 'れんぞくアタック'], effect: 'doubleAttack', power: 2, desc: 'すばやく 2かい こうげき。' },
  トビケラ目: { names: ['みずのまい', 'ながれアタック'], effect: 'defenseUp', power: 3, desc: 'みずの ながれで みをまもる。' },
  アミメカゲロウ目: { names: ['あごのいちげき', 'だいあごクラッシュ'], effect: 'powerStrike', power: 4, desc: 'おおきな あごで はさむ。' },
  クモガタ綱: { names: ['ねばねばネット', 'どくのキバ', 'クモのいと'], effect: 'powerStrike', power: 4, desc: 'どくの キバで かみつく。' },
  甲殻類: { names: ['はさみクラッシュ', 'こうらガード'], effect: 'powerStrike', power: 4, desc: 'つよい はさみで はさむ。' },
  多足類: { names: ['ひゃくそくラッシュ', 'どくあしキック'], effect: 'doubleAttack', power: 3, desc: 'たくさんの あしで 2かい こうげき。' },
}

// ③ どれにも当てはまらないとき（それでも アタックばかりに ならないように）
const GENERIC_MOVES: MoveTemplate[] = [
  { names: ['たいあたり', 'とっしんアタック', 'ローリングタックル'], effect: 'powerStrike', power: 3, desc: 'からだ ぜんたいで つっこむ。' },
  { names: ['れんぞくキック', 'すばやアタック', 'トリプルヒット'], effect: 'doubleAttack', power: 2, desc: 'すばやく 2かい こうげき。' },
  { names: ['がまんのかまえ', 'ふんばりガード'], effect: 'defenseUp', power: 3, desc: 'ぐっと こらえて みをまもる。' },
  { names: ['きあいだめ', 'とうしのにらみ'], effect: 'attackUp', power: 3, desc: 'きあいを ためて こうげき力アップ。' },
]

// 虫の こせいに あわせた ひっさつわざを つくる
export function defaultMove(bug: CaughtBug): SpecialMove {
  const text = `${bug.name} ${bug.fact ?? ''}`
  let tpl = FEATURE_MOVES.find((f) => f.re.test(text))?.tpl
  if (!tpl) {
    const co = canonicalOrder(bug.order)
    if (co && ORDER_MOVES[co]) tpl = ORDER_MOVES[co]
  }
  if (!tpl) tpl = GENERIC_MOVES[hashStr(bug.name) % GENERIC_MOVES.length]

  const seed = hashStr(bug.name + (bug.id ?? ''))
  const name = tpl.names[seed % tpl.names.length]
  const r = clampInt(bug.rarity, 1, 5)
  const power = clampInt(tpl.power + (r >= 5 ? 1 : 0), POWER_MIN, POWER_MAX)
  return {
    name,
    effect: tpl.effect,
    power,
    uses: usesForEffect(tpl.effect),
    desc: tpl.desc,
  }
}

// レア度などから、バトルステータスを自動でつくる（未設定の虫用）。
// おなじレア度でも 虫ごとに すこし ちがうように、名前から きめた ゆらぎを 足す。
export function defaultBattle(bug: CaughtBug): BattleStats {
  const r = clampInt(bug.rarity, 1, 5)
  const seed = hashStr(bug.name + (bug.id ?? ''))
  const jitA = ((seed >> 1) % 3) - 1 // -1〜1
  const jitD = ((seed >> 3) % 3) - 1 // -1〜1
  const jitH = ((seed >> 5) % 5) - 2 // -2〜2
  const hp = clampInt(8 + r * 2 + jitH, HP_MIN, HP_MAX)
  const attack = clampInt(3 + r + jitA, STAT_MIN, STAT_MAX)
  const defense = clampInt(2 + r + jitD, STAT_MIN, STAT_MAX)
  return { hp, attack, defense, move: defaultMove(bug) }
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

ひっさつわざは、その虫の マニアックな とくちょう（じっさいの すがた・こうどう・
たべもの・みのまもりかた・その虫だけの すごいところ）を いかした、
オリジナルの わざ名に してください。「◯◯アタック」のような ありきたりな名前は
さけて、その虫を しっている人が「おっ」と おもうような 名前にしてください
（れい: カブトムシなら「ヘラクレスなげ」、ミイデラゴミムシなら「100どのへっぴりガス」、
タガメなら「みずぎわのどくきば」）。
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
