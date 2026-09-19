// =============================================================
//  ストーリーモード
// -------------------------------------------------------------
//  ①つかう虫を えらぶ → ②ばしょ（マップ）を えらぶ
//  → ③マップを 1マスずつ すすむ → ④マスの虫と バトル
//  → ⑤ゴールで ステージクリア
//  たおすと けいけんち。レベルが あがると つよくなる。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { battleStatsV2 } from '../lib/battleSetup'
import { makeFighter, type Fighter } from '../lib/battleEngine'
import { orderEmoji } from '../data/orders'
import { ParkScene, parkName } from '../components/ParkScene'
import { BattleStage, type BattleResult } from '../components/BattleStage'
import { sfx } from '../lib/sound'
import {
  addExp,
  buildStage,
  currentIndex,
  expForWin,
  expToNext,
  isCleared,
  levelOf,
  loadStory,
  markCleared,
  reachableIndex,
  saveStory,
  statsWithLevel,
  storyPlaces,
  type StoryCell,
  type StoryStage,
  type StorySave,
} from '../lib/story'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Phase = 'pickBug' | 'pickMap' | 'map' | 'battle' | 'clear'

// マスの まんなかの いち（％）
function cellPos(cell: StoryCell, stage: StoryStage) {
  return {
    left: ((cell.col + 0.5) / stage.cols) * 100,
    top: ((cell.row + 0.5) / stage.rows) * 100,
  }
}

