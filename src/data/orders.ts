// 『学研の図鑑LIVE 昆虫』もくじ の30分類（本の順番）。
// 26の「目（もく）」＋昆虫以外の4グループ（内顎類・甲殻類・多足類・クモガタ綱）。
export const INSECT_ORDERS: string[] = [
  'イシノミ目',
  'シミ目',
  'カゲロウ目',
  'トンボ目',
  'ハサミムシ目',
  'カワゲラ目',
  'バッタ目',
  'ナナフシ目',
  'シロアリモドキ目',
  'ガロアムシ目',
  'カマキリ目',
  'ゴキブリ目',
  'カジリムシ目',
  'アザミウマ目',
  'カメムシ目',
  'ハチ目',
  'ラクダムシ目',
  'ヘビトンボ目',
  'アミメカゲロウ目',
  'ネジレバネ目',
  'コウチュウ目',
  'トビケラ目',
  'チョウ目',
  'シリアゲムシ目',
  'ノミ目',
  'ハエ目',
  '内顎類',
  '甲殻類',
  '多足類',
  'クモガタ綱',
]

// もくじ表示用のアイコン（絵文字）。ないものは 🐛。
export const ORDER_EMOJI: Record<string, string> = {
  イシノミ目: '🐛',
  シミ目: '🐛',
  カゲロウ目: '🪰',
  トンボ目: '🪰',
  ハサミムシ目: '✂️',
  カワゲラ目: '🪰',
  バッタ目: '🦗',
  ナナフシ目: '🌿',
  シロアリモドキ目: '🕸️',
  ガロアムシ目: '🐛',
  カマキリ目: '🦗',
  ゴキブリ目: '🪳',
  カジリムシ目: '🐛',
  アザミウマ目: '🐛',
  カメムシ目: '🛡️',
  ハチ目: '🐝',
  ラクダムシ目: '🐛',
  ヘビトンボ目: '🐛',
  アミメカゲロウ目: '🌿',
  ネジレバネ目: '🐛',
  コウチュウ目: '🪲',
  トビケラ目: '🪰',
  チョウ目: '🦋',
  シリアゲムシ目: '🦂',
  ノミ目: '🦟',
  ハエ目: '🪰',
  内顎類: '🐛',
  甲殻類: '🦐',
  多足類: '🐛',
  クモガタ綱: '🕷️',
}

export function orderEmoji(name: string): string {
  return ORDER_EMOJI[name] ?? '🐛'
}

const ORDER_SET = new Set(INSECT_ORDERS)

// AIやユーザーが入れた「目」の文字を、30分類のどれかに寄せる。
// 完全一致→部分一致の順。どれにも当てはまらなければ null。
export function canonicalOrder(s: string | undefined | null): string | null {
  if (!s) return null
  const q = s.trim()
  if (!q) return null
  if (ORDER_SET.has(q)) return q
  const hit = INSECT_ORDERS.find((o) => q.includes(o) || o.includes(q))
  return hit ?? null
}

// 本の順番でのインデックス（並べ替えのタイブレークに使う）
export function orderIndex(name: string): number {
  const i = INSECT_ORDERS.indexOf(name)
  return i < 0 ? INSECT_ORDERS.length : i
}
