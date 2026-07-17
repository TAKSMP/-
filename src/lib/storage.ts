import type { CaughtBug } from '../types'

// 図鑑（つかまえた虫の記録）はブラウザの localStorage に保存します。
// これでページをとじても、あつめた虫がきえません。
const STORAGE_KEY = 'chomushi.zukan.v1'

export function loadZukan(): CaughtBug[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data as CaughtBug[]
  } catch {
    return []
  }
}

export function saveZukan(bugs: CaughtBug[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bugs))
  } catch (e) {
    // 写真がおおくて容量オーバーになることがある。そのときはそっと知らせる。
    console.warn('図鑑の保存に失敗しました', e)
    alert('図鑑がいっぱいかもしれません。ふるい虫をへらしてみてね。')
  }
}

export function addToZukan(bug: CaughtBug): CaughtBug[] {
  const current = loadZukan()
  const next = [bug, ...current]
  saveZukan(next)
  return next
}

export function removeFromZukan(id: string): CaughtBug[] {
  const next = loadZukan().filter((b) => b.id !== id)
  saveZukan(next)
  return next
}

export function clearZukan(): CaughtBug[] {
  saveZukan([])
  return []
}
