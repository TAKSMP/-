import type { CaughtBug } from '../types'
import { getSpeciesById } from '../data/bugs'
import { StarRating } from './StarRating'
import { sfx } from '../lib/sound'

interface Props {
  bug: CaughtBug | null
  onClose: () => void
  onDelete?: (id: string) => void
}

// 虫カードをタップしたときにひらく、大きな詳細画面。
export function BugDetailModal({ bug, onClose, onDelete }: Props) {
  if (!bug) return null
  const species = bug.speciesId ? getSpeciesById(bug.speciesId) : undefined
  const date = new Date(bug.caughtAt)
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>

        <div className="modal-photo">
          <img src={bug.photo} alt={bug.name} />
        </div>

        <h2 className="modal-name">
          {bug.name}
          {bug.rarity >= 5 && ' ✨'}
        </h2>

        <div className="modal-stars">
          <StarRating value={bug.rarity} size={26} />
        </div>

        <dl className="modal-fields">
          <div>
            <dt>目（もく）</dt>
            <dd>{bug.order}</dd>
          </div>
          <div>
            <dt>生息地</dt>
            <dd>{bug.habitat}</dd>
          </div>
          <div>
            <dt>みつけた日</dt>
            <dd>{dateStr}</dd>
          </div>
          {bug.corrected && (
            <div>
              <dt>メモ</dt>
              <dd>✏️ じぶんでなおしたよ</dd>
            </div>
          )}
        </dl>

        {species && (
          <div className="modal-fact">
            <span className="fact-emoji">{species.emoji}</span>
            <p>{species.fact}</p>
          </div>
        )}

        {onDelete && (
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`「${bug.name}」を図鑑からけしてもいい？`)) {
                sfx.tap()
                onDelete(bug.id)
                onClose()
              }
            }}
          >
            🗑️ 図鑑からけす
          </button>
        )}
      </div>
    </div>
  )
}
