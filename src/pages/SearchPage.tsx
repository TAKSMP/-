import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { INSECT_ORDERS, canonicalOrder } from '../data/orders'
import { collectPlaces } from '../lib/storage'
import { BugCard } from '../components/BugCard'
import { BugDetailModal } from '../components/BugDetailModal'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onDelete: (id: string) => void
  onSetMain: (bugId: string, captureId: string) => void
}

// あつめた虫を、なまえ・目・みつけたばしょ・レア度でさがすページ。
export function SearchPage({ bugs, onDelete, onSetMain }: Props) {
  const [q, setQ] = useState('')
  const [orderFilter, setOrderFilter] = useState<string | null>(null)
  const [placeFilter, setPlaceFilter] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId
    ? (bugs.find((b) => b.id === selectedId) ?? null)
    : null

  // みつけた場所のタグ（記録がふえるたびに ここも ふえる）
  const places = useMemo(() => collectPlaces(bugs), [bugs])
  // 目のタグは、あつめた虫にある目だけを本の順にならべる
  const orders = useMemo(() => {
    const present = new Set(
      bugs.map((b) => canonicalOrder(b.order)).filter(Boolean) as string[],
    )
    return INSECT_ORDERS.filter((o) => present.has(o))
  }, [bugs])

  const results = useMemo(() => {
    const query = q.trim()
    return bugs.filter((b) => {
      if (query && !b.name.includes(query)) return false
      if (orderFilter && canonicalOrder(b.order) !== orderFilter) return false
      if (placeFilter && !b.captures.some((c) => c.place === placeFilter))
        return false
      if (rarityFilter && b.rarity !== rarityFilter) return false
      return true
    })
  }, [bugs, q, orderFilter, placeFilter, rarityFilter])

  function clearFilters() {
    sfx.tap()
    setQ('')
    setOrderFilter(null)
    setPlaceFilter(null)
    setRarityFilter(null)
  }

  const hasFilter = Boolean(
    q || orderFilter || placeFilter || rarityFilter !== null,
  )

  return (
    <div className="page search">
      <header className="page-head">
        <h1>🔍 むし けんさく</h1>
        <p className="sub">あつめた虫を さがしてみよう！</p>
      </header>

      <div className="search-box">
        <span className="search-icon">🔎</span>
        <input
          placeholder="虫のなまえでさがす（れい: カブト）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button className="search-clear" onClick={() => setQ('')}>
            ✕
          </button>
        )}
      </div>

      {/* みつけたばしょ タグ */}
      <div className="filter-group">
        <div className="filter-label">📍 みつけたばしょ</div>
        {places.length === 0 ? (
          <p className="filter-none">
            まだ ばしょが ないよ。「しらべる」で みつけたばしょを 入れてね。
          </p>
        ) : (
          <div className="chips-row">
            {places.map((p) => (
              <button
                key={p}
                className={'filter-chip' + (placeFilter === p ? ' active' : '')}
                onClick={() => {
                  sfx.tap()
                  setPlaceFilter((cur) => (cur === p ? null : p))
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 目 タグ（あつめた虫にある目だけ） */}
      {orders.length > 0 && (
        <div className="filter-group">
          <div className="filter-label">🐾 目（もく）</div>
          <div className="chips-row">
            {orders.map((o) => (
              <button
                key={o}
                className={'filter-chip' + (orderFilter === o ? ' active' : '')}
                onClick={() => {
                  sfx.tap()
                  setOrderFilter((cur) => (cur === o ? null : o))
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-group">
        <div className="filter-label">⭐ レア度</div>
        <div className="chips-row">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className={'filter-chip' + (rarityFilter === r ? ' active' : '')}
              onClick={() => {
                sfx.tap()
                setRarityFilter((cur) => (cur === r ? null : r))
              }}
            >
              {'⭐'.repeat(r)}
            </button>
          ))}
        </div>
      </div>

      {hasFilter && (
        <button className="btn btn-ghost btn-clear" onClick={clearFilters}>
          じょうけんをクリア ✕
        </button>
      )}

      {!hasFilter && (
        <div className="search-hint">
          <div className="empty-emoji">🔍</div>
          <p>なまえ・みつけたばしょ・目・レア度で さがしてみよう！</p>
        </div>
      )}

      {hasFilter && (
        <div className="bug-grid">
          {results.map((bug) => (
            <BugCard
              key={bug.id}
              bug={bug}
              onClick={() => {
                sfx.tap()
                setSelectedId(bug.id)
              }}
            />
          ))}
          {results.length === 0 && (
            <div className="empty-state small">
              <div className="empty-emoji">🤔</div>
              <p>その虫はみつからなかったよ。</p>
            </div>
          )}
        </div>
      )}

      <BugDetailModal
        bug={selected}
        onClose={() => setSelectedId(null)}
        onDelete={onDelete}
        onSetMain={onSetMain}
      />
    </div>
  )
}
