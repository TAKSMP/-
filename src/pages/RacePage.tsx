// =============================================================
//  むしレース（あたらしい ばん）
// -------------------------------------------------------------
//  うえから みた こうえんの コースを、6ぴきで いっしょに はしる。
//  ・ストーリーモードの レベル・わざを そのまま ひきつぐ
//    すばやさ → アクセルなしの はやさ／たいりょく → アクセルゲージ
//  ・わざは おなじ 名前で、レース用の こうか（raceMoves.ts）に なる
//  ストーリーの セーブは よむだけ（レースで レベルは かわらない）。
// =============================================================
import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { levelOf, loadStory, movesOf, statsWithLevel, cageOf, MAX_LEVEL } from '../lib/story'
import { cruiseOf, tankOf, type RacerInit } from '../lib/raceEngine'
import { EFFECT_INFO, raceMoveDesc, toRaceMove } from '../lib/raceMoves'
import { RaceTrack, type RaceResult } from '../components/RaceTrack'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const MAX_RACERS = 6
const COLORS = ['#ff6b6b', '#3d8bff', '#ffb703', '#8e5cf7', '#2fbf71', '#ff7ac6']
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣']

type Phase = 'pick' | 'lineup' | 'racing' | 'result'

function shuffle<T>(a: T[]): T[] {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

// ゲージの ながさ（0〜1）
const cruiseBar = (c: number) => Math.max(0.06, Math.min(1, (c - cruiseOf(1)) / (cruiseOf(50) - cruiseOf(1))))
const tankBar = (t: number) => Math.max(0.06, Math.min(1, (t - 4) / 10))

export function RacePage({ bugs, onGoCapture }: Props) {
  const save = useMemo(() => loadStory(), [])
  const [phase, setPhase] = useState<Phase>('pick')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [racers, setRacers] = useState<RacerInit[]>([])
  const [laps, setLaps] = useState(1)
  const [raceNo, setRaceNo] = useState(0)
  const [results, setResults] = useState<RaceResult[]>([])
  const [confetti, setConfetti] = useState(false)

  // そだてた虫（むしかご・レベルが たかい）を さきに ならべる
  const sorted = useMemo(() => {
    const cage = new Set(cageOf(save))
    return [...bugs].sort(
      (a, b) =>
        levelOf(save, b.id).level - levelOf(save, a.id).level ||
        Number(cage.has(b.id)) - Number(cage.has(a.id)),
    )
  }, [bugs, save])

  if (bugs.length < 2) {
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

  function makeRacer(bug: CaughtBug, level: number, mine: boolean, color: string): RacerInit {
    const s = statsWithLevel(bug, level)
    return {
      id: bug.id,
      name: bug.name,
      photo: mainPhoto(bug),
      color,
      mine,
      level,
      speedStat: s.speed,
      hpStat: s.hp,
      moves: movesOf(save, bug, level).map(toRaceMove),
    }
  }

  // あいては ランダム。レベルは じぶんの むしの ちかく（±2）
  function buildRacers(mine: CaughtBug): RacerInit[] {
    const myLv = levelOf(save, mine.id).level
    const others = shuffle(bugs.filter((b) => b.id !== mine.id)).slice(0, MAX_RACERS - 1)
    const colors = shuffle(COLORS)
    const list = [
      makeRacer(mine, myLv, true, colors[0]),
      ...others.map((b, i) =>
        makeRacer(b, Math.max(1, Math.min(MAX_LEVEL, myLv + Math.floor(Math.random() * 5) - 2)), false, colors[i + 1]),
      ),
    ]
    return shuffle(list) // スタートの ならびも シャッフル
  }

  function pickMine(bug: CaughtBug) {
    sfx.tap()
    setMyBug(bug)
    setRacers(buildRacers(bug))
    setPhase('lineup')
  }

  function startRace() {
    sfx.tap()
    setRaceNo((n) => n + 1)
    setPhase('racing')
  }

  function finish(res: RaceResult[]) {
    setResults(res)
    setPhase('result')
    if (res.find((r) => r.id === myBug?.id)?.rank === 1) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 600)
      sfx.win()
    } else sfx.lose()
  }

  const me = racers.find((r) => r.mine)
  const byId = new Map(racers.map((r) => [r.id, r]))

  return (
    <div className="race">
      <Confetti show={confetti} />

      {phase === 'pick' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① レースに でる虫を えらぼう</h2>
          <p className="race-lead">ストーリーで そだてた レベルと わざで はしるよ！</p>
          <div className="race-pick-grid">
            {sorted.map((b) => {
              const lv = levelOf(save, b.id).level
              const s = statsWithLevel(b, lv)
              return (
                <button key={b.id} className="race-pick" onClick={() => pickMine(b)}>
                  <img src={mainPhoto(b)} alt={b.name} loading="lazy" />
                  <span className="race-pick-lv">Lv {lv}</span>
                  <span className="race-pick-name">{b.name}</span>
                  <span className="race-pick-stats">
                    💨{s.speed} ❤️{s.hp}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === 'lineup' && me && (
        <div className="battle-step">
          <h2 className="battle-step-title">② こうえんレース 出走メンバー</h2>

          <div className="race-me-card">
            <div className="race-me-head">
              <img src={me.photo} alt={me.name} />
              <div>
                <div className="race-me-name">⭐ {me.name}</div>
                <div className="race-me-lv">Lv {me.level}</div>
              </div>
            </div>
            <div className="race-stat">
              <span>💨 ゆっくり スピード</span>
              <div className="race-stat-bar">
                <div style={{ width: cruiseBar(cruiseOf(me.speedStat)) * 100 + '%' }} />
              </div>
              <small>すばやさ {me.speedStat}</small>
            </div>
            <div className="race-stat">
              <span>🔥 アクセル ゲージ</span>
              <div className="race-stat-bar gauge">
                <div style={{ width: tankBar(tankOf(me.hpStat)) * 100 + '%' }} />
              </div>
              <small>たいりょく {me.hpStat}</small>
            </div>
            <div className="race-moves">
              <div className="race-moves-title">🎁を とると つかえる わざ</div>
              {me.moves.map((m) => (
                <div key={m.id} className={'race-move' + (m.ultimate ? ' ult' : '')}>
                  <span className="race-move-emoji">{m.emoji}</span>
                  <span className="race-move-body">
                    <b>{m.name}</b>
                    <span className="race-move-kind">
                      {EFFECT_INFO[m.effect].emoji} {EFFECT_INFO[m.effect].label}
                    </span>
                    <small>{raceMoveDesc(m)}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="race-lineup">
            {racers
              .filter((r) => !r.mine)
              .map((r) => (
                <div key={r.id} className="race-chip" style={{ borderColor: r.color }}>
                  <img src={r.photo} alt={r.name} />
                  <span className="race-chip-name">{r.name}</span>
                  <span className="race-chip-lv">Lv {r.level}</span>
                </div>
              ))}
          </div>

          <div className="race-howto">
            <p>🔥 <b>アクセル</b>を おしている あいだ はやく なるよ。でも たいりょくが へるよ。</p>
            <p>✋ はなすと たいりょくが もどるよ。おさなくても ゆっくり すすむよ。</p>
            <p>🎁 <b>？</b>の はこを とると わざが つかえるよ。</p>
          </div>

          <div className="race-laps">
            <span>なんしゅう？</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={'race-lap-btn' + (laps === n ? ' on' : '')}
                onClick={() => {
                  sfx.tap()
                  setLaps(n)
                }}
              >
                {n}しゅう
              </button>
            ))}
          </div>

          <div className="race-lineup-actions">
            <button className="btn btn-big btn-primary" onClick={startRace}>
              レース スタート 🏁
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                if (myBug) setRacers(buildRacers(myBug))
              }}
            >
              🎲 あいてを かえる
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

      {phase === 'racing' && <RaceTrack key={raceNo} racers={racers} laps={laps} onFinish={finish} />}

      {phase === 'result' && (
        <div className="race-result">
          {(() => {
            const mine = results.find((r) => r.id === me?.id)
            const top = byId.get(results[0]?.id ?? '')
            return mine?.rank === 1 ? (
              <p className="race-result-msg win">🎉 きみの「{me?.name}」が 1い！</p>
            ) : (
              <p className="race-result-msg">
                1いは「{top?.name}」！ きみの虫は {mine?.rank}い だったよ
              </p>
            )
          })()}
          <div className="race-rank-list">
            {results.map((r, i) => {
              const info = byId.get(r.id)
              if (!info) return null
              return (
                <div key={r.id} className={'race-rank-item' + (info.mine ? ' mine' : '')}>
                  <span className="race-rank-medal">{MEDALS[i] ?? i + 1 + 'い'}</span>
                  <img src={info.photo} alt={info.name} />
                  <span className="race-rank-name">
                    {info.name} <small>Lv{info.level}</small>
                  </span>
                  <span className="race-rank-time">{r.time.toFixed(1)}びょう</span>
                </div>
              )
            })}
          </div>
          <div className="race-result-actions">
            <button className="btn btn-big btn-primary" onClick={startRace}>
              もういちど レース 🔄
            </button>
            <button
              className="btn btn-big"
              onClick={() => {
                sfx.tap()
                if (myBug) setRacers(buildRacers(myBug))
                setPhase('lineup')
              }}
            >
              あいてを かえて レース 🎲
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                setPhase('pick')
              }}
            >
              べつの 虫で はしる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
