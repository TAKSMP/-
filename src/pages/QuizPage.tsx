import { useMemo, useState } from 'react'
import type { BugSpecies } from '../types'
import { ALL_HABITATS, ALL_ORDERS, BUG_SPECIES } from '../data/bugs'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

const QUESTION_COUNT = 10

type QKind = 'name' | 'habitat' | 'order'

interface Question {
  kind: QKind
  species: BugSpecies
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

// まちがいの選択肢（distractor）を、正解いがいから3つえらぶ
function pickDistractors(all: string[], answer: string, n: number): string[] {
  const pool = shuffle(all.filter((x) => x !== answer))
  return pool.slice(0, n)
}

function makeQuestion(): Question {
  const species = BUG_SPECIES[Math.floor(Math.random() * BUG_SPECIES.length)]
  const kinds: QKind[] = ['name', 'habitat', 'order']
  const kind = kinds[Math.floor(Math.random() * kinds.length)]

  if (kind === 'name') {
    const answer = species.name
    const options = shuffle([
      answer,
      ...pickDistractors(
        BUG_SPECIES.map((b) => b.name),
        answer,
        3,
      ),
    ])
    return {
      kind,
      species,
      prompt: 'この虫のなまえは、なあに？',
      options,
      answer,
    }
  }

  if (kind === 'habitat') {
    const answer = species.habitat
    const options = shuffle([
      answer,
      ...pickDistractors(ALL_HABITATS, answer, 3),
    ])
    return {
      kind,
      species,
      prompt: `「${species.name}」は どこにいるかな？`,
      options,
      answer,
    }
  }

  // order
  const answer = species.order
  const options = shuffle([answer, ...pickDistractors(ALL_ORDERS, answer, 3)])
  return {
    kind,
    species,
    prompt: `「${species.name}」は なに目（もく）？`,
    options,
    answer,
  }
}

function makeQuiz(): Question[] {
  return Array.from({ length: QUESTION_COUNT }, () => makeQuestion())
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

export function QuizPage() {
  const [phase, setPhase] = useState<Phase>('start')
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)

  const current = questions[index]
  const isCorrect = picked !== null && picked === current?.answer

  function start() {
    sfx.tap()
    setQuestions(makeQuiz())
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
        <p className="sub">虫はかせを めざそう！</p>
      </header>

      {/* --- スタート画面 --- */}
      {phase === 'start' && (
        <div className="quiz-start">
          <div className="quiz-start-emoji">🐞❓</div>
          <p>
            虫のなまえ・目（もく）・生息地の
            <br />
            ぜんぶで{QUESTION_COUNT}もんのクイズだよ！
          </p>
          <button className="btn btn-big btn-primary" onClick={start}>
            スタート ▶
          </button>
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
            <div className="quiz-emoji">{current.species.emoji}</div>
            <h2 className="quiz-prompt">{current.prompt}</h2>
            {current.kind === 'name' && (
              <p className="quiz-hint">
                ヒント: {current.species.order}・{current.species.habitat}にいるよ
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
                  {picked !== null && opt === picked && opt !== current.answer && ' ❌'}
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
                こたえは <b>{current.answer}</b>（{current.species.name}）
              </p>
              <p className="quiz-fact">💡 {current.species.fact}</p>
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
