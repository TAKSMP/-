// =============================================================
//  つうしんバトル（インターネットごしに 1たい1／2たい2）
// -------------------------------------------------------------
//  ・ストーリーモードで そだてた 虫を 1ぴき えらんで もっていく
//    （すきな なかまを もう1ぴき つれていくことも できる）
//  ・「部屋を つくる」→ コードが 出る → もう片方が それを 入れて 参加
//  ・field の けいさんは 部屋を つくった がわ（ホスト）だけが する
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { mainPhoto } from '../lib/storage'
import { levelOf, loadStory, movesOf, statsWithLevel, type StorySave } from '../lib/story'
import { BugPicker } from '../components/BugPicker'
import { NetBattleStage } from '../components/NetBattleStage'
import {
  BUILD_ID,
  buildSnapshot,
  createRoom,
  joinRoom,
  leaveRoom,
  watchRoom,
  type Role,
  type RoomState,
  type Team,
} from '../lib/netBattle'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
}

// まえに 入れた なまえを おぼえておく（毎回 入れなおさなくて いいように）
const NAME_KEY = 'chomushi.netbattle.name'
function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // ほぞんできなくても きにしない
  }
}

type Phase =
  | 'pickBug'
  | 'askAlly'
  | 'pickAlly'
  | 'name'
  | 'menu'
  | 'waitingHost'
  | 'joinEnter'
  | 'battle'

const moveLabel = (m: SpecialMoveV2) =>
  (m.ultimate ? '👑 ' : '') + (m.kind === 'attack' ? `いりょく${m.power}` : 'へんかわざ')

function bugCard(save: StorySave, b: CaughtBug, onViewMoves: (b: CaughtBug) => void) {
  const lv = levelOf(save, b.id)
  const s = statsWithLevel(b, lv.level)
  return (
    <div className="story-bug">
      <img src={mainPhoto(b)} alt={b.name} />
      <span className="story-bug-name">{b.name}</span>
      <span className="story-bug-lv">Lv {lv.level}</span>
      <span className="story-bug-stats">
        ❤️{s.hp} ⚔️{s.attack} 🛡️{s.defense} ⚡{s.speed}
      </span>
      <button
        type="button"
        className="btn btn-ghost story-bug-moves-btn"
        onClick={(e) => {
          e.stopPropagation()
          sfx.tap()
          onViewMoves(b)
        }}
      >
        📜 わざを みる
      </button>
    </div>
  )
}

