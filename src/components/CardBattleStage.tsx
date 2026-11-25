// =============================================================
//  ちょうむしカードバトル：たたかいの がめん（CPU・つうしん きょうつう）
// -------------------------------------------------------------
//  ・場の 虫は 紙と おなじ カードで ならべる（ながおしで 大きく）
//  ・すばやい じゅんに 1ぴきずつ ばんが くる。じぶんの 虫の ばんに わざを えらぶ
//  ・まんなかの メッセージは タップするたびに 1つずつ すすむ
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardMove } from '../lib/cardGame/cards'
import {
  activeOf,
  actorNeedsChoice,
  alive,
  currentActor,
  fighter,
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
import { useStickToBottom } from '../lib/useStickToBottom'
import { MoveBox } from './CardView'
import { CardZoom, PaperCard, usePress } from './PaperCard'

interface Props {
  state: CState
  me: SideId
  photos: Record<string, string> // uid → しゃしん
  myName: string
  foeName: string
  onCommand: (cmd: CCommand) => void
  onAdvance?: () => void // CPU：あいて・じどうの 虫を 1て すすめる
  onQuit: () => void
  onAgain?: () => void
}

function chipIcons(c?: [number, number, number]): string {
  if (!c) return ''
  const up = ['🔺', '🛡️', '💨']
  const down = ['🔻', '💔', '🐢']
  return c.map((n, i) => (n > 0 ? up[i].repeat(n) : n < 0 ? down[i].repeat(-n) : '')).join('')
}

function FighterCard({
  f,
  snap,
  photo,
  ev,
  width,
  turn,
  pickable,
  onPick,
}: {
  f: CF
  snap: Snap
  photo?: string
  ev?: CEvent
  width: number
  turn: boolean
  pickable: boolean
  onPick: () => void
}) {
  const [zoom, setZoom] = useState(false)
  const press = usePress(
    () => setZoom(true),
    () => (pickable ? onPick() : setZoom(true)),
  )
  const rate = Math.max(0, snap.h / f.card.hp)
  const isActor = ev?.a === f.uid
  const isTarget = ev?.g?.includes(f.uid)
  const fx = isTarget ? ev?.fx : undefined
  return (
    <div
      className={
        'cb-fighter' +
        (snap.f ? ' out' : '') +
        (isActor ? ' actor' : '') +
        (turn ? ' turn' : '') +
        (fx ? ` fx-${fx}` : '') +
        (pickable ? ' pick' : '') +
        (snap.x?.includes('🙈') ? ' hidden' : '')
      }
      style={{ width }}
    >
      <div className="pc-press" {...press}>
        <PaperCard card={f.card} photo={photo} width={width} usesLeft={f.usesLeft}>
          {isTarget && ev?.n ? (
            <span key={ev.id} className={`cb-pop ${ev.fx === 'heal' ? 'heal' : ''}`}>
              {ev.fx === 'heal' ? '+' : '-'}
              {ev.n}
            </span>
          ) : null}
          {pickable && <span className="cb-aim">🎯</span>}
          {snap.f ? <span className="cb-ko">たおれた</span> : null}
        </PaperCard>
      </div>
      <div className="cb-hp">
        <span className="cb-hp-bar">
          <i style={{ width: `${rate * 100}%` }} className={rate <= 0.25 ? 'low' : rate <= 0.5 ? 'mid' : ''} />
        </span>
        <b>
          {snap.h}
          <small>/{f.card.hp}</small>
        </b>
      </div>
      <div className="cb-chips">
        {snap.s}
        {chipIcons(snap.c)}
        {snap.x}
      </div>
      {zoom && <CardZoom card={f.card} photo={photo} usesLeft={f.usesLeft} onClose={() => setZoom(false)} />}
    </div>
  )
}

// サイコロの め（3×3 の どこに 点を おくか）
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
function DieFace({ n }: { n: number }) {
  return (
    <span className={`cb-die-face f${n}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[n].includes(i) ? 'on' : ''} />
      ))}
    </span>
  )
}

// サイコロが ころがる ポップアップ（さいごに result で とまる）
function DiceRoll({ result, text, onClose }: { result: number; text: string; onClose: () => void }) {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * 6))
  const [done, setDone] = useState(false)
  useEffect(() => {
    let t = 0
    let wait = 60
    let timer = 0
    const tick = () => {
      t += wait
      if (t >= 1500) {
        setFace(result)
        setDone(true)
        sfx.special(result >= 4 ? 'attackUp' : 'default')
        return
      }
      setFace((f) => {
        let n = 1 + Math.floor(Math.random() * 6)
        if (n === f) n = (n % 6) + 1
        return n
      })
      sfx.tap()
      wait = Math.min(260, wait * 1.18) // だんだん ゆっくり
      timer = window.setTimeout(tick, wait)
    }
    timer = window.setTimeout(tick, wait)
    return () => window.clearTimeout(timer)
  }, [result])
  return (
    <div className="cb-dice-pop" onClick={() => done && onClose()}>
      <div className="cb-dice-box" onClick={(e) => (e.stopPropagation(), done && onClose())}>
        <p className="cb-dice-title">{done ? `🎲 ${result} が でた！` : 'サイコロを ふるよ…'}</p>
        <div className={`cb-dice${done ? ' done' : ' rolling'}`}>
          <DieFace n={face} />
        </div>
        <p className={`cb-dice-text${done ? ' show' : ''}`}>{done ? text : '　'}</p>
        {done && <span className="cb-next">タップで とじる ▶</span>}
      </div>
    </div>
  )
}

export function CardBattleStage({ state, me, photos, myName, foeName, onCommand, onAdvance, onQuit, onAgain }: Props) {
  const foe = other(me)
  const log = state.log
  const lastId = log.length ? log[log.length - 1].id : 0
  // shown：もう 見せた できごとの いちばん あたらしい id
  const [shown, setShown] = useState(() => (log.length ? log[0].id : 0))
  const firstIdInit = useRef(log.length ? log[0].id : 0)
  const wantNext = useRef(false)
  const [pending, setPending] = useState<{ move: number; m: CardMove | null } | null>(null)
  const cmdRef = useRef<HTMLDivElement>(null)

  // じぶんで すすめて あたらしい できごとが きたら、すぐ 1つめを 見せる
  useEffect(() => {
    if (wantNext.current && lastId > shown) {
      wantNext.current = false
      const nx = log.find((e) => e.id > shown)
      if (nx) setShown(nx.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId])

  // ずっと まえの できごと（つうしんで おくれた ぶん）は とばす
  const firstId = log.length ? log[0].id : 0
  const shownId = Math.max(shown, firstId)
  const ev = log.find((e) => e.id === shownId) ?? log[log.length - 1]
  const caughtUp = shownId >= lastId
  // サイコロの できごとを はじめて 見せる ときは ポップアップで ころがす
  const [rolled, setRolled] = useState<number>(0)
  const rolling = !!ev?.d && ev.id > rolled && ev.id === shownId && shownId > firstIdInit.current

  useEffect(() => {
    if (!ev) return
    if (ev.fx === 'hit') (ev.n ?? 0) >= 35 ? sfx.special('powerStrike') : sfx.hit()
    else if (ev.fx === 'heal') sfx.special('heal')
    else if (ev.fx === 'buff') sfx.special('attackUp')
    else if (ev.fx === 'miss') sfx.dodge()
    else if (ev.fx === 'faint') sfx.special('powerStrike')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id])

  // メッセージが すすんだら、メッセージ欄が かならず 見える ように
  const msgRef = useRef<HTMLDivElement>(null)
  useStickToBottom(msgRef, ev?.id)

  const snapMap = useMemo(() => {
    const m = new Map<string, Snap>()
    for (const s of ev?.snap ?? []) m.set(s.u, s)
    return m
  }, [ev])
  const act = ev?.act ?? state.active

  const actor = caughtUp ? currentActor(state) : null
  const myChoice = !!actor && actor.side === me && actorNeedsChoice(state) && !state.over
  const resultShown = caughtUp && state.over

  useEffect(() => {
    if (state.over && caughtUp) {
      if (state.winner === me) sfx.win()
      else if (state.winner !== 'draw') sfx.lose()
    }
  }, [state.over, caughtUp, state.winner, me])

  useEffect(() => {
    setPending(null)
  }, [state.seq])
  useEffect(() => {
    if ((myChoice && !pending) || resultShown) cmdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [myChoice, resultShown, pending])

  function next() {
    if (rolling) return
    if (!caughtUp) {
      sfx.tap()
      const nx = log.find((e) => e.id > shownId)
      if (nx) setShown(nx.id)
      return
    }
    if (state.over || myChoice) return
    if (onAdvance) {
      sfx.tap()
      wantNext.current = true
      onAdvance()
    }
  }

  function choose(idx: number, m: CardMove | null) {
    if (!actor) return
    sfx.tap()
    const tk = targetKind(m)
    const foes = activeOf(state, foe).filter((x) => !x.hidden)
    const mine = activeOf(state, me)
    if ((tk === 'foe' && foes.length > 1) || (tk === 'ally' && mine.length > 1)) {
      setPending({ move: idx, m })
      // ねらう カードが 見える ように
      setTimeout(() => document.querySelector(tk === 'foe' ? '.cb-row.foe' : '.cb-row.mine')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return
    }
    const target = tk === 'foe' ? (foes[0] ?? activeOf(state, foe)[0])?.uid : tk === 'ally' ? actor.uid : undefined
    wantNext.current = true
    onCommand({ uid: actor.uid, move: idx, target })
  }
  function pickTarget(t: CF) {
    if (!actor || !pending) return
    sfx.tap()
    wantNext.current = true
    onCommand({ uid: actor.uid, move: pending.move, target: t.uid })
    setPending(null)
  }

  const W = Math.floor((Math.min(560, window.innerWidth) - 32 - 10) / 2)

  function row(side: SideId) {
    const pickSide = pending ? (targetKind(pending.m) === 'ally' ? me : foe) : null
    return (
      <div className={`cb-row ${side === me ? 'mine' : 'foe'}`}>
        {act[side].map((uid) => {
          const f = fighter(state, uid)
          const s = snapMap.get(uid) ?? { u: uid, h: f.hp }
          const pickable = pickSide === side && alive(f) && !(side === foe && f.hidden) && state.active[side].includes(uid)
          return (
            <FighterCard
              key={uid}
              f={f}
              snap={s}
              photo={photos[uid]}
              ev={ev}
              width={W}
              turn={actor?.uid === uid}
              pickable={!!pickable}
              onPick={() => pickTarget(f)}
            />
          )
        })}
      </div>
    )
  }

  function bench(side: SideId) {
    const list = state.fighters.filter((f) => f.side === side && !act[side].includes(f.uid))
    return (
      <div className={`cg-bench ${side === me ? 'mine' : 'foe'}`}>
        <span className="cg-bench-label">{side === me ? `👤 ${myName} の ひかえ` : `🆚 ${foeName} の ひかえ`}</span>
        {list.map((f) => {
          const s = snapMap.get(f.uid)
          return (
            <span key={f.uid} className={'cg-bench-dot' + (s?.f ? ' out' : '')}>
              {photos[f.uid] ? <img src={photos[f.uid]} alt="" /> : '🐛'}
              {s?.f ? <i>✖</i> : null}
            </span>
          )
        })}
        {list.length === 0 && <span className="cg-bench-none">なし</span>}
      </div>
    )
  }

  // この ラウンドの のこりの じゅんばん
  const order =
    caughtUp && !state.over
      ? state.queue.filter((u) => {
          const f = fighter(state, u)
          return alive(f) && state.active[f.side].includes(u)
        })
      : []
  const prev = log.filter((e) => e.id < shownId).slice(-2)
  const canTap = !caughtUp || (!state.over && !myChoice && !!onAdvance)

  return (
    <div className="cg-stage">
      {rolling && ev?.d && (
        <DiceRoll
          key={ev.id}
          result={ev.d}
          text={renderText(state, ev.t.replace(/^🎲\d /, ''), me)}
          onClose={() => setRolled(ev.id)}
        />
      )}
      {bench(foe)}
      {row(foe)}

      <div className={`cb-msg${canTap ? ' tap' : ''}`} onClick={next} ref={msgRef}>
        <div className="cb-msg-top">
          <span className="cg-round">ラウンド {state.round}</span>
          {order.length > 0 && (
            <span className="cb-order">
              じゅんばん
              {order.map((u) => (
                <span key={u} className={`cb-order-dot ${fighter(state, u).side === me ? 'mine' : 'foe'}${u === actor?.uid ? ' now' : ''}`}>
                  {photos[u] ? <img src={photos[u]} alt="" /> : '🐛'}
                </span>
              ))}
            </span>
          )}
        </div>
        {prev.map((e) => (
          <p key={e.id} className="old">
            {renderText(state, e.t.replace(/^🎲\d /, ''), me)}
          </p>
        ))}
        {ev && rolling && <p className="now">🎲 サイコロを ふるよ…</p>}
        {ev && !rolling && (
          <p key={ev.id} className={`now fx-${ev.fx ?? 'info'}`}>
            {ev.d ? <span className="cg-die">{ev.d}</span> : null}
            {renderText(state, ev.t.replace(/^🎲\d /, ''), me)}
          </p>
        )}
        {canTap ? (
          <span className="cb-next">タップで つぎへ ▶</span>
        ) : !state.over && !myChoice && actor ? (
          <span className="cb-wait">{actor.side === me ? 'じゅんびちゅう…' : 'あいてが えらんでいるよ… ⏳'}</span>
        ) : null}
      </div>

      {row(me)}
      {bench(me)}

      {myChoice && actor && !pending && (
        <div className="cg-command" ref={cmdRef}>
          <p className="cg-command-title">
            <b>{actor.card.name}</b> の ばん！ わざを えらんでね
          </p>
          <div className="cg-command-list">
            {actor.card.moves.map((m, i) => {
              const left = actor.usesLeft[i] ?? 0
              const off = left <= 0 || (actor.sealed ?? 0) > 0
              return (
                <button key={i} type="button" className="cg-cmd" disabled={off} onClick={() => choose(i, m)}>
                  <MoveBox m={m} left={left} compact />
                </button>
              )
            })}
            <button type="button" className="cg-cmd basic" onClick={() => choose(-1, null)}>
              <div className="cg-move k-attack">
                <span className="cg-move-ic">
                  <b>⚔️</b>
                </span>
                <span className="cg-move-body">
                  <span className="cg-move-head">
                    <b className="cg-move-name">こうげき</b>
                    <span className="cg-dots inf">∞</span>
                  </span>
                  <span className="cg-move-text">あいて1ぴきに {actor.card.basic}ダメージ。なんかいでも つかえる。</span>
                </span>
                <span className="cg-move-big">{actor.card.basic}</span>
              </div>
            </button>
          </div>
        </div>
      )}
      {myChoice && pending && (
        <div className="cg-command target" ref={cmdRef}>
          <p className="cg-command-title">
            {pending.m ? `${pending.m.emoji}${pending.m.name}` : '⚔️こうげき'}：
            {targetKind(pending.m) === 'ally' ? 'だれに つかう？' : 'どの あいてを ねらう？'} 🎯の カードを タップ
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
            ← わざを えらびなおす
          </button>
        </div>
      )}
      {resultShown && (
        <div ref={cmdRef} className={`cg-result ${state.winner === me ? 'win' : state.winner === 'draw' ? 'draw' : 'lose'}`}>
          <b>{state.winner === me ? '🏆 かち！' : state.winner === 'draw' ? '🤝 ひきわけ' : '😢 まけ…'}</b>
          <span>
            {state.winner === me
              ? 'あいての 虫を ぜんぶ たおした！'
              : state.winner === 'draw'
                ? 'おなじ ときに ぜんいん たおれた'
                : 'つぎは デッキを かえて みよう'}
          </span>
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
      <p className="cb-help">カードを ながおし すると 大きく 見られるよ</p>
      {!state.over && (
        <button type="button" className="btn btn-ghost cg-quit" onClick={onQuit}>
          🏳️ バトルを やめる
        </button>
      )}
    </div>
  )
}
