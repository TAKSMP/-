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
  ULTIMATE_KIND_LABEL,
  type MoveGroup,
} from '../lib/moveDex'
import { sfx } from '../lib/sound'
import { BASIC_ATTACK, moveSummary } from '../lib/moveLibrary'
import type { SpecialMoveV2 } from '../types'

// わざの くわしい せつめい（わざリストと おなじ ないよう）
export function MoveDetail({ move }: { move: SpecialMoveV2 }) {
  const lib = DEX.find((x) => x.move.id === move.id)?.move
  return (
    <div className="movedex-detail">
      <p className="movedex-desc">{move.desc}</p>
      <dl className="movedex-spec">
        <div>
          <dt>タイプ</dt>
          <dd>{move.id === BASIC_ATTACK.id ? 'ふつうの こうげき' : lib ? patternLabel(lib) : moveSummary(move)}</dd>
        </div>
        <div>
          <dt>ねらい</dt>
          <dd>
            {move.target === 'allFoes'
              ? 'あいて ぜんいん'
              : move.target === 'allOthers'
                ? 'じぶん いがい ぜんいん'
                : move.target === 'self'
                  ? 'じぶん'
                  : move.target === 'ally'
                    ? 'みかた'
                    : move.target === 'fallenAlly'
                      ? 'たおれた みかた'
                      : 'あいて 1ぴき'}
          </dd>
        </div>
        <div>
          <dt>{move.revive ? 'せいこう' : 'めいちゅう'}</dt>
          <dd>
            {move.revive
              ? `${Math.round(move.revive.chance * 100)}％`
              : move.accuracy == null
                ? 'かならず あたる'
                : `${move.accuracy}％`}
          </dd>
        </div>
        <div>
          <dt>つかえる</dt>
          <dd>{move.id === BASIC_ATTACK.id ? 'なんかいでも' : `${move.uses}かい`}</dd>
        </div>
      </dl>
    </div>
  )
}

// バトル中に わざを ながおし した ときの ポップアップ
export function MoveInfoModal({ move, left, onClose }: { move: SpecialMoveV2; left?: number; onClose: () => void }) {
  const d = DEX.find((x) => x.move.id === move.id)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal movedex moveinfo" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>
        <p className="moveinfo-emoji">{move.emoji ?? (move.id === BASIC_ATTACK.id ? '⚔️' : '✨')}</p>
        <h2 className="modal-name">{move.name}</h2>
        <p className="movedex-count">
          {d && <span>No.{d.no}　</span>}
          {move.ultimate && `👑 ${ULTIMATE_KIND_LABEL[move.ultimate]}・`}
          {move.fixedDamage ? `${move.fixedDamage}ダメージ` : moveSummary(move)}
          {left !== undefined && move.id !== BASIC_ATTACK.id && <b>　のこり {left}かい</b>}
        </p>
        <MoveDetail move={move} />
        <button className="btn btn-big" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  )
}

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
                      {d.move.ultimate && `${ULTIMATE_KIND_LABEL[d.move.ultimate]}・`}
                      {d.move.fixedDamage ? `${d.move.fixedDamage}ダメージ` : moveSummary(d.move)}
                    </span>
                  )}
                  {found && <span className="movedex-arrow">{isOpen ? '▲' : '▼'}</span>}
                </button>
                {found && isOpen && <MoveDetail move={d.move} />}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
