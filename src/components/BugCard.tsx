import type { CaughtBug } from '../types'
import { StarRating } from './StarRating'

interface Props {
  bug: CaughtBug
  onClick?: () => void
}

// 図鑑や検索でつかう虫のカード。
export function BugCard({ bug, onClick }: Props) {
  return (
    <button className="bugcard" onClick={onClick} type="button">
      <div className="bugcard-photo">
        <img src={bug.photo} alt={bug.name} loading="lazy" />
        {bug.rarity >= 5 && <span className="bugcard-shine">✨</span>}
      </div>
      <div className="bugcard-body">
        <div className="bugcard-name">{bug.name}</div>
        <div className="bugcard-meta">
          <span className="chip">{bug.order}</span>
          <span className="chip chip-soft">{bug.habitat}</span>
        </div>
        <StarRating value={bug.rarity} size={16} />
      </div>
    </button>
  )
}
