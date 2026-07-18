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

// 図鑑に記録された1件（＝子どもが実さいに見つけた虫）
export interface CaughtBug {
  id: string // レコードのID
  speciesId?: string // 図鑑データと一致した場合のID
  name: string
  order: string
  rarity: number
  habitat: string
  fact?: string // 説明文（AIが書いた、その種に合ったもの。あれば優先表示）
  photo: string // 写真（dataURL）
  caughtAt: number // 記録した日時（ミリ秒）
  corrected: boolean // ユーザーが訂正したかどうか
}
