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
import { FieldMap } from '../components/FieldMap'
import { WorldMap } from '../components/WorldMap'
import { fieldForPlace, fieldsInList, publicUrl, type FieldDef } from '../data/fields'
import { bugsForField } from '../lib/fieldBugs'
import { assignEncounters } from '../data/encounters'
import { findEncounter } from '../data/encounters'
import { sfx } from '../lib/sound'
import {
  addExp,
  addToCage,
  allMovesOf,
  cageOf,
  buildQuestStage,
  buildStage,
  currentIndex,
  expForWin,
  expToNext,
  DOUBLE_ENCOUNTER_CHANCE,
  isCleared,
  isSeen,
  learnLevelCrossed,
  levelOf,
  MAX_LEVEL,
  markSeen,
  loadStory,
  markCleared,
  moveSlots,
  movesOf,
  newMoveFor,
  questId,
  questUnlocked,
  QUEST_MAPS,
  QUEST_PER_MAP,
  reachableIndex,
  RECRUIT_CHANCE,
  releaseFromCage,
  resetStage,
  saveStory,
  setMoves,
  statsWithLevel,
  storyPlaces,
  type StoryCell,
  type StoryStage,
  type BugLevel,
  type StorySave,
} from '../lib/story'
import type { SpecialMoveV2 } from '../types'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Phase = 'pickBug' | 'pickMap' | 'map' | 'field' | 'encounter' | 'party' | 'battle' | 'clear'
type MapMode = 'place' | 'quest'

// マスの まんなかの いち（％）
function cellPos(cell: StoryCell, stage: StoryStage) {
  return {
    left: ((cell.col + 0.5) / stage.cols) * 100,
    top: ((cell.row + 0.5) / stage.rows) * 100,
  }
}

// -------------------------------------------------------------
//  かった あとに 1まいずつ 見せる もの（じぶんの 虫 → なかま の じゅん）
// -------------------------------------------------------------
interface LevelUpInfo {
  bugId: string
  name: string
  photo: string
  fromLv: number
  toLv: number
  rows: { label: string; emoji: string; from: number; to: number }[]
  buddy: boolean // なかまの ぶんか
}
interface LearnInfo {
  bugId: string
  name: string
  buddy: boolean
  move: SpecialMoveV2
  current: SpecialMoveV2[]
  forcedIndex: number | null // わくが ふえた ときは えらばずに ついか
}
type Celebration = { kind: 'level'; info: LevelUpInfo } | { kind: 'learn'; info: LearnInfo }

// レベルが あがったら「ステータスの かわりかた」、2レベルごとに「あたらしい わざ」
function celebrationsFor(
  bug: CaughtBug,
  res: { before: BugLevel; after: BugLevel; levelUps: number },
  saveAfter: StorySave,
  buddy: boolean,
): Celebration[] {
  if (res.levelUps <= 0) return []
  const a = statsWithLevel(bug, res.before.level)
  const b = statsWithLevel(bug, res.after.level)
  const out: Celebration[] = [
    {
      kind: 'level',
      info: {
        bugId: bug.id,
        name: bug.name,
        photo: mainPhoto(bug),
        fromLv: res.before.level,
        toLv: res.after.level,
        buddy,
        rows: [
          { label: 'たいりょく', emoji: '❤️', from: a.hp, to: b.hp },
          { label: 'こうげき', emoji: '⚔️', from: a.attack, to: b.attack },
          { label: 'ぼうぎょ', emoji: '🛡️', from: a.defense, to: b.defense },
          { label: 'すばやさ', emoji: '⚡', from: a.speed, to: b.speed },
        ],
      },
    },
  ]
  const learnLv = learnLevelCrossed(res.before.level, res.after.level)
  if (learnLv !== null) {
    const all = allMovesOf(saveAfter, bug)
    const before = moveSlots(res.before.level)
    const after = moveSlots(res.after.level)
    const nm = newMoveFor(bug, learnLv, all)
    if (nm) {
      out.push({
        kind: 'learn',
        info: {
          bugId: bug.id,
          name: bug.name,
          buddy,
          move: nm,
          current: all.slice(0, Math.max(1, before)),
          forcedIndex: after > before ? after - 1 : null,
        },
      })
    }
  }
  return out
}

