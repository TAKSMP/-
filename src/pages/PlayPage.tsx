import { useEffect, useState, type ReactNode } from 'react'
import type { CaughtBug } from '../types'
import { QuizPage } from './QuizPage'
import { BattleQuizPage } from './BattleQuizPage'
import { KenteiPage } from './KenteiPage'
import { ShopPage } from './ShopPage'
import { BattlePage } from './BattlePage'
import { BattlePage2 } from './BattlePage2'
import { StoryPage } from './StoryPage'
import { DojoPage } from './DojoPage'
import { RacePage } from './RacePage'
import { RacePageOld } from './RacePageOld'
import { NetBattlePage } from './NetBattlePage'
import { CardGamePage } from './CardGamePage'
import { PageOnePage } from './PageOnePage'
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
  quiz: 'quiz', battleQuiz: 'battleQuiz', kentei: 'kentei', shop: 'shop', story: 'story', dojo: 'dojo', dojoAdult: 'dojoAdult', dojoChouchou: 'dojoChouchou',
  battle: 'battle', battleOld: 'battleOld', net: 'net', race: 'race', raceOld: 'raceOld', cardGame: 'cardGame', pageOne: 'pageOne',
}

// ゲーム → クイズ／ストーリー（ストーリーモード／わざ道場）／バトル／レース。
// バトルの なかは → 1たい1／2たい2／まえのばん／つうしんバトル
type Game =
  | null
  | 'quizMenu'
  | 'quiz'
  | 'battleQuiz'
  | 'kentei'
  | 'storyMenu'
  | 'story'
  | 'dojo'
  | 'dojoAdult'
  | 'dojoChouchou'
  | 'battleMenu'
  | 'battle'
  | 'battleOld'
  | 'net'
  | 'race'
  | 'raceOld'
  | 'shop'
  | 'cardMenu'
  | 'cardGame'
  | 'pageOne'

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
        <button className="game-card kentei" onClick={() => go('kentei')}>
          <span className="game-emoji">📜</span>
          <span className="game-title">
            <ruby>昆虫検定<rt>こんちゅうけんてい</rt></ruby>
          </span>
          <span className="game-desc">
            <ruby>初級<rt>しょきゅう</rt></ruby>・<ruby>中級<rt>ちゅうきゅう</rt></ruby>から 10もん！ せいかいで 虫ポイント
          </span>
        </button>
      </div>,
    )
  }

  // 昆虫検定（初級・中級の問題集から、まだ 出ていない もんだいを 10もん）
  if (game === 'kentei') {
    return frame('quizMenu', 'クイズ', null, <KenteiPage />)
  }

  // ちょうむしショップ（虫ポイントで アメ・まきものと こうかん）
  if (game === 'shop') {
    return frame(null, 'ゲーム', null, <ShopPage bugs={bugs} onGoCapture={onGoCapture} />)
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
        <button className="game-card dojo-chouchou-card" onClick={() => go('dojoChouchou')}>
          <span className="game-emoji">🦋</span>
          <span className="game-title">チョウチョちゃん<ruby>道場<rt>どうじょう</rt></ruby></span>
          <span className="game-desc">さいきょうわざより つよい「アルティメットわざ」を おぼえる</span>
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

  // チョウチョちゃん道場：アルティメットわざを おぼえる
  if (game === 'dojoChouchou') {
    return frame(
      'storyMenu',
      'ストーリー',
      header(<>🦋 チョウチョちゃん<ruby>道場<rt>どうじょう</rt></ruby></>, 'さいきょうわざより つよい わざを おぼえよう！'),
      <DojoPage bugs={bugs} chouchou />,
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

  // カードゲームの メニュー（カードバトル／ページワン）
  if (game === 'cardMenu') {
    return frame(
      null,
      'ゲーム',
      header('🃏 カードゲーム', 'どの ゲームで あそぶ？'),
      <div className="game-menu">
        <button className="game-card battle" onClick={() => go('cardGame')}>
          <span className="game-emoji">⚔️</span>
          <span className="game-title">ちょうむしカードバトル</span>
          <span className="game-desc">デッキ 4まいで たいせん！ コンピューターや ともだちと</span>
        </button>
        <button className="game-card quiz" onClick={() => go('pageOne')}>
          <span className="game-emoji">🃏</span>
          <span className="game-title">ちょうむしページワン</span>
          <span className="game-desc">おなじ 目 か おなじ たいりょく なら だせる！ みんなで あそべる</span>
        </button>
      </div>,
    )
  }

  // ちょうむしカードバトル（紙の カードゲームと おなじ ルール）
  if (game === 'cardGame') {
    return frame(
      'cardMenu',
      'カードゲーム',
      header('⚔️ ちょうむしカードバトル', 'デッキ 4まいで たいせん！'),
      <CardGamePage bugs={bugs} onGoCapture={onGoCapture} />,
    )
  }

  if (game === 'pageOne') {
    return frame(
      'cardMenu',
      'カードゲーム',
      header('🃏 ちょうむしページワン', 'おなじ 目 か おなじ たいりょく なら だせる！'),
      <PageOnePage bugs={bugs} onGoCapture={onGoCapture} />,
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

  // メニュー：見出しは 出さず、その ぶん カードを つめて 1がめんに たくさん 見える ように する
  return (
    <div className="page play play-menu">
      <div className="game-menu">
        <button className="game-card quiz" onClick={() => go('quizMenu')}>
          <span className="game-emoji">🧠</span>
          <span className="game-title">クイズ</span>
          <span className="game-desc">むしクイズ／バトルクイズ／昆虫検定</span>
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
        <button className="game-card battle" onClick={() => go('cardMenu')}>
          <span className="game-emoji">🃏</span>
          <span className="game-title">カードゲーム</span>
          <span className="game-desc">カードバトル と ページワン。図鑑の 虫が カードに！</span>
        </button>
        <button className="game-card race" onClick={() => go('race')}>
          <span className="game-emoji">🏁</span>
          <span className="game-title">レース</span>
          <span className="game-desc">
            こうえんの コースを 6ぴきで きょうそう！ アクセルと わざで 1いを めざせ
          </span>
        </button>
        <button className="game-card shop" onClick={() => go('shop')}>
          <span className="game-emoji">🏪</span>
          <span className="game-title">ちょうむしショップ</span>
          <span className="game-desc">虫ポイントで ふしぎなアメや まきものと こうかん</span>
        </button>
      </div>
    </div>
  )
}
