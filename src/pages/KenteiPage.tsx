import { useEffect, useMemo, useRef, useState } from 'react'
import { Confetti } from '../components/Confetti'
import { Ruby } from '../components/Ruby'
import { PointRoulette, type RouletteSlot } from '../components/PointRoulette'
import { sfx } from '../lib/sound'
import { addPoints } from '../lib/points'
import { drawQuestions, progressOf, saveAnswer } from '../lib/kenteiDeck'
import {
  KENTEI,
  KENTEI_SECTIONS,
  type KenteiLevel,
  type KenteiQuestion,
} from '../data/kentei'

// 昆虫検定：初級・中級の問題集から 10もん。ぜんぶを まんべんなく、まちがえた もんだいほど よく 出す
// （えらびかたは lib/kenteiDeck.ts）。
// せいかいすると 虫ポイント（初級 1もん 1P、中級 1もん 3P、MIX 1もん 5P）。ぜんもん せいかいで ルーレット。
// MIX は 初級と 中級から 5もんずつ えらんで、ランダムな じゅんばんで 出す。
const QUESTION_COUNT = 10

type Mode = KenteiLevel | 'mix'
// 出す もんだい（どの 級の もんだいか も もつ）
type PlayQ = KenteiQuestion & { lv: KenteiLevel }

const LEVEL_LABEL: Record<KenteiLevel, string> = {
  beginner: '{初級|しょきゅう}',
  intermediate: '{中級|ちゅうきゅう}',
}

const LEVELS: {
  id: Mode
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
  {
    id: 'mix',
    label: '{初級|しょきゅう}・{中級|ちゅうきゅう}MIX',
    emoji: '🌈',
    desc: '{初級|しょきゅう}と {中級|ちゅうきゅう}が はんぶんずつ、ランダムに {出|で}るよ！',
    pointsPer: 5,
  },
]

// 2つの 列を まぜて ランダムな じゅんばんに する
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
  question: PlayQ
  picked: number
}

export function KenteiPage() {
  const [phase, setPhase] = useState<Phase>('select')
  const [level, setLevel] = useState<Mode>('beginner')
  const [questions, setQuestions] = useState<PlayQ[]>([])
  // 級ごとの この 回の ばんごう（こたえの きろくに つかう）と、まえに まちがえて もういちど 出す もんだい（"級:ばんごう"）
  const [rounds, setRounds] = useState<Record<KenteiLevel, number>>({ beginner: 0, intermediate: 0 })
  const [review, setReview] = useState<Set<string>>(new Set())
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

  const score = history.filter((h) => h.picked === h.question.answer).length
  const isCorrect = current != null && picked === current.answer
  const levelInfo = LEVELS.find((l) => l.id === level)!
  const rank = useMemo(() => rankOf(score, questions.length), [score, questions.length])
  const perfect = phase === 'done' && questions.length > 0 && score === questions.length
  const finalPoints = roulette ? Math.round(earned * roulette.mult) : earned

  function start(lv: Mode) {
    sfx.tap()
    setLevel(lv)
    // MIX は 初級・中級から 5もんずつ（5:5）。どちらも いつもの えらびかた（にがてを よく 出す）で えらぶ
    const parts: { lv: KenteiLevel; count: number }[] =
      lv === 'mix'
        ? [
            { lv: 'beginner', count: QUESTION_COUNT / 2 },
            { lv: 'intermediate', count: QUESTION_COUNT / 2 },
          ]
        : [{ lv, count: QUESTION_COUNT }]
    const nextRounds = { ...rounds }
    const nextReview = new Set<string>()
    let qs: PlayQ[] = []
    for (const part of parts) {
      const d = drawQuestions(part.lv, KENTEI[part.lv], part.count)
      nextRounds[part.lv] = d.round
      d.review.forEach((no) => nextReview.add(`${part.lv}:${no}`))
      qs = qs.concat(d.questions.map((q) => ({ ...q, lv: part.lv })))
    }
    setQuestions(lv === 'mix' ? shuffle(qs) : qs)
    setRounds(nextRounds)
    setReview(nextReview)
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
    // こたえる たびに きろく（にがてな もんだいを また 出す ため）
    saveAnswer(current.lv, current.no, i === current.answer, rounds[current.lv])
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
              ・ぜんぶで
              {level === 'mix'
                ? KENTEI.beginner.length + KENTEI.intermediate.length
                : KENTEI[level].length}
              もんから 10もん
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
              {lv.id === 'mix' ? (
                <span className="kentei-level-count">
                  <span>🐞 5もん ＋ 🦋 5もん</span>
                </span>
              ) : (
                <LevelProgress level={lv.id} />
              )}
              <span className="kentei-level-pt">せいかい 1もん {lv.pointsPer}P</span>
            </button>
          ))}
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
              <span className={'kentei-tag lv ' + current.lv}>
                <Ruby text={LEVEL_LABEL[current.lv]} />
              </span>
              <span className="kentei-tag">
                <Ruby text={sectionOf(current.lv, current.no)} />
              </span>
              {review.has(`${current.lv}:${current.no}`) && (
                <span className="kentei-tag again">🔁 もういちど</span>
              )}
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

// 級えらびの カードに 出す「おぼえた・にがて・まだ」
function LevelProgress({ level }: { level: KenteiLevel }) {
  const p = progressOf(level, KENTEI[level])
  return (
    <span className="kentei-level-count">
      <span>⭐ おぼえた {p.mastered}</span>
      <span>🔁 にがて {p.weak}</span>
      <span>❓ まだ {p.unseen}</span>
    </span>
  )
}
