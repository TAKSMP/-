import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { Confetti } from '../components/Confetti'
import { mainPhoto } from '../lib/storage'
import { sfx } from '../lib/sound'

const QUESTION_COUNT = 10

type QKind = 'name' | 'habitat' | 'order'

interface Question {
  kind: QKind
  photo: string
  bugName: string
  order: string
  habitat: string
  fact?: string
  prompt: string
  options: string[]
  answer: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((x) => x && x !== 'ふめい')))
}

// 正解＋まちがい選択肢（最大4つ）をつくる
function makeOptions(answer: string, pool: string[]): string[] {
  const distractors = shuffle(pool.filter((x) => x !== answer)).slice(0, 3)
  return shuffle([answer, ...distractors])
}

// 発見ずみの虫だけからクイズをつくる
function buildQuiz(bugs: CaughtBug[]): Question[] {
  const names = uniq(bugs.map((b) => b.name))
  const orders = uniq(bugs.map((b) => b.order))
  const habitats = uniq(bugs.map((b) => b.habitat))

  // つかえる問題タイプ（選択肢が2つ以上つくれるもの）
  const usable: QKind[] = []
  if (names.length >= 2) usable.push('name')
  if (orders.length >= 2) usable.push('order')
  if (habitats.length >= 2) usable.push('habitat')
  if (usable.length === 0) return []

  const questions: Question[] = []
  let guard = 0
  while (questions.length < QUESTION_COUNT && guard < 500) {
    guard++
    const bug = bugs[Math.floor(Math.random() * bugs.length)]
    // この虫でつかえるタイプ（値がちゃんとあるもの）にしぼる
    const kinds = usable.filter((k) => {
      if (k === 'name') return true
      if (k === 'order') return bug.order && bug.order !== 'ふめい'
      return bug.habitat && bug.habitat !== 'ふめい'
    })
    if (kinds.length === 0) continue
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    const photo = mainPhoto(bug)

    let prompt: string
    let options: string[]
    let answer: string
    if (kind === 'name') {
      answer = bug.name
      options = makeOptions(answer, names)
      prompt = 'この虫の なまえは？'
    } else if (kind === 'order') {
      answer = bug.order
      options = makeOptions(answer, orders)
      prompt = `「${bug.name}」は なに目（もく）？`
    } else {
      answer = bug.habitat
      options = makeOptions(answer, habitats)
      prompt = `「${bug.name}」は どこにいる？`
    }
    if (options.length < 2) continue

    questions.push({
      kind,
      photo,
      bugName: bug.name,
      order: bug.order,
      habitat: bug.habitat,
      fact: bug.fact,
      prompt,
      options,
      answer,
    })
  }
  return questions
}

function rankOf(score: number): { emoji: string; title: string } {
  const pct = score / QUESTION_COUNT
  if (pct === 1) return { emoji: '👑', title: 'むしはかせ マスター！' }
  if (pct >= 0.8) return { emoji: '🏆', title: 'むしめいじん！' }
  if (pct >= 0.5) return { emoji: '🌟', title: 'なかなかやるね！' }
  if (pct >= 0.2) return { emoji: '🐛', title: 'これからだね！' }
  return { emoji: '🌱', title: 'またチャレンジしよう！' }
}

type Phase = 'start' | 'playing' | 'done'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

export function QuizPage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('start')
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)

  // クイズをつくれるか（虫が2しゅるい以上あるか）
  const canQuiz = useMemo(() => buildQuiz(bugs).length > 0, [bugs])

  const current = questions[index]
  const isCorrect = picked !== null && picked === current?.answer

  function start() {
    const q = buildQuiz(bugs)
    if (q.length === 0) return
    sfx.tap()
    setQuestions(q)
    setIndex(0)
    setScore(0)
    setStreak(0)
    setPicked(null)
    setPhase('playing')
  }

  function choose(option: string) {
    if (picked !== null) return
    setPicked(option)
    if (option === current.answer) {
      setScore((s) => s + 1)
      setStreak((s) => s + 1)
      sfx.discover()
      setConfetti(true)
      setTimeout(() => setConfetti(false), 150)
    } else {
      setStreak(0)
      sfx.error()
    }
  }

  function next() {
    sfx.tap()
    if (index + 1 >= questions.length) {
      setPhase('done')
      sfx.discover()
      setConfetti(true)
      setTimeout(() => setConfetti(false), 150)
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
  }

  const rank = useMemo(() => rankOf(score), [score])

  return (
    <div className="page quiz">
      <Confetti show={confetti} />

      <header className="page-head">
        <h1>🧠 むしクイズ</h1>
        <p className="sub">あつめた虫から しゅつだい！</p>
      </header>

      {/* --- スタート画面 --- */}
      {phase === 'start' && (
        <div className="quiz-start">
          <div className="quiz-start-emoji">🐞❓</div>
          {canQuiz ? (
            <>
              <p>
                きみが 図鑑に あつめた虫から、
                <br />
                ぜんぶで{QUESTION_COUNT}もんの クイズだよ！
              </p>
              <button className="btn btn-big btn-primary" onClick={start}>
                スタート ▶
              </button>
            </>
          ) : (
            <>
              <p>
                クイズを するには、虫を
                <br />
                <b>2しゅるい いじょう</b> あつめてね！
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
            </>
          )}
        </div>
      )}

      {/* --- クイズちゅう --- */}
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

          <div className="quiz-card">
            {current.photo ? (
              <img className="quiz-photo" src={current.photo} alt="クイズの虫" />
            ) : (
              <div className="quiz-emoji">🐛</div>
            )}
            <h2 className="quiz-prompt">{current.prompt}</h2>
            {current.kind === 'name' && (
              <p className="quiz-hint">
                ヒント: {current.order}・{current.habitat}
              </p>
            )}
          </div>

          <div className="quiz-options">
            {current.options.map((opt) => {
              let cls = 'quiz-option'
              if (picked !== null) {
                if (opt === current.answer) cls += ' correct'
                else if (opt === picked) cls += ' wrong'
                else cls += ' dim'
              }
              return (
                <button
                  key={opt}
                  className={cls}
                  onClick={() => choose(opt)}
                  disabled={picked !== null}
                >
                  {opt}
                  {picked !== null && opt === current.answer && ' ⭕'}
                  {picked !== null &&
                    opt === picked &&
                    opt !== current.answer &&
                    ' ❌'}
                </button>
              )
            })}
          </div>

          {picked !== null && (
            <div className={'quiz-feedback' + (isCorrect ? ' ok' : ' ng')}>
              <div className="quiz-feedback-title">
                {isCorrect ? '🎉 せいかい！' : '😢 ざんねん…'}
              </div>
              <p>
                こたえは <b>{current.answer}</b>
              </p>
              {current.fact && <p className="quiz-fact">💡 {current.fact}</p>}
              <button className="btn btn-big" onClick={next}>
                {index + 1 >= questions.length ? 'けっかを見る 🏁' : 'つぎへ ▶'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- けっか画面 --- */}
      {phase === 'done' && (
        <div className="quiz-done">
          <div className="quiz-done-emoji">{rank.emoji}</div>
          <h2>{rank.title}</h2>
          <div className="quiz-final-score">
            {score} <span>/ {questions.length}てん</span>
          </div>
          <button className="btn btn-big btn-primary" onClick={start}>
            もういちど 🔄
          </button>
        </div>
      )}
    </div>
  )
}
