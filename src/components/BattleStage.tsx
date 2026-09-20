// =============================================================
//  せんとう画面（ふつうのバトルと ストーリーモードで 共通）
// -------------------------------------------------------------
//  ・ファイターを わたすと、その1せんとうを さいごまで 面倒みる
//  ・ログは 1行ずつ タップで すすむ。テキストと HPゲージ・音・
//    うごきが かならず そろう（エンジンが 1行ごとの すがたを かえす）
//  ・おわったら onFinish で かちまけを かえす
//  あたらしい せんとうを はじめる ときは key を かえて つくり直すこと。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { SpecialMoveV2 } from '../types'
import {
  chooseCpuCommand,
  createField,
  resolveTurn,
  statusEmoji,
  statusLabel,
  type Command,
  type Field,
  type Fighter,
  type Side,
  type TurnStep,
} from '../lib/battleEngine'
import { BASIC_ATTACK } from '../lib/moveLibrary'
import { Confetti } from './Confetti'
import { ParkScene } from './ParkScene'
import { sfx } from '../lib/sound'

// -------------------------------------------------------------
//  たいりょくゲージ
// -------------------------------------------------------------
function HpBar({ f }: { f: Fighter }) {
  const pct = Math.max(0, Math.round((f.hp / f.maxHp) * 100))
  const low = f.hp <= f.maxHp * 0.3
  return (
    <div className="hpbar-wrap">
      <div className="hpbar">
        <div
          className={'hpbar-fill' + (low ? ' low' : '')}
          style={{ width: pct + '%' }}
        />
      </div>
      <span className="hpbar-num">
        {f.hp}/{f.maxHp}
      </span>
    </div>
  )
}

// -------------------------------------------------------------
//  えんしゅつの ための ちいさな しくみ
// -------------------------------------------------------------
// ログ1行から「だれを どう うごかすか」を よみとる
interface Cue {
  hurt?: string
  glow?: string
  rank?: { uid: string; up: boolean }
  faint?: string
  dodge?: boolean
  heal?: string
  moveName?: string
}

function cueFor(line: string, fighters: Fighter[]): Cue {
  const find = (test: (f: Fighter) => boolean) => fighters.find(test)?.uid
  const cue: Cue = {}

  const damaged =
    find((f) => line.includes(`${f.name}に `) && line.includes('ダメージ')) ??
    find((f) => line.includes(`${f.name}は どくで`)) ??
    find((f) => line.includes(`${f.name}は はんどうで`)) ??
    find((f) => line.includes(`${f.name}は HPを`))
  if (damaged) cue.hurt = damaged

  if (line.includes('よけた')) cue.dodge = true

  const acting =
    find((f) => line.includes(`${f.name}の「`)) ??
    find((f) => line.includes(`${f.name}の こうげき`))
  if (acting) cue.glow = acting

  const m = line.match(/「(.+?)」/)
  if (m) cue.moveName = m[1]

  const healed = find((f) => line.includes(`${f.name}の HPが`))
  if (healed && line.includes('かいふく')) cue.heal = healed

  if (line.startsWith('🔺') || line.startsWith('🔻')) {
    const uid = find((f) => line.includes(`${f.name}の `))
    if (uid) cue.rank = { uid, up: line.startsWith('🔺') }
  }

  const fainted = find((f) => line.includes(`${f.name}は たおれた`))
  if (fainted) cue.faint = fainted

  return cue
}

// わざの あじ に あわせて 音を えらぶ
function soundKind(m: SpecialMoveV2): string {
  if (m.healRatio || m.restSleep || m.regen || m.drainRatio) return 'heal'
  if (m.hits) return 'doubleAttack'
  if (m.kind === 'status') {
    return m.statChanges?.some((s) => s.to === 'self') ? 'attackUp' : 'defenseUp'
  }
  if (m.power >= 80) return 'powerStrike'
  return 'other'
}

