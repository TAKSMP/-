// =============================================================
//  ちょうむしカードゲーム：たたかいの がめん（CPU・つうしん きょうつう）
// -------------------------------------------------------------
//  ・うえが あいて、したが じぶん。まえの 2ひきは おおきく、ひかえは まるい しゃしん
//  ・ラウンドの けっかは 1ぎょうずつ ながして見せる（タップで はやおくり）
//  ・わざえらび：虫ごとに わざ（または こうげき）→ ねらう あいてを タップ
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, CardMove } from '../lib/cardGame/cards'
import {
  activeOf,
  alive,
  fighter,
  needsCommand,
  other,
  renderText,
  targetKind,
  type CCommand,
  type CEvent,
  type CF,
  type CState,
  type SideId,
  type Snap,
} from '../lib/cardGame/engine'
import { sfx } from '../lib/sound'
import { CardFace, MoveBox, TierBadge, UsesDots } from './CardView'

interface Props {
  state: CState
  me: SideId
  photos: Record<string, string> // uid → しゃしん
  myName: string
  foeName: string
  waiting?: boolean // つうしん：あいてを まっている
  onCommands: (cmds: CCommand[]) => void
  onQuit: () => void
  onAgain?: () => void
}

const STEP_MS: Record<string, number> = { big: 1100, hit: 950, faint: 1200, heal: 900, status: 950, enter: 900 }

function chipIcons(c?: [number, number, number]): string {
  if (!c) return ''
  const up = ['🔺', '🛡️', '💨']
  const down = ['🔻', '💔', '🐢']
  return c.map((n, i) => (n > 0 ? up[i].repeat(n) : n < 0 ? down[i].repeat(-n) : '')).join('')
}

function Panel({
  f,
  snap,
  photo,
  ev,
  pickable,
  onPick,
  onInfo,
  current,
}: {
  f: CF
  snap: Snap
  photo?: string
  ev?: CEvent
  pickable?: boolean
  onPick?: () => void
  onInfo?: () => void
  current?: boolean
}) {
  const rate = Math.max(0, snap.h / f.card.hp)
  const isActor = ev?.a === f.uid
  const isTarget = ev?.g?.includes(f.uid)
  const fx = isTarget ? ev?.fx : undefined
  return (
    <button
      type="button"
      className={
        'cg-panel' +
        (snap.f ? ' out' : '') +
        (isActor ? ' actor' : '') +
        (fx ? ` fx-${fx}` : '') +
        (pickable ? ' pick' : '') +
        (current ? ' cur' : '') +
        (snap.x?.includes('🙈') ? ' hidden' : '')
      }
      onClick={() => (pickable ? onPick?.() : onInfo?.())}
    >
      <span className="cg-panel-photo">
        {photo ? <img src={photo} alt="" /> : '🐛'}
        {isTarget && ev?.n ? <span className={`cg-pop ${ev.fx === 'heal' ? 'heal' : ''}`}>{ev.fx === 'heal' ? '+' : '-'}{ev.n}</span> : null}
        {pickable && <span className="cg-panel-aim">🎯</span>}
      </span>
      <span className="cg-panel-info">
        <span className="cg-panel-name">
          <TierBadge tier={f.card.tier} />
          {f.card.name}
        </span>
        <span className="cg-hp">
          <span className="cg-hp-bar">
            <i style={{ width: `${rate * 100}%` }} className={rate <= 0.25 ? 'low' : rate <= 0.5 ? 'mid' : ''} />
          </span>
          <b>
            {snap.h}
            <small>/{f.card.hp}</small>
          </b>
        </span>
        <span className="cg-panel-chips">
          {snap.s}
          {chipIcons(snap.c)}
          {snap.x}
        </span>
      </span>
    </button>
  )
}

