import { useEffect, useState, type ReactNode } from 'react'
import type { CaughtBug } from '../types'
import { QuizPage } from './QuizPage'
import { BattleQuizPage } from './BattleQuizPage'
import { BattlePage } from './BattlePage'
import { BattlePage2 } from './BattlePage2'
import { StoryPage } from './StoryPage'
import { DojoPage } from './DojoPage'
import { RacePage } from './RacePage'
import { RacePageOld } from './RacePageOld'
import { NetBattlePage } from './NetBattlePage'
import { sfx } from '../lib/sound'
import { guardLock } from '../lib/childLock'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
  onActiveChange?: (lockKey: string | null) => void // いま あそんでいる ゲーム（チャイルドロック用）
  resetSignal?: number // かわったら ゲームの メニューに もどる
}

// 画面（Game）→ チャイルドロックの 項目キー（メニューは null）
const LOCK_KEY: Partial<Record<string, string>> = {
  quiz: 'quiz', battleQuiz: 'battleQuiz', story: 'story', dojo: 'dojo', dojoAdult: 'dojoAdult',
  battle: 'battle', battleOld: 'battleOld', net: 'net', race: 'race', raceOld: 'raceOld',
}

// ゲーム → クイズ／ストーリー（ストーリーモード／わざ道場）／バトル／レース。
// バトルの なかは → 1たい1／2たい2／まえのばん／つうしんバトル
type Game =
  | null
  | 'quizMenu'
  | 'quiz'
  | 'battleQuiz'
  | 'storyMenu'
  | 'story'
  | 'dojo'
  | 'dojoAdult'
  | 'battleMenu'
  | 'battle'
  | 'battleOld'
  | 'net'
  | 'race'
  | 'raceOld'

