import type { CaughtBug } from '../types'
import { findSpeciesByName, getSpeciesById } from '../data/bugs'
import { mainPhoto } from '../lib/storage'
import { StarRating } from './StarRating'
import { sfx } from '../lib/sound'

interface Props {
  bug: CaughtBug | null
  onClose: () => void
  onDelete?: (id: string) => void
  onSetMain?: (bugId: string, captureId: string) => void
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// 虫カードをタップしたときにひらく、大きな詳細画面。
export function BugDetailModal({ bug, onClose, onDelete, onSetMain }: Props) {
  if (!bug) return null
  // 表示している名前をもとに説明文を引く（訂正後の名前を優先）。
  const species =
    findSpeciesByName(bug.name) ??
    (bug.speciesId ? getSpeciesById(bug.speciesId) : undefined)
  const factText = bug.fact ?? species?.fact
  const factEmoji = species?.emoji ?? '🔎'

  // 撮影履歴（あたらしい順）
  const captures = [...bug.captures].sort((a, b) => b.caughtAt - a.caughtAt)
  const mainCapture =
    bug.captures.find((c) => c.id === bug.mainCaptureId) ?? bug.captures[0]
  const firstDate = bug.captures.reduce(
    (m, c) => Math.min(m, c.caughtAt),
    Infinity,
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>

        <div className="modal-photo">
          <img src={mainPhoto(bug)} alt={bug.name} />
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
          {mainCapture?.place && (
            <div>
              <dt>みつけたばしょ</dt>
              <dd>📍 {mainCapture.place}</dd>
            </div>
          )}
          <div>
            <dt>はじめて みつけた日</dt>
            <dd>{formatDate(firstDate)}</dd>
          </div>
          {bug.corrected && (
            <div>
              <dt>メモ</dt>
              <dd>✏️ じぶんでなおしたよ</dd>
            </div>
          )}
        </dl>

        {factText && (
          <div className="modal-fact">
            <span className="fact-emoji">{factEmoji}</span>
            <p>{factText}</p>
          </div>
        )}

        {/* とった写真の履歴（メイン画像もえらべる） */}
        <div className="history">
          <div className="history-title">
            📸 とった しゃしん（{captures.length}まい）
          </div>
          <p className="history-hint">
            しゃしんを タップすると、メイン画像に できるよ。
          </p>
          <div className="history-grid">
            {captures.map((c) => {
              const isMain = c.id === bug.mainCaptureId
              return (
                <button
                  key={c.id}
                  className={'history-item' + (isMain ? ' main' : '')}
                  onClick={() => {
                    if (!isMain && onSetMain) {
                      sfx.tap()
                      onSetMain(bug.id, c.id)
                    }
                  }}
                >
                  <img src={c.photo} alt={bug.name} loading="lazy" />
                  <span className="history-date">
                    {formatDate(c.caughtAt)}
                    {c.place ? ` ・${c.place}` : ''}
                  </span>
                  {isMain && <span className="history-badge">メイン</span>}
                </button>
              )
            })}
          </div>
        </div>

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
