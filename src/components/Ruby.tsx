// =============================================================
//  ふりがな つきの ぶんしょうを かく
// -------------------------------------------------------------
//  「{昆虫|こんちゅう}の あし」のように {漢字|よみ} で かいた ところを <ruby> に する。
//  （昆虫検定の データ src/data/kentei.ts で つかっている かきかた）
// =============================================================
import { Fragment } from 'react'

const RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g

export function Ruby({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(RUBY_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(<Fragment key={key++}>{text.slice(last, at)}</Fragment>)
    out.push(
      <ruby key={key++}>
        {m[1]}
        <rp>（</rp>
        <rt>{m[2]}</rt>
        <rp>）</rp>
      </ruby>,
    )
    last = at + m[0].length
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  return <>{out}</>
}

// ふりがなを はずした ふつうの もじ（alt や きろく用）
export function plainText(text: string): string {
  return text.replace(RUBY_RE, '$1')
}
