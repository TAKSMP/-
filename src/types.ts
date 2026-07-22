// 図鑑にのっている虫の「しゅるい」データ
export interface BugSpecies {
  id: string
  name: string // なまえ
  order: string // 目（もく）
  rarity: number // レア度（1〜5）
  habitat: string // 生息地（せいそくち）
  emoji: string // アイコンがわりの絵文字
  color: string // AIが写真から推理するときのヒントになる色
  fact: string // 豆ちしき
}

// AIが写真を判定した「けっか」。ユーザーが訂正できる4項目。
export interface AiResult {
  name: string // なまえ（種レベルの和名。例: オオカマキリ）
  order: string // 目
  rarity: number // レア度（1〜5）
  habitat: string // 生息地
  fact?: string // 説明文（AIが書いた、その種に合った豆ちしき）
  matchedSpeciesId?: string // 図鑑データと一致した場合のID
  confidence: number // AIの自信度（0〜1）
  demo?: boolean // デモモード（色から推理しただけ）の結果かどうか
}

// 1回ぶんの撮影（写真＋とった日＋みつけたばしょ）。
// 同じ虫を何回もとると、これがふえていく。
export interface Capture {
  id: string
  photo: string // 写真（dataURL）
  caughtAt: number // 記録した日時（ミリ秒）
  place?: string // みつけたばしょ（子どもが入力する、じっさいの場所）
}

// ひっさつわざの こうか（効果）のしゅるい
export type MoveEffect =
  | 'powerStrike' // つよいいちげき（大ダメージ・1かいだけ）
  | 'doubleAttack' // にかいこうげき（2かいこうげき・1かいだけ）
  | 'heal' // かいふく（たいりょくをかいふく）
  | 'attackUp' // こうげきアップ
  | 'defenseUp' // ぼうぎょアップ

// ひっさつわざ
export interface SpecialMove {
  name: string // わざの名前（その虫ならではの特徴）
  effect: MoveEffect // こうか
  power: number // こうかの大きさ（ダメージ加算・回復量・バフ量など。1〜6）
  uses: number // つかえる回数（つよい技は1回だけ）
  desc: string // わざのせつめい
}

// バトル用のステータス
export interface BattleStats {
  hp: number // たいりょく（1〜20・よこゲージ）
  attack: number // こうげきりょく（1〜10・星）
  defense: number // ぼうぎょりょく（1〜10・星）
  move: SpecialMove // ひっさつわざ
}

// 図鑑に記録された1しゅるいの虫。撮影の履歴（captures）をもつ。
export interface CaughtBug {
  id: string // レコードのID
  speciesId?: string // 図鑑データと一致した場合のID
  name: string
  order: string
  rarity: number
  habitat: string
  fact?: string // 説明文（AIが書いた、その種に合ったもの。あれば優先表示）
  captures: Capture[] // 撮影の履歴（あたらしい順）
  mainCaptureId: string // メイン画像につかう撮影のID
  corrected: boolean // ユーザーが訂正したことがあるか
  battle?: BattleStats // バトル用ステータス（未設定なら レア度から自動生成）
}

// 保存するときの入力（1回ぶんの撮影＋判定内容）
export interface CaptureInput {
  speciesId?: string
  name: string
  order: string
  rarity: number
  habitat: string
  fact?: string
  photo: string
  caughtAt: number
  place?: string // みつけたばしょ
  corrected: boolean
}