export function CardBattleStage({ state, me, photos, myName, foeName, waiting, onCommands, onQuit, onAgain }: Props) {
  const foe = other(me)
  const events = state.events
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(true)
  const lastState = useRef<CState | null>(null)
  const [info, setInfo] = useState<CF | null>(null)
  const [cmds, setCmds] = useState<CCommand[]>([])
  const [pending, setPending] = useState<{ move: number; m: CardMove | null } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // あたらしい じょうたいが きたら はじめから ながす
  useEffect(() => {
    if (lastState.current === state) return
    lastState.current = state
    setShown(0)
    setPlaying(events.length > 1)
    setCmds([])
    setPending(null)
  }, [state, events.length])

  useEffect(() => {
    if (!playing) return
    if (shown >= events.length - 1) {
      setPlaying(false)
      if (state.over) {
        if (state.winner === me) sfx.win()
        else if (state.winner !== 'draw') sfx.lose()
      }
      return
    }
    const ev = events[shown]
    const t = setTimeout(() => setShown((s) => s + 1), STEP_MS[ev?.fx ?? ''] ?? 800)
    return () => clearTimeout(t)
  }, [playing, shown, events, state.over, state.winner, me])

  // こうかおん
  const ev = events[Math.min(shown, events.length - 1)]
  useEffect(() => {
    if (!ev) return
    if (ev.fx === 'hit') (ev.n ?? 0) >= 35 ? sfx.special('powerStrike') : sfx.hit()
    else if (ev.fx === 'heal') sfx.special('heal')
    else if (ev.fx === 'buff') sfx.special('attackUp')
    else if (ev.fx === 'miss') sfx.dodge()
    else if (ev.fx === 'faint') sfx.special('powerStrike')
    else if (ev.fx === 'big' && shown > 0) sfx.special('default')
  }, [ev, shown])

  const cmdRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!playing) cmdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [playing, cmds.length, pending])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [shown])

  const snapMap = useMemo(() => {
    const m = new Map<string, Snap>()
    for (const s of ev?.snap ?? []) m.set(s.u, s)
    return m
  }, [ev])
  const act = ev?.act ?? state.active

  const needs = useMemo(() => activeOf(state, me).filter((f) => needsCommand(state, f)), [state, me])
  const choosing = !playing && !state.over && !waiting && needs.length > 0 && cmds.length < needs.length
  const cur = choosing ? needs[cmds.length] : null

  function finish(next: CCommand[]) {
    setCmds(next)
    setPending(null)
    if (next.length >= needs.length) onCommands(next)
  }

  function chooseMove(idx: number, m: CardMove | null) {
    if (!cur) return
    sfx.tap()
    const tk = targetKind(m)
    const foes = activeOf(state, foe).filter((x) => !x.hidden)
    const mine = activeOf(state, me)
    if (tk === 'foe' && foes.length > 1) return setPending({ move: idx, m })
    if (tk === 'ally' && mine.length > 1) return setPending({ move: idx, m })
    const target = tk === 'foe' ? (foes[0] ?? activeOf(state, foe)[0])?.uid : tk === 'ally' ? cur.uid : undefined
    finish([...cmds, { uid: cur.uid, move: idx, target }])
  }

  function pickTarget(t: CF) {
    if (!cur || !pending) return
    sfx.tap()
    finish([...cmds, { uid: cur.uid, move: pending.move, target: t.uid }])
  }

  // ひかえ・たおれた虫（まるい しゃしん）
  function bench(side: SideId) {
    const list = state.fighters.filter((f) => f.side === side && !act[side].includes(f.uid))
    return (
      <div className={`cg-bench ${side === me ? 'mine' : 'foe'}`}>
        <span className="cg-bench-label">{side === me ? 'ひかえ' : 'あいての ひかえ'}</span>
        {list.map((f) => {
          const s = snapMap.get(f.uid)
          return (
            <button key={f.uid} type="button" className={'cg-bench-dot' + (s?.f ? ' out' : '')} onClick={() => setInfo(f)}>
              {photos[f.uid] ? <img src={photos[f.uid]} alt="" /> : '🐛'}
              {s?.f ? <i>✖</i> : null}
            </button>
          )
        })}
        {list.length === 0 && <span className="cg-bench-none">なし</span>}
      </div>
    )
  }

  function row(side: SideId) {
    const pickSide = pending ? (targetKind(pending.m) === 'ally' ? me : foe) : null
    return (
      <div className={`cg-row ${side === me ? 'mine' : 'foe'}`}>
        {act[side].map((uid) => {
          const f = fighter(state, uid)
          const s = snapMap.get(uid) ?? { u: uid, h: f.hp }
          const pickable = pickSide === side && alive(f) && !(side === foe && f.hidden) && state.active[side].includes(uid)
          return (
            <Panel
              key={uid}
              f={f}
              snap={s}
              photo={photos[uid]}
              ev={playing ? ev : undefined}
              pickable={!!pickable}
              onPick={() => pickTarget(f)}
              onInfo={() => setInfo(f)}
              current={cur?.uid === uid}
            />
          )
        })}
      </div>
    )
  }

  const shownEvents = events.slice(0, shown + 1)

  return (
    <div className="cg-stage">
      <div className="cg-names">
        <span>🆚 {foeName}</span>
        <span className="cg-round">ラウンド {Math.max(1, state.round - (playing ? 1 : 0))}</span>
      </div>
      {bench(foe)}
      {row(foe)}

      <div className="cg-log" ref={logRef} onClick={() => playing && setShown(events.length - 1)}>
        {shownEvents.map((e, i) => (
          <p key={i} className={`fx-${e.fx ?? 'info'}${i === shownEvents.length - 1 ? ' now' : ''}`}>
            {e.d ? <span className="cg-die">{e.d}</span> : null}
            {renderText(state, e.t.replace(/^🎲\d /, ''), me)}
          </p>
        ))}
        {playing && <span className="cg-skip">タップで はやおくり ▶▶</span>}
      </div>

      {row(me)}
      {bench(me)}
      <div className="cg-names mine">
        <span>👤 {myName}</span>
      </div>

      {choosing && cur && !pending && (
        <div className="cg-command" ref={cmdRef}>
          <p className="cg-command-title">
            <b>{cur.card.name}</b> の わざを えらんでね
            {needs.length > 1 && (
              <small>
                （{cmds.length + 1}/{needs.length}）
              </small>
            )}
          </p>
          <div className="cg-command-list">
            {cur.card.moves.map((m, i) => {
              const left = cur.usesLeft[i] ?? 0
              const off = left <= 0 || (cur.sealed ?? 0) > 0
              return (
                <button key={i} type="button" className="cg-cmd" disabled={off} onClick={() => chooseMove(i, m)}>
                  <MoveBox m={m} left={left} compact />
                </button>
              )
            })}
            <button type="button" className="cg-cmd basic" onClick={() => chooseMove(-1, null)}>
              <div className="cg-move k-attack">
                <span className="cg-move-ic">
                  <b>⚔️</b>
                </span>
                <span className="cg-move-body">
                  <span className="cg-move-head">
                    <b className="cg-move-name">こうげき</b>
                    <span className="cg-dots inf">∞</span>
                  </span>
                  <span className="cg-move-text">あいて1ぴきに {cur.card.basic}ダメージ。なんかいでも つかえる。</span>
                </span>
                <span className="cg-move-big">{cur.card.basic}</span>
              </div>
            </button>
          </div>
          {cmds.length > 0 && (
            <button type="button" className="btn btn-ghost cg-undo" onClick={() => setCmds(cmds.slice(0, -1))}>
              ← まえの 虫を えらびなおす
            </button>
          )}
        </div>
      )}
      {pending && (
        <div className="cg-command target" ref={cmdRef}>
          <p className="cg-command-title">
            {pending.m ? `${pending.m.emoji}${pending.m.name}` : '⚔️こうげき'}：{targetKind(pending.m) === 'ally' ? 'だれに つかう？' : 'どの あいてを ねらう？'} 🎯を タップ
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
            ← わざを えらびなおす
          </button>
        </div>
      )}
      {!playing && !state.over && (waiting || (needs.length > 0 && cmds.length >= needs.length)) && (
        <div className="cg-command wait">
          <p>あいての わざを まっています… ⏳</p>
        </div>
      )}
      {!playing && state.over && (
        <div ref={cmdRef} className={`cg-result ${state.winner === me ? 'win' : state.winner === 'draw' ? 'draw' : 'lose'}`}>
          <b>{state.winner === me ? '🏆 かち！' : state.winner === 'draw' ? '🤝 ひきわけ' : '😢 まけ…'}</b>
          <span>{state.winner === me ? 'あいての 虫を ぜんぶ たおした！' : state.winner === 'draw' ? 'おなじ ときに ぜんいん たおれた' : 'つぎは デッキを かえて みよう'}</span>
          <div className="cg-result-btns">
            {onAgain && (
              <button className="btn btn-big btn-primary" onClick={onAgain}>
                🔁 もういちど
              </button>
            )}
            <button className="btn btn-big" onClick={onQuit}>
              おわる
            </button>
          </div>
        </div>
      )}
      {!state.over && (
        <button type="button" className="btn btn-ghost cg-quit" onClick={onQuit}>
          🏳️ バトルを やめる
        </button>
      )}

      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(null)}>
          <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInfo(null)} aria-label="とじる">
              ✕
            </button>
            <CardFace card={info.card as Card} photo={photos[info.uid]} usesLeft={info.usesLeft} />
            <p className="cg-modal-note">● は のこりの かいすう。うすい ● は つかった ぶん。</p>
          </div>
        </div>
      )}
    </div>
  )
}

export { UsesDots }
