// =============================================================
//  むしバトル v2（1たい1／2たい2）
// -------------------------------------------------------------
//  ・せんとうロジックは src/lib/battleEngine.ts に ぜんぶ ある。
//    このファイルは「UI（みため）」と「えんしゅつ」だけ。
//  ・1ターンぶんの めいれい（Command）を あつめて resolveTurn を 1回よぶ。
//  ・かえってきた field.log を 1行ずつ ゆっくり ながす。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { mainPhoto } from '../lib/storage'
import { battleStatsV2 } from '../lib/battleSetup'
import {
  chooseCpuCommand,
  createField,
  makeFighter,
  resolveTurn,
  statusEmoji,
  statusLabel,
  type Command,
  type Field,
  type Fighter,
  type TurnStep,
} from '../lib/battleEngine'
import { BASIC_ATTACK } from '../lib/moveLibrary'
import { INSECT_ORDERS, canonicalOrder, orderEmoji } from '../data/orders'
import { StarRating } from '../components/StarRating'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

const OTHER = '__other__'

// -------------------------------------------------------------
//  虫の ステータスカード（v2：すばやさ と わざ3つ）
// -------------------------------------------------------------
function StatCardV2({ bug }: { bug: CaughtBug }) {
  const s = battleStatsV2(bug)
  const [open, setOpen] = useState(false)
  return (
    <div className="statcard">
      <div className="statcard-top">
        <img className="statcard-photo" src={mainPhoto(bug)} alt={bug.name} />
        <div className="statcard-name">{bug.name}</div>
      </div>
      <div className="statrow">
        <span className="statlabel">たいりょく</span>
        <span className="statval">
          <span className="hpbar mini">
            <span
              className="hpbar-fill"
              style={{ width: Math.round((s.hp / 60) * 100) + '%' }}
            />
          </span>
          {s.hp}
        </span>
      </div>
      <div className="statrow">
        <span className="statlabel">こうげき</span>
        <StarRating value={s.attack} size={13} max={10} />
      </div>
      <div className="statrow">
        <span className="statlabel">ぼうぎょ</span>
        <StarRating value={s.defense} size={13} max={10} />
      </div>
      <div className="statrow">
        <span className="statlabel">すばやさ</span>
        <StarRating value={s.speed} size={13} max={10} />
      </div>
      <button
        type="button"
        className="move-detail-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        ✨ わざ {s.moves.length}つ {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="move-detail">
          {s.moves.map((m, i) => (
            <div key={m.id + i} className="move-line">
              <b>
                {m.emoji ?? '✨'} {m.name}
              </b>
              <span className="move-line-sub">
                {m.kind === 'attack' ? `いりょく${m.power}` : 'へんかわざ'} ／{' '}
                {m.uses}かい
              </span>
              <p className="move-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
//  図鑑とおなじ「もくじ」から、目（もく）ごとに虫をえらぶ
// -------------------------------------------------------------
function BugPicker({
  bugs,
  onPick,
}: {
  bugs: CaughtBug[]
  onPick: (b: CaughtBug) => void
}) {
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  const counts = new Map<string, number>()
  for (const o of INSECT_ORDERS) counts.set(o, 0)
  let otherCount = 0
  for (const b of bugs) {
    const key = canonicalOrder(b.order)
    if (key && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    else otherCount++
  }
  const mokuji = INSECT_ORDERS.map((name, idx) => ({
    name,
    idx,
    count: counts.get(name) ?? 0,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.idx - b.idx)

  if (openOrder) {
    const title = openOrder === OTHER ? 'その他' : openOrder
    const list = bugs.filter((b) => {
      const key = canonicalOrder(b.order)
      return openOrder === OTHER ? !key : key === openOrder
    })
    return (
      <>
        <button
          className="back-btn"
          onClick={() => {
            sfx.tap()
            setOpenOrder(null)
          }}
        >
          ← もくじにもどる
        </button>
        <p className="picker-order-title">
          {openOrder === OTHER ? '🔎' : orderEmoji(openOrder)} {title}
        </p>
        <div className="statcard-grid">
          {list.map((b) => (
            <div
              key={b.id}
              className="statcard-btn"
              role="button"
              tabIndex={0}
              onClick={() => onPick(b)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(b)
                }
              }}
            >
              <StatCardV2 bug={b} />
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="mokuji-list">
      {mokuji.map((it) => (
        <button
          key={it.name}
          className="mokuji-item"
          onClick={() => {
            sfx.tap()
            setOpenOrder(it.name)
          }}
        >
          <span className="mokuji-emoji">{orderEmoji(it.name)}</span>
          <span className="mokuji-name">{it.name}</span>
          <span className="mokuji-count">{it.count}</span>
        </button>
      ))}
      {otherCount > 0 && (
        <button
          className="mokuji-item"
          onClick={() => {
            sfx.tap()
            setOpenOrder(OTHER)
          }}
        >
          <span className="mokuji-emoji">🔎</span>
          <span className="mokuji-name">その他</span>
          <span className="mokuji-count">{otherCount}</span>
        </button>
      )}
    </div>
  )
}

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

// わざの あじ に あわせて 音を えらぶ（既存の sfx.special を つかう）
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

// -------------------------------------------------------------
//  ページ本体
// -------------------------------------------------------------
interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Mode = 1 | 2
type Phase = 'mode' | 'pickMine' | 'pickFoe' | 'speed' | 'battle' | 'result'

// まだ めいれいを きめていない、じぶんの虫
function nextActor(f: Field, cmds: Command[]): Fighter | undefined {
  const decided = new Set(cmds.map((c) => c.actorUid))
  return f.fighters.find(
    (x) => x.side === 'me' && !x.fainted && !decided.has(x.uid),
  )
}

export function BattlePage2({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('mode')
  const [mode, setMode] = useState<Mode>(1)
  const [myPicks, setMyPicks] = useState<CaughtBug[]>([])
  const [foeMode, setFoeMode] = useState<'random' | 'choose'>('random')
  const [foePicks, setFoePicks] = useState<CaughtBug[]>([])
  const [field, setField] = useState<Field | null>(null)
  const [cmds, setCmds] = useState<Command[]>([])
  const [pendingMove, setPendingMove] = useState<{
    actorUid: string
    moveIndex: number
    move: SpecialMoveV2
  } | null>(null)
  const [visibleLog, setVisibleLog] = useState<string[]>([])
  // せんとうの さいせい（ログを 1行ずつ タップで すすめる）
  const [playback, setPlayback] = useState<{
    steps: TurnStep[]
    index: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confetti, setConfetti] = useState(false)
  // えんしゅつ
  const [hurtUid, setHurtUid] = useState<string | null>(null)
  const [glowUid, setGlowUid] = useState<string | null>(null)
  const [rankPop, setRankPop] = useState<{ uid: string; up: boolean } | null>(null)

  const fieldRef = useRef<Field | null>(null)
  const cmdsRef = useRef<Command[]>([])
  const runningRef = useRef(false)
  const playbackRef = useRef<{ steps: TurnStep[]; index: number } | null>(null)
  const moveMapRef = useRef<Map<string, SpecialMoveV2>>(new Map())
  const logRef = useRef<HTMLDivElement>(null)

  // ログを いちばん下へ
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleLog.length])

  // ── ためている／うごけない虫は、えらばせずに じどうで すすめる
  useEffect(() => {
    if (phase !== 'battle' || busy || pendingMove) return
    const f = field
    if (!f || f.over) return
    const cur = nextActor(f, cmds)
    if (cur && (cur.charging || cur.recharge > 0)) {
      pushCmd({ actorUid: cur.uid, moveIndex: -1, targetUid: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, cmds, busy, phase, pendingMove])

  // ── ぜんいんの めいれいが そろったら 1ターン すすめる
  useEffect(() => {
    if (phase !== 'battle' || busy) return
    const f = field
    if (!f || f.over) return
    if (nextActor(f, cmds)) return
    const t = setTimeout(() => runTurn(), 260)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, cmds, busy, phase])

  // ── しょうぶが ついたら（えんしゅつが おわってから）けっか画面へ
  useEffect(() => {
    if (!field?.over || busy) return
    if (field.winner === 'me') {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 600)
      setTimeout(() => sfx.win(), 300)
    } else {
      setTimeout(() => sfx.lose(), 300)
    }
    const t = setTimeout(() => setPhase('result'), 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.over, field?.winner, busy])

  if (bugs.length < 2) {
    return (
      <div className="battle-empty">
        <div className="quiz-start-emoji">⚔️🐛</div>
        <p>
          バトルを するには、虫を
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

  function reset() {
    runningRef.current = false
    sfx.tap()
    setPhase('mode')
    setMyPicks([])
    setFoePicks([])
    setField(null)
    fieldRef.current = null
    setCmds([])
    cmdsRef.current = []
    setPendingMove(null)
    setPlayback(null)
    playbackRef.current = null
    setVisibleLog([])
    setBusy(false)
    setHurtUid(null)
    setGlowUid(null)
    setRankPop(null)
  }

  function chooseMode(m: Mode) {
    sfx.tap()
    setMode(m)
    setMyPicks([])
    setFoePicks([])
    setPhase('pickMine')
  }

  // ── ①じぶんの虫を えらぶ（2たい2なら 2ひき）
  function pickMine(bug: CaughtBug) {
    sfx.tap()
    const next = [...myPicks, bug]
    setMyPicks(next)
    if (next.length >= mode) setPhase('pickFoe')
  }

  // ── ②あいてを えらぶ
  function pickFoe(bug: CaughtBug) {
    sfx.tap()
    const next = [...foePicks, bug]
    setFoePicks(next)
    if (next.length >= mode) setPhase('speed')
  }

  function pickRandomFoe() {
    sfx.tap()
    const myIds = new Set(myPicks.map((b) => b.id))
    const pool = bugs.filter((b) => !myIds.has(b.id))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, mode)
    // たりないときは（虫が すくないとき）のこりを ぜんたいから おぎなう
    while (picked.length < mode) {
      picked.push(bugs[Math.floor(Math.random() * bugs.length)])
    }
    setFoePicks(picked)
    setPhase('speed')
  }

  // ── ③バトル かいし
  function startBattle() {
    if (myPicks.length < mode || foePicks.length < mode) return
    sfx.tap()
    const mine = myPicks.map((b, i) =>
      makeFighter(b, battleStatsV2(b), `me${i}`, 'me', mainPhoto(b)),
    )
    const foes = foePicks.map((b, i) =>
      makeFighter(b, battleStatsV2(b), `foe${i}`, 'foe', mainPhoto(b)),
    )
    const f = createField([...mine, ...foes])
    const map = new Map<string, SpecialMoveV2>()
    for (const x of f.fighters) for (const m of x.moves) map.set(m.name, m)
    map.set(BASIC_ATTACK.name, BASIC_ATTACK)
    moveMapRef.current = map

    fieldRef.current = f
    setField(f)
    setCmds([])
    cmdsRef.current = []
    setPendingMove(null)
    setPlayback(null)
    playbackRef.current = null
    setVisibleLog(['⚡ すばやい むしから こうどう するよ！'])
    setHurtUid(null)
    setGlowUid(null)
    setRankPop(null)
    setBusy(false)
    setPhase('battle')
    sfx.battleStart()
  }

  // ── めいれいを 1つ ためる
  function pushCmd(c: Command) {
    const next = [...cmdsRef.current, c]
    cmdsRef.current = next
    setCmds(next)
  }

  function needTarget(move: SpecialMoveV2, actor: Fighter): boolean {
    const f = fieldRef.current
    if (!f) return false
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
  //    （けっかは すぐには 見せない。ログ1行ずつ タップで すすめる）
  function runTurn() {
    if (runningRef.current) return
    const cur = fieldRef.current
    if (!cur || cur.over) return
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
  const myIds = new Set(myPicks.map((b) => b.id))
  const foeCandidates = bugs.filter((b) => !myIds.has(b.id))
  const canTwo = bugs.length >= 4
  const cur = field && !field.over ? nextActor(field, cmds) : undefined
  // さいせい中は そのときの スナップショット、ふだんは いまの ばめん
  const shownFighters = playback
    ? playback.steps[playback.index].fighters
    : (field?.fighters ?? [])
  const foeFighters = shownFighters.filter((x) => x.side === 'foe')
  const myFighters = shownFighters.filter((x) => x.side === 'me')
  const shownTurn = field ? (playback ? field.turnCount - 1 : field.turnCount) : 1

  // 「ねらう あいて」を タップできる か
  function isTappable(f: Fighter): boolean {
    if (!pendingMove || busy || f.fainted) return false
    const actor = field?.fighters.find((x) => x.uid === pendingMove.actorUid)
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
        big={mode === 1}
        hurt={hurtUid === f.uid}
        glow={glowUid === f.uid}
        rankUp={rankPop?.uid === f.uid ? rankPop.up : null}
        tappable={isTappable(f)}
        onTap={() => pickTarget(f.uid)}
      />
    )
  }

  return (
    <div className="battle">
      <Confetti show={confetti} />

      {/* --- ⓪ モードを えらぶ --- */}
      {phase === 'mode' && (
        <div className="battle-step">
          <h2 className="battle-step-title">⓪ たいせんの かたちを えらぼう</h2>
          <div className="mode-cards">
            <button className="mode-card" onClick={() => chooseMode(1)}>
              <span className="mode-emoji">🐛 VS 🐛</span>
              <span className="mode-title">1たい1</span>
              <span className="mode-desc">1ぴきずつ たたかう</span>
            </button>
            <button
              className="mode-card"
              disabled={!canTwo}
              onClick={() => chooseMode(2)}
            >
              <span className="mode-emoji">🐛🐛 VS 🐛🐛</span>
              <span className="mode-title">2たい2</span>
              <span className="mode-desc">
                {canTwo
                  ? '2ひきずつ チームで たたかう'
                  : '虫が 4ひき あつまったら できるよ'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* --- ① じぶんの虫をえらぶ --- */}
      {phase === 'pickMine' && (
        <div className="battle-step">
          <h2 className="battle-step-title">
            ① きみの虫を えらぼう
            {mode === 2 && `（${myPicks.length + 1}ひきめ ／ 2ひき）`}
          </h2>
          {myPicks.length > 0 && (
            <p className="pick-so-far">
              えらんだ虫: {myPicks.map((b) => b.name).join('・')}
            </p>
          )}
          <BugPicker
            key={`mine-${myPicks.length}`}
            bugs={bugs.filter((b) => !myIds.has(b.id))}
            onPick={pickMine}
          />
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* --- ② あいてをえらぶ --- */}
      {phase === 'pickFoe' && (
        <div className="battle-step">
          <h2 className="battle-step-title">
            ② あいてを えらぼう
            {mode === 2 &&
              foeMode === 'choose' &&
              `（${foePicks.length + 1}ひきめ ／ 2ひき）`}
          </h2>
          <div className="foe-mode">
            <button
              className={'chip' + (foeMode === 'random' ? ' on' : '')}
              onClick={() => {
                sfx.tap()
                setFoeMode('random')
              }}
            >
              🎲 ランダム
            </button>
            <button
              className={'chip' + (foeMode === 'choose' ? ' on' : '')}
              onClick={() => {
                sfx.tap()
                setFoeMode('choose')
              }}
            >
              👉 じぶんで えらぶ
            </button>
          </div>
          {foeMode === 'random' ? (
            <div className="foe-random">
              <p>あいては ランダムで きまるよ！</p>
              <button className="btn btn-big btn-primary" onClick={pickRandomFoe}>
                つぎへ ▶
              </button>
            </div>
          ) : (
            <>
              {foePicks.length > 0 && (
                <p className="pick-so-far">
                  あいて: {foePicks.map((b) => b.name).join('・')}
                </p>
              )}
              <BugPicker
                key={`foe-${foePicks.length}`}
                bugs={foeCandidates.filter(
                  (b) => !foePicks.some((p) => p.id === b.id),
                )}
                onPick={pickFoe}
              />
            </>
          )}
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* --- ③ すばやさの せつめい（じゃんけんの かわり） --- */}
      {phase === 'speed' && myPicks.length > 0 && foePicks.length > 0 && (
        <div className="battle-step">
          <h2 className="battle-step-title">③ こうどうの じゅんばん</h2>
          <p className="speed-lead">
            ⚡ <b>すばやさ</b> が たかい虫から こうどう するよ！
            <br />
            <small>
              （「⏳ためる」わざや ⚡まひ で じゅんばんが かわることも あるよ）
            </small>
          </p>
          <div className="speed-teams">
            <div className="speed-team">
              <span className="speed-team-label">きみ</span>
              {myPicks.map((b, i) => (
                <div key={b.id + i} className="speed-row">
                  <img src={mainPhoto(b)} alt={b.name} />
                  <span className="speed-name">{b.name}</span>
                  <StarRating value={battleStatsV2(b).speed} size={12} max={10} />
                </div>
              ))}
            </div>
            <div className="speed-team">
              <span className="speed-team-label">あいて</span>
              {foePicks.map((b, i) => (
                <div key={b.id + i} className="speed-row">
                  <img src={mainPhoto(b)} alt={b.name} />
                  <span className="speed-name">{b.name}</span>
                  <StarRating value={battleStatsV2(b).speed} size={12} max={10} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-big btn-primary" onClick={startBattle}>
            バトル スタート ⚔️
          </button>
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* --- ④ せんとう --- */}
      {phase === 'battle' && field && (
        <div className="battle-stage battle-stage2">
          <button className="battle-flee" onClick={reset}>
            ✕ やめる
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
                <span className="stage-wait">
                  {field.over ? '…' : 'たたかい中…'}
                </span>
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
      )}

      {/* --- けっか --- */}
      {phase === 'result' && field && (
        <div className="battle-result">
          <div className="battle-result-emoji">
            {field.winner === 'me' ? '🏆' : '😢'}
          </div>
          <h2>{field.winner === 'me' ? 'きみの かち！' : 'まけちゃった…'}</h2>
          <p className="battle-result-sub">
            {myPicks.map((b) => b.name).join('・')} <b>VS</b>{' '}
            {foePicks.map((b) => b.name).join('・')}
          </p>
          <p className="battle-result-sub">{field.turnCount - 1} ターンの たたかい</p>
          <div className="battle-result-actions">
            <button className="btn btn-big btn-primary" onClick={startBattle}>
              もういちど おなじ たいせん 🔄
            </button>
            <button className="btn btn-big" onClick={reset}>
              あたらしい たいせん ⚔️
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
