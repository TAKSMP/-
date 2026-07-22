import { useState } from 'react'
import type { CaughtBug } from '../types'
import { QuizPage } from './QuizPage'
import { BattlePage } from './BattlePage'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Game = null | 'quiz' | 'battle'

// 「あそぶ」ページ。クイズと バトルの 2つのゲームをえらべる。
export function PlayPage({ bugs, onGoCapture }: Props) {
  const [game, setGame] = useState<Game>(null)

  if (game === 'quiz') {
    return (
      <div className="page play">
        <button
          className="btn btn-ghost play-back"
          onClick={() => {
            sfx.tap()
            setGame(null)
          }}
        >
          ← あそぶ に もどる
        </button>
        <QuizPage bugs={bugs} onGoCapture={onGoCapture} />
      </div>
    )
  }

  if (game === 'battle') {
    return (
      <div className="page play">
        <button
          className="btn btn-ghost play-back"
          onClick={() => {
            sfx.tap()
            setGame(null)
          }}
        >
          ← あそぶ に もどる
        </button>
        <header className="page-head">
          <h1>⚔️ むしバトル</h1>
          <p className="sub">あつめた虫で たいせん！</p>
        </header>
        <BattlePage bugs={bugs} onGoCapture={onGoCapture} />
      </div>
    )
  }

  return (
    <div className="page play">
      <header className="page-head">
        <h1>🎮 あそぶ</h1>
        <p className="sub">あつめた虫で ゲームしよう！</p>
      </header>
      <div className="game-menu">
        <button
          className="game-card quiz"
          onClick={() => {
            sfx.tap()
            setGame('quiz')
          }}
        >
          <span className="game-emoji">🧠</span>
          <span className="game-title">クイズ</span>
          <span className="game-desc">虫の なまえや ひみつを あてよう</span>
        </button>
        <button
          className="game-card battle"
          onClick={() => {
            sfx.tap()
            setGame('battle')
          }}
        >
          <span className="game-emoji">⚔️</span>
          <span className="game-title">バトル</span>
          <span className="game-desc">虫どうしで たいせん！ ひっさつわざで かとう</span>
        </button>
      </div>
    </div>
  )
}