export function NetBattlePage({ bugs }: Props) {
  const [save] = useState<StorySave>(() => loadStory())
  const [phase, setPhase] = useState<Phase>('pickBug')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [ally, setAlly] = useState<CaughtBug | null>(null)
  const [name, setName] = useState<string>(() => loadSavedName())
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 虫えらび画面で「わざをみる」を おした とき
  const [movesViewBug, setMovesViewBug] = useState<CaughtBug | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [])

  function pickBug(b: CaughtBug) {
    sfx.tap()
    setMyBug(b)
    setAlly(null)
    setPhase(bugs.length > 1 ? 'askAlly' : 'name')
  }

  function pickAlly(b: CaughtBug) {
    sfx.tap()
    setAlly(b)
    setPhase('name')
  }

  function buildTeam(): Team {
    if (!myBug) return []
    const team = [buildSnapshot(myBug, save)]
    if (ally) team.push(buildSnapshot(ally, save))
    return team
  }

  function goMenu() {
    if (!name.trim()) {
      setError('なまえを 入れてね。')
      return
    }
    setError(null)
    sfx.tap()
    setPhase('menu')
  }

  async function doCreate() {
    if (!myBug) return
    setBusy(true)
    setError(null)
    try {
      const newCode = await createRoom(name.trim(), buildTeam())
      setCode(newCode)
      setRole('host')
      setPhase('waitingHost')
      unsubRef.current = watchRoom(newCode, (state: RoomState | null) => {
        if (state?.guest) {
          setPhase('battle')
          if (unsubRef.current) {
            unsubRef.current()
            unsubRef.current = null
          }
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '部屋を つくれませんでした。')
    } finally {
      setBusy(false)
    }
  }

  async function doJoin() {
    if (!myBug) return
    const trimmed = codeInput.trim().toUpperCase()
    if (trimmed.length !== 4) {
      setError('4もじの コードを 入れてね。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await joinRoom(trimmed, name.trim(), buildTeam())
      setCode(trimmed)
      setRole('guest')
      setPhase('battle')
    } catch (e) {
      setError(e instanceof Error ? e.message : '参加できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  function backToMenu() {
    if (code) leaveRoom(code).catch(() => {})
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    setCode(null)
    setRole(null)
    setPhase('menu')
  }

  if (phase === 'battle' && code && role) {
    return <NetBattleStage code={code} role={role} onQuit={backToMenu} />
  }

  const movesViewModal = movesViewBug && (
    <div className="modal-backdrop" onClick={() => setMovesViewBug(null)}>
      <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setMovesViewBug(null)} aria-label="とじる">
          ✕
        </button>
        <h3>{movesViewBug.name}の わざ</h3>
        <div className="story-learn-list">
          {movesOf(save, movesViewBug, levelOf(save, movesViewBug.id).level).map((m, i) => (
            <div key={m.id + i} className="story-learn-old story-learn-old-view">
              <span className="story-learn-old-name">
                {m.emoji ?? '✨'} {m.name}
              </span>
              <span className="story-learn-old-sub">
                {moveLabel(m)}／{m.uses}かい つかえる
              </span>
              <p className="story-learn-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (phase === 'pickBug') {
    return (
      <div className="story">
        <h2 className="battle-step-title">① もっていく虫を えらぼう</h2>
        <p className="story-lead">ストーリーモードで そだてた虫の中から、1ぴき えらんでね。</p>
        <BugPicker bugs={bugs} onPick={pickBug} renderCard={(b) => bugCard(save, b, setMovesViewBug)} />
        {movesViewModal}
      </div>
    )
  }

  if (phase === 'askAlly') {
    return (
      <div className="story net-battle-menu">
        <h2 className="battle-step-title">② なかまも つれていく？</h2>
        <p className="story-lead">
          <b>{myBug?.name}</b> だけで いくか、すきな なかまを もう1ぴき つれていくか えらんでね。
        </p>
        <div className="net-battle-menu-actions">
          <button className="btn btn-big btn-primary" onClick={() => setPhase('pickAlly')}>
            🐛🐛 なかまも つれていく
          </button>
          <button
            className="btn btn-big"
            onClick={() => {
              sfx.tap()
              setAlly(null)
              setPhase('name')
            }}
          >
            🐛 この虫だけで いく
          </button>
        </div>
        <button className="btn btn-ghost battle-back" onClick={() => setPhase('pickBug')}>
          ← 虫を えらびなおす
        </button>
      </div>
    )
  }

  if (phase === 'pickAlly') {
    return (
      <div className="story">
        <h2 className="battle-step-title">なかまを えらぼう</h2>
        <p className="story-lead">
          <b>{myBug?.name}</b> と いっしょに たたかう、すきな なかまを 1ぴき えらんでね。
        </p>
        <BugPicker
          bugs={bugs.filter((b) => b.id !== myBug?.id)}
          onPick={pickAlly}
          renderCard={(b) => bugCard(save, b, setMovesViewBug)}
        />
        {movesViewModal}
        <button className="btn btn-ghost battle-back" onClick={() => setPhase('askAlly')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'name') {
    return (
      <div className="story net-battle-menu">
        <h2 className="battle-step-title">③ あなたの なまえ</h2>
        <p className="story-lead">
          <b>{[myBug?.name, ally?.name].filter(Boolean).join('・')}</b> を つれて いくよ！
        </p>
        <input
          className="net-battle-input"
          value={name}
          maxLength={10}
          placeholder="なまえ（10もじまで）"
          onChange={(e) => {
            setName(e.target.value)
            saveName(e.target.value)
          }}
        />
        {error && <p className="story-notice">{error}</p>}
        <button className="btn btn-big btn-primary" onClick={goMenu}>
          つぎへ 👉
        </button>
        <button
          className="btn btn-ghost battle-back"
          onClick={() => setPhase(bugs.length > 1 ? 'askAlly' : 'pickBug')}
        >
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'menu') {
    return (
      <div className="story net-battle-menu">
        <h2 className="battle-step-title">④ たたかいばを つくる</h2>
        <div className="net-battle-menu-actions">
          <button className="btn btn-big btn-primary" disabled={busy} onClick={doCreate}>
            🆕 じぶんで つくる
          </button>
          <button className="btn btn-big" disabled={busy} onClick={() => setPhase('joinEnter')}>
            🔑 つくってもらう
          </button>
        </div>
        {error && <p className="story-notice">{error}</p>}
        <p className="net-battle-build">アプリの ばん: {BUILD_ID}</p>
        <button className="btn btn-ghost battle-back" onClick={() => setPhase('name')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'joinEnter') {
    return (
      <div className="story net-battle-menu">
        <h2 className="battle-step-title">コードを 入れてね</h2>
        <input
          className="net-battle-input net-battle-code-input"
          value={codeInput}
          maxLength={4}
          placeholder="ABCD"
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
        />
        {error && <p className="story-notice">{error}</p>}
        <button className="btn btn-big btn-primary" disabled={busy} onClick={doJoin}>
          参加する 🚪
        </button>
        <button className="btn btn-ghost battle-back" onClick={() => setPhase('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'waitingHost' && code) {
    return (
      <div className="story net-battle-menu">
        <h2 className="battle-step-title">あいてを まっています…</h2>
        <p className="net-battle-code-display">{code}</p>
        <p className="story-lead">この コードを、あいての 端末に つたえてね。</p>
        <button className="btn btn-ghost battle-back" onClick={backToMenu}>
          ← やめる
        </button>
      </div>
    )
  }

  return null
}