// 「ゲーム」ページ。クイズ・ストーリー・バトル・レースを えらべる。
export function PlayPage({ bugs, onGoCapture, onActiveChange, resetSignal }: Props) {
  const [game, setGame] = useState<Game>(null)

  function go(g: Game) {
    // ロック中の ゲームは ひらけない（「また あそぼうね」を だす）
    if (g && !guardLock(LOCK_KEY[g])) return
    sfx.tap()
    setGame(g)
  }

  useEffect(() => {
    onActiveChange?.((game && LOCK_KEY[game]) || null)
  }, [game, onActiveChange])
  useEffect(() => {
    if (resetSignal) setGame(null)
  }, [resetSignal])

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
  const header = (title: ReactNode, sub: string) => (
    <header className="page-head">
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
    </header>
  )

  // クイズ → むしクイズ／バトルクイズ
  if (game === 'quizMenu') {
    return frame(
      null,
      'ゲーム',
      header('🧠 クイズ', 'どっちの クイズに する？'),
      <div className="game-menu">
        <button className="game-card quiz" onClick={() => go('quiz')}>
          <span className="game-emoji">🐞❓</span>
          <span className="game-title">むしクイズ</span>
          <span className="game-desc">虫の なまえや ひみつを あてよう</span>
        </button>
        <button className="game-card battle" onClick={() => go('battleQuiz')}>
          <span className="game-emoji">⚔️❓</span>
          <span className="game-title">バトルクイズ</span>
          <span className="game-desc">バトルの ばめんで いちばん いい わざを えらぼう！</span>
        </button>
      </div>,
    )
  }

  if (game === 'quiz') {
    return frame('quizMenu', 'クイズ', null, <QuizPage bugs={bugs} onGoCapture={onGoCapture} />)
  }

  if (game === 'battleQuiz') {
    return frame(
      'quizMenu',
      'クイズ',
      header('⚔️ バトルクイズ', 'この ばめん、どの わざを つかう？'),
      <BattleQuizPage bugs={bugs} />,
    )
  }

  // ストーリー → ストーリーモード／わざ道場
  if (game === 'storyMenu') {
    return frame(
      null,
      'ゲーム',
      header('🗺️ ストーリー', 'どっちに いく？'),
      <div className="game-menu">
        <button className="game-card story" onClick={() => go('story')}>
          <span className="game-emoji">🗺️</span>
          <span className="game-title">ストーリーモード</span>
          <span className="game-desc">マップを すすんで ゴールへ！ たおすと レベルアップ</span>
        </button>
        <button className="game-card dojo" onClick={() => go('dojo')}>
          <span className="game-emoji">🥋</span>
          <span className="game-title">わざ<ruby>道場<rt>どうじょう</rt></ruby></span>
          <span className="game-desc">えいごの テストで わざを おぼえる・きたえる</span>
        </button>
        <button className="game-card dojo" onClick={() => go('dojoAdult')}>
          <span className="game-emoji">🌺</span>
          <span className="game-title">わざ道場（おとな）</span>
          <span className="game-desc">ハワイ旅行で つかう 英会話の テスト（むずかしい）</span>
        </button>
      </div>,
    )
  }

  // ストーリーモード（マップを すすんで ゴールを めざす）
  if (game === 'story') {
    return frame(
      'storyMenu',
      'ストーリー',
      header('🗺️ ストーリーモード', 'マップを すすんで ゴールを めざそう！'),
      <StoryPage bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  // わざ道場
  if (game === 'dojo') {
    return frame(
      'storyMenu',
      'ストーリー',
      header(<>🥋 わざ<ruby>道場<rt>どうじょう</rt></ruby></>, 'えいごを がんばって つよくなろう！'),
      <DojoPage bugs={bugs} />,
    )
  }

  // わざ道場（おとな）：ハワイ旅行の えいかいわ
  if (game === 'dojoAdult') {
    return frame(
      'storyMenu',
      'ストーリー',
      header('🌺 わざ道場（おとな）', 'ハワイ旅行で つかう 英会話'),
      <DojoPage bugs={bugs} variant="adult" />,
    )
  }

  // バトルの メニュー
  if (game === 'battleMenu') {
    return frame(
      null,
      'ゲーム',
      header('⚔️ バトル', 'どの バトルを する？'),
      <>
        <div className="game-menu">
          <button className="game-card battle" onClick={() => go('battle')}>
            <span className="game-emoji vs">🐛 VS 🐛</span>
            <span className="game-title">むしバトル</span>
            <span className="game-desc">1ぴき〜4ひきずつ。かずは じぶんで きめられる</span>
          </button>
          <button className="game-card battle" onClick={() => go('net')}>
            <span className="game-emoji">📡</span>
            <span className="game-title">つうしんバトル</span>
            <span className="game-desc">そだてた虫を たたかわせよう</span>
          </button>
        </div>
        {/* レースの「まえのばん」と おなじく、いちばん したに ちいさく */}
        <button className="btn btn-ghost play-old-link" onClick={() => go('battleOld')}>
          🕹️ まえのばん
        </button>
      </>,
    )
  }

  if (game === 'battle') {
    return frame(
      'battleMenu',
      'バトル',
      header('⚔️ むしバトル', 'さいだい 4たい4！ わざ3つ・すばやさ・じょうたいいじょう つき'),
      <BattlePage2 bugs={bugs} onGoCapture={onGoCapture} />,
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
        <button className="game-card quiz" onClick={() => go('quizMenu')}>
          <span className="game-emoji">🧠</span>
          <span className="game-title">クイズ</span>
          <span className="game-desc">むしクイズ／バトルクイズ</span>
        </button>
        <button className="game-card story" onClick={() => go('storyMenu')}>
          <span className="game-emoji">🗺️</span>
          <span className="game-title">ストーリー</span>
          <span className="game-desc">マップを すすんで ゴールへ！ たおすと レベルアップ</span>
        </button>
        <button className="game-card battle" onClick={() => go('battleMenu')}>
          <span className="game-emoji">⚔️</span>
          <span className="game-title">バトル</span>
          <span className="game-desc">さいだい 4たい4／つうしんバトル</span>
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
