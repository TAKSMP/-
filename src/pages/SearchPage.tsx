import { useMemo, useState } from 'react'
import type { BugSpecies, CaughtBug } from '../types'
import { ALL_HABITATS, BUG_SPECIES } from '../data/bugs'
import { INSECT_ORDERS } from '../data/orders'
import { StarRating } from '../components/StarRating'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
}

// どんな虫がいるかをしらべる検索ページ。
export function SearchPage({ bugs }: Props) {
  const [q, setQ] = useState('')
  const [orderFilter, setOrderFilter] = useState<string | null>(null)
  const [habitatFilter, setHabitatFilter] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<number | null>(null)
  const [selected, setSelected] = useState<BugSpecies | null>(null)

  const foundIds = useMemo(
    () => new Set(bugs.map((b) => b.speciesId).filter(Boolean)),
    [bugs],
  )

  const results = useMemo(() => {
    const query = q.trim()
    return BUG_SPECIES.filter((sp) => {
      if (query && !sp.name.includes(query) && !sp.order.includes(query))
        return false
      if (orderFilter && sp.order !== orderFilter) return false
      if (habitatFilter && sp.habitat !== habitatFilter) return false
      if (rarityFilter && sp.rarity !== rarityFilter) return false
      return true
    })
  }, [q, orderFilter, habitatFilter, rarityFilter])

  function clearFilters() {
    sfx.tap()
    setQ('')
    setOrderFilter(null)
    setHabitatFilter(null)
    setRarityFilter(null)
  }

  const hasFilter =
    q || orderFilter || habitatFilter || rarityFilter !== null

  return (
    <div className="page search">
      <header className="page-head">
        <h1>🔍 むし けんさく</h1>
        <p className="sub">どんな虫がいるか さがしてみよう！</p>
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

      <div className="filter-group">
        <div className="filter-label">🐾 目（もく）</div>
        <div className="chips-row">
          {INSECT_ORDERS.map((o) => (
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

      <div className="filter-group">
        <div className="filter-label">🌳 生息地</div>
        <div className="chips-row">
          {ALL_HABITATS.map((h) => (
            <button
              key={h}
              className={
                'filter-chip' + (habitatFilter === h ? ' active' : '')
              }
              onClick={() => {
                sfx.tap()
                setHabitatFilter((cur) => (cur === h ? null : h))
              }}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-label">⭐ レア度</div>
        <div className="chips-row">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className={
                'filter-chip' + (rarityFilter === r ? ' active' : '')
              }
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
          <p>なまえ・目（もく）・生息地・レア度で さがしてみよう！</p>
        </div>
      )}

      {hasFilter && (
      <div className="bug-grid">
        {results.map((sp) => {
          const found = foundIds.has(sp.id)
          return (
            <button
              key={sp.id}
              className={'bugcard species' + (found ? ' found' : '')}
              onClick={() => {
                sfx.tap()
                setSelected(sp)
              }}
            >
              <div
                className="bugcard-photo species-emoji"
                style={{ background: sp.color + '33' }}
              >
                <span>{sp.emoji}</span>
                {found && <span className="found-badge">✅</span>}
              </div>
              <div className="bugcard-body">
                <div className="bugcard-name">{sp.name}</div>
                <div className="bugcard-meta">
                  <span className="chip">{sp.order}</span>
                  <span className="chip chip-soft">{sp.habitat}</span>
                </div>
                <StarRating value={sp.rarity} size={14} />
              </div>
            </button>
          )
        })}
        {results.length === 0 && (
          <div className="empty-state small">
            <div className="empty-emoji">🤔</div>
            <p>その虫はみつからなかったよ。</p>
          </div>
        )}
      </div>
      )}

      {/* しゅるいの詳細 */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="とじる"
            >
              ✕
            </button>
            <div
              className="species-hero"
              style={{ background: selected.color + '22' }}
            >
              <span className="species-hero-emoji">{selected.emoji}</span>
            </div>
            <h2 className="modal-name">{selected.name}</h2>
            <div className="modal-stars">
              <StarRating value={selected.rarity} size={26} />
            </div>
            <dl className="modal-fields">
              <div>
                <dt>目（もく）</dt>
                <dd>{selected.order}</dd>
              </div>
              <div>
                <dt>生息地</dt>
                <dd>{selected.habitat}</dd>
              </div>
              <div>
                <dt>ずかん</dt>
                <dd>
                  {foundIds.has(selected.id)
                    ? '✅ もう見つけたよ！'
                    : '❔ まだ見つけていないよ'}
                </dd>
              </div>
            </dl>
            <div className="modal-fact">
              <span className="fact-emoji">{selected.emoji}</span>
              <p>{selected.fact}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
