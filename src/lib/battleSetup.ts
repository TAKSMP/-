// =============================================================
//  バトル v2 の したごしらえ
// -------------------------------------------------------------
//  ・虫の こせい（名前・せつめい・目）から わざを 3つ えらぶ
//  ・ふるい BattleStats（わざ1つ・すばやさ なし）からの ひきつぎ
//  ・AI（ChatGPT）に きくための しつもん文 と よみとり
// =============================================================
import type { BattleStatsV2, CaughtBug, SpecialMoveV2 } from '../types'
import { canonicalOrder } from '../data/orders'
import { MOVE_LIBRARY, MOVE_PATTERNS, type LibraryMove } from './moveLibrary'
import {
  clampInt,
  HP_MAX,
  HP_MIN,
  migrateHp,
  migrateSpeed,
  STAT_MAX,
  STAT_MIN,
} from './battleEngine'

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 名前・せつめいの「とくちょう」から タグを ひろう
const FEATURE_TAGS: { re: RegExp; tag: string }[] = [
  { re: /かま|カマ/, tag: 'かま' },
  { re: /つの|ツノ|角/, tag: 'つの' },
  { re: /はさみ|ハサミ/, tag: 'はさみ' },
  { re: /あご|アゴ|おおあご/, tag: 'あご' },
  { re: /きば|キバ|牙/, tag: 'きば' },
  { re: /どく|ドク|毒/, tag: 'どく' },
  { re: /はり|ハリ|針|さす|刺/, tag: 'はり' },
  { re: /とぶ|飛ぶ|はやい|速い|すばやい|ジャンプ|はねる|跳/, tag: 'とぶ' },
  { re: /かたい|硬い|こうら|コウラ|よろい|甲/, tag: 'かたい' },
  { re: /とげ|トゲ|棘/, tag: 'とげ' },
  { re: /すう|吸う|しる|じゅえき|樹液/, tag: 'すう' },
  { re: /みつ|ミツ|蜜/, tag: 'みつ' },
  { re: /ひかる|光|発光|ホタル/, tag: 'ひかる' },
  { re: /におい|臭|くさい|ガス/, tag: 'におい' },
  { re: /りんぷん|鱗粉/, tag: 'りんぷん' },
  { re: /はね|ハネ|羽/, tag: 'はね' },
  { re: /いと|糸|クモ/, tag: 'いと' },
  { re: /もぐ|土|地中/, tag: 'もぐる' },
  { re: /ぎたい|擬態|かくれ|隠/, tag: 'ぎたい' },
  { re: /おおき|大き|きょだい|巨大|ちから|パワー|力/, tag: 'ちから' },
  { re: /あし|脚|足/, tag: 'あし' },
  { re: /まゆ|繭|さなぎ/, tag: 'まゆ' },
  { re: /め|目|ふくがん|複眼/, tag: 'め' },
  { re: /みず|水|川|池/, tag: 'みず' },
  { re: /だっぴ|脱皮/, tag: 'だっぴ' },
]

export function tagsOf(bug: CaughtBug): string[] {
  const text = `${bug.name} ${bug.fact ?? ''}`
  const tags = FEATURE_TAGS.filter((f) => f.re.test(text)).map((f) => f.tag)
  const co = canonicalOrder(bug.order)
  if (co) tags.push(co)
  return tags
}