export function StoryPage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('pickBug')
  const [mapMode, setMapMode] = useState<MapMode>('quest')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [stage, setStage] = useState<StoryStage | null>(null)
  // あるける マップ（えらんで いれば）
  const [field, setField] = useState<FieldDef | null>(null)
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
  // レベルアップした ときの「なにが どう かわったか」
  // あたらしい わざを おぼえる（レベル2ごと）
  // （じぶんの 虫と なかまの ぶんを、じゅんばんに 1まいずつ 見せる）
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  // たおした虫が なかまに なりたがっている
  const [recruit, setRecruit] = useState<{ bug: CaughtBug; level: number } | null>(null)
  // 2ひき いっしょの であいで、「〇〇が なかまの 〇〇を つれてきた！」を 見せたか
  const [allyIntroShown, setAllyIntroShown] = useState(false)
  // むしかご：つれていく なかま（この バトルだけ）
  const [companionId, setCompanionId] = useState<string | null>(null)
  const [pendingCell, setPendingCell] = useState<StoryCell | null>(null)
  const [cageOpen, setCageOpen] = useState(false)
  const [askRelease, setAskRelease] = useState<string | null>(null)
  const head = celebrations[0]
  const levelUp = head?.kind === 'level' ? head.info : null
  const learn = head?.kind === 'learn' ? head.info : null
  const popCelebration = () => setCelebrations((q) => q.slice(1))
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
    setCelebrations([])
    setRecruit(null)
    setCompanionId(null)
    setPendingCell(null)
    setCageOpen(false)
    setNotice(null)
  }

  function pickBug(b: CaughtBug) {
    sfx.tap()
    setMyBug(b)
    setPhase('pickMap')
  }

  function openStage(st: StoryStage) {
    sfx.tap()
    setField(null)
    setStage(st)
    setPos(currentIndex(save, st))
    setPhase('map')
    setNotice(null)
  }

  // あたらしい わざと とりかえる
  function swapMove(index: number) {
    if (!learn) return
    const who = bugs.find((b) => b.id === learn.bugId)
    if (!who) {
      popCelebration()
      return
    }
    sfx.special('attackUp')
    // わざが たりない 虫でも きえない ように、わくが なければ うしろに たす
    const moves = [...allMovesOf(save, who)]
    if (index < moves.length) moves[index] = learn.move
    else moves.push(learn.move)
    const next = setMoves(save, who.id, moves)
    setSave(next)
    saveStory(next)
    setNotice(`✨ ${who.name}は 「${learn.move.name}」を おぼえた！`)
    popCelebration()
  }

  // むしかごから にがす
  function doRelease(bugId: string) {
    const b = bugs.find((x) => x.id === bugId)
    sfx.dodge()
    const next = releaseFromCage(save, bugId)
    setSave(next)
    saveStory(next)
    if (companionId === bugId) setCompanionId(null)
    setNotice(b ? `👋 ${b.name} を にがして あげた。` : null)
  }

  // なかまに する
  function doRecruit() {
    if (!stage || !recruit) return
    sfx.discover()
    const next = addToCage(save, recruit.bug.id, recruit.level)
    setSave(next)
    saveStory(next)
    setNotice(`🤝 ${recruit.bug.name} が むしかごに なかま入り！`)
    setRecruit(null)
  }

  // あるける マップを ひらく（すごろくの かわり）
  function openField(f: FieldDef) {
    sfx.tap()
    setField(f)
    setStage({
      id: `field:${f.id}`,
      title: f.name,
      kind: 'place',
      cells: [],
      cols: 1,
      rows: 1,
      sceneIndex: 0,
    })
    setNotice(null)
    setPhase('field')
  }

  // あるいていて むしに であった
  function fieldEncounter() {
    if (!field) return
    const pool = bugsForField(field.id, bugs)
    if (pool.length === 0) {
      setNotice('この マップに 出る むしが きまっていないよ（せっていで えらべます）')
      return
    }
    // つるせ などは てきの レベルを じぶんの 虫に あわせる（-2〜+1）
    const pickLevel = () =>
      field.enemyLevel === 'player' && myBug
        ? Math.max(
            1,
            Math.min(MAX_LEVEL, levelOf(save, myBug.id).level + Math.floor(Math.random() * 4) - 2),
          )
        : 1
    const enemy = pool[Math.floor(Math.random() * pool.length)]
    const [encId] = assignEncounters([enemy.order], `f${Math.random()}`)
    const level = pickLevel()
    // 大きい あるく マップ（つるせ）では、たまに 2匹いっしょに であう
    const doubleUp = field.engine === 'world' && Math.random() < DOUBLE_ENCOUNTER_CHANCE
    const ally = doubleUp ? pool[Math.floor(Math.random() * pool.length)] : null
    setEncounterCell({
      index: -1,
      kind: 'battle',
      bugId: enemy.id,
      level,
      allyBugId: ally ? ally.id : undefined,
      allyLevel: ally ? pickLevel() : undefined,
      encounterId: encId,
      col: 0,
      row: 0,
    })
    setAllyIntroShown(false)
    setGoFlash(false)
    setPhase('encounter')
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
        beginBattle(cell)
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
        setAllyIntroShown(false)
        setGoFlash(false)
        setPhase('encounter')
        return
      }
      beginBattle(cell)
    }
  }

  // レベルぶんの ステータス＋つかえる わざ
  function statsFor(bug: CaughtBug, level: number) {
    return { ...statsWithLevel(bug, level), moves: movesOf(save, bug, level) }
  }

  // ── むしかごに なかまが いれば、つれていくか きいてから バトル
  function beginBattle(cell: StoryCell) {
    if (cageOf(save).length === 0) {
      startBattle(cell, null)
      return
    }
    setPendingCell(cell)
    setGoFlash(false)
    setPhase('party')
  }

  // ── バトルを はじめる
  function startBattle(cell: StoryCell, companion: string | null) {
    if (!myBug || !stage || !cell.bugId) return
    const enemy = bugs.find((b) => b.id === cell.bugId)
    if (!enemy) return
    const myLv = levelOf(save, myBug.id).level
    // じぶん＋なかま
    const mine: Fighter[] = [
      makeFighter(myBug, statsFor(myBug, myLv), 'me0', 'me', mainPhoto(myBug)),
    ]
    const buddy = companion ? bugs.find((x) => x.id === companion) : null
    if (buddy) {
      mine.push(
        makeFighter(buddy, statsFor(buddy, levelOf(save, buddy.id).level), 'me1', 'me', mainPhoto(buddy)),
      )
    }
    // てき（さきの ステージでは なかまを つれてくる）
    const foes: Fighter[] = [
      makeFighter(enemy, statsFor(enemy, cell.level ?? 1), 'foe0', 'foe', mainPhoto(enemy)),
    ]
    const foeAlly = cell.allyBugId ? bugs.find((b) => b.id === cell.allyBugId) : null
    if (foeAlly) {
      foes.push(
        makeFighter(foeAlly, statsFor(foeAlly, cell.allyLevel ?? 1), 'foe1', 'foe', mainPhoto(foeAlly)),
      )
    }
    setFighters([...mine, ...foes])
    setCompanionId(companion)
    setPendingCell(null)
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
        const queue: Celebration[] = celebrationsFor(myBug, res, next, false)
        // つれていった なかまにも おなじ けいけんち。レベルアップも わざも おなじように 見せる
        const buddy = companionId ? bugs.find((x) => x.id === companionId) : null
        if (buddy) {
          const pr = addExp(next, buddy.id, gain)
          next = pr.save
          queue.push(...celebrationsFor(buddy, pr, next, true))
        }
        if (queue.length > 0) {
          setCelebrations(queue)
          setTimeout(() => sfx.badge(), 200)
        }
      }
      // ときどき、たおした虫が なかまに なりたがる
      if (
        enemy &&
        enemy.id !== myBug.id &&
        !cageOf(next).includes(enemy.id) &&
        Math.random() < RECRUIT_CHANCE
      ) {
        setRecruit({ bug: enemy, level: battleCell.level ?? 1 })
      }
      setSave(next)
      saveStory(next)
      setNotice(msg)
    } else {
      setPos(currentIndex(save, stage))
      setNotice('😢 まけちゃった… レベルを あげて もういちど！')
    }
    setPhase(field ? 'field' : 'map')
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

  const learnModal = learn && (
    <div className="modal-backdrop">
      <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">✨</div>
        <h3>
          {learn.buddy && '🤝 '}
          {learn.name}は
          <br />
          {learn.forcedIndex !== null
            ? 'あたらしい わざを おぼえた！'
            : 'あたらしい わざを おぼえられる！'}
        </h3>
        <div className="story-learn-new">
          <span className="story-learn-emoji">{learn.move.emoji ?? '✨'}</span>
          <span className="story-learn-name">{learn.move.name}</span>
          <span className="story-learn-sub">
            {moveLabel(learn.move)}／{learn.move.uses}かい つかえる
          </span>
          <p className="story-learn-desc">{learn.move.desc}</p>
        </div>
        {learn.forcedIndex !== null ? (
          <button
            className="btn btn-big btn-primary"
            onClick={() => swapMove(learn.forcedIndex as number)}
          >
            やった！ 💪
          </button>
        ) : (
          <>
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
                popCelebration()
              }}
            >
              おぼえない
            </button>
          </>
        )}
      </div>
    </div>
  )

  const cageList = cageOf(save)
    .map((id) => bugs.find((b) => b.id === id))
    .filter((b): b is CaughtBug => !!b)

  const cageModal = cageOpen && (
    <div className="modal-backdrop" onClick={() => setCageOpen(false)}>
      <div className="modal story-cage" onClick={(e) => e.stopPropagation()}>
        <h3>🧺 むしかご</h3>
        {cageList.length === 0 ? (
          <p className="story-recruit-sub">
            まだ なかまが いないよ。バトルで たおした虫が ときどき なかまに なりたがるんだ。
          </p>
        ) : (
          <ul className="story-cage-list">
            {cageList.map((b) => (
              <li key={b.id}>
                <img src={mainPhoto(b)} alt={b.name} />
                <span className="story-cage-name">
                  {b.name}
                  <b>Lv {levelOf(save, b.id).level}</b>
                </span>
                {askRelease === b.id ? (
                  <span className="story-cage-confirm">
                    <button className="story-cage-yes" onClick={() => { doRelease(b.id); setAskRelease(null) }}>
                      にがす
                    </button>
                    <button className="story-cage-no" onClick={() => setAskRelease(null)}>
                      やめる
                    </button>
                  </span>
                ) : (
                  <button className="story-cage-free" onClick={() => { sfx.tap(); setAskRelease(b.id) }}>
                    👋 にがす
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn-big btn-primary" onClick={() => { sfx.tap(); setCageOpen(false); setAskRelease(null) }}>
          とじる
        </button>
      </div>
    </div>
  )

  const recruitModal = recruit && celebrations.length === 0 && (
    <div className="modal-backdrop">
      <div className="modal story-recruit" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">🤝</div>
        <img className="story-recruit-photo" src={mainPhoto(recruit.bug)} alt={recruit.bug.name} />
        <p className="story-recruit-text">
          たおれていた <b>{recruit.bug.name}</b> が おきあがり、
          <br />
          なかまに なりたそうに こっちを みている！
        </p>
        <p className="story-recruit-sub">
          なかまに すると、この マップの あいだ いっしょに たたかえるよ。
          （Lv {Math.max(1, recruit.level)} から／けいけんちも たまる）
        </p>
        <div className="battle-result-actions">
          <button className="btn btn-big btn-primary" onClick={doRecruit}>
            なかまに する 🤝
          </button>
          <button
            className="btn btn-big"
            onClick={() => {
              sfx.tap()
              setRecruit(null)
            }}
          >
            ことわる
          </button>
        </div>
      </div>
    </div>
  )

  const levelUpModal = levelUp && (
    <div className="modal-backdrop" onClick={popCelebration}>
      <div className="modal story-levelup" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">⭐</div>
        <h3>{levelUp.buddy ? '🤝 なかまが レベルアップ！' : 'レベルアップ！'}</h3>
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
        <button className="btn btn-big btn-primary" onClick={popCelebration}>
          つよくなった！ 💪
        </button>
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
              </div>
            )
          }}
        />
      </div>
    )
  }

  // ② マップえらび
  if (phase === 'pickMap') {
    // ばしょに ひもづかない 大きい マップ（つるせ など）の カード
    const bigMapCard = (f: FieldDef) => (
      <div key={`big-${f.id}`} className="story-map-row">
        <button className="story-map story-map-big" onClick={() => openField(f)}>
          <span className="story-map-thumb">
            {f.thumb ? (
              <img className="story-map-img" src={publicUrl(f.thumb)} alt="" />
            ) : (
              <ParkScene index={0} fit="meet" />
            )}
          </span>
          <span className="story-map-body">
            <span className="story-map-name">🚶 {f.name}</span>
            <span className="story-map-sub">あるいて さがす 大きな マップ</span>
            <span className="story-map-sub">
              {f.enemyLevel === 'player'
                ? 'てきは じぶんと おなじくらいの レベル'
                : 'ずかんの 虫が あいて'}
            </span>
          </span>
        </button>
      </div>
    )
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
              {fieldsInList('quest').map(bigMapCard)}
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
            {fieldsInList('place').length > 0 && (
              <div className="story-map-list story-map-list-big">
                {fieldsInList('place').map(bigMapCard)}
              </div>
            )}
            {places.length === 0 ? (
              <p className="pick-so-far">
                まだ「みつけたばしょ」が ないみたい。ずかんで ばしょを 書くと マップが ふえるよ。
              </p>
            ) : (
              <div className="story-map-list">
                {places.map((p) => {
                  const walkable = fieldForPlace(p.place)
                  const st = buildStage(bugs, p.place)
                  const done = (save.cleared[st.id] ?? []).length
                  const goal = !!save.goal[st.id]
                  return (
                    <div key={p.place} className="story-map-row">
                      <button
                        className="story-map"
                        onClick={() => (walkable ? openField(walkable) : openStage(st))}
                      >
                        <span className="story-map-thumb">
                          <ParkScene index={st.sceneIndex} fit="meet" />
                        </span>
                        <span className="story-map-body">
                          <span className="story-map-name">
                            {goal && '🏆 '}
                            {walkable && '🚶 '}
                            {p.place}
                          </span>
                          <span className="story-map-sub">
                            {walkable
                              ? 'あるいて さがす マップ'
                              : `${parkName(st.sceneIndex)}／てき ${p.count}ひき（たおした ${done}）`}
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
        {cageOf(save).length > 0 && (
          <button
            className="btn btn-ghost story-cage-open"
            onClick={() => { sfx.tap(); setCageOpen(true) }}
          >
            🧺 むしかご（{cageOf(save).length}ひき）を みる
          </button>
        )}
        <button className="btn btn-ghost battle-back" onClick={reset}>
          ← つかう虫を えらびなおす
        </button>
        {resetModal}
        {cageModal}
      </div>
    )
  }

  // ③' あるける マップ（フィールド）
  if (phase === 'field' && field && myBug) {
    const pool = bugsForField(field.id, bugs)
    // レベルアップや わざの がめんを 見ている あいだは あるかない（うしろで であわない ように）
    const fieldPaused = celebrations.length > 0 || !!recruit || cageOpen
    return (
      <>
        {field.engine === 'world' ? (
          <WorldMap
            base={field.base}
            paused={fieldPaused}
            onEncounter={fieldEncounter}
            onError={() => setNotice('マップを よみこめませんでした')}
          />
        ) : (
          <FieldMap
            base={field.base}
            paused={fieldPaused}
            onEncounter={fieldEncounter}
            onError={() => setNotice('マップを よみこめませんでした')}
          />
        )}
        <div className="field-top">
          <button
            className="btn btn-ghost field-back"
            onClick={() => {
              sfx.tap()
              setField(null)
              setPhase('pickMap')
            }}
          >
            ← もどる
          </button>
          <span className="field-place">{field.name}</span>
          <div className="field-bug">
            <img src={mainPhoto(myBug)} alt="" />
            <span>
              {myBug.name} <b>Lv {myLevel.level}</b>
            </span>
          </div>
          {cageOf(save).length > 0 && (
            <button
              className="btn btn-ghost field-cage"
              onClick={() => {
                sfx.tap()
                setCageOpen(true)
              }}
            >
              🧺{cageOf(save).length}
            </button>
          )}
        </div>
        <p className="field-hint">あるくと むしに であうよ</p>
        {notice && <p className="story-notice field-notice">{notice}</p>}
        {pool.length === 0 && (
          <p className="story-notice field-notice">
            この マップに 出る むしが まだ きまっていません（⚙️ せっていで えらべます）
          </p>
        )}
        {levelUpModal}
        {learnModal}
        {recruitModal}
        {cageModal}
      </>
    )
  }

  // ③.5 であいの おはなし
  if (phase === 'encounter' && stage && encounterCell) {
    const enemy = bugs.find((b) => b.id === encounterCell.bugId)
    const enc = findEncounter(encounterCell.encounterId)
    const lv = encounterCell.level ?? 1
    // 2ひき いっしょの であいなら、バトルの まえに「なかまを つれてきた」を 1回 見せる
    const allyBug = encounterCell.allyBugId ? bugs.find((b) => b.id === encounterCell.allyBugId) : null
    const allyIntroModal = allyBug && enemy && !allyIntroShown && (
      <div className="modal-backdrop">
        <div className="modal story-recruit" onClick={(e) => e.stopPropagation()}>
          <div className="story-levelup-emoji">👥</div>
          <img className="story-recruit-photo" src={mainPhoto(allyBug)} alt={allyBug.name} />
          <p className="story-recruit-text">
            <b>{enemy.name}</b> が なかまの <b>{allyBug.name}</b> を つれてきた！
          </p>
          <p className="story-recruit-sub">2ひき いっしょに たたかう ことに なるよ。</p>
          <div className="battle-result-actions">
            <button
              className="btn btn-big btn-primary"
              onClick={() => {
                sfx.tap()
                setAllyIntroShown(true)
              }}
            >
              わかった
            </button>
          </div>
        </div>
      </div>
    )
    return (
      <div className="story-encounter">
        <ParkScene index={stage.sceneIndex} />
        {allyIntroModal}
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
              window.setTimeout(() => beginBattle(encounterCell), 950)
            }}
          >
            バトル かいし ⚔️
          </button>
          <button
            className="btn btn-ghost battle-back"
            onClick={() => {
              if (goFlash) return
              sfx.tap()
              if (stage) setPos(currentIndex(save, stage))
              setEncounterCell(null)
              setPhase(field ? 'field' : 'map')
            }}
          >
            ← マップに もどる
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

  // ③.7 なかまを つれていく？
  if (phase === 'party' && stage && pendingCell) {
    const enemy = bugs.find((b) => b.id === pendingCell.bugId)
    const foeAlly = pendingCell.allyBugId ? bugs.find((b) => b.id === pendingCell.allyBugId) : null
    const start = (id: string | null) => {
      if (goFlash) return
      setGoFlash(true)
      sfx.battleStart()
      window.setTimeout(() => startBattle(pendingCell, id), 950)
    }
    return (
      <div className="story-encounter">
        <ParkScene index={stage.sceneIndex} />
        <div className="story-enc-inner">
          <p className="story-party-foe">
            あいて：<b>{enemy?.name}</b>
            {(pendingCell.level ?? 1) > 1 && ` Lv${pendingCell.level}`}
            {foeAlly && <> と <b>{foeAlly.name}</b></>}
          </p>
          <h3 className="story-party-title">なかまを つれていく？</h3>
          <div className="story-party-list">
            {cageList.map((b) => (
              <button key={b.id} className="story-party-pick" onClick={() => start(b.id)}>
                <img src={mainPhoto(b)} alt={b.name} />
                <span className="story-party-name">{b.name}</span>
                <span className="story-party-lv">Lv {levelOf(save, b.id).level}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-big btn-primary story-enc-go" onClick={() => start(null)}>
            ひとりで いく 🐛
          </button>
          <button
            className="btn btn-ghost battle-back"
            onClick={() => { sfx.tap(); setPendingCell(null); setPhase(field ? 'field' : 'map') }}
          >
            ← もどる
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
        big={fighters.length <= 2}
        sceneIndex={stage?.sceneIndex}
        quitLabel="✕ にげる"
        startLog="⚔️ てきが あらわれた！"
        onQuit={() => {
          if (stage) setPos(currentIndex(save, stage))
          setPhase(field ? 'field' : 'map')
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
          <button className="btn btn-big" onClick={() => { sfx.tap(); setPhase('pickMap') }}>
            ← べつの マップへ 🗺️
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
          {cageOf(save).length > 0 && (
            <button
              className="btn btn-ghost story-hud-back story-cage-btn"
              onClick={() => { sfx.tap(); setCageOpen(true) }}
              title="むしかご"
            >
              🧺<b>{cageOf(save).length}</b>
            </button>
          )}
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

        <button
          className="btn btn-ghost battle-back"
          onClick={() => {
            sfx.tap()
            setPhase('pickMap')
          }}
        >
          ← マップを えらびなおす
        </button>

        {askAgain && (
          <div className="modal-backdrop" onClick={() => setAskAgain(null)}>
            <div className="modal story-ask" onClick={(e) => e.stopPropagation()}>
              <h3>もういちど たたかう？</h3>
              <p>
                {bugs.find((b) => b.id === askAgain.bugId)?.name} と もう一度 しょうぶできるよ。
                （けいけんちは はんぶん）
              </p>
              <div className="battle-result-actions">
                <button className="btn btn-big btn-primary" onClick={() => beginBattle(askAgain)}>
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
        {recruitModal}
        {cageModal}
      </div>
    )
  }

  return (
    <div className="story">
      <button className="btn btn-big" onClick={reset}>さいしょから</button>
    </div>
  )
}
