import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { BUG_SPECIES } from '../data/bugs'
import { BugCard } from '../components/BugCard'
import { BugDetailModal } from '../components/BugDetailModal'
import { StarRating } from '../components/StarRating'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onDelete: (id: string) => void
  onGoCapture: () => void
}

// あつめた虫がならぶ図鑑ページ。
export function ZukanPage({ bugs, onDelete, onGoCapture }: Props) {
  const [selected, setSelected] = useState<CaughtBug | null>(null)

  // 図鑑データのうち、なんしゅるい見つけたか
  const foundSpeciesIds = useMemo(
    () => new Set(bugs.map((b) => b.speciesId).filter(Boolean)),
    [bugs],
  )
  const totalSpecies = BUG_SPECIES.length
  const foundCount = foundSpeciesIds.size
  const percent = Math.round((foundCount / totalSpecies) * 100)

  // まだ見つけていない虫（シルエットで見せる）
  const notFound = BUG_SPECIES.filter((sp) => !foundSpeciesIds.has(sp.id))

  return (
    <div className="page zukan">
      <header className="page-head">
        <h1>📖 むし図鑑</h1>
        <p className="sub">きみがみつけた虫のきろく</p>
      </header>

      {/* すすみぐあい */}
      <div className="progress-card">
        <div className="progress-top">
          <span className="progress-big">{foundCount}</span>
          <span className="progress-total">/ {totalSpecies} しゅるい</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="progress-label">
          ずかん たっせいりつ {percent}%
          {percent === 100 && ' 🏆 コンプリート！'}
        </p>
      </div>

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
          <h3 className="section-title">
            🎒 みつけた虫（{bugs.length}ひき）
          </h3>
          <div className="bug-grid">
            {bugs.map((bug) => (
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
        </>
      )}

      {/* まだ見ぬ虫 */}
      {notFound.length > 0 && (
        <>
          <h3 className="section-title">
            ❔ まだ見つけていない虫（{notFound.length}しゅるい）
          </h3>
          <div className="bug-grid">
            {notFound.map((sp) => (
              <div className="bugcard silhouette" key={sp.id}>
                <div className="bugcard-photo">
                  <div className="silhouette-mark">❓</div>
                </div>
                <div className="bugcard-body">
                  <div className="bugcard-name">？？？</div>
                  <div className="bugcard-meta">
                    <span className="chip chip-soft">{sp.habitat}にいるよ</span>
                  </div>
                  <StarRating value={sp.rarity} size={14} />
                </div>
              </div>
            ))}
          </div>
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
