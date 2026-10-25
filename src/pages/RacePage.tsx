// =============================================================
//  こうえんレース
// -------------------------------------------------------------
//  うえから みた こうえんの コースを、2〜6ぴきで いっしょに はしる。
//  ・ひとりで あそぶ：のこりの わくは CPU（虫を えらぶ／おまかせ、つよさ 1〜10）
//  ・つうしんで あそぶ：ともだちと さいだい 6にん（RaceNet.tsx）
//  ・ストーリーモードの レベル・わざを そのまま ひきつぐ
//    すばやさ → アクセルなしの はやさ／たいりょく → アクセルゲージ
//  1いに なると、ストーリーの レベルが あがる けいけんちを もらえる（raceExpGain）。
// =============================================================
import { useState } from 'react'
import type { CaughtBug } from '../types'
import { addExp, levelOf, loadStory, saveStory } from '../lib/story'
import type { RacerInit } from '../lib/raceEngine'
import {
  cpuRacerInits,
  loadRaceSetup,
  myRacerInit,
  RACE_COLORS,
  raceExpGain,
  saveRaceSetup,
  shuffle,
  type RaceSetup,
} from '../lib/raceSetup'
import { RaceTrack, type RaceResult } from '../components/RaceTrack'
import { RaceSlots } from '../components/RaceSlots'
import { LapPicker, MyBugGrid, MyRacerCard, RaceHowto, RaceResults, StagePicker } from '../components/RaceParts'
import { RaceNet } from './RaceNet'
import { RaceExpPanel, type RaceExpInfo } from '../components/RaceExp'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Mode = 'menu' | 'solo' | 'net'

