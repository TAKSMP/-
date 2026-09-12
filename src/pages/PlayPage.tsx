import { useState } from 'react'
import type { CaughtBug } from '../types'
import { QuizPage } from './QuizPage'
import { BattlePage } from './BattlePage'
import { BattlePage2 } from './BattlePage2'
import { RacePage } from './RacePage'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Game = null | 'quiz' | 'battle' | 'battle2' | 'race'

// 「あそぶ」ページ。クイズと バトルの ゲームをえらべる。
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

  // あたらしい バトル（2たい2・わざ3つ・すばやさ・じょうたいいじょう）
  if (game === 'battle2') {
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
          <h1>⚔️ むしバトル 2たい2</h1>
          <p className="sub">わざ3つ・すばやさ・じょうたいいじょう つき！</p>
        </header>
        <BattlePage2 bugs={bugs} onGoCapture={onGoCapture} />
      </div>
    )
  }

  if (game === 'race') {
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
          <h1>🏁 むしレース</h1>
          <p className="sub">あつめた虫で かけっこ！</p>
        </header>
        <RacePage bugs={bugs} onGoCapture={onGoCapture} />
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
            setGame('battle2')
          }}
        >
          <span className="game-emoji">⚔️</span>
          <span className="game-title">バトル</span>
          <span className="game-desc">
            1たい1／2たい2！ わざ3つ・すばやさ・じょうたいいじょう
          </span>
        </button>
        <button
          className="game-card battle"
          onClick={() => {
            sfx.tap()
            setGame('battle')
          }}
        >
          <span className="game-emoji">🕹️</span>
          <span className="game-title">バトル（まえのばん）</span>
          <span className="game-desc">
            くらべる ため のこしてあります（あとで けします）
          </span>
        </button>
        <button
          className="game-card race"
          onClick={() => {
            sfx.tap()
            setGame('race')
          }}
        >
          <span className="game-emoji">🏁</span>
          <span className="game-title">レース</span>
          <span className="game-desc">虫たちで かけっこ！ だれが 1いかな</span>
        </button>
      </div>
    </div>
  )
}