// 虫に にあう わざを てんすうづけ して 3つ えらぶ。
// ・1つめ … こうげきわざ（あいて1ぴき or ぜんたい）
// ・2つめ … じょうたいいじょう or のうりょく変化
// ・3つめ … かいふく or へんかしゅの こうげきわざ
export function defaultMovesV2(bug: CaughtBug): SpecialMoveV2[] {
  const tags = tagsOf(bug)
  const seed = hashStr(bug.name + (bug.id ?? ''))
  const r = clampInt(bug.rarity, 1, 5)

  const score = (m: LibraryMove, i: number): number => {
    const match = m.tags.filter((t) => tags.includes(t)).length
    return match * 100 + ((seed >> (i % 8)) % 17) // にてる わざを ゆうせん＋虫ごとの ゆらぎ
  }

  const attackers = MOVE_LIBRARY.filter((m) => m.kind === 'attack')
  const supports = MOVE_LIBRARY.filter(
    (m) =>
      m.kind === 'status' &&
      (m.inflict || m.statChanges || m.stealStats || m.swapStats),
  )
  const recovery = MOVE_LIBRARY.filter(
    (m) => m.healRatio || m.restSleep || m.regen || m.leech || m.cureStatus,
  )

  const pick = (pool: LibraryMove[], exclude: Set<string>, i: number) => {
    const sorted = pool
      .filter((m) => !exclude.has(m.id))
      .sort((a, b) => score(b, i) - score(a, i))
    return sorted[0]
  }

  const used = new Set<string>()
  const picked: LibraryMove[] = []
  for (const [i, pool] of [attackers, supports, recovery].entries()) {
    const m = pick(pool, used, i)
    if (m) {
      used.add(m.id)
      picked.push(m)
    }
  }
  // レア度が たかい虫は、つよい わざを もう1つ もらえる（3つめを さしかえ）
  if (r >= 5) {
    const strong = attackers
      .filter((m) => !used.has(m.id) && m.power >= 100)
      .sort((a, b) => score(b, 3) - score(a, 3))[0]
    if (strong) picked[2] = strong
  }

  return picked.map((m) => ({ ...m, uses: usesFor(m) }))
}

// つよい わざほど つかえる かいすうが すくない
export function usesFor(m: SpecialMoveV2): number {
  if (m.power >= 110 || m.restSleep || m.swapStats) return 1
  if (m.power >= 70 || m.stealStats) return 2
  if (m.kind === 'status') return 3
  return 3
}

// -------------------------------------------------------------
//  ステータス（v2）を とりだす。ふるいデータからも ひきつげる。
// -------------------------------------------------------------
export function battleStatsV2(bug: CaughtBug): BattleStatsV2 {
  const legacy = bug.battle
  const v2 = legacy as unknown as Partial<BattleStatsV2> | undefined

  // すでに v2 で ほぞん されている
  if (v2?.moves && v2.moves.length > 0 && typeof v2.speed === 'number') {
    return {
      hp: clampInt(v2.hp ?? 40, HP_MIN, HP_MAX),
      attack: clampInt(v2.attack ?? 5, STAT_MIN, STAT_MAX),
      defense: clampInt(v2.defense ?? 5, STAT_MIN, STAT_MAX),
      speed: clampInt(v2.speed, STAT_MIN, STAT_MAX),
      moves: v2.moves.slice(0, 3),
    }
  }

  // ふるいデータ（わざ1つ・すばやさ なし）からの ひきつぎ
  if (legacy) {
    return {
      hp: migrateHp(legacy.hp),
      attack: clampInt(legacy.attack, STAT_MIN, STAT_MAX),
      defense: clampInt(legacy.defense, STAT_MIN, STAT_MAX),
      speed: migrateSpeed(bug),
      moves: mergeLegacyMove(bug),
    }
  }

  // なにも ない → レア度から じどう生成
  const r = clampInt(bug.rarity, 1, 5)
  const seed = hashStr(bug.name + (bug.id ?? ''))
  return {
    hp: clampInt(HP_MIN + r * 6 + (((seed >> 5) % 9) - 4), HP_MIN, HP_MAX),
    attack: clampInt(3 + r + (((seed >> 1) % 3) - 1), STAT_MIN, STAT_MAX),
    defense: clampInt(2 + r + (((seed >> 3) % 3) - 1), STAT_MIN, STAT_MAX),
    speed: migrateSpeed(bug),
    moves: defaultMovesV2(bug),
  }
}

// ふるい ひっさつわざ（名前だけ のこす）＋ あたらしい わざ2つ
function mergeLegacyMove(bug: CaughtBug): SpecialMoveV2[] {
  const auto = defaultMovesV2(bug)
  const old = bug.battle?.move
  if (!old) return auto
  const base = auto[0]
  const kept: SpecialMoveV2 = {
    ...base,
    id: 'legacy',
    name: old.name, // 子どもが つけた 名前は ぜったいに のこす
    desc: old.desc || base.desc,
  }
  return [kept, auto[1], auto[2]].filter(Boolean) as SpecialMoveV2[]
}

