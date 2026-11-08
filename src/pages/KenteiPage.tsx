import { useEffect, useMemo, useRef, useState } from 'react'
import { Confetti } from '../components/Confetti'
import { Ruby } from '../components/Ruby'
import { PointRoulette, type RouletteSlot } from '../components/PointRoulette'
import { sfx } from '../lib/sound'
import { addPoints } from '../lib/points'
import { drawQuestions, markShown, remainingCount } from '../lib/kenteiDeck'
import {
  KENTEI,
  KENTEI_SECTIONS,
  type KenteiLevel,
  type KenteiQuestion,
} from '../data/kentei'

// 昆虫検定：初級・中級の問題集から、まだ 出していない もんだいを ランダムに 10もん。
// せいかいすると 虫ポイント（初級 1もん 1P、中級 1もん 3P）。ぜんもん せいかいで ルーレット。
const QUESTION_COUNT = 10

const LEVELS: {
  id: KenteiLevel
  label: string // ふりがな つき
  emoji: string
  desc: string
  pointsPer: number
}[] = [
  {
    id: 'beginner',
    label: '{初級|しょきゅう}',
    emoji: '🐞',
    desc: '{昆虫|こんちゅう}の きほんから チャレンジ！',
    pointsPer: 1,
  },
  {
    id: 'intermediate',
    label: '{中級|ちゅうきゅう}',
    emoji: '🦋',
    desc: 'もっと くわしい {問題|もんだい}に ちょうせん！',
    pointsPer: 3,
  },
]

function sectionOf(level: KenteiLevel, no: number): string {
  const s = KENTEI_SECTIONS[level].find((x) => no <= x.last)
  return s ? s.name : ''
}

function rankOf(score: number, total: number): { emoji: string; title: string } {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return { emoji: '👑', title: 'パーフェクト！ むしはかせ！' }
  if (pct >= 0.8) return { emoji: '🏆', title: 'すごい！ {昆虫|こんちゅう}めいじん！' }
  if (pct >= 0.5) return { emoji: '🌟', title: 'なかなかやるね！' }
  if (pct >= 0.2) return { emoji: '🐛', title: 'これからだね！' }
  return { emoji: '🌱', title: 'またチャレンジしよう！' }
}

type Phase = 'select' | 'playing' | 'done'

interface Answered {
  question: KenteiQuestion
  picked: number
}