// -------------------------------------------------------------
//  1ぴきぶんの ひょうじ（しゃしん＋なまえ＋HP＋バッジ）
// -------------------------------------------------------------
function FighterSlot({
  f,
  big,
  hurt,
  glow,
  rankUp,
  tappable,
  onTap,
}: {
  f: Fighter
  big: boolean
  hurt: boolean
  glow: boolean
  rankUp: boolean | null
  tappable: boolean
  onTap: () => void
}) {
  let photoCls = 'stage-photo'
  if (hurt) photoCls += ' hurt'
  if (glow) photoCls += ' fx-glow'

  return (
    <div
      className={
        'stage2-slot' +
        (big ? ' big' : '') +
        (f.fainted ? ' faint' : '') +
        (f.charging ? ' charging' : '') +
        (tappable ? ' tappable' : '')
      }
    >
      <div className="stage-namebox">
        <span className="fighter-name">
          {f.name}
          {f.status && (
            <span className="status-badge" title={statusLabel(f.status.key)}>
              {statusEmoji(f.status.key)}
              {statusLabel(f.status.key)}
            </span>
          )}
        </span>
        <HpBar f={f} />
      </div>
      <button
        type="button"
        className="stage2-photo-btn"
        disabled={!tappable}
        onClick={onTap}
        aria-label={f.name}
      >
        <img className={photoCls} src={f.photo} alt={f.name} />
        {f.charging && (
          <span className="stage2-overlay">
            {f.charging.hidden ? '🫥' : '⏳'}
          </span>
        )}
        {f.fainted && <span className="stage2-overlay">💫</span>}
        {rankUp !== null && (
          <span className="rank-pop">{rankUp ? '🔺' : '🔻'}</span>
        )}
        {tappable && <span className="stage2-aim">🎯</span>}
      </button>
    </div>
  )
}

// まだ めいれいを きめていない、じぶんの虫
function nextActor(f: Field, cmds: Command[]): Fighter | undefined {
  const decided = new Set(cmds.map((c) => c.actorUid))
  return f.fighters.find(
    (x) => x.side === 'me' && !x.fainted && !decided.has(x.uid),
  )
}

// -------------------------------------------------------------
//  本体
// -------------------------------------------------------------
export interface BattleResult {
  winner: Side | null
  turns: number
}

interface Props {
  fighters: Fighter[] // makeFighter で つくったもの（me と foe）
  big?: boolean // 1たい1なら しゃしんを 大きく
  startLog?: string // さいしょに 出す 1行
  quitLabel?: string
  sceneIndex?: number // せなかの 絵（ストーリーの ステージに あわせる）
  onQuit: () => void
  onFinish: (result: BattleResult) => void
}

