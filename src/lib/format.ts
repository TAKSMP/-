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
