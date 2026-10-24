import { useState, type ReactNode } from 'react'
import type { CaughtBug } from '../types'
import { QuizPage } from './QuizPage'
import { BattlePage } from './BattlePage'
import { BattlePage2 } from './BattlePage2'
import { StoryPage } from './StoryPage'
import { RacePage } from './RacePage'
import { RacePageOld } from './RacePageOld'
import { NetBattlePage } from './NetBattlePage'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

// ゲーム → クイズ／ストーリー／バトル／レース。
// バトルの なかは → 1たい1／2たい2／まえのばん／つうしんバトル
type Game =
  | null
  | 'quiz'
  | 'story'
  | 'battleMenu'
  | 'battle1'
  | 'battle2'
  | 'battleOld'
  | 'net'
  | 'race'
  | 'raceOld'

// 「ゲーム」ページ。クイズ・ストーリー・バトル・レースを えらべる。
export function PlayPage({ bugs, onGoCapture }: Props) {
  const [game, setGame] = useState<Game>(null)

  function go(g: Game) {
    sfx.tap()
    setGame(g)
  }

  // もどる ボタンと みだし つきの ページわく
  function frame(back: Game, backLabel: string, head: ReactNode, body: ReactNode) {
    return (
      <div className="page play">
        <button className="btn btn-ghost play-back" onClick={() => go(back)}>
          ← {backLabel} に もどる
        </button>
        {head}
        {body}
      </div>
    )
  }
  const header = (title: string, sub: string) => (
    <header className="page-head">
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
    </header>
  )

  if (game === 'quiz') {
    return frame(null, 'ゲーム', null, <QuizPage bugs={bugs} onGoCapture={onGoCapture} />)
  }

  // ストーリーモード（マップを すすんで ゴールを めざす）
  if (game === 'story') {
    return frame(
      null,
      'ゲーム',
      header('🗺️ ストーリー', 'マップを すすんで ゴールを めざそう！'),
      <StoryPage bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  // バトルの メニュー
  if (game === 'battleMenu') {
    const canTwo = bugs.length >= 4
    return frame(
      null,
      'ゲーム',
      header('⚔️ バトル', 'どの バトルを する？'),
      <div className="game-menu">
        <button className="game-card battle" onClick={() => go('battle1')}>
          <span className="game-emoji vs">🐛 VS 🐛</span>
          <span className="game-title">1たい1</span>
          <span className="game-desc">1ぴきずつ たたかう</span>
        </button>
        <button className="game-card battle" disabled={!canTwo} onClick={() => go('battle2')}>
          <span className="game-emoji vs">🐛🐛 VS 🐛🐛</span>
          <span className="game-title">2たい2</span>
          <span className="game-desc">
            {canTwo ? '2ひきずつ チームで たたかう' : '虫が 4ひき あつまったら できるよ'}
          </span>
        </button>
        <button className="game-card battle" onClick={() => go('battleOld')}>
          <span className="game-emoji">🕹️</span>
          <span className="game-title">まえのばん</span>
          <span className="game-desc">くらべる ため のこしてあります（あとで けします）</span>
        </button>
        <button className="game-card battle" onClick={() => go('net')}>
          <span className="game-emoji">📡</span>
          <span className="game-title">つうしんバトル</span>
          <span className="game-desc">そだてた虫を たたかわせよう</span>
        </button>
      </div>,
    )
  }

  if (game === 'battle1') {
    return frame(
      'battleMenu',
      'バトル',
      header('⚔️ むしバトル 1たい1', 'わざ3つ・すばやさ・じょうたいいじょう つき！'),
      <BattlePage2 key="b1" mode={1} bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  if (game === 'battle2') {
    return frame(
      'battleMenu',
      'バトル',
      header('⚔️ むしバトル 2たい2', 'わざ3つ・すばやさ・じょうたいいじょう つき！'),
      <BattlePage2 key="b2" mode={2} bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  if (game === 'battleOld') {
    return frame(
      'battleMenu',
      'バトル',
      header('⚔️ むしバトル（まえのばん）', 'あつめた虫で たいせん！'),
      <BattlePage bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  if (game === 'net') {
    return frame(
      'battleMenu',
      'バトル',
      header('📡 つうしんバトル', 'そだてた虫を たたかわせよう'),
      <NetBattlePage bugs={bugs} />,
    )
  }

  if (game === 'race') {
    return frame(
      null,
      'ゲーム',
      header('🏁 こうえんレース', 'そだてた虫で こうえんの コースを きょうそう！'),
      <>
        <RacePage bugs={bugs} onGoCapture={onGoCapture} />
        <button className="btn btn-ghost play-old-link" onClick={() => go('raceOld')}>
          🐌 まえのばんの レース
        </button>
      </>,
    )
  }

  if (game === 'raceOld') {
    return frame(
      'race',
      'レース',
      header('🏁 むしレース（まえのばん）', 'あつめた虫で かけっこ！'),
      <RacePageOld bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  return (
    <div className="page play">
      <header className="page-head">
        <h1>🎮 ゲーム</h1>
        <p className="sub">あつめた虫で ゲームしよう！</p>
      </header>
      <div className="game-menu">
        <button className="game-card quiz" onClick={() => go('quiz')}>
          <span className="game-emoji">🧠</span>
          <span className="game-title">クイズ</span>
          <span className="game-desc">虫の なまえや ひみつを あてよう</span>
        </button>
        <button className="game-card story" onClick={() => go('story')}>
          <span className="game-emoji">🗺️</span>
          <span className="game-title">ストーリー</span>
          <span className="game-desc">マップを すすんで ゴールへ！ たおすと レベルアップ</span>
        </button>
        <button className="game-card battle" onClick={() => go('battleMenu')}>
          <span className="game-emoji">⚔️</span>
          <span className="game-title">バトル</span>
          <span className="game-desc">1たい1／2たい2／つうしんバトル</span>
        </button>
        <button className="game-card race" onClick={() => go('race')}>
          <span className="game-emoji">🏁</span>
          <span className="game-title">レース</span>
          <span className="game-desc">
            こうえんの コースを 6ぴきで きょうそう！ アクセルと わざで 1いを めざせ
          </span>
        </button>
      </div>
    </div>
  )
}
