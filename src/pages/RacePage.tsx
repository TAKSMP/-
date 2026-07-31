import { useEffect, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { BugCard } from '../components/BugCard'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const GOAL = 100
const TICK_MS = 90
const MAX_RACERS = 4

interface Racer {
  bug: CaughtBug
  name: string
  photo: string
  speed: number // レア度から きまる ちょっとした はやさ（ほぼランダム）
  mine: boolean
  pos: number
  finish: number | null // ゴールした じゅんい（1〜）
}

function shuffle<T>(a: T[]): T[] {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

function makeRacer(bug: CaughtBug, mine: boolean): Racer {
  return {
    bug,
    name: bug.name,
    photo: mainPhoto(bug),
    // レアな虫ほど ほんの少し はやい（でも ランダムが メイン）
    speed: 1 + (Math.max(1, Math.min(5, bug.rarity)) - 3) * 0.06,
    mine,
    pos: 0,
    finish: null,
  }
}

type Phase = 'pick' | 'lineup' | 'racing' | 'result'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣']

export function RacePage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [racers, setRacers] = useState<Racer[]>([])
  const [countdown, setCountdown] = useState(3)
  const [confetti, setConfetti] = useState(false)
  const racersRef = useRef<Racer[]>([])
  const rankRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (bugs.length < 2) {
    return (
      <div className="battle-empty">
        <div className="quiz-start-emoji">🏁🐛</div>
        <p>
          レースを するには、虫を
          <br />
          <b>2ひき いじょう</b> あつめてね！
        </p>
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
    )
  }

  // あいてを えらんで（ランダム）出走メンバーを つくる
  function buildRacers(mine: CaughtBug): Racer[] {
    const others = shuffle(bugs.filter((b) => b.id !== mine.id)).slice(
      0,
      Math.max(1, Math.min(MAX_RACERS, bugs.length) - 1),
    )
    const list = [makeRacer(mine, true), ...others.map((b) => makeRacer(b, false))]
    return shuffle(list) // レーンの じゅんばんも シャッフル
  }

  function pickMine(bug: CaughtBug) {
    sfx.tap()
    setMyBug(bug)
    setRacers(buildRacers(bug))
    setPhase('lineup')
  }

  function reroll() {
    if (!myBug) return
    sfx.tap()
    setRacers(buildRacers(myBug))
  }

  function startRace() {
    sfx.tap()
    const fresh = racers.map((r) => ({ ...r, pos: 0, finish: null }))
    racersRef.current = fresh
    rankRef.current = 0
    setRacers(fresh)
    setCountdown(3)
    setPhase('racing')
  }

  function fullReset() {
    sfx.tap()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setPhase('pick')
    setMyBug(null)
    setRacers([])
  }

  // カウントダウン → スタート → じどうで すすむ
  useEffect(() => {
    if (phase !== 'racing') return
    if (countdown > 0) {
      const t = setTimeout(() => {
        sfx.tap()
        setCountdown((c) => c - 1)
      }, 700)
      return () => clearTimeout(t)
    }
    // よーい ドン！
    sfx.battleStart()
    const tick = () => {
      const prev = racersRef.current
      const next = prev.map((r) => ({ ...r }))
      for (const r of next) {
        if (r.finish !== null) continue
        const dash = Math.random() < 0.1 ? 2.6 : 0
        r.pos = Math.min(GOAL, r.pos + (0.7 + Math.random() * 2.6 + dash) * r.speed)
        if (r.pos >= GOAL) {
          rankRef.current += 1
          r.finish = rankRef.current
        }
      }
      racersRef.current = next
      setRacers(next)
      if (next.every((r) => r.finish !== null)) {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        const mineRank = next.find((r) => r.mine)?.finish ?? null
        setTimeout(() => {
          setPhase('result')
          if (mineRank === 1) {
            setConfetti(true)
            setTimeout(() => setConfetti(false), 600)
            sfx.win()
          } else {
            sfx.lose()
          }
        }, 700)
      }
    }
    timerRef.current = window.setInterval(tick, TICK_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [phase, countdown])

  // ゴールした じゅんに ならべた けっか
  const ranking = [...racers].sort(
    (a, b) => (a.finish ?? 99) - (b.finish ?? 99),
  )

  return (
    <div className="race">
      <Confetti show={confetti} />

      {/* ① じぶんの虫をえらぶ */}
      {phase === 'pick' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① おうえんする虫を えらぼう</h2>
          <p className="race-lead">えらんだ虫が レースに でるよ！</p>
          <div className="bug-grid">
            {bugs.map((b) => (
              <BugCard key={b.id} bug={b} onClick={() => pickMine(b)} />
            ))}
          </div>
        </div>
      )}

      {/* ② 出走メンバー */}
      {phase === 'lineup' && (
        <div className="battle-step">
          <h2 className="battle-step-title">② よーい… メンバー しょうかい！</h2>
          <div className="race-lineup">
            {racers.map((r) => (
              <div
                key={r.bug.id}
                className={'race-chip' + (r.mine ? ' mine' : '')}
              >
                <img src={r.photo} alt={r.name} />
                <span className="race-chip-name">{r.name}</span>
                {r.mine && <span className="race-chip-you">きみ</span>}
              </div>
            ))}
          </div>
          <div className="race-lineup-actions">
            <button className="btn btn-ghost" onClick={reroll}>
              🎲 あいてを かえる
            </button>
            <button className="btn btn-big btn-primary" onClick={startRace}>
              レース スタート 🏁
            </button>
          </div>
          <button className="btn btn-ghost battle-back" onClick={fullReset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* ③ レース中 */}
      {(phase === 'racing' || phase === 'result') && (
        <div className="race-track-area">
          <h2 className="battle-step-title">
            {phase === 'result' ? '🏁 ゴール！' : '🏁 むしレース！'}
          </h2>
          <div className="race-lanes">
            {racers.map((r) => (
              <div
                key={r.bug.id}
                className={'race-lane' + (r.mine ? ' mine' : '')}
              >
                <div className="race-lane-head">
                  <span className="race-lane-name">
                    {r.mine ? '⭐ ' : ''}
                    {r.name}
                  </span>
                  {r.finish !== null && (
                    <span className="race-lane-rank">
                      {MEDALS[r.finish - 1] ?? r.finish + 'い'}
                    </span>
                  )}
                </div>
                <div className="race-track">
                  <span className="race-goal">🏁</span>
                  <span
                    className={
                      'race-runner' +
                      (r.finish === null && countdown === 0 ? ' dash' : '')
                    }
                    style={{ left: r.pos * 0.86 + '%' }}
                  >
                    <img src={r.photo} alt={r.name} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {phase === 'racing' && countdown > 0 && (
            <div className="race-countdown">{countdown}</div>
          )}
        </div>
      )}

      {/* ④ けっか */}
      {phase === 'result' && (
        <div className="race-result">
          {ranking[0]?.mine ? (
            <p className="race-result-msg win">
              🎉 きみの「{ranking[0].name}」が 1い！
            </p>
          ) : (
            <p className="race-result-msg">
              1いは「{ranking[0]?.name}」！ きみの虫は{' '}
              {racers.find((r) => r.mine)?.finish}い だったよ
            </p>
          )}
          <div className="race-rank-list">
            {ranking.map((r, i) => (
              <div
                key={r.bug.id}
                className={'race-rank-item' + (r.mine ? ' mine' : '')}
              >
                <span className="race-rank-medal">
                  {MEDALS[i] ?? i + 1 + 'い'}
                </span>
                <img src={r.photo} alt={r.name} />
                <span className="race-rank-name">{r.name}</span>
              </div>
            ))}
          </div>
          <div className="race-result-actions">
            <button className="btn btn-big btn-primary" onClick={startRace}>
              もういちど レース 🔄
            </button>
            <button className="btn btn-big" onClick={fullReset}>
              あたらしい レース 🏁
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
