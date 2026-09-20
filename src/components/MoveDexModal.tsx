// =============================================================
//  ひっさつわざリスト（わざ図鑑）の がめん
// -------------------------------------------------------------
//  No.じゅんに ぜんぶ ならぶ。見たことの ない わざは「????」。
// =============================================================
import { useState } from 'react'
import {
  DEX,
  GROUPS,
  dexCount,
  loadDexSeen,
  patternLabel,
  type MoveGroup,
} from '../lib/moveDex'
import { sfx } from '../lib/sound'

export function MoveDexModal({ onClose }: { onClose: () => void }) {
  const [group, setGroup] = useState<MoveGroup>('attack')
  const [open, setOpen] = useState<string | null>(null)
  const seen = loadDexSeen()
  const count = dexCount(seen)
  const list = DEX.filter((d) => d.group === group)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal movedex" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>
        <h2 className="modal-name">📜 ひっさつわざリスト</h2>
        <p className="movedex-count">
          みつけた わざ <b>{count.found}</b> ／ {count.total}
        </p>
        <p className="movedex-hint">
          バトルで <b>見た</b> か <b>つかった</b> わざだけ、くわしく 見られるよ。
        </p>

        <div className="foe-mode movedex-tabs">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              className={'chip' + (group === g.key ? ' on' : '')}
              onClick={() => {
                sfx.tap()
                setGroup(g.key)
                setOpen(null)
              }}
            >
              {g.emoji} {g.label}
            </button>
          ))}
        </div>

        <ul className="movedex-list">
          {list.map((d) => {
            const found = seen.has(d.move.id)
            const isOpen = open === d.move.id
            return (
              <li key={d.move.id} className={found ? 'found' : 'unknown'}>
                <button
                  className="movedex-row"
                  disabled={!found}
                  onClick={() => {
                    sfx.tap()
                    setOpen(isOpen ? null : d.move.id)
                  }}
                >
                  <span className="movedex-no">No.{d.no}</span>
                  <span className="movedex-emoji">{found ? (d.move.emoji ?? '✨') : '❔'}</span>
                  <span className="movedex-name">
                    {found ? d.move.name : '????'}
                  </span>
                  {found && (
                    <span className="movedex-power">
                      {d.move.kind === 'attack' && d.move.power > 0
                        ? `いりょく${d.move.power}`
                        : d.move.fixedDamage
                          ? `${d.move.fixedDamage}ダメージ`
                          : 'へんかわざ'}
                    </span>
                  )}
                  {found && <span className="movedex-arrow">{isOpen ? '▲' : '▼'}</span>}
                </button>
                {found && isOpen && (
                  <div className="movedex-detail">
                    <p className="movedex-desc">{d.move.desc}</p>
                    <dl className="movedex-spec">
                      <div>
                        <dt>タイプ</dt>
                        <dd>{patternLabel(d.move)}</dd>
                      </div>
                      <div>
                        <dt>ねらい</dt>
                        <dd>
                          {d.move.target === 'allFoes'
                            ? 'あいて ぜんいん'
                            : d.move.target === 'allOthers'
                              ? 'じぶん いがい ぜんいん'
                              : d.move.target === 'self'
                                ? 'じぶん'
                                : d.move.target === 'ally'
                                  ? 'みかた'
                                  : 'あいて 1ぴき'}
                        </dd>
                      </div>
                      <div>
                        <dt>めいちゅう</dt>
                        <dd>{d.move.accuracy === null ? 'かならず あたる' : `${d.move.accuracy}％`}</dd>
                      </div>
                      <div>
                        <dt>つかえる</dt>
                        <dd>{d.move.uses}かい</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
