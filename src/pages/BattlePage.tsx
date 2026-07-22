import { useEffect, useRef, useState } from 'react'
import type { CaughtBug, SpecialMove } from '../types'
import { mainPhoto } from '../lib/storage'
import {
  battleStatsOf,
  computeDamage,
  DODGE_CHANCE,
  effectInfo,
} from '../lib/battle'
import { INSECT_ORDERS, canonicalOrder, orderEmoji } from '../data/orders'
import { StarRating } from '../components/StarRating'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

const OTHER = '__other__'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 図鑑とおなじ「もくじ」から、目（もく）ごとに虫をえらぶ。
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
            <button
              key={b.id}
              className="statcard-btn"
              onClick={() => onPick(b)}
            >
              <StatCard bug={b} />
            </button>
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

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

// せんとうちゅうの、片方の じょうたい
interface Side {
  bug: CaughtBug
  name: string
  photo: string
  maxHp: number
  hp: number
  attack: number
  defense: number
  move: SpecialMove
  moveLeft: number // ひっさつわざの のこり回数
}

interface BState {
  me: Side
  foe: Side
  turn: 'me' | 'foe'
  log: string[]
  over: boolean
  winner: 'me' | 'foe' | null
}

function makeSide(bug: CaughtBug): Side {
  const s = battleStatsOf(bug)
  return {
    bug,
    name: bug.name,
    photo: mainPhoto(bug),
    maxHp: s.hp,
    hp: s.hp,
    attack: s.attack,
    defense: s.defense,
    move: s.move,
    moveLeft: s.move.uses,
  }
}

type Action = 'normal' | 'special'

// 1つの こうどう（通常こうげき or ひっさつわざ）を ばんに はんえいする。
function performAction(state: BState, actor: 'me' | 'foe', action: Action): BState {
  const me = { ...state.me }
  const foe = { ...state.foe }
  const att = actor === 'me' ? me : foe
  const def = actor === 'me' ? foe : me
  const log = [...state.log]

  const doAttack = (bonus = 0) => {
    if (def.hp <= 0) return
    if (Math.random() < DODGE_CHANCE) {
      log.push(`💨 ${def.name}は ヒラリと よけた！`)
      return
    }
    const dmg = computeDamage(att.attack + bonus, def.defense)
    def.hp = Math.max(0, def.hp - dmg)
    log.push(`${att.name}の こうげき！ ${dmg}の ダメージ！`)
  }

  if (action === 'special') {
    const m = att.move
    att.moveLeft = Math.max(0, att.moveLeft - 1)
    log.push(`✨ ${att.name}の ひっさつわざ「${m.name}」！`)
    switch (m.effect) {
      case 'powerStrike':
        doAttack(m.power + 1)
        break
      case 'doubleAttack':
        doAttack()
        doAttack()
        break
      case 'heal': {
        const heal = m.power + 2
        const before = att.hp
        att.hp = Math.min(att.maxHp, att.hp + heal)
        log.push(`💚 たいりょくが ${att.hp - before} かいふく！`)
        break
      }
      case 'attackUp':
        att.attack += m.power
        log.push(`🔺 こうげき力が ${m.power} あがった！`)
        break
      case 'defenseUp':
        att.defense += m.power
        log.push(`🛡️ ぼうぎょ力が ${m.power} あがった！`)
        break
    }
  } else {
    doAttack()
  }

  const over = me.hp <= 0 || foe.hp <= 0
  const winner: BState['winner'] = foe.hp <= 0 ? 'me' : me.hp <= 0 ? 'foe' : null
  const turn: 'me' | 'foe' = over ? state.turn : actor === 'me' ? 'foe' : 'me'
  return { me, foe, turn, log, over, winner }
}

// あいて（CPU）の こうどうを きめる かんたんな さくせん
function chooseFoeAction(state: BState): Action {
  const foe = state.foe
  const me = state.me
  const info = effectInfo(foe.move.effect)
  if (foe.moveLeft <= 0) return 'normal'
  if (foe.move.effect === 'heal' && foe.hp <= foe.maxHp * 0.4) return 'special'
  if (info.strong && me.hp <= computeDamage(foe.attack + foe.move.power + 1, me.defense))
    return 'special'
  return Math.random() < 0.45 ? 'special' : 'normal'
}

// たいりょくゲージ
function HpBar({ side }: { side: Side }) {
  const pct = Math.max(0, Math.round((side.hp / side.maxHp) * 100))
  const low = side.hp <= side.maxHp * 0.3
  return (
    <div className="hpbar-wrap">
      <div className="hpbar">
        <div
          className={'hpbar-fill' + (low ? ' low' : '')}
          style={{ width: pct + '%' }}
        />
      </div>
      <span className="hpbar-num">
        {side.hp}/{side.maxHp}
      </span>
    </div>
  )
}

