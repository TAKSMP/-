// =============================================================
//  つうしんバトルの せんとう画面
// -------------------------------------------------------------
//  ・1たい1／2たい2 りょうほう つかえる（ホストと ゲストで にんずうが
//    ちがっても OK。エンジンは がわごとの にんずうを きにしない）。
//  ・field の けいさんは ホストの はしだけが する。ゲストは うけとって 見るだけ。
//  ・じぶんの がわの 生きている虫 ぜんいんぶん、じゅんばんに わざを えらび、
//    そろったら 1かいだけ Firebase に 送る。
// =============================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SpecialMoveV2 } from '../types'
import { type Command, type Field, type Fighter, type Side } from '../lib/battleEngine'
import {
  BUILD_ID,
  hydrateField,
  leaveRoom,
  resolveIfReady,
  submitCommands,
  watchRoom,
  type LiteField,
  type LiteFighter,
  type LiteStep,
  type Role,
  type RoomState,
  type Team,
} from '../lib/netBattle'
import { cueFor, FighterSlot, playCueSound } from './BattleStage'
import { BASIC_ATTACK } from '../lib/moveLibrary'
import { ParkScene } from './ParkScene'
import { Confetti } from './Confetti'
import { sfx } from '../lib/sound'

interface Props {
  code: string
  role: Role
  onQuit: () => void
}

const moveLabel = (m: SpecialMoveV2) => (m.kind === 'attack' ? `いりょく${m.power}` : 'へんかわざ')

// LiteFighter に しゃしんを もどして、ふつうの FighterSlot で つかえる かたちに
// Realtime Database は からの配列（[]）を おとして undefined に する くせが ある ので、
// もどってきた ときに かならず 配列に なるように しておく
function toDisplayFighter(lite: LiteFighter, photo: string): Fighter {
  return {
    ...lite,
    photo,
    bug: null as unknown as Fighter['bug'],
    statuses: lite.statuses ?? [],
    moves: lite.moves ?? [],
    usesLeft: lite.usesLeft ?? [],
  }
}

// まだ めいれいを きめていない、じぶんの がわの 生きている虫
// （LiteFighter・Fighter どちらの はいれつでも つかえるよう、さいしょうげんの かたちで うける）
function nextActor<T extends { uid: string; side: Side; fainted: boolean }>(
  fighters: T[],
  mySide: Side,
  cmds: Command[],
): T | undefined {
  const decided = new Set(cmds.map((c) => c.actorUid))
  return fighters.find((x) => x.side === mySide && !x.fainted && !decided.has(x.uid))
}

