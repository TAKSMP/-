import { useEffect, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import type { Baseline, Mission } from '../data/missions'
import {
  LEVELS,
  MISSIONS,
  computeBaseline,
  metricProgress,
} from '../data/missions'
import {
  loadClaimedBadges,
  loadMissionBaseline,
  resetMissions,
  saveClaimedBadges,
  saveMissionBaseline,
} from '../lib/storage'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

// ほぞんされた baseline が ただしい形か たしかめる
function isBaseline(x: unknown): x is Baseline {
  if (!x || typeof x !== 'object') return false
  const b = x as Record<string, unknown>
  return (
    typeof b.kinds === 'number' &&
    typeof b.orders === 'number' &&
    typeof b.places === 'number' &&
    typeof b.captures === 'number'
  )
}

export function MissionPage({ bugs, onGoCapture }: Props) {
  // きじゅん（はじめて開いたときの図鑑の状態）。なければ 今の図鑑でつくって保存。
  const [baseline, setBaseline] = useState<Baseline>(() => {
    const stored = loadMissionBaseline()
    if (isBaseline(stored)) return stored
    const b = computeBaseline(bugs)
    saveMissionBaseline(b)
    return b
  })
  const [claimed, setClaimed] = useState<string[]>(() => loadClaimedBadges())
  const [justEarned, setJustEarned] = useState<Mission[]>([])
  const [confetti, setConfetti] = useState(false)
  const claimedRef = useRef(claimed)

  // 達成したミッションが あれば バッジをつけて お祝いする。
  useEffect(() => {
    const prev = claimedRef.current
    const newly = MISSIONS.filter(
      (m) =>
        !prev.includes(m.id) &&
        metricProgress(bugs, baseline, m.metric) >= m.goal,
    )
    if (newly.length === 0) return
    const next = [...prev, ...newly.map((m) => m.id)]
    claimedRef.current = next
    saveClaimedBadges(next)
    setClaimed(next)
    setJustEarned(newly)
    setConfetti(true)
    sfx.discover()
    const t = setTimeout(() => setConfetti(false), 400)
    return () => clearTimeout(t)
  }, [bugs, baseline])

  function handleReset() {
    if (
      !confirm(
        'いまの図鑑を あたらしい「きじゅん」にして、ミッションを さいしょから やりなおす？（とったバッジも きえます）',
      )
    )
      return
    sfx.tap()
    resetMissions()
    const b = computeBaseline(bugs)
    saveMissionBaseline(b)
    claimedRef.current = []
    setBaseline(b)
    setClaimed([])
    setJustEarned([])
  }

  const earnedCount = claimed.length

  return (
    <div className="page mission">
      <Confetti show={confetti} />

      <header className="page-head">
        <h1>🎯 ミッション</h1>
        <p className="sub">おだいを クリアして バッジを あつめよう！</p>
      </header>

      {/* いま すすめる 3つのミッション（レベルごとに1つ） */}
      <div className="mission-cards">
        {LEVELS.map((lv) => {
          const track = MISSIONS.filter((m) => m.level === lv.key)
          const done = track.filter((m) => claimed.includes(m.id)).length
          const active = track.find((m) => !claimed.includes(m.id))
          return (
            <div key={lv.key} className={'mission-card lv-' + lv.key}>
              <div className="mission-card-head">
                <span className="mission-level">
                  {lv.emoji} {lv.label}
                </span>
                <span className="mission-track">
                  {done}/{track.length}
                </span>
              </div>
              {active ? (
                (() => {
                  const cur = Math.min(
                    metricProgress(bugs, baseline, active.metric),
                    active.goal,
                  )
                  const pct = Math.round((cur / active.goal) * 100)
                  return (
                    <>
                      <div className="mission-emoji">{active.emoji}</div>
                      <p className="mission-title">{active.title}</p>
                      <div className="mission-bar">
                        <div
                          className="mission-bar-fill"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                      <p className="mission-progress">
                        {cur} / {active.goal}
                        <span className="mission-remain">
                          （あと {active.goal - cur}）
                        </span>
                      </p>
                      <p className="mission-reward">
                        ごほうび: {active.badge.emoji} {active.badge.name}
                      </p>
                    </>
                  )
                })()
              ) : (
                <div className="mission-clear">
                  <div className="mission-emoji">🎉</div>
                  <p>ぜんぶ たっせい！すごい！</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {bugs.length === 0 && (
        <div className="mission-hint">
          <p>まずは 虫を みつけて 図鑑に きろくしよう！</p>
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
      )}

      {/* 獲得バッジ いちらん */}
      <div className="badge-section">
        <h3 className="badge-title">
          🏅 獲得バッジ（{earnedCount}/{MISSIONS.length}）
        </h3>
        <div className="badge-grid">
          {MISSIONS.map((m) => {
            const got = claimed.includes(m.id)
            return (
              <div
                key={m.id}
                className={'badge-item' + (got ? ' got' : ' locked')}
                title={got ? m.badge.name : m.title}
              >
                <span className="badge-emoji">{got ? m.badge.emoji : '🔒'}</span>
                <span className="badge-name">
                  {got ? m.badge.name : '？？？'}
                </span>
                {!got && <span className="badge-goal">{m.title}</span>}
              </div>
            )
          })}
        </div>
        <button className="btn btn-ghost mission-reset" onClick={handleReset}>
          🔄 いまの図鑑から やりなおす
        </button>
      </div>

      {/* たった今 とれたバッジの お祝い */}
      {justEarned.length > 0 && (
        <div className="badge-toast" onClick={() => setJustEarned([])}>
          <div className="badge-toast-inner" onClick={(e) => e.stopPropagation()}>
            <div className="badge-toast-title">🎉 バッジ ゲット！</div>
            <div className="badge-toast-list">
              {justEarned.map((m) => (
                <div key={m.id} className="badge-toast-badge">
                  <span className="badge-toast-emoji">{m.badge.emoji}</span>
                  <span>{m.badge.name}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-big btn-primary"
              onClick={() => {
                sfx.tap()
                setJustEarned([])
              }}
            >
              やったー！
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