export function StoryPage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('pickBug')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [stage, setStage] = useState<StoryStage | null>(null)
  const [save, setSave] = useState<StorySave>(() => loadStory())
  const [pos, setPos] = useState(0)
  const [moving, setMoving] = useState(false)
  const [battleCell, setBattleCell] = useState<StoryCell | null>(null)
  const [fighters, setFighters] = useState<Fighter[] | null>(null)
  const [battleKey, setBattleKey] = useState(0)
  const [askAgain, setAskAgain] = useState<StoryCell | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const moveTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (moveTimer.current) clearTimeout(moveTimer.current)
    }
  }, [])

  const places = storyPlaces(bugs)

  if (bugs.length < 2) {
    return (
      <div className="battle-empty">
        <div className="quiz-start-emoji">🗺️🐛</div>
        <p>
          ストーリーで あそぶには、虫を
          <br />
          <b>2ひき いじょう</b> あつめてね！
        </p>
        <button className="btn btn-big" onClick={() => { sfx.tap(); onGoCapture() }}>
          むしをしらべる 🔎
        </button>
      </div>
    )
  }

  function reset() {
    sfx.tap()
    setPhase('pickBug')
    setMyBug(null)
    setStage(null)
    setPos(0)
    setBattleCell(null)
    setFighters(null)
    setAskAgain(null)
    setNotice(null)
  }

  function pickBug(b: CaughtBug) {
    sfx.tap()
    setMyBug(b)
    setPhase('pickMap')
  }

  function pickMap(place: string) {
    sfx.tap()
    const st = buildStage(bugs, place)
    setStage(st)
    // まえの つづきから（たおしつづけた ところまで）
    setPos(currentIndex(save, st))
    setPhase('map')
    setNotice(null)
  }

  // ── マスを タップ
  function tapCell(cell: StoryCell) {
    if (!stage || moving) return
    // いま いる マスを もう一度 → さいせん を きく
    if (cell.index === pos) {
      if (cell.kind !== 'battle') return
      if (isCleared(save, stage.place, cell)) {
        sfx.tap()
        setAskAgain(cell)
      } else {
        // まだ たおしていない敵の マスに いる ＝ もう一度 いどむ
        sfx.tap()
        startBattle(cell)
      }
      return
    }
    // となりの マスだけ うごける
    if (Math.abs(cell.index - pos) !== 1) {
      sfx.error()
      setNotice('となりの マスに しか うごけないよ')
      return
    }
    // まだ たおしていない虫が いる マスより さきへは いけない
    const maxReach = reachableIndex(save, stage)
    if (cell.index > maxReach) {
      sfx.error()
      setNotice('まだ ここまでは いけないよ')
      return
    }
    setNotice(null)
    moveTo(cell)
  }

  // 1マスぶん うごく（アイコンが すすむ あいだ まつ）
  function moveTo(cell: StoryCell) {
    if (!stage) return
    sfx.tap()
    setMoving(true)
    setPos(cell.index)
    moveTimer.current = window.setTimeout(() => {
      setMoving(false)
      arrive(cell)
    }, 520)
  }

  // マスに ついた ときの しょり
  function arrive(cell: StoryCell) {
    if (!stage) return
    if (cell.kind === 'goal') {
      const next = markCleared(save, stage.place, cell)
      setSave(next)
      saveStory(next)
      sfx.win()
      setPhase('clear')
      return
    }
    if (cell.kind === 'battle' && !isCleared(save, stage.place, cell)) {
      startBattle(cell)
    }
  }

  // ── バトルを はじめる
  function startBattle(cell: StoryCell) {
    if (!myBug || !stage || !cell.bugId) return
    const enemy = bugs.find((b) => b.id === cell.bugId)
    if (!enemy) return
    const lv = levelOf(save, myBug.id).level
    const me = makeFighter(myBug, statsWithLevel(myBug, lv), 'me0', 'me', mainPhoto(myBug))
    const foe = makeFighter(enemy, battleStatsV2(enemy), 'foe0', 'foe', mainPhoto(enemy))
    setFighters([me, foe])
    setBattleCell(cell)
    setBattleKey((k) => k + 1)
    setAskAgain(null)
    setPhase('battle')
  }

  // ── バトルが おわった
  function finishBattle(r: BattleResult) {
    if (!myBug || !stage || !battleCell) return
    if (r.winner === 'me') {
      const enemy = bugs.find((b) => b.id === battleCell.bugId)
      const first = !isCleared(save, stage.place, battleCell)
      let next = markCleared(save, stage.place, battleCell)
      let msg = '🎉 かった！'
      if (enemy) {
        const lv = levelOf(next, myBug.id).level
        // 2かいめ いこうは けいけんちが はんぶん
        const gain = Math.max(1, Math.round(expForWin(enemy, lv) * (first ? 1 : 0.5)))
        const res = addExp(next, myBug.id, gain)
        next = res.save
        msg = `🎉 かった！ +${gain} けいけんち`
        if (res.levelUps > 0) msg += `／⭐ レベル ${res.after.level} に あがった！`
      }
      setSave(next)
      saveStory(next)
      setNotice(msg)
    } else {
      // まけたら ひとつ まえの（たおしずみの）マスに もどる。
      // そのままだと 敵マスの 上に 立ったままで うごけなくなる。
      setPos(currentIndex(save, stage))
      setNotice('😢 まけちゃった… レベルを あげて もういちど！')
    }
    setPhase('map')
    setBattleCell(null)
  }

  // -----------------------------------------------------------
  //  みため
  // -----------------------------------------------------------
  const myLevel = myBug ? levelOf(save, myBug.id) : { level: 1, exp: 0 }
  const need = expToNext(myLevel.level)

  // ① 虫えらび
  if (phase === 'pickBug') {
    return (
      <div className="story">
        <h2 className="battle-step-title">① つかう虫を えらぼう</h2>
        <p className="story-lead">
          えらんだ虫で マップを すすむよ。たおすと <b>レベル</b> が あがって つよくなる！
        </p>
        <div className="story-bug-grid">
          {bugs.map((b) => {
            const lv = levelOf(save, b.id)
            const s = battleStatsV2(b)
            return (
              <button key={b.id} className="story-bug" onClick={() => pickBug(b)}>
                <img src={mainPhoto(b)} alt={b.name} />
                <span className="story-bug-name">{b.name}</span>
                <span className="story-bug-lv">Lv {lv.level}</span>
                <span className="story-bug-stats">
                  ❤️{s.hp} ⚔️{s.attack} 🛡️{s.defense} ⚡{s.speed}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ② マップえらび
  if (phase === 'pickMap') {
    return (
      <div className="story">
        <h2 className="battle-step-title">② マップを えらぼう</h2>
        <p className="story-lead">
          マップは <b>「みつけたばしょ」</b>。そこで みつけた虫が てきに なるよ。
        </p>
        {places.length === 0 ? (
          <p className="pick-so-far">
            まだ「みつけたばしょ」が ないみたい。ずかんで ばしょを 書くと マップが ふえるよ。
          </p>
        ) : (
          <div className="story-map-list">
            {places.map((p) => {
              const st = buildStage(bugs, p.place)
              const done = (save.cleared[p.place] ?? []).length
              const goal = !!save.goal[p.place]
              return (
                <button key={p.place} className="story-map" onClick={() => pickMap(p.place)}>
                  <span className="story-map-thumb">
                    <ParkScene index={st.sceneIndex} fit="meet" />
                  </span>
                  <span className="story-map-body">
                    <span className="story-map-name">
                      {goal && '🏆 '}
                      {p.place}
                    </span>
                    <span className="story-map-sub">
                      {parkName(st.sceneIndex)}／てき {p.count}ひき（たおした {done}）
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <button className="btn btn-ghost battle-back" onClick={reset}>
          ← 虫を えらびなおす
        </button>
      </div>
    )
  }

  // ④ バトル
  if (phase === 'battle' && fighters) {
    return (
      <BattleStage
        key={battleKey}
        fighters={fighters}
        big
        quitLabel="✕ にげる"
        startLog="⚔️ てきが あらわれた！"
        onQuit={() => {
          if (stage) setPos(currentIndex(save, stage))
          setPhase('map')
          setBattleCell(null)
          setNotice('にげた…')
        }}
        onFinish={finishBattle}
      />
    )
  }

  // ⑤ クリア
  if (phase === 'clear' && stage && myBug) {
    return (
      <div className="story-clear">
        <div className="battle-result-emoji">🏆</div>
        <h2>ステージクリア！</h2>
        <p className="battle-result-sub">{stage.place}</p>
        <div className="story-clear-bug">
          <img src={mainPhoto(myBug)} alt={myBug.name} />
          <div>
            <b>{myBug.name}</b>
            <br />
            <span>Lv {myLevel.level}</span>
          </div>
        </div>
        <div className="battle-result-actions">
          <button className="btn btn-big btn-primary" onClick={() => setPhase('pickMap')}>
            べつの マップへ 🗺️
          </button>
          <button className="btn btn-big" onClick={reset}>
            さいしょから ⚔️
          </button>
        </div>
      </div>
    )
  }

  // ③ マップ
  if (phase === 'map' && stage && myBug) {
    const maxReach = reachableIndex(save, stage)
    const me = stage.cells[pos]
    const mePos = cellPos(me, stage)
    return (
      <div className="story">
        {/* うえの おび：じぶんの虫と レベル */}
        <div className="story-hud">
          <img className="story-hud-photo" src={mainPhoto(myBug)} alt={myBug.name} />
          <div className="story-hud-body">
            <span className="story-hud-name">
              {myBug.name} <b>Lv {myLevel.level}</b>
            </span>
            <span className="story-exp">
              <span className="story-exp-fill" style={{ width: `${Math.min(100, (myLevel.exp / need) * 100)}%` }} />
            </span>
            <span className="story-hud-sub">けいけんち {myLevel.exp}/{need}</span>
          </div>
          <button className="btn btn-ghost story-hud-back" onClick={() => setPhase('pickMap')}>
            🗺️
          </button>
        </div>

        {notice && <p className="story-notice">{notice}</p>}

        {/* マップ本体 */}
        <div
          className="story-board"
          style={{ aspectRatio: `${stage.cols} / ${stage.rows}` }}
        >
          <ParkScene index={stage.sceneIndex} />

          <div className="story-grid">
          {/* マスを つなぐ みち */}
          <svg className="story-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
            {stage.cells.slice(0, -1).map((c, i) => {
              const a = cellPos(c, stage)
              const b = cellPos(stage.cells[i + 1], stage)
              return (
                <line
                  key={i}
                  x1={a.left} y1={a.top} x2={b.left} y2={b.top}
                  stroke="#f3e6bd" strokeWidth="5" strokeLinecap="round"
                />
              )
            })}
          </svg>

          {/* マス */}
          {stage.cells.map((cell) => {
            const p = cellPos(cell, stage)
            const cleared = isCleared(save, stage.place, cell)
            const enemy = cell.bugId ? bugs.find((b) => b.id === cell.bugId) : null
            const locked = cell.index > maxReach
            return (
              <button
                key={cell.index}
                className={
                  'story-cell' +
                  (cleared ? ' cleared' : '') +
                  (locked ? ' locked' : '') +
                  (cell.index === pos ? ' here' : '')
                }
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                onClick={() => tapCell(cell)}
                aria-label={enemy ? enemy.name : cell.kind}
              >
                {cell.kind === 'start' && <span className="story-cell-icon">🏠</span>}
                {cell.kind === 'goal' && <span className="story-cell-icon">🏰</span>}
                {enemy && (
                  <>
                    <img src={mainPhoto(enemy)} alt={enemy.name} />
                    {cleared && <span className="story-cell-check">✅</span>}
                  </>
                )}
              </button>
            )
          })}

          {/* じぶん（虫の「目」の アイコン） */}
          <span
            className={'story-me' + (moving ? ' moving' : '')}
            style={{ left: `${mePos.left}%`, top: `${mePos.top}%` }}
          >
            {orderEmoji(myBug.order)}
          </span>
          </div>
        </div>

        <p className="story-help">
          となりの マスを タップして すすもう。まだ たおしていない虫の マスに はいると バトル！
        </p>

        {/* もういちど たたかう？ */}
        {askAgain && (
          <div className="modal-backdrop" onClick={() => setAskAgain(null)}>
            <div className="modal story-ask" onClick={(e) => e.stopPropagation()}>
              <h3>もういちど たたかう？</h3>
              <p>
                {bugs.find((b) => b.id === askAgain.bugId)?.name} と もう一度 しょうぶできるよ。
                （けいけんちは はんぶん）
              </p>
              <div className="battle-result-actions">
                <button className="btn btn-big btn-primary" onClick={() => startBattle(askAgain)}>
                  たたかう ⚔️
                </button>
                <button className="btn btn-big" onClick={() => setAskAgain(null)}>
                  やめる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ここには こない（ほけん）
  return (
    <div className="story">
      <button className="btn btn-big" onClick={reset}>さいしょから</button>
    </div>
  )
}
