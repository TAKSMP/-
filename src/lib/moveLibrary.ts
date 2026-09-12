// =============================================================
//  わざライブラリ（ひっさつわざ v2）
// -------------------------------------------------------------
//  「相手1匹を強めに攻撃」〜「相手のHPを毎ターン吸収」まで、
//  40しゅるいの わざパターンを ぜんぶ ここに ならべてある。
//  ・pattern … どの パターンか（UI の しぼりこみ・AI との やりとり用）
//  ・虫ごとの わざは、この ライブラリから えらんで つくる
// =============================================================
import type { MoveTarget, SpecialMoveV2, StatKey } from '../types'

// わざパターンの ばんごう（1〜40）。AIに きくときの コードにも つかう。
export const MOVE_PATTERNS = [
  { no: 1, key: 'bigHit', label: 'あいて1ぴきを つよく こうげき' },
  { no: 2, key: 'spread', label: 'あいて ぜんいんを こうげき' },
  { no: 3, key: 'allOthers', label: 'じぶん いがい ぜんいんを こうげき' },
  { no: 4, key: 'multi25', label: '2〜5かい れんぞく こうげき' },
  { no: 5, key: 'multiFixed', label: 'かならず 2かい・3かい こうげき' },
  { no: 6, key: 'lateBoost', label: 'あとに うごくと つよくなる' },
  { no: 7, key: 'charge', label: '1ターン ためて つぎに こうげき' },
  { no: 8, key: 'hideCharge', label: 'すがたを かくして つぎに こうげき' },
  { no: 9, key: 'delayed', label: 'すうターンごに こうげきが あたる' },
  { no: 10, key: 'recharge', label: 'つかうと つぎの ターン うごけない 大わざ' },
  { no: 11, key: 'highCrit', label: 'きゅうしょに あたりやすい' },
  { no: 12, key: 'alwaysCrit', label: 'かならず きゅうしょに あたる' },
  { no: 13, key: 'sureHit', label: 'かならず めいちゅうする' },
  { no: 14, key: 'fixedDamage', label: 'こていダメージ' },
  { no: 15, key: 'vsStatus', label: 'あいてが じょうたいいじょうだと つよい' },
  { no: 16, key: 'selfStatus', label: 'じぶんが じょうたいいじょうだと つよい' },
  { no: 17, key: 'recoil', label: 'じぶんも ダメージを うける はんどうわざ' },
  { no: 18, key: 'hpCost', label: 'じぶんのHPを へらして こうげき' },
  { no: 19, key: 'drain', label: 'あたえた ダメージを きゅうしゅうして かいふく' },
  { no: 20, key: 'counter', label: 'うけた ダメージを ばいがえし' },
  { no: 21, key: 'counterGuard', label: 'こうげきを うけると はんげきする' },
  { no: 22, key: 'poison', label: 'あいてを どくに する' },
  { no: 23, key: 'paralyze', label: 'あいてを まひに する' },
  { no: 24, key: 'sleep', label: 'あいてを ねむりに する' },
  { no: 25, key: 'atkDown', label: 'あいての こうげきを さげる' },
  { no: 26, key: 'defDown', label: 'あいての ぼうぎょを さげる' },
  { no: 27, key: 'spdDown', label: 'あいての すばやさを さげる' },
  { no: 28, key: 'accDown', label: 'あいての めいちゅうりつを さげる' },
  { no: 29, key: 'selfUp', label: 'じぶんの のうりょくを あげる' },
  { no: 30, key: 'selfUpMulti', label: 'いくつもの のうりょくを あげる' },
  { no: 31, key: 'atkAndUp', label: 'こうげき しながら じぶんを あげる' },
  { no: 32, key: 'atkAndDown', label: 'こうげき しながら あいてを さげる' },
  { no: 33, key: 'steal', label: 'あいての のうりょくを うばう' },
  { no: 34, key: 'swap', label: 'のうりょくを いれかえる' },
  { no: 35, key: 'heal', label: 'じぶんの HPを かいふく' },
  { no: 36, key: 'healAlly', label: 'みかたの HPを かいふく' },
  { no: 37, key: 'cure', label: 'みかたの じょうたいいじょうを なおす' },
  { no: 38, key: 'rest', label: 'ねむって ぜんかいふく' },
  { no: 39, key: 'regen', label: 'まいターン すこしずつ かいふく' },
  { no: 40, key: 'leech', label: 'あいてのHPを まいターン すいとる' },
] as const