export function RacePage({ bugs, onGoCapture }: Props) {
  const [mode, setMode] = useState<Mode>('menu')

  if (bugs.length < 1) {
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

  if (mode === 'solo') return <SoloRace bugs={bugs} onBack={() => setMode('menu')} />
  if (mode === 'net') return <RaceNet bugs={bugs} onBack={() => setMode('menu')} />

  return (
    <div className="race">
      <div className="race-mode-menu">
        <button
          className="game-card race"
          disabled={bugs.length < 2}
          onClick={() => {
            sfx.tap()
            setMode('solo')
          }}
        >
          <span className="game-emoji">🏁</span>
          <span className="game-title">ひとりで あそぶ</span>
          <span className="game-desc">
            {bugs.length < 2 ? '虫を 2ひき いじょう あつめてね' : 'CPUの 虫たちと きょうそう！ なんびき・つよさを えらべるよ'}
          </span>
        </button>
        <button
          className="game-card battle"
          onClick={() => {
            sfx.tap()
            setMode('net')
          }}
        >
          <span className="game-emoji">📡</span>
          <span className="game-title">つうしんで あそぶ</span>
          <span className="game-desc">ともだちと さいだい 6にんで きょうそう！ たりない ぶんは CPU</span>
        </button>
      </div>
    </div>
  )
}

type Phase = 'pick' | 'setup' | 'racing' | 'result'

function SoloRace({ bugs, onBack }: { bugs: CaughtBug[]; onBack: () => void }) {
  const [save, setSave] = useState(() => loadStory())
  const [phase, setPhase] = useState<Phase>('pick')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [setup, setSetupState] = useState<RaceSetup>(() => loadRaceSetup())
  const [racers, setRacers] = useState<RacerInit[]>([])
  const [raceNo, setRaceNo] = useState(0)
  const [results, setResults] = useState<RaceResult[]>([])
  const [confetti, setConfetti] = useState(false)
  // 1いで もらった けいけんち（2いいかは なし）
  const [expInfo, setExpInfo] = useState<RaceExpInfo | null>(null)

  const setSetup = (s: RaceSetup) => {
    setSetupState(s)
    saveRaceSetup(s)
  }

  const me = myBug ? myRacerInit(myBug, save, 'p0', RACE_COLORS[0]) : null
  const myLv = myBug ? levelOf(save, myBug.id).level : 1

  // CPUの わくを うめて、スタートの ならびを シャッフル
  function buildRacers(): RacerInit[] {
    if (!myBug) return []
    const colors = shuffle(RACE_COLORS)
    const mine = myRacerInit(myBug, save, 'p0', colors[0])
    const cpus = cpuRacerInits(setup.slots.slice(0, setup.count - 1), bugs, save, {
      baseLv: myLv,
      usedBugIds: [myBug.id],
      firstIndex: 1,
      colors,
    })
    return shuffle([mine, ...cpus])
  }

  function start(fresh: boolean) {
    sfx.tap()
    if (fresh || racers.length === 0) setRacers(buildRacers())
    setExpInfo(null)
    setRaceNo((n) => n + 1)
    setPhase('racing')
  }

  function finish(res: RaceResult[]) {
    setResults(res)
    setPhase('result')
    if (res.find((r) => r.id === 'p0')?.rank === 1) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 600)
      sfx.win()
      giveExp()
    } else {
      setExpInfo(null)
      sfx.lose()
    }
  }

  // 1いの ごほうび：ライバルの かず・つよさと しゅうかいで きまる けいけんち
  function giveExp() {
    if (!myBug) return
    const rivals = racers
      .filter((r) => r.id !== 'p0')
      .map((r) => ({ level: r.level, skill: r.skill, human: r.human }))
    const gain = raceExpGain(myLv, setup.laps, rivals)
    if (gain <= 0) return
    const res = addExp(save, myBug.id, gain)
    saveStory(res.save)
    setSave(res.save)
    setExpInfo({ name: myBug.name, gain, before: res.before, after: res.after, levelUps: res.levelUps })
  }

  return (
    <div className="race">
      <Confetti show={confetti} />

      {phase === 'pick' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① レースに でる虫を えらぼう</h2>
          <p className="race-lead">ストーリーで そだてた レベルと わざで はしるよ！</p>
          <MyBugGrid
            bugs={bugs}
            save={save}
            onPick={(b) => {
              sfx.tap()
              setMyBug(b)
              setPhase('setup')
            }}
          />
          <button
            className="btn btn-ghost battle-back"
            onClick={() => {
              sfx.tap()
              onBack()
            }}
          >
            ← もどる
          </button>
        </div>
      )}

      {phase === 'setup' && me && myBug && (
        <div className="battle-step">
          <h2 className="battle-step-title">② メンバーを きめよう</h2>
          <MyRacerCard me={me} />
          <StagePicker
            stage={setup.stage}
            onStage={(stage) => {
              sfx.tap()
              setSetup({ ...setup, stage })
            }}
          />
          <RaceSlots
            count={setup.count}
            minCount={2}
            onCount={(count) => setSetup({ ...setup, count })}
            fixed={[{ key: 'me', name: me.name, photo: me.photo, level: me.level, label: 'きみ' }]}
            slots={setup.slots}
            onSlots={(slots) => setSetup({ ...setup, slots })}
            bugs={bugs}
            excludeIds={[myBug.id]}
            baseLv={myLv}
            storyLevel={(id) => levelOf(save, id).level}
          />
          <RaceHowto />
          <LapPicker
            laps={setup.laps}
            onLaps={(laps) => {
              sfx.tap()
              setSetup({ ...setup, laps })
            }}
          />
          <div className="race-lineup-actions">
            <button className="btn btn-big btn-primary" onClick={() => start(true)}>
              レース スタート 🏁
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                setPhase('pick')
              }}
            >
              ← 虫を えらびなおす
            </button>
          </div>
        </div>
      )}

      {phase === 'racing' && (
        <RaceTrack
          key={raceNo}
          racers={racers}
          laps={setup.laps}
          stageId={setup.stage}
          viewerId="p0"
          onFinish={finish}
          onQuit={() => setPhase('setup')}
        />
      )}

      {phase === 'result' && (
        <div className="race-result">
          {expInfo && <RaceExpPanel info={expInfo} />}
          <RaceResults results={results} racers={racers} viewerId="p0" />
          <div className="race-result-actions">
            <button className="btn btn-big btn-primary" onClick={() => start(false)}>
              おなじ メンバーで もういちど 🔄
            </button>
            <button className="btn btn-big" onClick={() => start(true)}>
              あたらしい メンバーで レース 🎲
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                setPhase('setup')
              }}
            >
              メンバーを かえる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
