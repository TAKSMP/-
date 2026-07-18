import { useState } from 'react'
import type { CaughtBug } from '../types'
import type { BugPatch } from '../lib/storage'
import { findSpeciesByName, getSpeciesById } from '../data/bugs'
import { INSECT_ORDERS } from '../data/orders'
import { mainPhoto } from '../lib/storage'
import { describeBug, suggestHabitat } from '../lib/ai'
import { StarRating } from './StarRating'
import { sfx } from '../lib/sound'

interface Props {
  bug: CaughtBug | null
  onClose: () => void
  onDelete?: (id: string) => void
  onSetMain?: (bugId: string, captureId: string) => void
  onUpdate?: (bugId: string, patch: BugPatch) => void
  pastPlaces?: string[]
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ミリ秒 →「YYYY-MM-DD」（<input type=date> 用）
function msToDateInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// 「YYYY-MM-DD」→ ミリ秒（そのひのお昼にして時差のズレをふせぐ）
function dateInputToMs(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime()
}

export function BugDetailModal({
  bug,
  onClose,
  onDelete,
  onSetMain,
  onUpdate,
  pastPlaces = [],
}: Props) {
  const [editing, setEditing] = useState(false)
  // へんしゅう中の各項目
  const [name, setName] = useState('')
  const [order, setOrder] = useState('')
  const [rarity, setRarity] = useState(3)
  const [habitat, setHabitat] = useState('')
  const [fact, setFact] = useState('')
  const [place, setPlace] = useState('')
  const [foundDate, setFoundDate] = useState('') // YYYY-MM-DD
  const [describing, setDescribing] = useState(false)
  const [describeMiss, setDescribeMiss] = useState(false)
  const [suggestingHab, setSuggestingHab] = useState(false)
  const [habMiss, setHabMiss] = useState(false)

  if (!bug) return null

  const species =
    findSpeciesByName(bug.name) ??
    (bug.speciesId ? getSpeciesById(bug.speciesId) : undefined)
  const factText = bug.fact ?? species?.fact

  const captures = [...bug.captures].sort((a, b) => b.caughtAt - a.caughtAt)
  const mainCapture =
    bug.captures.find((c) => c.id === bug.mainCaptureId) ?? bug.captures[0]
  const firstDate = bug.captures.reduce(
    (m, c) => Math.min(m, c.caughtAt),
    Infinity,
  )

  function startEdit() {
    if (!bug) return
    sfx.tap()
    setName(bug.name)
    setOrder(bug.order)
    setRarity(bug.rarity)
    setHabitat(bug.habitat)
    setFact(bug.fact ?? '')
    setPlace(mainCapture?.place ?? '')
    setFoundDate(msToDateInput(firstDate))
    setDescribeMiss(false)
    setHabMiss(false)
    setEditing(true)
  }

  function saveEdit() {
    if (!bug || !onUpdate) return
    const firstCaughtAt = dateInputToMs(foundDate)
    onUpdate(bug.id, {
      name,
      order,
      rarity,
      habitat,
      fact,
      mainPlace: place,
      ...(firstCaughtAt !== null ? { firstCaughtAt } : {}),
    })
    sfx.discover()
    setEditing(false)
  }

  async function handleDescribe() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    setDescribeMiss(false)
    setDescribing(true)
    const text = await describeBug(name)
    setDescribing(false)
    if (text) {
      setFact(text)
      sfx.discover()
    } else {
      setDescribeMiss(true)
      sfx.error()
    }
  }

  async function handleSuggestHabitat() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    setHabMiss(false)
    setSuggestingHab(true)
    const h = await suggestHabitat(name)
    setSuggestingHab(false)
    if (h) {
      setHabitat(h)
      sfx.discover()
    } else {
      setHabMiss(true)
      sfx.error()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>

        <div className="modal-photo">
          <img src={mainPhoto(bug)} alt={bug.name} />
        </div>

        {/* ============ へんしゅうモード ============ */}
        {editing ? (
          <>
            <dl className="fields modal-edit">
              <div className="field">
                <dt>なまえ</dt>
                <dd>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </dd>
              </div>
              <div className="field">
                <dt>目（もく）</dt>
                <dd>
                  <select
                    className="order-select"
                    value={INSECT_ORDERS.includes(order) ? order : ''}
                    onChange={(e) => setOrder(e.target.value)}
                  >
                    <option value="" disabled>
                      えらんでね
                    </option>
                    {INSECT_ORDERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="field">
                <dt>レア度</dt>
                <dd>
                  <StarRating
                    value={rarity}
                    editable
                    onChange={setRarity}
                    size={24}
                  />
                </dd>
              </div>
              <div className="field">
                <dt>生息地</dt>
                <dd>
                  <div className="field-edit">
                    <input
                      list="edit-habitats"
                      value={habitat}
                      onChange={(e) => setHabitat(e.target.value)}
                    />
                    <button
                      type="button"
                      className="lookup-btn"
                      onClick={handleSuggestHabitat}
                      disabled={suggestingHab}
                    >
                      {suggestingHab ? (
                        <>
                          <span className="spinner">🔎</span> しらべ中…
                        </>
                      ) : (
                        <>🤖 AIがかく</>
                      )}
                    </button>
                    {habMiss && (
                      <span className="lookup-miss">
                        わからなかった…なまえを見なおしてね
                      </span>
                    )}
                  </div>
                </dd>
              </div>
              <div className="field">
                <dt>みつけたばしょ</dt>
                <dd>
                  <input
                    list="edit-places"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="れい: こうえん"
                  />
                  <datalist id="edit-places">
                    {pastPlaces.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </dd>
              </div>
              <div className="field">
                <dt>はじめて みつけた日</dt>
                <dd>
                  <input
                    type="date"
                    className="date-input"
                    value={foundDate}
                    onChange={(e) => setFoundDate(e.target.value)}
                  />
                </dd>
              </div>
            </dl>

            <div className="desc-field">
              <div className="desc-head">
                <label htmlFor="edit-desc">📝 せつめい</label>
                <button
                  type="button"
                  className="desc-btn"
                  onClick={handleDescribe}
                  disabled={describing}
                >
                  {describing ? (
                    <>
                      <span className="spinner">✍️</span> かいてます…
                    </>
                  ) : (
                    <>🤖 なまえに あわせてAIがかく</>
                  )}
                </button>
              </div>
              <textarea
                id="edit-desc"
                className="desc-textarea"
                value={fact}
                onChange={(e) => setFact(e.target.value)}
                rows={3}
                placeholder="この虫の せつめい"
              />
              {describeMiss && (
                <p className="desc-miss">
                  うまく かけなかった…（本物AIモードか、図鑑にある虫だと かけるよ）
                </p>
              )}
            </div>

            <div className="modal-edit-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  sfx.tap()
                  setEditing(false)
                }}
              >
                やめる
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                ✅ なおす
              </button>
            </div>
          </>
        ) : (
          /* ============ ひょうじモード ============ */
          <>
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
            </dl>

            {factText && (
              <div className="modal-fact">
                <p>{factText}</p>
              </div>
            )}

            {onUpdate && (
              <button className="btn btn-ghost modal-edit-btn" onClick={startEdit}>
                ✏️ ないようを なおす
              </button>
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
          </>
        )}

        <datalist id="edit-habitats">
          <option value="くさむら" />
          <option value="ぞうきばやし" />
          <option value="かわ" />
          <option value="き" />
          <option value="はなばたけ" />
        </datalist>
      </div>
    </div>
  )
}
