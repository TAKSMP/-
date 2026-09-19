// =============================================================
//  ストーリーモード
// -------------------------------------------------------------
//  ①つかう虫を えらぶ（ずかんと おなじ もくじ）
//  ②マップを えらぶ … 「ばしょ」から／「10マップ」から
//  ③マップを 1マスずつ すすむ → ④マスの虫と バトル
//  ⑤ゴールで ステージクリア
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { battleStatsV2 } from '../lib/battleSetup'
import { makeFighter, type Fighter } from '../lib/battleEngine'
import { orderEmoji } from '../data/orders'
import { ParkScene, parkName } from '../components/ParkScene'
import { BattleStage, type BattleResult } from '../components/BattleStage'
import { BugPicker } from '../components/BugPicker'
import { findEncounter } from '../data/encounters'
import { sfx } from '../lib/sound'
import {
  addExp,
  buildQuestStage,
  buildStage,
  currentIndex,
  expForWin,
  expToNext,
  isCleared,
  isSeen,
  learnLevelCrossed,
  levelOf,
  markSeen,
  loadStory,
  markCleared,
  movesOf,
  newMoveFor,
  questId,
  questUnlocked,
  QUEST_MAPS,
  QUEST_PER_MAP,
  reachableIndex,
  resetAllLevels,
  resetLevel,
  resetStage,
  saveStory,
  setMoves,
  statsWithLevel,
  storyPlaces,
  type StoryCell,
  type StoryStage,
  type StorySave,
} from '../lib/story'
import type { SpecialMoveV2 } from '../types'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Phase = 'pickBug' | 'pickMap' | 'map' | 'encounter' | 'battle' | 'clear'
type MapMode = 'place' | 'quest'

// マスの まんなかの いち（％）
function cellPos(cell: StoryCell, stage: StoryStage) {
  return {
    left: ((cell.col + 0.5) / stage.cols) * 100,
    top: ((cell.row + 0.5) / stage.rows) * 100,
  }
}

