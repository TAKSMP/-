import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { BugCard } from '../components/BugCard'
import { BugDetailModal } from '../components/BugDetailModal'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onDelete: (id: string) => void
  onGoCapture: () => void
}

// 並べ替えの種類
type SortKey = 'date' | 'name' | 'order' | 'habitat'

const SORTS: { key: SortKey; label: string; emoji: string }[] = [
  { key: 'date', label: 'とった日', emoji: '📅' },
  { key: 'name', label: 'なまえ', emoji: '🔤' },
  { key: 'order', label: '目（もく）', emoji: '🐾' },
  { key: 'habitat', label: '生息地', emoji: '🌳' },
]

// あつめた虫がならぶ図鑑ページ。記録した虫をどんどんためていく。
export function ZukanPage({ bugs, onDelete, onGoCapture }: Props) {
  const [selected, setSelected] = useState<CaughtBug | null>(null)
  const [sort, setSort] = useState<SortKey>('date')

  // 並べ替え／グループ分けした結果をつくる。
  // date・name は1つのまとまり、order・habitat は見出しつきのグループに分ける。
  const groups = useMemo(() => {
    const byDateNewest = (a: CaughtBug, b: CaughtBug) => b.caughtAt - a.caughtAt

    if (sort === 'date') {
      return [{ title: '', items: [...bugs].sort(byDateNewest) }]
    }
    if (sort === 'name') {
      const items = [...bugs].sort((a, b) =>
        a.name.localeCompare(b.name, 'ja'),
      )
      return [{ title: '', items }]
    }
    // order / habitat: グループごとにまとめる
    const keyOf = (b: CaughtBug) => (sort === 'order' ? b.order : b.habitat)
    const map = new Map<string, CaughtBug[]>()
    for (const bug of bugs) {
      const k = keyOf(bug) || 'ふめい'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(bug)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([title, items]) => ({
        title,
        items: items.sort(byDateNewest),
      }))
  }, [bugs, sort])

  return (
    <div className="page zukan">
      <header className="page-head">
        <h1>📖 むし図鑑</h1>
        <p className="sub">きみが みつけた虫の きろく</p>
      </header>

      {bugs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🐛</div>
          <p>まだ虫がいないよ。</p>
          <p>写真をよみこんで、さいしょの虫をみつけよう！</p>
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
      ) : (
        <>
          <div className="zukan-count">🎒 {bugs.length}ひき あつめたよ</div>

          {/* 並べ替えボタン */}
          <div className="sort-bar">
            <span className="sort-label">ならびかえ</span>
            <div className="chips-row">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  className={'sort-chip' + (sort === s.key ? ' active' : '')}
                  onClick={() => {
                    sfx.tap()
                    setSort(s.key)
                  }}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 虫のならび（グループごと） */}
          {groups.map((g, i) => (
            <div key={g.title || i} className="zukan-group">
              {g.title && <h3 className="group-title">{g.title}</h3>}
              <div className="bug-grid">
                {g.items.map((bug) => (
                  <BugCard
                    key={bug.id}
                    bug={bug}
                    onClick={() => {
                      sfx.tap()
                      setSelected(bug)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <BugDetailModal
        bug={selected}
        onClose={() => setSelected(null)}
        onDelete={onDelete}
      />
    </div>
  )
}