// -------------------------------------------------------------
//  AI（ChatGPT）に きく しつもん文
// -------------------------------------------------------------
export function buildBattlePromptV2(name: string, fact?: string): string {
  const factLine = fact?.trim() ? `この虫のとくちょう: ${fact.trim()}\n` : ''
  const list = MOVE_PATTERNS.map((p) => `${p.no}. ${p.label}`).join('\n')
  const fence = '```'
  return `日本の昆虫「${name}」の、たいせんゲーム用のステータスを、バランスを考えてきめてください。
${factLine}その虫の じっさいの とくちょう（大きさ・力・すばやさ・ハサミや毒など）を いかしつつ、
1ぴきだけ きょくたんに つよくならないように してください。

ひっさつわざは 3つ。その虫の マニアックな とくちょうを いかした オリジナルの
わざ名に してください（れい: カブトムシなら「ヘラクレスなげ」、
ミイデラゴミムシなら「100どのへっぴりガス」、タガメなら「みずぎわのどくきば」）。
3つは できるだけ タイプを ばらけさせて ください
（こうげき・じょうたいいじょう／のうりょく変化・かいふく のように）。

わざタイプは つぎの 40しゅるいから ばんごうで えらんでください:
${list}

答えは、下の行だけを ${fence}（コードブロック）で かこんで、かな中心で 出力してください。
コードブロックの そとには 何も書かないでください。

${fence}
たいりょく: （20〜60の数字）
こうげき: （1〜10の数字）
ぼうぎょ: （1〜10の数字）
すばやさ: （1〜10の数字）
わざ1: （わざの名前）
タイプ1: （1〜40の番号）
せつめい1: （かなで みじかく）
わざ2: （わざの名前）
タイプ2: （1〜40の番号）
せつめい2: （かなで みじかく）
わざ3: （わざの名前）
タイプ3: （1〜40の番号）
せつめい3: （かなで みじかく）
${fence}`
}

function pickLine(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`^\\s*[*\\-・]?\\s*${label}\\s*[:：]\\s*(.+)$`, 'm')
    const m = text.match(re)
    if (m && m[1].trim()) return m[1].trim()
  }
  return undefined
}

const num = (s?: string): number | undefined => {
  if (!s) return undefined
  const m = s.match(/-?\d+/)
  return m ? Number(m[0]) : undefined
}

// AIの こたえを よみとる。よみとれなければ null。
export function parseBattleAnswerV2(
  text: string,
  bug: CaughtBug,
): BattleStatsV2 | null {
  const hp = num(pickLine(text, ['たいりょく', '体力', 'HP', 'ＨＰ']))
  const attack = num(pickLine(text, ['こうげき', '攻撃']))
  const defense = num(pickLine(text, ['ぼうぎょ', '防御']))
  const speed = num(pickLine(text, ['すばやさ', '素早さ', 'スピード']))

  const auto = defaultMovesV2(bug)
  const moves: SpecialMoveV2[] = []
  for (let i = 1; i <= 3; i++) {
    const mName = pickLine(text, [`わざ${i}`, `技${i}`, `ひっさつわざ${i}`])
    if (!mName) continue
    const typeNo = num(pickLine(text, [`タイプ${i}`, `こうか${i}`, `効果${i}`]))
    const desc = pickLine(text, [`せつめい${i}`, `わざせつめい${i}`, `説明${i}`])
    const pat = MOVE_PATTERNS.find((p) => p.no === typeNo)
    const template =
      (pat && MOVE_LIBRARY.find((m) => m.pattern === pat.key)) ??
      auto[i - 1] ??
      auto[0]
    moves.push({
      ...template,
      id: `ai${i}`,
      name: mName.replace(/[（(【].*$/, '').trim(),
      desc: (desc ?? template.desc).trim(),
      uses: usesFor(template),
    })
  }

  if (
    hp === undefined &&
    attack === undefined &&
    defense === undefined &&
    moves.length === 0
  ) {
    return null
  }

  const fallback = battleStatsV2(bug)
  return {
    hp: clampInt(hp ?? fallback.hp, HP_MIN, HP_MAX),
    attack: clampInt(attack ?? fallback.attack, STAT_MIN, STAT_MAX),
    defense: clampInt(defense ?? fallback.defense, STAT_MIN, STAT_MAX),
    speed: clampInt(speed ?? fallback.speed, STAT_MIN, STAT_MAX),
    moves: moves.length > 0 ? moves : fallback.moves,
  }
}