export function StoryPage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('pickBug')
  const [mapMode, setMapMode] = useState<MapMode>('quest')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [stage, setStage] = useState<StoryStage | null>(null)
  const [save, setSave] = useState<StorySave>(() => loadStory())
  const [pos, setPos] = useState(0)
  const [moving, setMoving] = useState(false)
  const [battleCell, setBattleCell] = useState<StoryCell | null>(null)
  // であいの おはなし
  const [encounterCell, setEncounterCell] = useState<StoryCell | null>(null)
  const [goFlash, setGoFlash] = useState(false)
  const [fighters, setFighters] = useState<Fighter[] | null>(null)
  const [battleKey, setBattleKey] = useState(0)
  const [askAgain, setAskAgain] = useState<StoryCell | null>(null)
  const [askReset, setAskReset] = useState<{ id: string; title: string } | null>(null)
  // レベルを もどす かくにん（bugId が '*' なら ぜんぶ）
  const [askLevel, setAskLevel] = useState<{ bugId: string; name: string } | null>(null)
  // レベルアップした ときの「なにが どう かわったか」
  // あたらしい わざを おぼえる（レベル2ごと）
  const [learn, setLearn] = useState<{
    move: SpecialMoveV2
    current: SpecialMoveV2[]
  } | null>(null)
  const [levelUp, setLevelUp] = useState<{
    name: string
    photo: string
    fromLv: number
    toLv: number
    rows: { label: string; emoji: string; from: number; to: number }[]
  } | null>(null)
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
    setEncounterCell(null)
    setGoFlash(false)
    setLearn(null)
    setLevelUp(null)
    setNotice(null)
  }

  function pickBug(b: CaughtBug) {
    sfx.tap()
    setMyBug(b)
    setPhase('pickMap')
  }

  function openStage(st: StoryStage) {
    sfx.tap()
    setStage(st)
    setPos(currentIndex(save, st))
    setPhase('map')
    setNotice(null)
  }

  // あたらしい わざと とりかえる
  function swapMove(index: number) {
    if (!myBug || !learn) return
    sfx.special('attackUp')
    const next = setMoves(
      save,
      myBug.id,
      learn.current.map((m, i) => (i === index ? learn.move : m)),
    )
    setSave(next)
    saveStory(next)
    setNotice(`✨ 「${learn.move.name}」を おぼえた！`)
    setLearn(null)
  }

  // 虫の レベルを 1に もどす
  function doResetLevel(bugId: string) {
    const next = bugId === '*' ? resetAllLevels(save) : resetLevel(save, bugId)
    setSave(next)
    saveStory(next)
    setAskLevel(null)
    setLevelUp(null)
    setLearn(null)
    sfx.tap()
  }

  // そのマップの すすみぐあいを まっさらに する
  function doReset(id: string) {
    const next = resetStage(save, id)
    setSave(next)
    saveStory(next)
    setAskReset(null)
    sfx.tap()
    if (stage && stage.id === id) setPos(0)
  }

  // ── マスを タップ
  function tapCell(cell: StoryCell) {
    if (!stage || moving) return
    if (cell.index === pos) {
      if (cell.kind !== 'battle') return
      if (isCleared(save, stage.id, cell)) {
        sfx.tap()
        setAskAgain(cell)
      } else {
        sfx.tap()
        startBattle(cell)
      }
      return
    }
    if (Math.abs(cell.index - pos) !== 1) {
      sfx.error()
      setNotice('となりの マスに しか うごけないよ')
      return
    }
    if (cell.index > reachableIndex(save, stage)) {
      sfx.error()
      setNotice('まだ ここまでは いけないよ')
      return
    }
    setNotice(null)
    moveTo(cell)
  }

  // 1マスぶん うごく
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

  function arrive(cell: StoryCell) {
    if (!stage) return
    if (cell.kind === 'goal') {
      const next = markCleared(save, stage.id, cell)
      setSave(next)
      saveStory(next)
      sfx.win()
      setPhase('clear')
      return
    }
    if (cell.kind === 'battle' && !isCleared(save, stage.id, cell)) {
      // はじめて 出会う虫は おはなし → しゃしんが あかされる → バトル
      if (!isSeen(save, stage.id, cell)) {
        const next = markSeen(save, stage.id, cell)
        setSave(next)
        saveStory(next)
        setEncounterCell(cell)
        setGoFlash(false)
        setPhase('encounter')
        return
      }
      startBattle(cell)
    }
  }

  // ── バトルを はじめる
  function startBattle(cell: StoryCell) {
    if (!myBug || !stage || !cell.bugId) return
    const enemy = bugs.find((b) => b.id === cell.bugId)
    if (!enemy) return
    const myLv = levelOf(save, myBug.id).level
    const enemyLv = cell.level ?? 1
    const me = makeFighter(
      myBug,
      { ...statsWithLevel(myBug, myLv), moves: movesOf(save, myBug) },
      'me0',
      'me',
      mainPhoto(myBug),
    )
    const foe = makeFighter(enemy, statsWithLevel(enemy, enemyLv), 'foe0', 'foe', mainPhoto(enemy))
    setFighters([me, foe])
    setBattleCell(cell)
    setBattleKey((k) => k + 1)
    setAskAgain(null)
    setEncounterCell(null)
    setGoFlash(false)
    setPhase('battle')
  }

  // ── バトルが おわった
  function finishBattle(r: BattleResult) {
    if (!myBug || !stage || !battleCell) return
    if (r.winner === 'me') {
      const enemy = bugs.find((b) => b.id === battleCell.bugId)
      const first = !isCleared(save, stage.id, battleCell)
      let next = markCleared(save, stage.id, battleCell)
      let msg = '🎉 かった！'
      if (enemy) {
        const lv = levelOf(next, myBug.id).level
        const gain = Math.max(
          1,
          Math.round(expForWin(enemy, lv, battleCell.level ?? 1) * (first ? 1 : 0.5)),
        )
        const res = addExp(next, myBug.id, gain)
        next = res.save
        msg = `🎉 かった！ +${gain} けいけんち`
        if (res.levelUps > 0) {
          // レベルが あがったら、ステータスが どう かわったかを 見せる
          const a = statsWithLevel(myBug, res.before.level)
          const b = statsWithLevel(myBug, res.after.level)
          setLevelUp({
            name: myBug.name,
            photo: mainPhoto(myBug),
            fromLv: res.before.level,
            toLv: res.after.level,
            rows: [
              { label: 'たいりょく', emoji: '❤️', from: a.hp, to: b.hp },
              { label: 'こうげき', emoji: '⚔️', from: a.attack, to: b.attack },
              { label: 'ぼうぎょ', emoji: '🛡️', from: a.defense, to: b.defense },
              { label: 'すばやさ', emoji: '⚡', from: a.speed, to: b.speed },
            ],
          })
          setTimeout(() => sfx.badge(), 200)
          // レベルが 2あがる ごとに、あたらしい わざを 1つ おぼえられる
          const learnLv = learnLevelCrossed(res.before.level, res.after.level)
          if (learnLv !== null) {
            const cur = movesOf(next, myBug)
            const nm = newMoveFor(myBug, learnLv, cur)
            if (nm) setLearn({ move: nm, current: cur })
          }
        }
      }
      setSave(next)
      saveStory(next)
      setNotice(msg)
    } else {
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

  // リセットの かくにん（どの がめんでも 出す）
  const resetModal = askReset && (
    <div className="modal-backdrop" onClick={() => setAskReset(null)}>
      <div className="modal story-ask" onClick={(e) => e.stopPropagation()}>
        <h3>すすみぐあいを リセット する？</h3>
        <p>
          「{askReset.title}」を さいしょから やりなおします。
          <br />
          虫の レベルは そのままです。
        </p>
        <div className="battle-result-actions">
          <button className="btn btn-big btn-primary" onClick={() => doReset(askReset.id)}>
            リセットする 🔄
          </button>
          <button className="btn btn-big" onClick={() => setAskReset(null)}>
            やめる
          </button>
        </div>
      </div>
    </div>
  )

  const moveLabel = (m: SpecialMoveV2) =>
    m.kind === 'attack' ? `いりょく${m.power}` : 'へんかわざ'

  const learnModal = learn && !levelUp && (
    <div className="modal-backdrop">
      <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">✨</div>
        <h3>あたらしい わざを おぼえられる！</h3>
        <div className="story-learn-new">
          <span className="story-learn-emoji">{learn.move.emoji ?? '✨'}</span>
          <span className="story-learn-name">{learn.move.name}</span>
          <span className="story-learn-sub">
            {moveLabel(learn.move)}／{learn.move.uses}かい つかえる
          </span>
          <p className="story-learn-desc">{learn.move.desc}</p>
        </div>
        <p className="story-learn-q">どの わざと とりかえる？</p>
        <div className="story-learn-list">
          {learn.current.map((m, i) => (
            <button key={m.id + i} className="story-learn-old" onClick={() => swapMove(i)}>
              <span className="story-learn-old-name">
                {m.emoji ?? '✨'} {m.name}
              </span>
              <span className="story-learn-old-sub">
                {moveLabel(m)}／{m.uses}かい
              </span>
            </button>
          ))}
        </div>
        <button
          className="btn btn-big"
          onClick={() => {
            sfx.tap()
            setNotice('いまの わざの ままに した。')
            setLearn(null)
          }}
        >
          おぼえない
        </button>
      </div>
    </div>
  )

  const levelUpModal = levelUp && (
    <div className="modal-backdrop" onClick={() => setLevelUp(null)}>
      <div className="modal story-levelup" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">⭐</div>
        <h3>レベルアップ！</h3>
        <div className="story-levelup-head">
          <img src={levelUp.photo} alt={levelUp.name} />
          <span>
            <b>{levelUp.name}</b>
            <br />
            Lv {levelUp.fromLv} <span className="story-arrow">▶</span>{' '}
            <b className="story-levelup-new">Lv {levelUp.toLv}</b>
          </span>
        </div>
        <ul className="story-statlist">
          {levelUp.rows.map((r) => {
            const up = r.to - r.from
            return (
              <li key={r.label} className={up > 0 ? 'up' : ''}>
                <span className="story-stat-name">
                  {r.emoji} {r.label}
                </span>
                <span className="story-stat-val">
                  {r.from} <span className="story-arrow">▶</span> <b>{r.to}</b>
                  {up > 0 ? (
                    <em className="story-stat-up">+{up}</em>
                  ) : (
                    <em className="story-stat-same">かわらず</em>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        <button className="btn btn-big btn-primary" onClick={() => setLevelUp(null)}>
          つよくなった！ 💪
        </button>
      </div>
    </div>
  )

  const levelModal = askLevel && (
    <div className="modal-backdrop" onClick={() => setAskLevel(null)}>
      <div className="modal story-ask" onClick={(e) => e.stopPropagation()}>
        <h3>レベルを 1に もどす？</h3>
        <p>
          {askLevel.bugId === '*'
            ? 'ぜんぶの虫の レベルと けいけんちが 1に もどります。'
            : `「${askLevel.name}」の レベルと けいけんちが 1に もどります。`}
          <br />
          マップの すすみぐあいは そのままです。
        </p>
        <div className="battle-result-actions">
          <button
            className="btn btn-big btn-primary"
            onClick={() => doResetLevel(askLevel.bugId)}
          >
            もどす 🔄
          </button>
          <button className="btn btn-big" onClick={() => setAskLevel(null)}>
            やめる
          </button>
        </div>
      </div>
    </div>
  )

  // ① 虫えらび（ずかんと おなじ もくじ）
  if (phase === 'pickBug') {
    return (
      <div className="story">
        <h2 className="battle-step-title">① つかう虫を えらぼう</h2>
        <p className="story-lead">
          えらんだ虫で マップを すすむよ。たおすと <b>レベル</b> が あがって つよくなる！
        </p>
        <BugPicker
          bugs={bugs}
          onPick={pickBug}
          renderCard={(b) => {
            const lv = levelOf(save, b.id)
            const s = battleStatsV2(b)
            return (
              <div className="story-bug">
                <img src={mainPhoto(b)} alt={b.name} />
                <span className="story-bug-name">{b.name}</span>
                <span className="story-bug-lv">Lv {lv.level}</span>
                <span className="story-bug-stats">
                  ❤️{s.hp} ⚔️{s.attack} 🛡️{s.defense} ⚡{s.speed}
                </span>
                {(lv.level > 1 || lv.exp > 0) && (
                  <button
                    className="story-lv-reset"
                    onClick={(e) => {
                      e.stopPropagation()
                      sfx.tap()
                      setAskLevel({ bugId: b.id, name: b.name })
                    }}
                  >
                    🔄 Lvを もどす
                  </button>
                )}
              </div>
            )
          }}
        />
        {Object.keys(save.levels).length > 0 && (
          <button
            className="btn btn-ghost story-lv-reset-all"
            onClick={() => {
              sfx.tap()
              setAskLevel({ bugId: '*', name: '' })
            }}
          >
            🔄 ぜんぶの虫の レベルを もどす
          </button>
        )}
        {levelModal}
      </div>
    )
  }

  // ② マップえらび
  if (phase === 'pickMap') {
    return (
      <div className="story">
        <h2 className="battle-step-title">② マップを えらぼう</h2>
        <div className="foe-mode">
          <button
            className={'chip' + (mapMode === 'quest' ? ' on' : '')}
            onClick={() => { sfx.tap(); setMapMode('quest') }}
          >
            🏞️ 10マップ
          </button>
          <button
            className={'chip' + (mapMode === 'place' ? ' on' : '')}
            onClick={() => { sfx.tap(); setMapMode('place') }}
          >
            📍 みつけたばしょ
          </button>
        </div>

        {mapMode === 'quest' ? (
          <>
            <p className="story-lead">
              あつめた虫 ぜんいんが あいて。1マップ {QUEST_PER_MAP}ひき、
              すすむほど <b>つよい虫・たかいレベル</b> が 出てくるよ。
            </p>
            <div className="story-map-list">
              {Array.from({ length: QUEST_MAPS }, (_, i) => {
                const id = questId(i)
                const open = questUnlocked(save, i)
                const st = buildQuestStage(bugs, i)
                const done = (save.cleared[id] ?? []).length
                const goal = !!save.goal[id]
                const maxLv = Math.max(...st.cells.map((c) => c.level ?? 0))
                return (
                  <div key={id} className={'story-map-row' + (open ? '' : ' locked')}>
                    <button
                      className="story-map"
                      disabled={!open}
                      onClick={() => openStage(st)}
                    >
                      <span className="story-map-thumb">
                        <ParkScene index={st.sceneIndex} fit="meet" />
                        {!open && <span className="story-map-lock">🔒</span>}
                      </span>
                      <span className="story-map-body">
                        <span className="story-map-name">
                          {goal && '🏆 '}
                          {st.title}
                        </span>
                        <span className="story-map-sub">
                          {parkName(st.sceneIndex)}／てき {QUEST_PER_MAP}ひき（さいだい Lv{maxLv}）
                        </span>
                        <span className="story-map-sub">
                          {open ? `たおした ${done}／${QUEST_PER_MAP}` : 'まえの ステージを クリアすると あくよ'}
                        </span>
                      </span>
                    </button>
                    {open && (done > 0 || goal) && (
                      <button
                        className="story-reset"
                        onClick={() => { sfx.tap(); setAskReset({ id, title: st.title }) }}
                        title="すすみぐあいを リセット"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
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
                  const done = (save.cleared[st.id] ?? []).length
                  const goal = !!save.goal[st.id]
                  return (
                    <div key={p.place} className="story-map-row">
                      <button className="story-map" onClick={() => openStage(st)}>
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
                      {(done > 0 || goal) && (
                        <button
                          className="story-reset"
                          onClick={() => { sfx.tap(); setAskReset({ id: st.id, title: p.place }) }}
                          title="すすみぐあいを リセット"
                        >
                          🔄
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        <button className="btn btn-ghost battle-back" onClick={reset}>
          ← 虫を えらびなおす
        </button>
        {resetModal}
      </div>
    )
  }

  // ③.5 であいの おはなし
  if (phase === 'encounter' && stage && encounterCell) {
    const enemy = bugs.find((b) => b.id === encounterCell.bugId)
    const enc = findEncounter(encounterCell.encounterId)
    const lv = encounterCell.level ?? 1
    return (
      <div className="story-encounter">
        <ParkScene index={stage.sceneIndex} />
        <div className="story-enc-inner">
          <div className="story-enc-emoji">{enc?.emoji ?? '❗'}</div>
          <p className="story-enc-text">
            {enc && enemy ? enc.text(enemy.name) : 'てきが あらわれた！'}
          </p>
          {enemy && (
            <div className="story-enc-bug">
              <img src={mainPhoto(enemy)} alt={enemy.name} />
              <span className="story-enc-name">
                {enemy.name}
                {lv > 1 && <b> Lv{lv}</b>}
              </span>
            </div>
          )}
          <button
            className="btn btn-big btn-primary story-enc-go"
            onClick={() => {
              if (goFlash) return
              setGoFlash(true)
              sfx.battleStart()
              window.setTimeout(() => startBattle(encounterCell), 950)
            }}
          >
            バトル かいし ⚔️
          </button>
        </div>
        {goFlash && (
          <div className="story-go">
            <span>バトル かいし！</span>
          </div>
        )}
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
    const questIndex = stage.kind === 'quest' ? Number(stage.id.split(':')[1]) : -1
    const hasNext = questIndex >= 0 && questIndex + 1 < QUEST_MAPS
    return (
      <div className="story-clear">
        <div className="battle-result-emoji">🏆</div>
        <h2>ステージクリア！</h2>
        <p className="battle-result-sub">{stage.title}</p>
        <div className="story-clear-bug">
          <img src={mainPhoto(myBug)} alt={myBug.name} />
          <div>
            <b>{myBug.name}</b>
            <br />
            <span>Lv {myLevel.level}</span>
          </div>
        </div>
        <div className="battle-result-actions">
          {hasNext && (
            <button
              className="btn btn-big btn-primary"
              onClick={() => openStage(buildQuestStage(bugs, questIndex + 1))}
            >
              つぎの ステージへ ▶
            </button>
          )}
          <button className="btn btn-big" onClick={() => setPhase('pickMap')}>
            べつの マップへ 🗺️
          </button>
          <button className="btn btn-big" onClick={reset}>
            虫を えらびなおす ⚔️
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
        <div className="story-hud">
          <img className="story-hud-photo" src={mainPhoto(myBug)} alt={myBug.name} />
          <div className="story-hud-body">
            <span className="story-hud-name">
              {myBug.name} <b>Lv {myLevel.level}</b>
            </span>
            <span className="story-exp">
              <span
                className="story-exp-fill"
                style={{ width: `${Math.min(100, (myLevel.exp / need) * 100)}%` }}
              />
            </span>
            <span className="story-hud-sub">
              {stage.title}／けいけんち {myLevel.exp}/{need}
            </span>
          </div>
          <button
            className="btn btn-ghost story-hud-back"
            onClick={() => { sfx.tap(); setAskReset({ id: stage.id, title: stage.title }) }}
            title="このマップを リセット"
          >
            🔄
          </button>
          <button className="btn btn-ghost story-hud-back" onClick={() => setPhase('pickMap')}>
            🗺️
          </button>
        </div>

        {notice && <p className="story-notice">{notice}</p>}

        <div className="story-board" style={{ aspectRatio: `${stage.cols} / ${stage.rows}` }}>
          <ParkScene index={stage.sceneIndex} />

          <div className="story-grid">
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

            {stage.cells.map((cell) => {
              const p = cellPos(cell, stage)
              const cleared = isCleared(save, stage.id, cell)
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
                  aria-label={
                    enemy && isSeen(save, stage.id, cell) ? enemy.name : cell.kind
                  }
                >
                  {cell.kind === 'start' && <span className="story-cell-icon">🏠</span>}
                  {cell.kind === 'goal' && <span className="story-cell-icon">🏰</span>}
                  {enemy &&
                    (isSeen(save, stage.id, cell) ? (
                      <>
                        <img src={mainPhoto(enemy)} alt={enemy.name} />
                        {(cell.level ?? 1) > 1 && (
                          <span className="story-cell-lv">Lv{cell.level}</span>
                        )}
                        {cleared && <span className="story-cell-check">✅</span>}
                      </>
                    ) : (
                      // まだ 出会っていない マスは かくしておく
                      <span className="story-cell-icon hidden-cell">？</span>
                    ))}
                </button>
              )
            })}

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
        {resetModal}
        {levelUpModal}
        {learnModal}
      </div>
    )
  }

  return (
    <div className="story">
      <button className="btn btn-big" onClick={reset}>さいしょから</button>
    </div>
  )
}
