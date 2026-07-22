import { useEffect, useState } from 'react'
import type { CaughtBug, MoveEffect } from '../types'
import type { BugPatch } from '../lib/storage'
import { findSpeciesByName, getSpeciesById } from '../data/bugs'
import { INSECT_ORDERS } from '../data/orders'
import { mainPhoto } from '../lib/storage'
import {
  askChatGPTText,
  buildDescribePrompt,
  buildHabitatPrompt,
} from '../lib/chatgpt'
import {
  battleStatsOf,
  buildBattlePrompt,
  EFFECTS,
  effectInfo,
  HP_MAX,
  HP_MIN,
  normalizeStats,
  parseBattleAnswer,
  POWER_MAX,
  POWER_MIN,
  STAT_MAX,
  usesForEffect,
} from '../lib/battle'
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
  const [descNote, setDescNote] = useState('')
  const [habNote, setHabNote] = useState('')
  // バトルステータス（へんしゅう中）
  const [bHp, setBHp] = useState(12)
  const [bAtk, setBAtk] = useState(6)
  const [bDef, setBDef] = useState(5)
  const [mvName, setMvName] = useState('')
  const [mvEffect, setMvEffect] = useState<MoveEffect>('powerStrike')
  const [mvPower, setMvPower] = useState(3)
  const [mvDesc, setMvDesc] = useState('')
  const [battleText, setBattleText] = useState('')
  const [battleNote, setBattleNote] = useState('')
  // ひょうじモードで バトルステータスをひらくか
  const [showBattle, setShowBattle] = useState(false)

  // ひらいている虫が変わったら、編集モードはリセットする。
  // （別の虫を開いたのに、前の虫の入力内容が残って上書きされるのを防ぐ）
  const bugId = bug?.id
  useEffect(() => {
    setEditing(false)
    setShowBattle(false)
  }, [bugId])

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
    setDescNote('')
    setHabNote('')
    // バトルステータス（未設定なら レア度からの自動値）を編集欄にいれる
    const bs = battleStatsOf(bug)
    setBHp(bs.hp)
    setBAtk(bs.attack)
    setBDef(bs.defense)
    setMvName(bs.move.name)
    setMvEffect(bs.move.effect)
    setMvPower(bs.move.power)
    setMvDesc(bs.move.desc)
    setBattleText('')
    setBattleNote('')
    setEditing(true)
  }

  // いま編集中の内容を保存する
  function commitEdit() {
    if (!bug || !onUpdate) return
    onUpdate(bug.id, {
      name,
      order,
      rarity,
      habitat,
      fact,
      mainPlace: place,
      battle: normalizeStats({
        hp: bHp,
        attack: bAtk,
        defense: bDef,
        move: {
          name: mvName,
          effect: mvEffect,
          power: mvPower,
          uses: usesForEffect(mvEffect),
          desc: mvDesc,
        },
      }),
    })
  }

  // バトルステータスを AI（ChatGPT）に かんがえてもらう
  async function handleAskBattle() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    await askChatGPTText(buildBattlePrompt(name, fact))
    setBattleNote(
      '📋 しつもんをコピーしたよ。AIチャットに はりつけて、こたえ（コードブロック）を 下に はりつけて「とりこむ」をおしてね。',
    )
  }

  // AIの答えを よみとって、バトルステータス欄に いれる
  function handleImportBattle() {
    const parsed = parseBattleAnswer(battleText)
    if (!parsed) {
      sfx.error()
      setBattleNote('うまく よみとれなかった…決まった形（たいりょく: …）で 答えてもらってね。')
      return
    }
    setBHp(parsed.hp)
    setBAtk(parsed.attack)
    setBDef(parsed.defense)
    setMvName(parsed.move.name)
    setMvEffect(parsed.move.effect)
    setMvPower(parsed.move.power)
    setMvDesc(parsed.move.desc)
    sfx.discover()
    setBattleNote('✅ バトルステータスを とりこんだよ！ないようを たしかめて「なおす」をおしてね。')
  }

  function saveEdit() {
    commitEdit()
    sfx.discover()
    setEditing(false)
  }

  // ✕・そとがわタップで閉じるとき。編集中なら、その内容を保存してから閉じる。
  function handleClose() {
    if (editing) commitEdit()
    onClose()
  }

  async function handleAskDescribe() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    await askChatGPTText(buildDescribePrompt(name))
    setDescNote(
      '📋 しつもんをコピーしたよ。AIチャットに はりつけて、こたえを ここに はりつけてね。',
    )
  }

  async function handleAskHabitat() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    await askChatGPTText(buildHabitatPrompt(name))
    setHabNote(
      '📋 しつもんをコピーしたよ。AIチャットに はりつけて、こたえを 生息地に はりつけてね。',
    )
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} aria-label="とじる">
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
                      onClick={handleAskHabitat}
                    >
                      🤖 AIにきく（コピー）
                    </button>
                    {habNote && <span className="lookup-note">{habNote}</span>}
                  </div>
                </dd>
              </div>
              <div className="field">
                <dt>みつけたばしょ</dt>
                <dd>
                  <input
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="れい: こうえん"
                  />
                  {pastPlaces.length > 0 && (
                    <select
                      className="place-select"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setPlace(e.target.value)
                      }}
                    >
                      <option value="">▼ これまでの ばしょから えらぶ</option>
                      {pastPlaces.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                </dd>
              </div>
            </dl>
            <p className="edit-note">
              ※ 日づけは、下の「とった しゃしん」で 写真ごとに なおせるよ。
            </p>

            <div className="desc-field">
              <div className="desc-head">
                <label htmlFor="edit-desc">📝 せつめい</label>
                <button
                  type="button"
                  className="desc-btn"
                  onClick={handleAskDescribe}
                >
                  🤖 AIにきく（コピー）
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
              {descNote && <p className="desc-note">{descNote}</p>}
            </div>

            {/* ============ バトルステータス（へんしゅう） ============ */}
            <div className="battle-edit">
              <div className="battle-edit-head">
                <span className="battle-edit-title">⚔️ バトルステータス</span>
                <button
                  type="button"
                  className="desc-btn"
                  onClick={handleAskBattle}
                >
                  🤖 AIにきめてもらう
                </button>
              </div>
              <p className="battle-edit-lead">
                バランスは AIに かんがえてもらうのが おすすめ。手で なおしてもOK。
              </p>

              <div className="battle-edit-row">
                <label>たいりょく（1〜{HP_MAX}）</label>
                <div className="hp-edit">
                  <input
                    type="range"
                    min={HP_MIN}
                    max={HP_MAX}
                    value={bHp}
                    onChange={(e) => setBHp(Number(e.target.value))}
                  />
                  <span className="hp-edit-num">{bHp}</span>
                </div>
              </div>

              <div className="battle-edit-row">
                <label>こうげき（★{STAT_MAX}だんかい）</label>
                <StarRating
                  value={bAtk}
                  editable
                  onChange={setBAtk}
                  size={18}
                  max={STAT_MAX}
                />
              </div>

              <div className="battle-edit-row">
                <label>ぼうぎょ（★{STAT_MAX}だんかい）</label>
                <StarRating
                  value={bDef}
                  editable
                  onChange={setBDef}
                  size={18}
                  max={STAT_MAX}
                />
              </div>

              <div className="battle-edit-row col">
                <label>ひっさつわざの なまえ</label>
                <input
                  value={mvName}
                  onChange={(e) => setMvName(e.target.value)}
                  placeholder="れい: カマのいちげき"
                />
              </div>

              <div className="battle-edit-row col">
                <label>こうか</label>
                <select
                  className="order-select"
                  value={mvEffect}
                  onChange={(e) => setMvEffect(e.target.value as MoveEffect)}
                >
                  {EFFECTS.map((ef) => (
                    <option key={ef.key} value={ef.key}>
                      {ef.emoji} {ef.label}（{ef.hint}）
                    </option>
                  ))}
                </select>
                <p className="battle-uses-note">
                  つかえる回数: {usesForEffect(mvEffect)}回
                </p>
              </div>

              <div className="battle-edit-row">
                <label>こうかの つよさ（{POWER_MIN}〜{POWER_MAX}）</label>
                <input
                  type="number"
                  className="power-input"
                  min={POWER_MIN}
                  max={POWER_MAX}
                  value={mvPower}
                  onChange={(e) => setMvPower(Number(e.target.value))}
                />
              </div>

              <div className="battle-edit-row col">
                <label>わざの せつめい</label>
                <textarea
                  className="desc-textarea"
                  value={mvDesc}
                  onChange={(e) => setMvDesc(e.target.value)}
                  rows={2}
                  placeholder="この わざの せつめい"
                />
              </div>

              <details className="battle-import">
                <summary>🤖 AIの答えを とりこむ</summary>
                <p className="battle-import-lead">
                  「AIにきめてもらう」で コピーした しつもんを AIチャットに はりつけ、
                  こたえ（コードブロック）を 下に はって「とりこむ」。
                </p>
                <textarea
                  className="chatgpt-textarea"
                  placeholder={'たいりょく: 14\nこうげき: 7\nぼうぎょ: 5\nわざ: カマのいちげき\nこうか: つよいいちげき\nこうかりょう: 4\nわざせつめい: …'}
                  value={battleText}
                  onChange={(e) => setBattleText(e.target.value)}
                  rows={5}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleImportBattle}
                  disabled={!battleText.trim()}
                >
                  ⬇️ とりこむ
                </button>
              </details>
              {battleNote && <p className="desc-note">{battleNote}</p>}
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

            {/* ⚔️ バトルステータス（ひょうじ） */}
            {(() => {
              const bs = battleStatsOf(bug)
              const info = effectInfo(bs.move.effect)
              return (
                <div className="battle-view">
                  <button
                    className="battle-view-toggle"
                    onClick={() => {
                      sfx.tap()
                      setShowBattle((s) => !s)
                    }}
                  >
                    ⚔️ バトルステータス {showBattle ? '▲' : '▼'}
                  </button>
                  {showBattle && (
                    <div className="battle-view-body">
                      <div className="statrow">
                        <span className="statlabel">たいりょく</span>
                        <span className="statval">
                          <span className="hpbar mini">
                            <span
                              className="hpbar-fill"
                              style={{ width: (bs.hp / HP_MAX) * 100 + '%' }}
                            />
                          </span>
                          {bs.hp}
                        </span>
                      </div>
                      <div className="statrow">
                        <span className="statlabel">こうげき</span>
                        <StarRating value={bs.attack} size={14} max={STAT_MAX} />
                      </div>
                      <div className="statrow">
                        <span className="statlabel">ぼうぎょ</span>
                        <StarRating value={bs.defense} size={14} max={STAT_MAX} />
                      </div>
                      <div className="battle-view-move">
                        <p className="move-name">
                          {info.emoji} ひっさつわざ「{bs.move.name}」
                        </p>
                        <p className="move-eff">
                          {info.label}（{info.hint}）／ つよさ{bs.move.power}・
                          {bs.move.uses}回
                        </p>
                        {bs.move.desc && (
                          <p className="move-desc">{bs.move.desc}</p>
                        )}
                      </div>
                      {!bug.battle && (
                        <p className="battle-view-auto">
                          ※ これは レア度からの じどうステータス。「✏️ ないようを
                          なおす」で じぶん好みに できるよ。
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

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
                しゃしんを タップすると メイン画像に。日づけは 写真ごとに なおせるよ。
              </p>
              <div className="history-grid">
                {captures.map((c) => {
                  const isMain = c.id === bug.mainCaptureId
                  return (
                    <div
                      key={c.id}
                      className={'history-item' + (isMain ? ' main' : '')}
                    >
                      <button
                        className="history-photo"
                        onClick={() => {
                          if (!isMain && onSetMain) {
                            sfx.tap()
                            onSetMain(bug.id, c.id)
                          }
                        }}
                      >
                        <img src={c.photo} alt={bug.name} loading="lazy" />
                        {isMain && (
                          <span className="history-badge">メイン</span>
                        )}
                      </button>
                      <input
                        type="date"
                        className="history-date-input"
                        value={msToDateInput(c.caughtAt)}
                        onChange={(e) => {
                          const ms = dateInputToMs(e.target.value)
                          if (ms !== null && onUpdate) {
                            onUpdate(bug.id, {
                              captureDate: { id: c.id, caughtAt: ms },
                            })
                          }
                        }}
                      />
                      {c.place && (
                        <span className="history-place">📍 {c.place}</span>
                      )}
                    </div>
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