export function NetBattleStage({ code, role, onQuit }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [cmds, setCmds] = useState<Command[]>([])
  const [pendingMove, setPendingMove] = useState<{
    actorUid: string
    moveIndex: number
    move: SpecialMoveV2
  } | null>(null)
  const [confetti, setConfetti] = useState(false)
  // そのターンの ログを 1行ずつ 見せている さいちゅう（ふつうの バトルと おなじ）
  const [playback, setPlayback] = useState<{ steps: LiteStep[]; index: number } | null>(null)
  const mySide: Side = role === 'host' ? 'me' : 'foe'
  const hostFieldRef = useRef<Field | null>(null)
  const resolvingRef = useRef(false)
  const playbackPendingRef = useRef(false)
  const resultShownRef = useRef(false)
  const seenTurnRef = useRef(0)
  const submittedTurnRef = useRef(0)
  const leftRef = useRef(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    const unsub = watchRoom(code, (state) => {
      loadedRef.current = true
      setRoom(state)
    })
    return () => unsub()
  }, [code])

  // 部屋が きえたら（あいてが ぬけた など）もとの がめんへ。
  // さいしょの 1かい（まだ Firebase から なにも とどいていない とき）は むし。
  useEffect(() => {
    if (loadedRef.current && room === null && !leftRef.current) {
      leftRef.current = true
      onQuit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  // field が すすんだら、つぎのターンの めいれいを えらべる ように もどし、
  // そのターンの ログの さいせいを はじめる。
  // じぶんの がわの めいれいが そろったら、1かいだけ 送る。
  // （この2つを 1つの effect に まとめる のが たいせつ：べつべつの effect に すると、
  //   「turnCount が すすんだので cmds を リセットする」setCmds が まだ はんえいされていない
  //   おなじ コミットの なかで「送る effect」が ふるい cmds を 読んでしまい、
  //   まえの ターンの めいれいを つぎの ターンに 2重に 送ってしまう ことが あった。
  //   また useLayoutEffect なのは、あたらしい field が とどいた しゅんかんに
  //   けっか画面や わざ えらびが 1コマ ちらつかない ように する ため）
  useLayoutEffect(() => {
    const turn = room?.field?.turnCount ?? 0
    if (turn !== seenTurnRef.current) {
      const firstLoad = seenTurnRef.current === 0
      seenTurnRef.current = turn
      setCmds([])
      setPendingMove(null)
      resolvingRef.current = false
      const steps = room?.field?.steps ?? []
      if (!firstLoad && steps.length > 0) {
        playbackPendingRef.current = true
        setPlayback({ steps, index: 0 })
      }
      return // このレンダーの cmds は もう ふるい ので、送信チェックは しない
    }
    if (!room?.field || room.field.over) return
    if (submittedTurnRef.current === turn) return
    const fighters = room.field.fighters
    if (nextActor(fighters, mySide, cmds)) return
    if (cmds.length === 0) return
    submittedTurnRef.current = turn
    submitCommands(code, role, cmds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmds, room?.field, code, role, mySide])

  // 1行ごとに 音を ならす（さいせい中の 行が かわるたび）
  useEffect(() => {
    if (!playback || !room?.field) return
    const step = playback.steps[playback.index]
    if (!step) return
    const moveMap = new Map<string, SpecialMoveV2>()
    for (const f of room.field.fighters) for (const m of f.moves ?? []) moveMap.set(m.name, m)
    moveMap.set(BASIC_ATTACK.name, BASIC_ATTACK)
    playCueSound(cueFor(step.line, room.field.fighters), moveMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback])

  // かちまけの えんしゅつ（さいせいが おわってから）
  useEffect(() => {
    if (!room?.field?.over || playback || playbackPendingRef.current) return
    if (resultShownRef.current) return
    resultShownRef.current = true
    const iWon = room.field.winner === mySide
    setConfetti(iWon)
    if (iWon) sfx.win(); else sfx.lose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.field?.over, playback])

  // ホストだけ：両方の てが そろったら すすめる
  useEffect(() => {
    if (role !== 'host' || !room?.field || !room.guest) return
    if (resolvingRef.current) return
    if (room.commands?.host && room.commands.guest) {
      resolvingRef.current = true
      // てもとに 本物の Field が 無ければ（さいしょの ターン／さいよみこみ 直後）、
      // 同期ずみの field から くみたてなおしてから すすめる
      if (!hostFieldRef.current) {
        hostFieldRef.current = hydrateField(room.field, room.host.team, room.guest.team)
      }
      const next = resolveIfReady(code, hostFieldRef.current, room.commands)
      if (next) hostFieldRef.current = next
    }
  }, [role, room, code])

  if (!room || !room.guest || !room.field) return null
  const liteField: LiteField = room.field
  const hostTeam: Team = room.host.team
  const guestTeam: Team = room.guest.team

  const photoOf = (uid: string) => {
    const m = uid.match(/^(me|foe)(\d+)$/)
    if (!m) return ''
    const team = m[1] === 'me' ? hostTeam : guestTeam
    return team[Number(m[2])]?.photo ?? ''
  }

  // さいせい中は「その行の ときの すがた」を、ふだんは いまの field を 見せる
  const step = playback ? playback.steps[playback.index] : null
  const shown = liteField.fighters.map((f) => {
    const base = toDisplayFighter(f, photoOf(f.uid))
    const snap = step?.fighters?.find((x) => x.uid === base.uid)
    if (!snap) return base
    return {
      ...base,
      hp: snap.hp,
      fainted: snap.fainted,
      statuses: snap.statuses ?? [],
      rank: snap.rank ?? base.rank,
      charging: snap.charging
        ? { move: base.moves[0] ?? BASIC_ATTACK, targetUid: null, hidden: snap.charging.hidden }
        : null,
    }
  })
  const cue = step ? cueFor(step.line, shown) : null
  const foeFighters = shown.filter((f) => f.side !== mySide)
  const myFighters = shown.filter((f) => f.side === mySide)
  const fieldOver = liteField.over
  const over = fieldOver && !playback
  const iWon = over && liteField.winner === mySide
  const cur = !fieldOver ? nextActor(shown, mySide, cmds) : undefined
  const waiting = !fieldOver && !cur
  const opponentBuild = (role === 'host' ? room.guest : room.host).build
  const buildMismatch = opponentBuild !== BUILD_ID
  const shownTurn = playback ? liteField.turnCount - 1 : liteField.turnCount

  // つぎの 1行へ（がめんを タップ）。さいごまで 見たら おわり
  function advanceStep() {
    if (!playback) return
    if (playback.index + 1 >= playback.steps.length) {
      playbackPendingRef.current = false
      setPlayback(null)
      return
    }
    setPlayback({ steps: playback.steps, index: playback.index + 1 })
  }

  function needTarget(move: SpecialMoveV2, actor: Fighter): boolean {
    if (move.target === 'oneFoe') {
      return shown.filter((x) => x.side !== actor.side && !x.fainted).length > 1
    }
    if (move.target === 'ally') {
      return shown.filter((x) => x.side === actor.side && !x.fainted && x.uid !== actor.uid).length > 0
    }
    return false
  }

  function chooseMove(actor: Fighter, moveIndex: number, move: SpecialMoveV2) {
    if (cur?.uid !== actor.uid) return
    sfx.tap()
    if (needTarget(move, actor)) {
      setPendingMove({ actorUid: actor.uid, moveIndex, move })
      return
    }
    setCmds((prev) => [...prev, { actorUid: actor.uid, moveIndex, targetUid: null }])
  }

  function pickTarget(uid: string) {
    const pm = pendingMove
    if (!pm) return
    sfx.tap()
    setPendingMove(null)
    setCmds((prev) => [...prev, { actorUid: pm.actorUid, moveIndex: pm.moveIndex, targetUid: uid }])
  }

  function isTappable(f: Fighter): boolean {
    if (!pendingMove || f.fainted) return false
    const actor = shown.find((x) => x.uid === pendingMove.actorUid)
    if (!actor) return false
    if (pendingMove.move.target === 'oneFoe') return f.side !== actor.side
    if (pendingMove.move.target === 'ally') return f.side === actor.side
    return false
  }

  function quit() {
    leftRef.current = true
    leaveRoom(code)
    onQuit()
  }

  function slotOf(f: Fighter) {
    return (
      <FighterSlot
        key={f.uid}
        f={f}
        big={myFighters.length === 1 && foeFighters.length === 1}
        hurt={cue?.hurt === f.uid}
        glow={cue?.glow === f.uid}
        rankUp={cue?.rank?.uid === f.uid ? cue.rank.up : null}
        tappable={isTappable(f)}
        onTap={() => pickTarget(f.uid)}
      />
    )
  }

  return (
    <div className="battle-stage battle-stage2 net-battle">
      <div className="battle-bg">
        <ParkScene index={0} />
      </div>
      <Confetti show={confetti} />
      <button className="battle-flee" onClick={quit}>
        ✕ やめる
      </button>
      <span className="stage-turn">ターン {shownTurn}</span>

      <div className="stage-scene stage2">
        <div className="stage2-side foe">{foeFighters.map(slotOf)}</div>
        <div className="stage2-side me">{myFighters.map(slotOf)}</div>
      </div>

      <div className="stage-bottom">
        {buildMismatch && (
          <p className="net-battle-warn">
            ⚠️ あいての アプリの ばんが ちがうよ。りょうほうの ページを 読みこみなおしてね。
          </p>
        )}
        <div
          className={'stage-log net-battle-log' + (playback ? ' tappable' : '')}
          onClick={playback ? advanceStep : undefined}
        >
          {playback ? (
            playback.steps.slice(0, playback.index + 1).map((s, i) => <p key={i}>{s.line}</p>)
          ) : (liteField.log ?? []).length === 0 ? (
            <p>⚡ すばやい むしから こうどう するよ！</p>
          ) : (
            liteField.log.map((line, i) => <p key={i}>{line}</p>)
          )}
        </div>

        {playback ? (
          <button className="stage-next" onClick={advanceStep}>
            つぎへ
            <span className="stage-next-arrow">▼</span>
          </button>
        ) : over ? (
          <div className="stage-actions">
            <p className="net-battle-result">{iWon ? '🏆 かった！' : '😢 まけちゃった…'}</p>
            <button className="btn btn-big btn-primary" onClick={quit}>
              もどる
            </button>
          </div>
        ) : pendingMove ? (
          <>
            <p className="stage-prompt">
              🎯 「{pendingMove.move.name}」… だれを ねらう？ <b>しゃしんを タップ！</b>
            </p>
            <div className="stage-actions">
              <button
                className="stage-btn atk"
                onClick={() => {
                  sfx.tap()
                  setPendingMove(null)
                }}
              >
                ← わざを えらびなおす
              </button>
            </div>
          </>
        ) : waiting ? (
          <div className="stage-actions">
            <span className="stage-wait">🕐 あいてを まっています…</span>
          </div>
        ) : cur ? (
          <>
            <p className="stage-prompt">
              🐛 <b>{cur.name}</b> は なにを する？
            </p>
            <div className="stage2-moves">
              {cur.moves.map((m, i) => (
                <button
                  key={m.id + i}
                  className="stage-btn sp"
                  disabled={cur.usesLeft[i] <= 0}
                  onClick={() => chooseMove(cur, i, m)}
                >
                  <span>
                    {m.emoji ?? '✨'} {m.name}
                  </span>
                  <small>
                    {moveLabel(m)}／のこり{cur.usesLeft[i]}
                  </small>
                </button>
              ))}
              <button className="stage-btn atk" onClick={() => chooseMove(cur, -1, BASIC_ATTACK)}>
                <span>⚔️ こうげき</span>
                <small>なんかいでも つかえる</small>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
