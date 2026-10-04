// =============================================================
//  レースの メンバー せってい（なんびき・CPUの わく）
// -------------------------------------------------------------
//  ・さいしょの わくは ひと（じぶん・つうしんで はいった ともだち）
//  ・のこりは CPU。虫を「えらぶ」か「おまかせ」、つよさ（1〜10）を きめる
//  onCount / onSlots が ない ときは 見るだけ（つうしんの ゲスト）
// =============================================================
import { useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { cpuBugLevel, MAX_RACERS, MIN_RACERS, type CpuSlot } from '../lib/raceSetup'
import { sfx } from '../lib/sound'

export interface FixedRacer {
  key: string
  name: string
  photo: string
  level: number
  label: string
}

interface Props {
  count: number
  minCount: number
  onCount?: (n: number) => void
  fixed: FixedRacer[]
  slots: CpuSlot[]
  onSlots?: (slots: CpuSlot[]) => void
  bugs: CaughtBug[]
  excludeIds?: string[]
  baseLv: number
}

export function RaceSlots({ count, minCount, onCount, fixed, slots, onSlots, bugs, excludeIds = [], baseLv }: Props) {
  const [picking, setPicking] = useState<number | null>(null)
  const readOnly = !onSlots
  const cpuCount = Math.max(0, count - fixed.length)

  const setSlot = (i: number, patch: Partial<CpuSlot>) => {
    if (!onSlots) return
    onSlots(slots.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  }

  return (
    <div className="rs">
      <div className="rs-count">
        <span>なんびきで はしる？</span>
        <div className="rs-count-btns">
          {Array.from({ length: MAX_RACERS - MIN_RACERS + 1 }, (_, i) => i + MIN_RACERS).map((n) => (
            <button
              key={n}
              className={'rs-count-btn' + (count === n ? ' on' : '')}
              disabled={!onCount || n < minCount}
              onClick={() => {
                sfx.tap()
                onCount?.(n)
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="rs-list">
        {fixed.map((f, i) => (
          <div key={f.key} className="rs-row human">
            <span className="rs-no">{i + 1}</span>
            <img className="rs-face" src={f.photo} alt={f.name} />
            <div className="rs-mid">
              <b>{f.name}</b>
              <small>
                {f.label} ・ Lv {f.level}
              </small>
            </div>
          </div>
        ))}
        {slots.slice(0, cpuCount).map((s, i) => {
          const bug = s.mode === 'pick' ? bugs.find((b) => b.id === s.bugId) : undefined
          return (
            <div key={i} className="rs-row cpu">
              <span className="rs-no">{fixed.length + i + 1}</span>
              <button
                className="rs-face rs-face-btn"
                disabled={readOnly}
                onClick={() => {
                  sfx.tap()
                  setSlot(i, { mode: 'pick' })
                  setPicking(i)
                }}
              >
                {bug ? <img src={mainPhoto(bug)} alt={bug.name} /> : <span>{s.mode === 'pick' ? '＋' : '🎲'}</span>}
              </button>
              <div className="rs-mid">
                {!readOnly && (
                  <div className="rs-toggle">
                    <button
                      className={s.mode === 'pick' ? 'on' : ''}
                      onClick={() => {
                        sfx.tap()
                        setSlot(i, { mode: 'pick' })
                        if (!bug) setPicking(i)
                      }}
                    >
                      えらぶ
                    </button>
                    <button
                      className={s.mode === 'random' ? 'on' : ''}
                      onClick={() => {
                        sfx.tap()
                        setSlot(i, { mode: 'random' })
                      }}
                    >
                      おまかせ
                    </button>
                  </div>
                )}
                <small>
                  {bug
                    ? bug.name
                    : readOnly
                      ? s.mode === 'pick'
                        ? 'ホストが えらんだ 虫'
                        : 'おまかせ'
                      : s.mode === 'pick'
                        ? 'タップして えらんでね'
                        : 'だれが でるかな？'}
                </small>
              </div>
              <div className="rs-level">
                <span>CPU つよさ</span>
                <div className="rs-level-step">
                  {!readOnly && (
                    <button
                      disabled={s.level <= 1}
                      onClick={() => {
                        sfx.tap()
                        setSlot(i, { level: s.level - 1 })
                      }}
                    >
                      −
                    </button>
                  )}
                  <b>{s.level}</b>
                  {!readOnly && (
                    <button
                      disabled={s.level >= 10}
                      onClick={() => {
                        sfx.tap()
                        setSlot(i, { level: s.level + 1 })
                      }}
                    >
                      ＋
                    </button>
                  )}
                </div>
                <small>虫 Lv {cpuBugLevel(baseLv, s.level)}</small>
              </div>
            </div>
          )
        })}
      </div>

      {picking !== null && (
        <div className="rs-picker" onClick={() => setPicking(null)}>
          <div className="rs-picker-box" onClick={(e) => e.stopPropagation()}>
            <div className="rs-picker-head">
              <b>{fixed.length + picking + 1}ばんめに はしる 虫を えらんでね</b>
              <button className="btn btn-ghost" onClick={() => setPicking(null)}>
                とじる
              </button>
            </div>
            <div className="race-pick-grid">
              {bugs
                .filter((b) => !excludeIds.includes(b.id))
                .map((b) => (
                  <button
                    key={b.id}
                    className={'race-pick' + (slots[picking]?.bugId === b.id ? ' on' : '')}
                    onClick={() => {
                      sfx.tap()
                      setSlot(picking, { mode: 'pick', bugId: b.id })
                      setPicking(null)
                    }}
                  >
                    <img src={mainPhoto(b)} alt={b.name} loading="lazy" />
                    <span className="race-pick-name">{b.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
