// =============================================================
//  虫ポイント と もちもの（ちょうむしショップ）
// -------------------------------------------------------------
//  ・昆虫検定で せいかいすると たまる（初級 1もん 1P、中級 1もん 3P）
//  ・10もん ぜんぶ せいかいすると ルーレットで ばいに なる
//  ・ショップで「ふしぎなアメ」「まきもの」などと こうかんする
//  ・あとで つかう もの（ちょうちょちゃんあめ・トンボあめ）は もちものに のこる
//  この たんまつの localStorage に ほぞん。引き継ぎバックアップにも はいる（storage.ts）。
// =============================================================
import { useEffect, useState } from 'react'

export const POINTS_KEY = 'chomushi.points.v1'

// あとで つかう もちもの（つるせMAPで すきな ときに つかう）
export type ItemId = 'butterflyCandy' | 'dragonflyCandy'

export interface PointsSave {
  points: number
  items: Record<ItemId, number>
}

const empty = (): PointsSave => ({ points: 0, items: { butterflyCandy: 0, dragonflyCandy: 0 } })

function toCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

export function normalizePoints(raw: unknown): PointsSave {
  const base = empty()
  if (!raw || typeof raw !== 'object') return base
  const d = raw as Partial<PointsSave>
  const items = (d.items ?? {}) as Partial<Record<ItemId, unknown>>
  return {
    points: toCount(d.points),
    items: {
      butterflyCandy: toCount(items.butterflyCandy),
      dragonflyCandy: toCount(items.dragonflyCandy),
    },
  }
}

export function loadPoints(): PointsSave {
  try {
    const raw = localStorage.getItem(POINTS_KEY)
    return raw ? normalizePoints(JSON.parse(raw)) : empty()
  } catch {
    return empty()
  }
}

// かわったら アプリじゅうに しらせる（右上の P や ショップの ひょうじを こうしん）
const EVENT = 'chomushi-points'

function savePoints(s: PointsSave): void {
  try {
    localStorage.setItem(POINTS_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('虫ポイントの ほぞんに しっぱい', e)
  }
  window.dispatchEvent(new Event(EVENT))
}

export function addPoints(n: number): PointsSave {
  const s = loadPoints()
  const next = { ...s, points: s.points + Math.max(0, Math.round(n)) }
  savePoints(next)
  return next
}

// ポイントを つかう。たりなければ false（なにも かわらない）
export function spendPoints(n: number): boolean {
  const s = loadPoints()
  if (s.points < n) return false
  savePoints({ ...s, points: s.points - n })
  return true
}

// ポイントで もちものを かう
export function buyItem(id: ItemId, price: number): boolean {
  const s = loadPoints()
  if (s.points < price) return false
  savePoints({ ...s, points: s.points - price, items: { ...s.items, [id]: s.items[id] + 1 } })
  return true
}

// もちものを 1つ つかう。もっていなければ false
export function consumeItem(id: ItemId): boolean {
  const s = loadPoints()
  if (s.items[id] <= 0) return false
  savePoints({ ...s, items: { ...s.items, [id]: s.items[id] - 1 } })
  return true
}

// バックアップを もどした ときなどに よぶ
export function notifyPointsChanged(): void {
  window.dispatchEvent(new Event(EVENT))
}

// いまの ポイントと もちもの（かわると さいびょうが）
export function usePoints(): PointsSave {
  const [s, setS] = useState<PointsSave>(() => loadPoints())
  useEffect(() => {
    const on = () => setS(loadPoints())
    window.addEventListener(EVENT, on)
    // べつの タブで かわった ときも
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return s
}