// 虫のステータス カード（えらぶとき・かくにん用）
function StatCard({ bug }: { bug: CaughtBug }) {
  const s = battleStatsOf(bug)
  const [open, setOpen] = useState(false)
  const info = effectInfo(s.move.effect)
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
              style={{ width: Math.round((s.hp / 20) * 100) + '%' }}
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
      <button
        type="button"
        className="move-detail-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {info.emoji} わざ「{s.move.name}」{open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="move-detail">
          <p>
            <b>こうか:</b> {info.label}（{info.hint}）
          </p>
          <p>
            <b>つよさ:</b> {s.move.power} ／ つかえる回数: {s.move.uses}回
          </p>
          {s.move.desc && <p className="move-desc">{s.move.desc}</p>}
        </div>
      )}
    </div>
  )
}

type Phase = 'pickMine' | 'pickFoe' | 'janken' | 'battle' | 'result'
type Hand = 'rock' | 'scissors' | 'paper'
const HANDS: { key: Hand; emoji: string; label: string }[] = [
  { key: 'rock', emoji: '✊', label: 'グー' },
  { key: 'scissors', emoji: '✌️', label: 'チョキ' },
  { key: 'paper', emoji: '✋', label: 'パー' },
]
const handEmoji = (h: Hand | null) =>
  h ? (HANDS.find((x) => x.key === h)?.emoji ?? '❓') : '❓'
function handBeats(a: Hand, b: Hand): boolean {
  return (
    (a === 'rock' && b === 'scissors') ||
    (a === 'scissors' && b === 'paper') ||
    (a === 'paper' && b === 'rock')
  )
}