export function KenteiPage() {
  const [phase, setPhase] = useState<Phase>('select')
  const [level, setLevel] = useState<KenteiLevel>('beginner')
  const [questions, setQuestions] = useState<KenteiQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [history, setHistory] = useState<Answered[]>([])
  const [streak, setStreak] = useState(0)
  const [confetti, setConfetti] = useState(false)
  // この回で もらった ポイント（ルーレットの まえ）と、ルーレットの けっか
  const [earned, setEarned] = useState(0)
  const [roulette, setRoulette] = useState<RouletteSlot | null>(null)
  // 級えらびで「まだ 出ていない もんだい」の かずを 出すため（もどるたびに よみなおす）
  const [deckTick, setDeckTick] = useState(0)
  const feedbackRef = useRef<HTMLDivElement>(null)

  // こたえたら、解説と「つぎへ」が見えるところまで スクロール（スマホだと画面の下に隠れるため）
  useEffect(() => {
    if (picked !== null) {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [picked])

  const current = questions[index]

  // がめんに 出した もんだいを「出した」に する（つぎから しばらく 出ない）
  useEffect(() => {
    if (phase === 'playing' && current) markShown(level, current.no, KENTEI[level].length)
  }, [phase, current, level])

  const score = history.filter((h) => h.picked === h.question.answer).length
  const isCorrect = current != null && picked === current.answer
  const levelInfo = LEVELS.find((l) => l.id === level)!
  const rank = useMemo(() => rankOf(score, questions.length), [score, questions.length])
  const perfect = phase === 'done' && questions.length > 0 && score === questions.length
  const finalPoints = roulette ? Math.round(earned * roulette.mult) : earned

  function start(lv: KenteiLevel) {
    sfx.tap()
    setLevel(lv)
    setQuestions(drawQuestions(lv, KENTEI[lv], QUESTION_COUNT))
    setIndex(0)
    setPicked(null)
    setHistory([])
    setStreak(0)
    setEarned(0)
    setRoulette(null)
    setPhase('playing')
    window.scrollTo({ top: 0 })
  }

  function popConfetti() {
    setConfetti(true)
    setTimeout(() => setConfetti(false), 150)
  }

  function choose(i: number) {
    if (picked !== null || !current) return
    setPicked(i)
    setHistory((h) => [...h, { question: current, picked: i }])
    if (i === current.answer) {
      setStreak((s) => s + 1)
      sfx.discover()
      popConfetti()
    } else {
      setStreak(0)
      sfx.error()
    }
  }

  function next() {
    sfx.tap()
    if (index + 1 >= questions.length) {
      // ポイントは ここで すぐ わたす（ルーレットで ふえた ぶんは あとから たす。
      // ルーレットの とちゅうで やめても、もらった ぶんは なくならない）
      const pts = score * levelInfo.pointsPer
      setEarned(pts)
      if (pts > 0) addPoints(pts)
      setPhase('done')
      // 半分いじょうで かちジングル、それ未満は しょんぼり
      if (score * 2 >= questions.length) sfx.win()
      else sfx.lose()
      popConfetti()
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
    window.scrollTo({ top: 0 })
  }

  function onRoulette(slot: RouletteSlot) {
    setRoulette(slot)
    const extra = Math.round(earned * slot.mult) - earned
    if (extra > 0) addPoints(extra)
    if (slot.mult > 1) popConfetti()
  }

  function backToSelect() {
    sfx.tap()
    setPhase('select')
    setDeckTick((t) => t + 1)
  }

  return (
    <div className="page quiz kentei">
      <Confetti show={confetti} />

      <header className="page-head">
        <h1>
          📜 <Ruby text="{昆虫検定|こんちゅうけんてい}" />
        </h1>
        <p className="sub">
          {phase === 'select' ? (
            <>
              <Ruby text="{級|きゅう}" />
              をえらんで、ランダムに10もん ちょうせん！
            </>
          ) : (
            <>
              <Ruby text={levelInfo.label} />
              ・ぜんぶで{KENTEI[level].length}もんから 10もん
            </>
          )}
        </p>
      </header>

      {/* --- 級をえらぶ --- */}
      {phase === 'select' && (
        <div className="kentei-levels" data-tick={deckTick}>
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              className={'game-card kentei-level ' + lv.id}
              onClick={() => start(lv.id)}
            >
              <span className="game-emoji">{lv.emoji}</span>
              <span className="game-title">
                <Ruby text={lv.label} />
              </span>
              <span className="game-desc">
                <Ruby text={lv.desc} />
              </span>
              <span className="kentei-level-count">
                まだ {remainingCount(lv.id, KENTEI[lv.id])} ／ {KENTEI[lv.id].length}もん
              </span>
              <span className="kentei-level-pt">せいかい 1もん {lv.pointsPer}P</span>
            </button>
          ))}
          <p className="kentei-note">
            <Ruby text="いちど {出|で}た もんだいは、ぜんぶ {出|で}おわるまで {出|で}ないよ。" />
          </p>
        </div>
      )}

      {/* --- もんだい --- */}
      {phase === 'playing' && current && (
        <div className="quiz-play">
          <div className="quiz-progress">
            <span>
              だい {index + 1} もん / {questions.length}
            </span>
            <span className="quiz-score">⭐ {score}てん</span>
            {streak >= 2 && (
              <span className="quiz-streak">🔥 {streak}れんぞく！</span>
            )}
          </div>

          <div className="quiz-card kentei-card">
            <div className="kentei-tags">
              <span className={'kentei-tag lv ' + level}>
                <Ruby text={levelInfo.label} />
              </span>
              <span className="kentei-tag">
                <Ruby text={sectionOf(level, current.no)} />
              </span>
              <span className="kentei-no">
                <Ruby text="{問題|もんだい}" />
                {String(current.no).padStart(3, '0')}
              </span>
            </div>
            <h2 className="kentei-question">
              <Ruby text={current.q} />
            </h2>
          </div>

          <div className="quiz-options kentei-options">
            {current.choices.map((opt, i) => {
              let cls = 'quiz-option kentei-option'
              if (picked !== null) {
                if (i === current.answer) cls += ' correct'
                else if (i === picked) cls += ' wrong'
                else cls += ' dim'
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => choose(i)}
                  disabled={picked !== null}
                >
                  <span className="kentei-num">{i + 1}</span>
                  <span className="kentei-text">
                    <Ruby text={opt} />
                  </span>
                  {picked !== null && i === current.answer && (
                    <span className="kentei-mark">⭕</span>
                  )}
                  {picked !== null && i === picked && i !== current.answer && (
                    <span className="kentei-mark">❌</span>
                  )}
                </button>
              )
            })}
          </div>

          {picked !== null && (
            <div
              ref={feedbackRef}
              className={'quiz-feedback' + (isCorrect ? ' ok' : ' ng')}
            >
              <div className="quiz-feedback-title">
                {isCorrect ? '🎉 せいかい！' : '😢 ざんねん…'}
              </div>
              <p>
                こたえは{' '}
                <b>
                  {current.answer + 1}．<Ruby text={current.choices[current.answer]} />
                </b>
              </p>
              <p className="kentei-explain">
                💡 <Ruby text={current.explain} />
              </p>
              <button className="btn btn-big" onClick={next}>
                {index + 1 >= questions.length ? (
                  <Ruby text="けっかを{見|み}る 🏁" />
                ) : (
                  'つぎへ ▶'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- けっか --- */}
      {phase === 'done' && (
        <>
          <div className="quiz-done">
            <div className="quiz-done-emoji">{rank.emoji}</div>
            <p className="kentei-done-level">
              <Ruby text={`{昆虫検定|こんちゅうけんてい} ${levelInfo.label}`} />
            </p>
            <h2>
              <Ruby text={rank.title} />
            </h2>
            <div className="quiz-final-score">
              {score} <span>/ {questions.length}てん</span>
            </div>

            <div className={'kentei-points' + (earned > 0 ? '' : ' zero')}>
              {earned > 0 ? (
                <>
                  🪙 <Ruby text="{虫|むし}" />
                  ポイント <b>+{finalPoints}P</b>
                  {roulette && roulette.mult > 1 && (
                    <small>（{earned}P {roulette.label}）</small>
                  )}
                </>
              ) : (
                <>
                  <Ruby text="{虫|むし}" />
                  ポイントは もらえなかった…
                </>
              )}
            </div>

            {perfect && earned > 0 && (
              <PointRoulette basePoints={earned} onResult={onRoulette} />
            )}

            {(!perfect || roulette) && (
              <div className="kentei-done-buttons">
                <button className="btn btn-big btn-primary" onClick={() => start(level)}>
                  もういちど <Ruby text={levelInfo.label} /> 🔄
                </button>
                <button className="btn btn-big" onClick={backToSelect}>
                  <Ruby text="{級|きゅう}" />
                  をえらびなおす
                </button>
              </div>
            )}
          </div>

          <div className="kentei-review">
            <h3>📝 ふりかえり</h3>
            <ol>
              {history.map((h, i) => {
                const ok = h.picked === h.question.answer
                return (
                  <li key={i} className={ok ? 'ok' : 'ng'}>
                    <span className="kentei-review-mark">{ok ? '⭕' : '❌'}</span>
                    <div>
                      <div className="kentei-review-q">
                        <Ruby text={h.question.q} />
                      </div>
                      <div className="kentei-review-a">
                        こたえ：{h.question.answer + 1}．
                        <Ruby text={h.question.choices[h.question.answer]} />
                        {!ok && (
                          <span className="kentei-review-picked">
                            （きみ：{h.picked + 1}．
                            <Ruby text={h.question.choices[h.picked]} />）
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
