import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { BugCard } from '../components/BugCard'
import { BugDetailModal } from '../components/BugDetailModal'
import { INSECT_ORDERS, canonicalOrder, orderEmoji } from '../data/orders'
import { latestCaughtAt } from '../lib/storage'
import type { BugPatch } from '../lib/storage'
import { countHiki } from '../lib/format'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onDelete: (id: string) => void
  onSetMain: (bugId: string, captureId: string) => void
  onUpdate: (bugId: string, patch: BugPatch) => void
  pastPlaces: string[]
  onGoCapture: () => void
}

const OTHER = '__other__' // 30分類に入らない虫のまとめ

// あつめた虫を、目（もく）の「もくじ」からたどる図鑑ページ。
export function ZukanPage({
  bugs,
  onDelete,
  onSetMain,
  onUpdate,
  pastPlaces,
  onGoCapture,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId
    ? (bugs.find((b) => b.id === selectedId) ?? null)
    : null
  // ひらいている目（null=もくじ画面）
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  // 目ごとの発見数（30分類＋その他）
  const { counts, otherCount } = useMemo(() => {
    const c = new Map<string, number>()
    for (const o of INSECT_ORDERS) c.set(o, 0)
    let other = 0
    for (const bug of bugs) {
      const key = canonicalOrder(bug.order)
      if (key && c.has(key)) c.set(key, (c.get(key) ?? 0) + 1)
      else other++
    }
    return { counts: c, otherCount: other }
  }, [bugs])

  // もくじの並び：発見数が多い順、おなじなら本の順番。
  const mokuji = useMemo(() => {
    return INSECT_ORDERS.map((name, idx) => ({
      name,
      idx,
      count: counts.get(name) ?? 0,
    })).sort((a, b) => b.count - a.count || a.idx - b.idx)
  }, [counts])

  // ひらいている目の虫（あたらしい順）
  const detailBugs = useMemo(() => {
    if (!openOrder) return []
    const list = bugs.filter((b) => {
      const key = canonicalOrder(b.order)
      return openOrder === OTHER ? !key : key === openOrder
    })
    return list.sort((a, b) => latestCaughtAt(b) - latestCaughtAt(a))
  }, [bugs, openOrder])

  function open(name: string) {
    sfx.tap()
    setOpenOrder(name)
  }

  // --- 目の中身（虫のいちらん） ---
  if (openOrder) {
    const title = openOrder === OTHER ? 'その他' : openOrder
    const emoji = openOrder === OTHER ? '🔎' : orderEmoji(openOrder)
    return (
      <div className="page zukan">
        <button
          className="back-btn"
          onClick={() => {
            sfx.tap()
            setOpenOrder(null)
          }}
        >
          ← もくじにもどる
        </button>
        <header className="page-head">
          <h1>
            {emoji} {title}
          </h1>
          <p className="sub">{countHiki(detailBugs.length)} みつけたよ</p>
        </header>

        <div className="bug-grid">
          {detailBugs.map((bug) => (
            <BugCard
              key={bug.id}
              bug={bug}
              onClick={() => {
                sfx.tap()
                setSelectedId(bug.id)
              }}
            />
          ))}
        </div>

        <BugDetailModal
          bug={selected}
          onClose={() => setSelectedId(null)}
          onDelete={onDelete}
          onSetMain={onSetMain}
          onUpdate={onUpdate}
          pastPlaces={pastPlaces}
        />
      </div>
    )
  }

  // --- もくじ画面 ---
  return (
    <div className="page zukan">
      <header className="page-head">
        <h1>📖 むし図鑑</h1>
        <p className="sub">きみが みつけた虫の きろく</p>
      </header>

      <div className="zukan-count">🎒 {countHiki(bugs.length)} あつめたよ</div>

      {bugs.length === 0 && (
        <div className="mokuji-empty">
          <p>まだ虫がいないよ。写真をよみこんで さいしょの虫を みつけよう！</p>
          <button
            className="btn btn-big"
            onClick={() => {
              sfx.tap()
              onGoCapture()
            }}
          >
            むしをしらべる 🔎
          </button>
        </div>
      )}

      <h3 className="mokuji-title">もくじ</h3>
      <div className="mokuji-list">
        {mokuji.map((it) => (
          <button
            key={it.name}
            className={'mokuji-item' + (it.count === 0 ? ' empty' : '')}
            disabled={it.count === 0}
            onClick={() => open(it.name)}
          >
            <span className="mokuji-emoji">{orderEmoji(it.name)}</span>
            <span className="mokuji-name">{it.name}</span>
            <span className="mokuji-count">{it.count}</span>
          </button>
        ))}
        {otherCount > 0 && (
          <button className="mokuji-item" onClick={() => open(OTHER)}>
            <span className="mokuji-emoji">🔎</span>
            <span className="mokuji-name">その他</span>
            <span className="mokuji-count">{otherCount}</span>
          </button>
        )}
      </div>
    </div>
  )
}
