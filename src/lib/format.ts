// 「◯ひき」の数え方は、数によって「ぴき／ひき／びき」と音が変わります。
// 1ぴき・2ひき・3びき・6ぴき・8ぴき・10ぴき… のように、
// 子どもが読んでも自然になるように、かなをきりかえます。
export function hikiKana(n: number): string {
  const last = Math.abs(n) % 10
  if (last === 3) return 'びき'
  if (last === 1 || last === 6 || last === 8 || last === 0) return 'ぴき'
  return 'ひき'
}

// 数＋「ひき」をまとめてかえす（例: 1 → "1ぴき"）
export function countHiki(n: number): string {
  return `${n}${hikiKana(n)}`
}

// ミリ秒 →「YYYY-MM-DD」（<input type=date> 用）
export function msToDateInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// きょうの日付（YYYY-MM-DD）
export function todayDateInput(): string {
  return msToDateInput(Date.now())
}

// 「YYYY-MM-DD」→ ミリ秒（そのひのお昼にして時差のズレをふせぐ）
export function dateInputToMs(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime()
}
