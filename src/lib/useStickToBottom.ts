// ログ（メッセージ）欄を、あたらしい 行が でる たびに いちばん下まで スクロールする。
// ・ログ欄の 中を いちばん下へ
// ・ログ欄が 画面の そとに はみだしていたら、画面も すこし うごかして 見える ように する
import { useEffect, type RefObject } from 'react'

export function stickToBottom(el: HTMLElement | null) {
  if (!el) return
  const go = () => {
    el.scrollTop = el.scrollHeight
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (r.bottom > vh || r.top < 0) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  requestAnimationFrame(go)
  // 行が でてくる アニメーションの あとにも もういちど
  window.setTimeout(go, 300)
}

export function useStickToBottom(ref: RefObject<HTMLElement | null>, dep: unknown) {
  useEffect(() => {
    stickToBottom(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
}
