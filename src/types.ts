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
  name: string // なまえ
  order: string // 目
  rarity: number // レア度（1〜5）
  habitat: string // 生息地
  matchedSpeciesId?: string // 図鑑データと一致した場合のID
  confidence: number // AIの自信度（0〜1）デモ表示用
}

// 図鑑に記録された1件（＝子どもが実さいに見つけた虫）
export interface CaughtBug {
  id: string // レコードのID
  speciesId?: string // 図鑑データと一致した場合のID
  name: string
  order: string
  rarity: number
  habitat: string
  photo: string // 写真（dataURL）
  caughtAt: number // 記録した日時（ミリ秒）
  corrected: boolean // ユーザーが訂正したかどうか
}
