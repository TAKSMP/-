// =============================================================
//  つうしんバトルの せんとう画面
// -------------------------------------------------------------
//  ・1たい1／2たい2 りょうほう つかえる（ホストと ゲストで にんずうが
//    ちがっても OK。エンジンは がわごとの にんずうを きにしない）。
//  ・field の けいさんは ホストの はしだけが する。ゲストは うけとって 見るだけ。
//  ・じぶんの がわの 生きている虫 ぜんいんぶん、じゅんばんに わざを えらび、
//    そろったら 1かいだけ Firebase に 送る。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { SpecialMoveV2 } from '../types'
import { type Command, type Field, type Fighter, type Side } from '../lib/battleEngine'
import {
  hydrateField,
  leaveRoom,
  resolveIfReady,
  submitCommands,
  watchRoom,
  type LiteField,
  type LiteFighter,
  type Role,
  type RoomState,
  type Team,
} from '../lib/netBattle'
import { FighterSlot } from './BattleStage'
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
  const mySide: Side = role === 'host' ? 'me' : 'foe'
  const hostFieldRef = useRef<Field | null>(null)
  const resolvingRef = useRef(false)
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

  // かちまけの えんしゅつ音
  useEffect(() => {
    if (!room?.field?.over) return
    const iWon = room.field.winner === mySide
    setConfetti(iWon)
    if (iWon) sfx.win(); else sfx.lose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.field?.over])

  // field が すすんだら、つぎのターンの めいれいを えらべる ように もどす。
  // じぶんの がわの めいれいが そろったら、1かいだけ 送る。
  // （この2つを 1つの effect に まとめる のが たいせつ：べつべつの effect に すると、
  //   「turnCount が すすんだので cmds を リセットする」setCmds が まだ はんえいされていない
  //   おなじ コミットの なかで「送る effect」が ふるい cmds を 読んでしまい、
  //   まえの ターンの めいれいを つぎの ターンに 2重に 送ってしまう ことが あった）
  useEffect(() => {
    const turn = room?.field?.turnCount ?? 0
    if (turn !== seenTurnRef.current) {
      seenTurnRef.current = turn
      setCmds([])
      setPendingMove(null)
      resolvingRef.current = false
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

  const shown = liteField.fighters.map((f) => toDisplayFighter(f, photoOf(f.uid)))
  const foeFighters = shown.filter((f) => f.side !== mySide)
  const myFighters = shown.filter((f) => f.side === mySide)
  const over = liteField.over
  const iWon = over && liteField.winner === mySide
  const cur = !over ? nextActor(shown, mySide, cmds) : undefined
  const waiting = !over && !cur

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
        hurt={false}
        glow={false}
        rankUp={null}
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
      <span className="stage-turn">ターン {liteField.turnCount}</span>

      <div className="stage-scene stage2">
        <div className="stage2-side foe">{foeFighters.map(slotOf)}</div>
        <div className="stage2-side me">{myFighters.map(slotOf)}</div>
      </div>

      <div className="stage-bottom">
        <div className="stage-log net-battle-log">
          {(liteField.log ?? []).length === 0 ? (
            <p>⚡ すばやい むしから こうどう するよ！</p>
          ) : (
            liteField.log.map((line, i) => <p key={i}>{line}</p>)
          )}
        </div>

        {over ? (
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
