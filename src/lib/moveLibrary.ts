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
  { no: 41, key: 'healAll', label: 'みかた ぜんいんの HPを かいふく' },
  { no: 42, key: 'cureAll', label: 'みかた ぜんいんの じょうたいいじょうを なおす' },
  { no: 43, key: 'cureSleep', label: 'じぶんか みかたの ねむりだけ なおす' },
  { no: 44, key: 'curePoison', label: 'じぶんか みかたの どくだけ なおす' },
  { no: 45, key: 'cureParalysis', label: 'じぶんか みかたの まひだけ なおす' },
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
  mv({ id: 'm23a', pattern: 'paralyze', name: 'しびれのこな', desc: 'しびれる こなで あいてを まひに する（すばやさ はんぶん・ときどき うごけない）。', emoji: '⚡', power: 0, target: 'oneFoe', accuracy: 90, inflict: { status: 'paralysis', chance: 1 }, tags: ['りんぷん', 'どく'] }),
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
  // ===== ここから ついか ぶん（50こ）=====
  // ① あいて1ぴきを つよく
  mv({ id: 'n01', pattern: 'bigHit', name: 'てっとうのずつき', desc: 'かたい あたまで まっすぐ ぶつかる。', emoji: '💥', power: 80, tags: ['かたい', 'つの'] }),
  mv({ id: 'n02', pattern: 'bigHit', name: 'じごくのはさみうち', desc: 'りょうがわから はさんで にがさない。', emoji: '🦞', power: 85, tags: ['はさみ', '甲殻類'] }),
  mv({ id: 'n03', pattern: 'bigHit', name: 'とげあしスタンプ', desc: 'とげの ある あしで ふみつける。', emoji: '🦵', power: 78, tags: ['あし', 'とげ', 'バッタ目'] }),
  mv({ id: 'n04', pattern: 'bigHit', name: 'まっぷたつぎり', desc: 'いっしゅんで きりさく。', emoji: '✂️', power: 88, tags: ['かま', 'するどい'] }),
  // ② あいて ぜんいん
  mv({ id: 'n05', pattern: 'spread', name: 'きりのカーテン', desc: 'しろい きりで あいて ぜんいんを つつむ。', emoji: '🌫️', power: 50, target: 'allFoes', tags: ['みず', 'トビケラ目'] }),
  mv({ id: 'n06', pattern: 'spread', name: 'すなあらしアタック', desc: 'すなを まきあげて ぜんいんを こうげき。', emoji: '🌪️', power: 55, target: 'allFoes', tags: ['あし', 'もぐる'] }),
  mv({ id: 'n07', pattern: 'spread', name: 'はねのつむじかぜ', desc: 'はねで かぜを おこして ふきとばす。', emoji: '🪭', power: 52, target: 'allFoes', tags: ['はね', 'トンボ目'] }),
  // ③ じぶん いがい ぜんいん
  mv({ id: 'n08', pattern: 'allOthers', name: 'だいばくはつのかおり', desc: 'すごい においが あたり いちめんに ひろがる。', emoji: '💥', power: 68, target: 'allOthers', tags: ['におい', 'カメムシ目'] }),
  // ④⑤ れんぞく こうげき
  mv({ id: 'n09', pattern: 'multi25', name: 'めまぐるしパンチ', desc: '2〜5かい すばやく たたく。', emoji: '👊', power: 22, hits: [2, 5], accuracy: 90, tags: ['あし', 'ちから'] }),
  mv({ id: 'n10', pattern: 'multi25', name: 'つつきのあらし', desc: 'くちばしのような くちで 2〜5かい つつく。', emoji: '🪶', power: 20, hits: [2, 5], accuracy: 90, tags: ['すう', 'カメムシ目'] }),
  mv({ id: 'n11', pattern: 'multiFixed', name: 'みつげきのつの', desc: 'つので かならず 3かい つきあげる。', emoji: '⚡', power: 26, hits: [3, 3], tags: ['つの', 'コウチュウ目'] }),
  mv({ id: 'n12', pattern: 'multiFixed', name: 'ダブルキック', desc: 'りょうあしで かならず 2かい ける。', emoji: '⚡', power: 34, hits: [2, 2], tags: ['あし', 'バッタ目'] }),
  // ⑥ あとに うごくと つよい
  mv({ id: 'n13', pattern: 'lateBoost', name: 'しずかなるいちげき', desc: 'あいての あとに うごくと いりょくが 2ばい。', emoji: '🕰️', power: 48, boostIfLate: 2, tags: ['ぎたい', 'かくれる'] }),
  mv({ id: 'n14', pattern: 'lateBoost', name: 'あとだしカウンター', desc: 'ようすを みてから うつと つよい。', emoji: '🕰️', power: 45, boostIfLate: 2, tags: ['め', 'かたい'] }),
  // ⑦⑧ ためる
  mv({ id: 'n15', pattern: 'charge', name: 'たいようチャージ', desc: 'おひさまの ちからを ためて つぎに はなつ。', emoji: '☀️', power: 115, chargeTurns: 1, tags: ['ひかる', 'はね'] }),
  mv({ id: 'n16', pattern: 'hideCharge', name: 'はっぱのしたへ', desc: 'はっぱの したに かくれて つぎに とびだす。', emoji: '🍃', power: 95, chargeTurns: 1, hideWhileCharging: true, tags: ['ぎたい', 'チョウ目'] }),
  mv({ id: 'n17', pattern: 'hideCharge', name: 'すなのなかへ', desc: 'すなに もぐって つぎに おそいかかる。', emoji: '🏜️', power: 100, chargeTurns: 1, hideWhileCharging: true, tags: ['もぐる', 'あし'] }),
  // ⑨ ちえん
  mv({ id: 'n18', pattern: 'delayed', name: 'しかけのねばいと', desc: '2ターンごに わなが はつどうする。', emoji: '🕸️', power: 85, delayTurns: 2, accuracy: null, tags: ['いと', 'クモガタ綱'] }),
  // ⑩ 大わざ
  mv({ id: 'n19', pattern: 'recharge', name: 'いっぱつしょうぶ', desc: 'ぜんぶの ちからを こめる。つぎは うごけない。', emoji: '☄️', power: 135, rechargeTurns: 1, accuracy: 90, tags: ['ちから'] }),
  // ⑪⑫ きゅうしょ
  mv({ id: 'n20', pattern: 'highCrit', name: 'するどいひとつき', desc: 'きゅうしょに あたりやすい いちげき。', emoji: '✨', power: 58, critStage: 2, tags: ['はり', 'ハチ目'] }),
  mv({ id: 'n21', pattern: 'highCrit', name: 'いあいのかまえ', desc: 'ねらいすまして きる。きゅうしょに あたりやすい。', emoji: '✨', power: 62, critStage: 2, tags: ['かま', 'カマキリ目'] }),
  mv({ id: 'n22', pattern: 'alwaysCrit', name: 'きゅうしょつらぬき', desc: 'よわい ところだけを ねらう。かならず きゅうしょ。', emoji: '🎯', power: 44, critStage: 9, accuracy: 85, tags: ['はり', 'するどい'] }),
  // ⑬ かならず あたる
  mv({ id: 'n23', pattern: 'sureHit', name: 'においついせき', desc: 'においで おいかける。かならず あたる。', emoji: '👃', power: 52, accuracy: null, tags: ['におい', 'ハエ目'] }),
  mv({ id: 'n24', pattern: 'sureHit', name: 'しんどうキャッチ', desc: 'ゆれを かんじて ねらう。かならず あたる。', emoji: '📡', power: 50, accuracy: null, tags: ['あし', '多足類'] }),
  // ⑭ こていダメージ
  mv({ id: 'n25', pattern: 'fixedDamage', name: 'ちくちくばり', desc: 'あいての HPを かならず 12 へらす。', emoji: '📌', power: 0, kind: 'attack', fixedDamage: 12, accuracy: null, tags: ['はり', 'とげ'] }),
  // ⑮⑯ じょうたいで つよくなる
  mv({ id: 'n26', pattern: 'vsStatus', name: 'とどめのひとかみ', desc: 'あいてが よわって いると いりょくが 2ばい。', emoji: '🦷', power: 48, boostIfFoeStatus: 2, tags: ['きば', 'あご'] }),
  mv({ id: 'n27', pattern: 'selfStatus', name: 'こんじょうアタック', desc: 'じぶんが くるしいほど つよくなる。', emoji: '🔥', power: 48, boostIfSelfStatus: 2, tags: ['ちから', 'かたい'] }),
  // ⑰⑱ リスクの ある わざ
  mv({ id: 'n28', pattern: 'recoil', name: 'すてみのとっしん', desc: 'みを すてて つっこむ。じぶんも ダメージ。', emoji: '🚀', power: 105, recoilRatio: 0.3, tags: ['ちから', 'コウチュウ目'] }),
  mv({ id: 'n29', pattern: 'hpCost', name: 'いのちのきば', desc: 'じぶんの HPを けずって かみつく。', emoji: '💔', power: 120, hpCostRatio: 0.2, tags: ['きば', 'どく'] }),
  // ⑲ きゅうしゅう
  mv({ id: 'n30', pattern: 'drain', name: 'あまみつドレイン', desc: 'すいとって じぶんの HPに する。', emoji: '💚', power: 52, drainRatio: 0.5, tags: ['みつ', 'すう'] }),
  mv({ id: 'n31', pattern: 'drain', name: 'ねっしんきゅうしゅう', desc: 'あいての ねつを うばって げんきに なる。', emoji: '🌡️', power: 48, drainRatio: 0.6, tags: ['すう', 'カメムシ目'] }),
  // ⑳㉑ はんげき
  mv({ id: 'n32', pattern: 'counter', name: 'いかりのおかえし', desc: 'このターン うけた ダメージを 2ばいで かえす。', emoji: '↩️', power: 0, kind: 'attack', counterRatio: 2, priority: -3, accuracy: null, target: 'oneFoe', tags: ['ちから'] }),
  mv({ id: 'n33', pattern: 'counterGuard', name: 'こうらのかまえ', desc: 'こうげきを うけると こうらで はんげき。', emoji: '🐢', power: 0, counterGuard: true, accuracy: null, tags: ['かたい', 'こうら'] }),
  // ㉒㉓㉔ じょうたいいじょう
  mv({ id: 'n34', pattern: 'poison', name: 'しびれどくえき', desc: 'どくの えきを かけて どくに する。', emoji: '☠️', power: 0, target: 'oneFoe', accuracy: 90, inflict: { status: 'poison', chance: 1 }, tags: ['どく', 'はり'] }),
  mv({ id: 'n35', pattern: 'poison', name: 'くさったにおい', desc: 'ひどい においで あいてを どくに する。', emoji: '🤢', power: 0, target: 'oneFoe', accuracy: 85, inflict: { status: 'poison', chance: 1 }, tags: ['におい'] }),
  mv({ id: 'n36', pattern: 'paralyze', name: 'でんげきのしっぽ', desc: 'びりびりと しびれさせて まひに する（すばやさ はんぶん・ときどき うごけない）。', emoji: '⚡', power: 0, target: 'oneFoe', accuracy: 90, inflict: { status: 'paralysis', chance: 1 }, tags: ['あし', 'とげ'] }),
  mv({ id: 'n37', pattern: 'sleep', name: 'ゆりかごのうた', desc: 'やさしい おとで ねむらせる。', emoji: '💤', power: 0, target: 'oneFoe', accuracy: 75, inflict: { status: 'sleep', chance: 1 }, tags: ['はね', 'バッタ目'] }),
  mv({ id: 'n38', pattern: 'sleep', name: 'ねむりのかおり', desc: 'あまい かおりで ねむくさせる。', emoji: '🌸', power: 0, target: 'oneFoe', accuracy: 75, inflict: { status: 'sleep', chance: 1 }, tags: ['みつ', 'チョウ目'] }),
  // ㉕〜㉘ のうりょく ダウン
  mv({ id: 'n39', pattern: 'atkDown', name: 'きあいそらし', desc: 'あいての ちからを ぬく。', emoji: '😮‍💨', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('attack', -1)], tags: ['ぎたい'] }),
  mv({ id: 'n40', pattern: 'defDown', name: 'よろいくだき', desc: 'かたい ところを こわして ぼうぎょを さげる。', emoji: '🔨', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('defense', -2)], tags: ['あご', 'ちから'] }),
  mv({ id: 'n41', pattern: 'spdDown', name: 'あしからめ', desc: 'あしを からめて うごきを にぶくする。', emoji: '🪢', power: 0, target: 'oneFoe', accuracy: 95, statChanges: [down('speed', -2)], tags: ['いと', 'あし'] }),
  mv({ id: 'n42', pattern: 'accDown', name: 'こなかけ', desc: 'こなを かけて ねらいを くるわせる。', emoji: '💨', power: 0, target: 'oneFoe', accuracy: 100, statChanges: [down('accuracy', -1)], tags: ['りんぷん', 'チョウ目'] }),
  // ㉙㉚ じぶん アップ
  mv({ id: 'n43', pattern: 'selfUp', name: 'ちからのおたけび', desc: 'おおきな こえで こうげきが あがる。', emoji: '🔺', power: 0, accuracy: null, statChanges: [up('attack', 2)], tags: ['ちから', 'バッタ目'] }),
  mv({ id: 'n44', pattern: 'selfUp', name: 'こうそくモード', desc: 'からだを かるくして すばやさが あがる。', emoji: '💨', power: 0, accuracy: null, statChanges: [up('speed', 2)], tags: ['とぶ', 'はね'] }),
  mv({ id: 'n45', pattern: 'selfUpMulti', name: 'だっぴのめざめ', desc: 'だっぴして ぼうぎょと すばやさが あがる。', emoji: '🌱', power: 0, accuracy: null, statChanges: [up('defense', 1), up('speed', 1)], tags: ['だっぴ'] }),
  // ㉛㉜ こうげき＋へんか
  mv({ id: 'n46', pattern: 'atkAndUp', name: 'かまえながらぎり', desc: 'きりつけながら ぼうぎょが あがる。', emoji: '🛡️', power: 55, statChanges: [{ to: 'self', stat: 'defense', stage: 1, chance: 1 }], tags: ['かま', 'かたい'] }),
  mv({ id: 'n47', pattern: 'atkAndDown', name: 'どろはねキック', desc: 'こうげき しながら あいての すばやさを さげる。', emoji: '🥾', power: 52, statChanges: [down('speed', -1, 1)], tags: ['あし', 'みず'] }),
  // ㉝ うばう
  mv({ id: 'n48', pattern: 'steal', name: 'ものまねポーズ', desc: 'あいての あげた ちからを まねて うばう。', emoji: '🫳', power: 0, target: 'oneFoe', accuracy: null, stealStats: true, tags: ['ぎたい', 'め'] }),
  // ㉟〜㊵ かいふく
  mv({ id: 'n49', pattern: 'healAlly', name: 'なかまへのみつ', desc: 'みかたに みつを わけて HPを かいふく。', emoji: '🍯', power: 0, target: 'ally', accuracy: null, healRatio: 0.5, tags: ['みつ', 'ハチ目'] }),
  mv({ id: 'n50', pattern: 'regen', name: 'ひなたぼっこ', desc: 'おひさまを あびて まいターン かいふく。', emoji: '☀️', power: 0, accuracy: null, regen: { ratio: 0.12, turns: 4 }, tags: ['ひかる', 'はね'] }),

  // ㊱' みかたの HPを かいふく（じぶんも えらべる）― もっと しゅるいを ふやした
  mv({ id: 'p01', pattern: 'healAlly', name: 'いやしのはな粉', desc: 'あまい はな粉を わけて HPを かいふく。じぶんにも つかえる。', emoji: '🌼', power: 0, target: 'ally', accuracy: null, healRatio: 0.5, tags: ['はな', 'かふん'] }),
  mv({ id: 'p02', pattern: 'healAlly', name: 'せいめいのしずく', desc: 'からだから にじみでる しずくで HPを かいふく。じぶんにも つかえる。', emoji: '💧', power: 0, target: 'ally', accuracy: null, healRatio: 0.5, tags: ['すう'] }),

  // ㊲' みかたの じょうたいいじょうを なおす（じぶんも えらべる）― もっと しゅるいを ふやした
  mv({ id: 'p03', pattern: 'cure', name: 'あんしんのはねおと', desc: 'はねおとで おちつかせて じょうたいいじょうを なおす。じぶんにも つかえる。', emoji: '🎐', power: 0, target: 'ally', accuracy: null, cureStatus: true, tags: ['はね'] }),
  mv({ id: 'p04', pattern: 'cure', name: 'きよめのこな', desc: 'からだの こなを ふりかけて じょうたいいじょうを なおす。じぶんにも つかえる。', emoji: '✨', power: 0, target: 'ally', accuracy: null, cureStatus: true, tags: ['りんぷん'] }),
  mv({ id: 'p05', pattern: 'cure', name: 'なかまのかんびょう', desc: 'そばで かいほうして じょうたいいじょうを なおす。じぶんにも つかえる。', emoji: '🩹', power: 0, target: 'ally', accuracy: null, cureStatus: true, tags: ['なかよし'] }),

  // ㊶ みかた ぜんいんの HPを かいふく
  mv({ id: 'p06', pattern: 'healAll', name: 'なかまへのじゅえき', desc: 'あまい じゅえきを みんなに わけて HPを かいふく。', emoji: '💚', power: 0, target: 'selfSide', accuracy: null, healRatio: 0.35, uses: 2, tags: ['じゅえき'] }),
  mv({ id: 'p07', pattern: 'healAll', name: 'いのちのはなびら', desc: 'はなびらを まいちらして なかま ぜんいんの HPを かいふく。', emoji: '🌸', power: 0, target: 'selfSide', accuracy: null, healRatio: 0.35, uses: 2, tags: ['はな'] }),

  // ㊷ みかた ぜんいんの じょうたいいじょうを なおす
  mv({ id: 'p08', pattern: 'cureAll', name: 'せいじょうのかぜ', desc: 'すずしい かぜを おくって なかま ぜんいんの じょうたいいじょうを なおす。', emoji: '🌬️', power: 0, target: 'selfSide', accuracy: null, cureStatus: true, uses: 2, tags: ['かぜ'] }),
  mv({ id: 'p09', pattern: 'cureAll', name: 'まもりのりんぷん', desc: 'りんぷんを ふりまいて なかま ぜんいんの じょうたいいじょうを なおす。', emoji: '🦋', power: 0, target: 'selfSide', accuracy: null, cureStatus: true, uses: 2, tags: ['りんぷん', 'チョウ目'] }),

  // ㊸ ねむりだけ なおす（じぶんも えらべる）
  mv({ id: 'p10', pattern: 'cureSleep', name: 'めざめのかね', desc: 'すんだ おとで めを さまさせる。ねむりだけ なおす。じぶんにも つかえる。', emoji: '🔔', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'sleep', tags: ['おと'] }),
  mv({ id: 'p11', pattern: 'cureSleep', name: 'さわやかなにおい', desc: 'すっきりした においで めを さまさせる。ねむりだけ なおす。じぶんにも つかえる。', emoji: '🌿', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'sleep', tags: ['におい'] }),

  // ㊹ どくだけ なおす（じぶんも えらべる）
  mv({ id: 'p12', pattern: 'curePoison', name: 'げどくのだえき', desc: 'どくを けす だえきを ぬる。どくだけ なおす。じぶんにも つかえる。', emoji: '🧪', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'poison', tags: ['だえき'] }),
  mv({ id: 'p13', pattern: 'curePoison', name: 'すいすいのしずく', desc: 'きれいな しずくで どくを ながす。どくだけ なおす。じぶんにも つかえる。', emoji: '💧', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'poison', tags: ['すう'] }),

  // ㊺ まひだけ なおす（じぶんも えらべる）
  mv({ id: 'p14', pattern: 'cureParalysis', name: 'あたためのはね', desc: 'はねで あおいで からだを あたためる。まひだけ なおす。じぶんにも つかえる。', emoji: '🪶', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'paralysis', tags: ['はね'] }),
  mv({ id: 'p15', pattern: 'cureParalysis', name: 'しびれぬきマッサージ', desc: 'からだを マッサージして しびれを とる。まひだけ なおす。じぶんにも つかえる。', emoji: '💆', power: 0, target: 'ally', accuracy: null, cureStatusKey: 'paralysis', tags: ['あし'] }),
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
