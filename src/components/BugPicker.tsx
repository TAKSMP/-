// =============================================================
//  虫を えらぶ「もくじ」（ずかんと おなじ ならべかた）
// -------------------------------------------------------------
//  目（もく）ごとに まとめて、ひらくと その中の虫が でる。
//  カードの なかみは つかう がめんごとに ちがうので renderCard で わたす。
// =============================================================
import { useState, type ReactNode } from 'react'
import type { CaughtBug } from '../types'
import { INSECT_ORDERS, canonicalOrder, orderEmoji } from '../data/orders'
import { sfx } from '../lib/sound'

const OTHER = '__other__'

export function BugPicker({
  bugs,
  onPick,
  renderCard,
}: {
  bugs: CaughtBug[]
  onPick: (b: CaughtBug) => void
  renderCard: (b: CaughtBug) => ReactNode
}) {
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  const counts = new Map<string, number>()
  for (const o of INSECT_ORDERS) counts.set(o, 0)
  let otherCount = 0
  for (const b of bugs) {
    const key = canonicalOrder(b.order)
    if (key && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    else otherCount++
  }
  const mokuji = INSECT_ORDERS.map((name, idx) => ({
    name,
    idx,
    count: counts.get(name) ?? 0,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.idx - b.idx)

  if (openOrder) {
    const title = openOrder === OTHER ? 'その他' : openOrder
    const list = bugs.filter((b) => {
      const key = canonicalOrder(b.order)
      return openOrder === OTHER ? !key : key === openOrder
    })
    return (
      <>
        <button
          className="back-btn"
          onClick={() => {
            sfx.tap()
            setOpenOrder(null)
          }}
        >
          ← もくじにもどる
        </button>
        <p className="picker-order-title">
          {openOrder === OTHER ? '🔎' : orderEmoji(openOrder)} {title}
        </p>
        <div className="statcard-grid">
          {list.map((b) => (
            <div
              key={b.id}
              className="statcard-btn"
              role="button"
              tabIndex={0}
              onClick={() => onPick(b)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(b)
                }
              }}
            >
              {renderCard(b)}
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="mokuji-list">
      {mokuji.map((it) => (
        <button
          key={it.name}
          className="mokuji-item"
          onClick={() => {
            sfx.tap()
            setOpenOrder(it.name)
          }}
        >
          <span className="mokuji-emoji">{orderEmoji(it.name)}</span>
          <span className="mokuji-name">{it.name}</span>
          <span className="mokuji-count">{it.count}</span>
        </button>
      ))}
      {otherCount > 0 && (
        <button
          className="mokuji-item"
          onClick={() => {
            sfx.tap()
            setOpenOrder(OTHER)
          }}
        >
          <span className="mokuji-emoji">🔎</span>
          <span className="mokuji-name">その他</span>
          <span className="mokuji-count">{otherCount}</span>
        </button>
      )}
    </div>
  )
}