export function BattlePage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('pickMine')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [foeMode, setFoeMode] = useState<'random' | 'choose'>('random')
  const [foeBug, setFoeBug] = useState<CaughtBug | null>(null)
  const [battle, setBattle] = useState<BState | null>(null)
  const [visibleLog, setVisibleLog] = useState<string[]>([])
  const [confetti, setConfetti] = useState(false)
  // えんしゅつ用
  const [atk, setAtk] = useState<{ side: 'me' | 'foe'; special: boolean } | null>(null)
  const [hurt, setHurt] = useState<'me' | 'foe' | null>(null)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)
  const runningRef = useRef(false)
  const battleRef = useRef<BState | null>(null)
  // じゃんけん
  const [myHand, setMyHand] = useState<Hand | null>(null)
  const [foeHand, setFoeHand] = useState<Hand | null>(null)
  const [rollHand, setRollHand] = useState<Hand | null>(null)
  const [rolling, setRolling] = useState(false)
  const [firstTurn, setFirstTurn] = useState<'me' | 'foe' | null>(null)
  const jankenTimer = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    battleRef.current = battle
  }, [battle])

  // かたづけ（タイマーを のこさない）
  useEffect(() => {
    return () => {
      if (jankenTimer.current) clearTimeout(jankenTimer.current)
    }
  }, [])

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
    if (jankenTimer.current) clearTimeout(jankenTimer.current)
    runningRef.current = false
    sfx.tap()
    setPhase('pickMine')
    setMyBug(null)
    setFoeBug(null)
    setBattle(null)
    setVisibleLog([])
    setAtk(null)
    setHurt(null)
    setFlash(false)
    setBusy(false)
    setMyHand(null)
    setFoeHand(null)
    setRollHand(null)
    setRolling(false)
    setFirstTurn(null)
  }

  function pickMine(bug: CaughtBug) {
    sfx.tap()
    setMyBug(bug)
    setPhase('pickFoe')
  }

  function startFoe(bug: CaughtBug) {
    sfx.tap()
    setFoeBug(bug)
    setMyHand(null)
    setFoeHand(null)
    setRollHand(null)
    setRolling(false)
    setFirstTurn(null)
    setPhase('janken')
  }

  function pickRandomFoe() {
    const others = bugs.filter((b) => b.id !== myBug?.id)
    const pool = others.length > 0 ? others : bugs
    const foe = pool[Math.floor(Math.random() * pool.length)]
    startFoe(foe)
  }

  // じゃんけん：てをえらぶと、あいての手が ルーレットで まわって ゆっくり とまる
  function playJanken(hand: Hand) {
    if (rolling || firstTurn || myHand) return
    setMyHand(hand)
    setFoeHand(null)
    setRolling(true)
    const target = HANDS[Math.floor(Math.random() * 3)].key
    const spins = 15 + Math.floor(Math.random() * 3)
    let i = 0
    sfx.tap()
    const step = () => {
      setRollHand(HANDS[i % 3].key)
      i++
      if (i < spins) {
        const d = 55 + i * i * 1.4 // だんだん おそくなる
        jankenTimer.current = window.setTimeout(step, d)
      } else {
        setRollHand(target)
        setFoeHand(target)
        setRolling(false)
        sfx.tap()
        jankenTimer.current = window.setTimeout(() => resolveJanken(hand, target), 700)
      }
    }
    step()
  }

  function resolveJanken(mine: Hand, foe: Hand) {
    if (mine === foe) {
      // あいこ → もういちど
      jankenTimer.current = window.setTimeout(() => {
        setMyHand(null)
        setFoeHand(null)
        setRollHand(null)
      }, 700)
      return
    }
    const iWin = handBeats(mine, foe)
    setFirstTurn(iWin ? 'me' : 'foe')
    if (iWin) sfx.discover()
    else sfx.error()
  }

  function startBattle() {
    if (!myBug || !foeBug || !firstTurn) return
    sfx.tap()
    const first = firstTurn
    const init: BState = {
      me: makeSide(myBug),
      foe: makeSide(foeBug),
      turn: first,
      log: [],
      over: false,
      winner: null,
    }
    battleRef.current = init
    runningRef.current = false
    setBattle(init)
    setVisibleLog([first === 'me' ? 'きみの ターンから！' : 'あいての ターンから！'])
    setAtk(null)
    setHurt(null)
    setFlash(false)
    setBusy(false)
    setPhase('battle')
  }

  // 1つの こうどうを、えんしゅつ（アニメ）と いっしょに ゆっくり すすめる
  async function runAction(actor: 'me' | 'foe', action: Action) {
    if (runningRef.current) return
    const cur = battleRef.current
    if (!cur || cur.over || cur.turn !== actor) return
    const actSide = actor === 'me' ? cur.me : cur.foe
    if (action === 'special' && actSide.moveLeft <= 0) return
    runningRef.current = true
    setBusy(true)

    const next = performAction(cur, actor, action)
    const newLines = next.log.slice(cur.log.length)
    const special = action === 'special'

    // ① こうげき／ひっさつわざ の うごき（ふりかぶり〜つっこむ）
    setAtk({ side: actor, special })
    sfx.tap()
    await sleep(special ? 700 : 430)

    // ② ヒット：ダメージを はんえい、あいてが ゆれる
    battleRef.current = next
    setBattle(next)
    setHurt(actor === 'me' ? 'foe' : 'me')
    if (special) {
      setFlash(true)
      sfx.discover()
    }

    // ③ テキストを ひとつずつ ゆっくり だす
    for (let i = 0; i < newLines.length; i++) {
      setVisibleLog((prev) => [...prev, newLines[i]])
      if (i > 0) sfx.tap()
      await sleep(700)
    }

    setFlash(false)
    await sleep(280)
    setAtk(null)
    setHurt(null)
    runningRef.current = false
    setBusy(false)
  }

  function myMove(action: Action) {
    void runAction('me', action)
  }

  // あいての ターンは じどうで すすむ（少し まってから）
  useEffect(() => {
    if (!battle || battle.over || battle.turn !== 'foe' || busy) return
    const t = setTimeout(() => {
      const cur = battleRef.current
      if (cur) void runAction('foe', chooseFoeAction(cur))
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, busy])

  // ログを いちばん下へ
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleLog.length])

  // 勝敗が ついたら、少し まって けっか画面へ
  useEffect(() => {
    if (!battle?.over) return
    if (battle.winner === 'me') {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 500)
    }
    const t = setTimeout(() => setPhase('result'), 1700)
    return () => clearTimeout(t)
  }, [battle?.over, battle?.winner])

  const meAnim =
    (atk?.side === 'me' ? (atk.special ? ' sp-up' : ' atk-up') : '') +
    (hurt === 'me' ? ' hurt' : '')
  const foeAnim =
    (atk?.side === 'foe' ? (atk.special ? ' sp-down' : ' atk-down') : '') +
    (hurt === 'foe' ? ' hurt' : '')

  return (
    <div className="battle">
      <Confetti show={confetti} />

      {/* --- ① じぶんの虫をえらぶ --- */}
      {phase === 'pickMine' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① きみの虫を えらぼう</h2>
          <BugPicker bugs={bugs} onPick={pickMine} />
        </div>
      )}

      {/* --- ② あいてをえらぶ --- */}
      {phase === 'pickFoe' && (
        <div className="battle-step">
          <h2 className="battle-step-title">② あいてを えらぼう</h2>
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
                じゅんばんぎめへ ▶
              </button>
            </div>
          ) : (
            <BugPicker
              bugs={bugs.filter((b) => b.id !== myBug?.id)}
              onPick={startFoe}
            />
          )}
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* --- ③ じゃんけん（先攻・後攻） --- */}
      {phase === 'janken' && myBug && foeBug && (
        <div className="battle-step">
          <h2 className="battle-step-title">③ じゃんけんで せんこう を きめよう</h2>
          <div className="janken-vs">
            <div className="janken-fighter">
              <img src={mainPhoto(myBug)} alt={myBug.name} />
              <span>{myBug.name}</span>
            </div>
            <div className="vs">VS</div>
            <div className="janken-fighter">
              <img src={mainPhoto(foeBug)} alt={foeBug.name} />
              <span>{foeBug.name}</span>
            </div>
          </div>

          {/* きみ と あいての て（あいては ルーレット） */}
          <div className="janken-play">
            <div className="janken-slot">
              <span className="janken-slot-label">きみ</span>
              <span className="janken-slot-hand">{handEmoji(myHand)}</span>
            </div>
            <span className="janken-vs-mid">VS</span>
            <div className="janken-slot">
              <span className="janken-slot-label">あいて</span>
              <span className={'janken-slot-hand' + (rolling ? ' rolling' : '')}>
                {handEmoji(rolling ? rollHand : foeHand)}
              </span>
            </div>
          </div>

          {!firstTurn ? (
            <>
              <p className="janken-lead">
                {rolling
                  ? 'あいての て が まわってる…！'
                  : myHand
                    ? 'あいこ！ もういちど てを えらんでね'
                    : 'てを えらんでね'}
              </p>
              <div className="janken-hands">
                {HANDS.map((h) => (
                  <button
                    key={h.key}
                    className="janken-btn"
                    disabled={rolling || !!myHand}
                    onClick={() => playJanken(h.key)}
                  >
                    <span className="janken-emoji">{h.emoji}</span>
                    <span>{h.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="janken-result">
              <p className="janken-win">
                {firstTurn === 'me'
                  ? '🎉 かった！ きみが せんこう！'
                  : '😣 まけ… あいてが せんこう！'}
              </p>
              <button className="btn btn-big btn-primary" onClick={startBattle}>
                バトル スタート ⚔️
              </button>
            </div>
          )}
          {!rolling && !firstTurn && (
            <button className="btn btn-ghost battle-back" onClick={reset}>
              ← さいしょから
            </button>
          )}
        </div>
      )}

      {/* --- ④ せんとう（ぜんめん ステージ） --- */}
      {phase === 'battle' && battle && (
        <div className={'battle-stage' + (flash ? ' flash' : '')}>
          <button className="battle-flee" onClick={reset}>
            ✕ やめる
          </button>

          <div className="stage-scene">
            {/* あいて：おく（うえ） */}
            <div className="stage-foe">
              <div className="stage-namebox">
                <span className="fighter-name">{battle.foe.name}</span>
                <HpBar side={battle.foe} />
              </div>
              <img
                className={'stage-photo' + foeAnim}
                src={battle.foe.photo}
                alt={battle.foe.name}
              />
            </div>

            {/* じぶん：てまえ（した） */}
            <div className="stage-me">
              <img
                className={'stage-photo' + meAnim}
                src={battle.me.photo}
                alt={battle.me.name}
              />
              <div className="stage-namebox">
                <span className="fighter-name">{battle.me.name}</span>
                <HpBar side={battle.me} />
              </div>
            </div>
          </div>

          {/* した：戦いの ようす（テキストウインドウ）＋ ボタン */}
          <div className="stage-bottom">
            <div className="stage-log" ref={logRef}>
              {visibleLog.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            {!battle.over && battle.turn === 'me' && !busy ? (
              <div className="stage-actions">
                <button
                  className="stage-btn atk"
                  onClick={() => myMove('normal')}
                >
                  ⚔️ こうげき
                </button>
                <button
                  className="stage-btn sp"
                  onClick={() => myMove('special')}
                  disabled={battle.me.moveLeft <= 0}
                >
                  {effectInfo(battle.me.move.effect).emoji} {battle.me.move.name}
                  <small>のこり{battle.me.moveLeft}</small>
                </button>
              </div>
            ) : (
              <div className="stage-actions">
                <span className="stage-wait">
                  {battle.over
                    ? '…'
                    : busy
                      ? 'たたかい中…'
                      : 'あいての ターン…'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- けっか --- */}
      {phase === 'result' && battle && (
        <div className="battle-result">
          <div className="battle-result-emoji">
            {battle.winner === 'me' ? '🏆' : '😢'}
          </div>
          <h2>{battle.winner === 'me' ? 'きみの かち！' : 'まけちゃった…'}</h2>
          <p className="battle-result-sub">
            {battle.me.name} <b>VS</b> {battle.foe.name}
          </p>
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