export type MovePatternKey = (typeof MOVE_PATTERNS)[number]['key']

export interface LibraryMove extends SpecialMoveV2 {
  pattern: MovePatternKey
  tags: string[] // どんな虫に にあうか（かま・つの・どく…）
}

// みじかく かくための ヘルパー
type MvInput = Partial<LibraryMove> &
  Pick<LibraryMove, 'id' | 'pattern' | 'name' | 'desc' | 'power' | 'tags'>

function mv(m: MvInput): LibraryMove {
  const attacking = m.power > 0 || !!m.fixedDamage
  return {
    priority: 0,
    accuracy: 95,
    uses: 3,
    kind: attacking ? 'attack' : 'status',
    target: (attacking ? 'oneFoe' : 'self') as MoveTarget,
    ...m,
  } as LibraryMove
}

const up = (stat: StatKey, stage: number) =>
  ({ to: 'self', stat, stage }) as const
const down = (stat: StatKey, stage: number, chance?: number) =>
  ({ to: 'foe', stat, stage, chance }) as const

// -------------------------------------------------------------
//  ライブラリ本体（40パターン × 虫らしい わざ名）
// -------------------------------------------------------------
export const MOVE_LIBRARY: LibraryMove[] = [
  // ① あいて1ぴきを つよく
  mv({ id: 'm01a', pattern: 'bigHit', name: 'ヘラクレスなげ', desc: 'じまんの つので あいてを たかく なげとばす。', emoji: '💥', power: 85, tags: ['つの', 'コウチュウ目'] }),
  mv({ id: 'm01b', pattern: 'bigHit', name: 'かまのいちげき', desc: 'するどい かまで いっきに きりつける。', emoji: '🔪', power: 85, tags: ['かま', 'カマキリ目'] }),
  mv({ id: 'm01c', pattern: 'bigHit', name: 'だいあごクラッシュ', desc: 'おおきな あごで はさんで つぶす。', emoji: '💥', power: 80, tags: ['あご', 'はさみ'] }),

  // ② あいて ぜんいん
  mv({ id: 'm02a', pattern: 'spread', name: 'あくしゅうガス', desc: 'くさい ガスを まきちらして あいて ぜんいんを こうげき。', emoji: '💨', power: 55, target: 'allFoes', tags: ['におい', 'カメムシ目'] }),
  mv({ id: 'm02b', pattern: 'spread', name: 'りんぷんブリザード', desc: 'りんぷんを ふきつけて あいて ぜんいんを つつむ。', emoji: '❄️', power: 50, target: 'allFoes', tags: ['りんぷん', 'チョウ目'] }),

  // ③ じぶん いがい ぜんいん
  mv({ id: 'm03a', pattern: 'allOthers', name: '100どのへっぴりガス', desc: 'ねっとうの ガスを ばくはつ！ まわり ぜんぶを まきこむ。', emoji: '🌋', power: 70, target: 'allOthers', tags: ['におい', 'ばくはつ'] }),
  mv({ id: 'm03b', pattern: 'allOthers', name: 'だいちのしんどう', desc: 'じめんを ゆらして まわりの みんなに ダメージ。', emoji: '🌊', power: 65, target: 'allOthers', tags: ['おおきい'] }),

  // ④ 2〜5かい れんぞく
  mv({ id: 'm04a', pattern: 'multi25', name: 'ひゃくそくラッシュ', desc: 'たくさんの あしで 2〜5かい たたきこむ。', emoji: '👣', power: 20, hits: [2, 5], accuracy: 90, tags: ['あし', '多足類'] }),
  mv({ id: 'm04b', pattern: 'multi25', name: 'れんぞくばりチクチク', desc: 'するどい はりで 2〜5かい さしつづける。', emoji: '💉', power: 20, hits: [2, 5], accuracy: 90, tags: ['はり', 'ハチ目'] }),

  // ⑤ かならず きまった かいすう
  mv({ id: 'm05a', pattern: 'multiFixed', name: 'にどぎりのかま', desc: 'ひだり みぎの かまで かならず 2かい きる。', emoji: '⚡', power: 35, hits: [2, 2], tags: ['かま', 'カマキリ目'] }),
  mv({ id: 'm05b', pattern: 'multiFixed', name: 'トリプルスティング', desc: 'はりで かならず 3かい さす。', emoji: '⚡', power: 25, hits: [3, 3], tags: ['はり', 'ハチ目'] }),

  // ⑥ あとに うごくと つよい
  mv({ id: 'm06a', pattern: 'lateBoost', name: 'まちぶせのきば', desc: 'あいてが うごいた あとに かみつくと いりょくが 2ばい。', emoji: '🕰️', power: 50, boostIfLate: 2, tags: ['まちぶせ', 'クモガタ綱'] }),

  // ⑦ 1ターン ためる
  mv({ id: 'm07a', pattern: 'charge', name: 'ためこみタックル', desc: '1ターン ちからを ためて、つぎの ターンに とっしん。', emoji: '⏳', power: 120, chargeTurns: 1, tags: ['おおきい', 'ちから'] }),

  // ⑧ すがたを かくして つぎに
  mv({ id: 'm08a', pattern: 'hideCharge', name: 'つちにもぐる', desc: 'つちに もぐって こうげきを かわし、つぎの ターンに とびだす。', emoji: '🕳️', power: 100, chargeTurns: 1, hideWhileCharging: true, tags: ['もぐる', 'コウチュウ目'] }),
  mv({ id: 'm08b', pattern: 'hideCharge', name: 'はっぱのかくれみ', desc: 'はっぱに ぎたいして みつからず、つぎの ターンに おそう。', emoji: '🍃', power: 95, chargeTurns: 1, hideWhileCharging: true, tags: ['ぎたい', 'かくれる'] }),

  // ⑨ すうターンご に あたる
  mv({ id: 'm09a', pattern: 'delayed', name: 'よこくのクモのいと', desc: '2ターンご に わなが はつどうして あいてに あたる。', emoji: '🕸️', power: 90, delayTurns: 2, accuracy: null, tags: ['いと', 'クモガタ綱'] }),

  // ⑩ つかうと つぎ うごけない
  mv({ id: 'm10a', pattern: 'recharge', name: 'ぜんりょくヘッドバット', desc: 'ぜんぶの ちからを ぶつける。つぎの ターンは うごけない。', emoji: '☄️', power: 140, rechargeTurns: 1, accuracy: 90, tags: ['つの', 'ちから'] }),

  // ⑪ きゅうしょに あたりやすい
  mv({ id: 'm11a', pattern: 'highCrit', name: 'いあいぎり', desc: 'するどい いちげき。きゅうしょに あたりやすい。', emoji: '✨', power: 60, critStage: 2, tags: ['かま', 'するどい'] }),

  // ⑫ かならず きゅうしょ
  mv({ id: 'm12a', pattern: 'alwaysCrit', name: 'きゅうしょのどくきば', desc: 'よわいところを ねらって かならず きゅうしょに あてる。', emoji: '🎯', power: 45, critStage: 9, accuracy: 85, tags: ['きば', 'どく'] }),

  // ⑬ かならず めいちゅう
  mv({ id: 'm13a', pattern: 'sureHit', name: 'ロックオンビーム', desc: 'ふくがんで ねらいを さだめる。かならず あたる。', emoji: '👁️', power: 55, accuracy: null, tags: ['め', 'トンボ目'] }),

  // ⑭ こていダメージ
  mv({ id: 'm14a', pattern: 'fixedDamage', name: 'じゅえきドレイン', desc: 'あいての HPを かならず 10 へらす。', emoji: '🥤', power: 0, kind: 'attack', fixedDamage: 10, accuracy: null, tags: ['すう', 'じゅえき'] }),

  // ⑮ あいてが じょうたいいじょう だと つよい
  mv({ id: 'm15a', pattern: 'vsStatus', name: 'よわりめアタック', desc: 'あいてが よわって いると いりょくが 2ばい。', emoji: '🩸', power: 50, boostIfFoeStatus: 2, tags: ['どく'] }),

  // ⑯ じぶんが じょうたいいじょう だと つよい
  mv({ id: 'm16a', pattern: 'selfStatus', name: 'やけくそブレイク', desc: 'じぶんが くるしいほど つよくなる。', emoji: '🔥', power: 50, boostIfSelfStatus: 2, tags: ['どく', 'ちから'] }),

  // ⑰ はんどうわざ
  mv({ id: 'm17a', pattern: 'recoil', name: 'とっしんダイブ', desc: 'ぜんそくりょくで つっこむ。じぶんも すこし ダメージ。', emoji: '🚀', power: 110, recoilRatio: 0.33, tags: ['とぶ', 'トンボ目'] }),

  // ⑱ じぶんのHPを へらして こうげき
  mv({ id: 'm18a', pattern: 'hpCost', name: 'いのちのいちげき', desc: 'じぶんの HPを けずって とんでもない いちげきを はなつ。', emoji: '💔', power: 130, hpCostRatio: 0.25, tags: ['ちから'] }),

  // ⑲ きゅうしゅう
  mv({ id: 'm19a', pattern: 'drain', name: 'エナジードレイン', desc: 'あいてから すいとって じぶんの HPを かいふく。', emoji: '💚', power: 55, drainRatio: 0.5, tags: ['すう', 'カメムシ目'] }),

  // ⑳ ばいがえし
  mv({ id: 'm20a', pattern: 'counter', name: 'ばいがえしのかまえ', desc: 'このターン うけた ダメージを 2ばいに して かえす。', emoji: '↩️', power: 0, kind: 'attack', counterRatio: 2, priority: -3, accuracy: null, target: 'oneFoe', tags: ['かたい'] }),

  // ㉑ はんげきの かまえ
  mv({ id: 'm21a', pattern: 'counterGuard', name: 'とげのよろい', desc: 'こうげきを うけると とげで はんげきする かまえ。', emoji: '🦔', power: 0, counterGuard: true, accuracy: null, tags: ['とげ', 'かたい'] }),

  // ㉒㉓㉔ じょうたいいじょう
  mv({ id: 'm22a', pattern: 'poison', name: 'もうどくスプレー', desc: 'つよい どくを ふきかけて あいてを どくに する。', emoji: '☠️', power: 0, target: 'oneFoe', accuracy: 90, inflict: { status: 'poison', chance: 1 }, tags: ['どく'] }),
  mv({ id: 'm23a', pattern: 'paralyze', name: 'しびれのこな', desc: 'しびれる こなで あいてを まひに する。', emoji: '⚡', power: 0, target: 'oneFoe', accuracy: 90, inflict: { status: 'paralysis', chance: 1 }, tags: ['りんぷん', 'どく'] }),
  mv({ id: 'm24a', pattern: 'sleep', name: 'ねむりのりんぷん', desc: 'ねむくなる りんぷんで あいてを ねむらせる。', emoji: '💤', power: 0, target: 'oneFoe', accuracy: 75, inflict: { status: 'sleep', chance: 1 }, tags: ['りんぷん', 'チョウ目'] }),

  // ㉕〜㉘ あいての のうりょく ダウン
  mv({ id: 'm25a', pattern: 'atkDown', name: 'いかくのポーズ', desc: 'おおきく みせて あいての こうげきを さげる。', emoji: '😤', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('attack', -1)], tags: ['いかく', 'カマキリ目'] }),
  mv({ id: 'm26a', pattern: 'defDown', name: 'こうらくずし', desc: 'かたい ところを けずって ぼうぎょを さげる。', emoji: '🔨', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('defense', -1)], tags: ['あご', 'はさみ'] }),
  mv({ id: 'm27a', pattern: 'spdDown', name: 'ねばねばネット', desc: 'ねばねばの いとで あいての すばやさを さげる。', emoji: '🕸️', power: 0, target: 'oneFoe', accuracy: 95, statChanges: [down('speed', -2)], tags: ['いと', 'クモガタ綱'] }),
  mv({ id: 'm28a', pattern: 'accDown', name: 'めくらましフラッシュ', desc: 'まぶしく ひかって あいての めいちゅうりつを さげる。', emoji: '💡', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('accuracy', -1)], tags: ['ひかる', 'ホタル'] }),

  // ㉙㉚ じぶんの のうりょく アップ
  mv({ id: 'm29a', pattern: 'selfUp', name: 'きあいだめ', desc: 'きあいを ためて こうげきが あがる。', emoji: '🔺', power: 0, accuracy: null, statChanges: [up('attack', 2)], tags: ['ちから'] }),
  mv({ id: 'm29b', pattern: 'selfUp', name: 'てっぺきガード', desc: 'からだを かためて ぼうぎょが あがる。', emoji: '🛡️', power: 0, accuracy: null, statChanges: [up('defense', 2)], tags: ['かたい', 'こうら'] }),
  mv({ id: 'm30a', pattern: 'selfUpMulti', name: 'はねのまい', desc: 'はねを ふるわせて こうげきと すばやさが あがる。', emoji: '🦋', power: 0, accuracy: null, statChanges: [up('attack', 1), up('speed', 1)], tags: ['はね', 'チョウ目'] }),

  // ㉛㉜ こうげき＋のうりょく変化
  mv({ id: 'm31a', pattern: 'atkAndUp', name: 'つのアッパー', desc: 'こうげき しながら じぶんの こうげきが あがる。', emoji: '🔺', power: 60, statChanges: [{ to: 'self', stat: 'attack', stage: 1, chance: 1 }], tags: ['つの'] }),
  mv({ id: 'm32a', pattern: 'atkAndDown', name: 'すなかけキック', desc: 'こうげき しながら あいての めいちゅうりつを さげる。', emoji: '🌪️', power: 55, statChanges: [down('accuracy', -1, 1)], tags: ['あし', 'バッタ目'] }),

  // ㉝㉞ のうりょくを うばう・いれかえる
  mv({ id: 'm33a', pattern: 'steal', name: 'ちからどろぼう', desc: 'あいてが あげた のうりょくを そっくり うばいとる。', emoji: '🫳', power: 0, target: 'oneFoe', accuracy: null, stealStats: true, tags: ['ずるい'] }),
  mv({ id: 'm34a', pattern: 'swap', name: 'いれかえのいと', desc: 'じぶんと あいての のうりょくを そっくり いれかえる。', emoji: '🔄', power: 0, target: 'oneFoe', accuracy: null, swapStats: true, tags: ['いと'] }),

  // ㉟〜㊵ かいふく けい
  mv({ id: 'm35a', pattern: 'heal', name: 'ちからのみつ', desc: 'あまい みつを のんで HPを かいふく。', emoji: '🍯', power: 0, accuracy: null, healRatio: 0.5, tags: ['みつ', 'ハチ目'] }),
  mv({ id: 'm36a', pattern: 'healAlly', name: 'なかまのじゅえき', desc: 'みかたに じゅえきを わけて HPを かいふく。', emoji: '💚', power: 0, target: 'ally', accuracy: null, healRatio: 0.5, tags: ['じゅえき'] }),
  mv({ id: 'm37a', pattern: 'cure', name: 'きよめのしずく', desc: 'みかたの じょうたいいじょうを なおす。', emoji: '💧', power: 0, target: 'ally', accuracy: null, cureStatus: true, tags: ['みず'] }),
  mv({ id: 'm38a', pattern: 'rest', name: 'まゆごもり', desc: 'まゆに こもって ねむり、HPを ぜんぶ かいふく。', emoji: '🛌', power: 0, accuracy: null, restSleep: true, tags: ['まゆ', 'チョウ目'] }),
  mv({ id: 'm39a', pattern: 'regen', name: 'だっぴのじゅんび', desc: 'まいターン すこしずつ HPが かいふく する。', emoji: '🌱', power: 0, accuracy: null, regen: { ratio: 0.12, turns: 4 }, tags: ['だっぴ'] }),
  mv({ id: 'm40a', pattern: 'leech', name: 'すいつきのくち', desc: 'あいてに すいついて まいターン HPを すいとる。', emoji: '🩸', power: 0, target: 'oneFoe', accuracy: 90, leech: { ratio: 0.1, turns: 4 }, tags: ['すう', 'カメムシ目'] }),
]

export function findMove(id: string): LibraryMove | undefined {
  return MOVE_LIBRARY.find((m) => m.id === id)
}

export function movesByPattern(pattern: MovePatternKey): LibraryMove[] {
  return MOVE_LIBRARY.filter((m) => m.pattern === pattern)
}

// ふつうの こうげき（わざを つかわないとき）
export const BASIC_ATTACK: SpecialMoveV2 = {
  id: 'basic',
  name: 'こうげき',
  desc: 'ふつうの こうげき。',
  kind: 'attack',
  target: 'oneFoe',
  power: 40,
  accuracy: 100,
  priority: 0,
  uses: 999,
  emoji: '⚔️',
}