export function BattleStage({
  fighters,
  big = false,
  startLog = '⚡ すばやい むしから こうどう するよ！',
  quitLabel = '✕ やめる',
  sceneIndex,
  onQuit,
  onFinish,
}: Props) {
  const [field, setField] = useState<Field>(() => createField(fighters))
  const [cmds, setCmds] = useState<Command[]>([])
  const [pendingMove, setPendingMove] = useState<{
    actorUid: string
    moveIndex: number
    move: SpecialMoveV2
  } | null>(null)
  const [visibleLog, setVisibleLog] = useState<string[]>([startLog])
  const [playback, setPlayback] = useState<{
    steps: TurnStep[]
    index: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [hurtUid, setHurtUid] = useState<string | null>(null)
  const [glowUid, setGlowUid] = useState<string | null>(null)
  const [rankPop, setRankPop] = useState<{ uid: string; up: boolean } | null>(null)

  const fieldRef = useRef<Field>(field)
  const cmdsRef = useRef<Command[]>([])
  const runningRef = useRef(false)
  const playbackRef = useRef<{ steps: TurnStep[]; index: number } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const finishedRef = useRef(false)
  // わざ名 → わざ（音を えらぶため）
  const moveMapRef = useRef<Map<string, SpecialMoveV2>>(
    (() => {
      const map = new Map<string, SpecialMoveV2>()
      for (const x of fighters) for (const m of x.moves) map.set(m.name, m)
      map.set(BASIC_ATTACK.name, BASIC_ATTACK)
      return map
    })(),
  )

  // はじまりの音
  useEffect(() => {
    sfx.battleStart()
  }, [])

  // ログを いちばん下へ
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleLog.length])

  // ── ためている／うごけない虫は、えらばせずに じどうで すすめる
  useEffect(() => {
    if (busy || pendingMove || field.over) return
    const cur = nextActor(field, cmds)
    if (cur && (cur.charging || cur.recharge > 0)) {
      pushCmd({ actorUid: cur.uid, moveIndex: -1, targetUid: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, cmds, busy, pendingMove])

  // ── ぜんいんの めいれいが そろったら 1ターン すすめる
  useEffect(() => {
    if (busy || field.over) return
    if (nextActor(field, cmds)) return
    const t = setTimeout(() => runTurn(), 260)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, cmds, busy])

  // ── しょうぶが ついたら（さいせいが おわってから）よびだし元へ かえす
  useEffect(() => {
    if (!field.over || busy || finishedRef.current) return
    finishedRef.current = true
    if (field.winner === 'me') {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 600)
      setTimeout(() => sfx.win(), 300)
    } else {
      setTimeout(() => sfx.lose(), 300)
    }
    const t = setTimeout(
      () => onFinish({ winner: field.winner, turns: field.turnCount - 1 }),
      1800,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.over, field.winner, busy])

  // ── めいれいを 1つ ためる
  function pushCmd(c: Command) {
    const next = [...cmdsRef.current, c]
    cmdsRef.current = next
    setCmds(next)
  }

  function needTarget(move: SpecialMoveV2, actor: Fighter): boolean {
    const f = fieldRef.current
    if (move.target === 'oneFoe') {
      return f.fighters.filter((x) => x.side !== actor.side && !x.fainted).length > 1
    }
    if (move.target === 'ally') {
      return (
        f.fighters.filter(
          (x) => x.side === actor.side && !x.fainted && x.uid !== actor.uid,
        ).length > 0
      )
    }
    return false
  }

  function chooseMove(actor: Fighter, moveIndex: number, move: SpecialMoveV2) {
    sfx.tap()
    if (needTarget(move, actor)) {
      setPendingMove({ actorUid: actor.uid, moveIndex, move })
      return
    }
    pushCmd({ actorUid: actor.uid, moveIndex, targetUid: null })
  }

  function pickTarget(uid: string) {
    const pm = pendingMove
    if (!pm) return
    sfx.tap()
    setPendingMove(null)
    pushCmd({ actorUid: pm.actorUid, moveIndex: pm.moveIndex, targetUid: uid })
  }

  // ── 1ターンぶんを けいさんして、さいせいを はじめる
  function runTurn() {
    if (runningRef.current) return
    const cur = fieldRef.current
    if (cur.over) return
    runningRef.current = true
    setBusy(true)

    const cpu = cur.fighters
      .filter((x) => x.side === 'foe' && !x.fainted)
      .map((x) => chooseCpuCommand(cur, x))
    const next = resolveTurn(cur, [...cmdsRef.current, ...cpu])

    fieldRef.current = next
    setField(next)
    cmdsRef.current = []
    setCmds([])

    if (next.steps.length === 0) {
      endPlayback()
      return
    }
    showStep(next.steps, 0)
  }

  // 1行ぶんを 見せる：テキスト・音・うごき・HPゲージを ぜんぶ そろえる
  function showStep(steps: TurnStep[], index: number) {
    const step = steps[index]
    const pb = { steps, index }
    playbackRef.current = pb
    setPlayback(pb)

    const cue = cueFor(step.line, step.fighters)
    setGlowUid(cue.glow ?? null)
    setHurtUid(cue.hurt ?? null)
    setRankPop(cue.rank ?? null)

    if (cue.moveName) {
      const m = moveMapRef.current.get(cue.moveName)
      sfx.special(m ? soundKind(m) : 'other')
    } else if (cue.dodge) {
      sfx.dodge()
    } else if (cue.faint) {
      sfx.error()
    } else if (cue.heal) {
      sfx.special('heal')
    } else if (cue.hurt) {
      sfx.hit()
    } else if (cue.rank) {
      if (cue.rank.up) sfx.special('attackUp')
      else sfx.dodge()
    }

    setVisibleLog((prev) => [...prev, step.line])
  }

  // つぎの 1行へ（がめんを タップ）
  function advanceStep() {
    const pb = playbackRef.current
    if (!pb) return
    const nextIndex = pb.index + 1
    if (nextIndex >= pb.steps.length) {
      endPlayback()
      return
    }
    showStep(pb.steps, nextIndex)
  }

  function endPlayback() {
    playbackRef.current = null
    setPlayback(null)
    setHurtUid(null)
    setGlowUid(null)
    setRankPop(null)
    runningRef.current = false
    setBusy(false)
  }

  // -----------------------------------------------------------
  //  みため
  // -----------------------------------------------------------
  const cur = !field.over ? nextActor(field, cmds) : undefined
  // さいせい中は そのときの スナップショット、ふだんは いまの ばめん
  const shownFighters = playback
    ? playback.steps[playback.index].fighters
    : field.fighters
  const foeFighters = shownFighters.filter((x) => x.side === 'foe')
  const myFighters = shownFighters.filter((x) => x.side === 'me')
  const shownTurn = playback ? field.turnCount - 1 : field.turnCount

  function isTappable(f: Fighter): boolean {
    if (!pendingMove || busy || f.fainted) return false
    const actor = field.fighters.find((x) => x.uid === pendingMove.actorUid)
    if (!actor) return false
    if (pendingMove.move.target === 'oneFoe') return f.side !== actor.side
    if (pendingMove.move.target === 'ally')
      return f.side === actor.side && f.uid !== actor.uid
    return false
  }

  function slotOf(f: Fighter) {
    return (
      <FighterSlot
        key={f.uid}
        f={f}
        big={big}
        hurt={hurtUid === f.uid}
        glow={glowUid === f.uid}
        rankUp={rankPop?.uid === f.uid ? rankPop.up : null}
        tappable={isTappable(f)}
        onTap={() => pickTarget(f.uid)}
      />
    )
  }

  return (
    <div className="battle-stage battle-stage2">
      {/* ストーリーの ときは その ステージの 公園を せなかに しく */}
      {sceneIndex !== undefined && (
        <div className="battle-bg">
          <ParkScene index={sceneIndex} />
        </div>
      )}
      <Confetti show={confetti} />
      <button className="battle-flee" onClick={onQuit}>
        {quitLabel}
      </button>
      <span className="stage-turn">ターン {shownTurn}</span>

      <div className="stage-scene stage2">
        <div className="stage2-side foe">{foeFighters.map(slotOf)}</div>
        <div className="stage2-side me">{myFighters.map(slotOf)}</div>
      </div>

      <div className="stage-bottom">
        <div
          className={'stage-log' + (playback ? ' tappable' : '')}
          ref={logRef}
          onClick={playback ? advanceStep : undefined}
        >
          {visibleLog.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {playback ? (
          <button className="stage-next" onClick={advanceStep}>
            つぎへ
            <span className="stage-next-arrow">▼</span>
          </button>
        ) : field.over || busy ? (
          <div className="stage-actions">
            <span className="stage-wait">{field.over ? '…' : 'たたかい中…'}</span>
          </div>
        ) : pendingMove ? (
          <>
            <p className="stage-prompt">
              🎯 「{pendingMove.move.name}」… だれを ねらう？{' '}
              <b>しゃしんを タップ！</b>
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
                    {m.kind === 'attack' ? `いりょく${m.power}` : 'へんかわざ'}
                    ／のこり{cur.usesLeft[i]}
                  </small>
                </button>
              ))}
              <button
                className="stage-btn atk"
                onClick={() => chooseMove(cur, -1, BASIC_ATTACK)}
              >
                <span>⚔️ こうげき</span>
                <small>なんかいでも つかえる</small>
              </button>
            </div>
          </>
        ) : (
          <div className="stage-actions">
            <span className="stage-wait">まってね…</span>
          </div>
        )}
      </div>
    </div>
  )
}
