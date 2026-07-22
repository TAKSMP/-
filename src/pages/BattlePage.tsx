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

// 図鑑とおなじ「もくじ」から、目（もく）ごとに虫をえらぶ。
function BugPicker({
  bugs,
  onPick,
}: {
  bugs: CaughtBug[]
  onPick: (b: CaughtBug) => void
}) {
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  // 目ごとの発見数
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

  // 1かいぶんの こうげき（bonus は ひっさつわざの ついかダメージ）
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
  // たいりょくが すくないと かいふく
  if (foe.move.effect === 'heal' && foe.hp <= foe.maxHp * 0.4) return 'special'
  // あいてを たおせそうなら つよい技でとどめ
  if (info.strong && me.hp <= computeDamage(foe.attack + foe.move.power + 1, me.defense))
    return 'special'
  // それ以外は ときどき つかう
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
// a が b に かつなら true
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
  const [confetti, setConfetti] = useState(false)
  // じゃんけん
  const [myHand, setMyHand] = useState<Hand | null>(null)
  const [foeHand, setFoeHand] = useState<Hand | null>(null)
  const [firstTurn, setFirstTurn] = useState<'me' | 'foe' | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // 虫が2ひきいじょう ないと たいせんできない
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
    sfx.tap()
    setPhase('pickMine')
    setMyBug(null)
    setFoeBug(null)
    setBattle(null)
    setMyHand(null)
    setFoeHand(null)
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
    setFirstTurn(null)
    setPhase('janken')
  }

  function pickRandomFoe() {
    const others = bugs.filter((b) => b.id !== myBug?.id)
    const pool = others.length > 0 ? others : bugs
    const foe = pool[Math.floor(Math.random() * pool.length)]
    startFoe(foe)
  }

  // じゃんけん
  function playJanken(hand: Hand) {
    if (firstTurn) return
    const foe = HANDS[Math.floor(Math.random() * 3)].key
    setMyHand(hand)
    setFoeHand(foe)
    if (hand === foe) {
      sfx.tap()
      // あいこ → もういちど（少しまってリセット）
      setTimeout(() => {
        setMyHand(null)
        setFoeHand(null)
      }, 900)
      return
    }
    const iWin = handBeats(hand, foe)
    setFirstTurn(iWin ? 'me' : 'foe')
    if (iWin) sfx.discover()
    else sfx.error()
  }

  function startBattle() {
    if (!myBug || !foeBug || !firstTurn) return
    sfx.tap()
    setBattle({
      me: makeSide(myBug),
      foe: makeSide(foeBug),
      turn: firstTurn,
      log: [firstTurn === 'me' ? 'きみの ターンから！' : 'あいての ターンから！'],
      over: false,
      winner: null,
    })
    setPhase('battle')
  }

  function myMove(action: Action) {
    if (!battle || battle.over || battle.turn !== 'me') return
    if (action === 'special' && battle.me.moveLeft <= 0) return
    sfx.tap()
    setBattle(performAction(battle, 'me', action))
  }

  // あいての ターンは じどうで すすむ
  useEffect(() => {
    if (!battle || battle.over || battle.turn !== 'foe') return
    const t = setTimeout(() => {
      setBattle((prev) => {
        if (!prev || prev.over || prev.turn !== 'foe') return prev
        return performAction(prev, 'foe', chooseFoeAction(prev))
      })
    }, 950)
    return () => clearTimeout(t)
  }, [battle])

  // ログを いちばん下へ
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [battle?.log.length])

  // けっけつ（勝敗が ついたら）
  useEffect(() => {
    if (battle?.over) {
      if (battle.winner === 'me') {
        sfx.discover()
        setConfetti(true)
        setTimeout(() => setConfetti(false), 300)
      } else {
        sfx.error()
      }
      const t = setTimeout(() => setPhase('result'), 1100)
      return () => clearTimeout(t)
    }
  }, [battle?.over, battle?.winner])

  return (
    <div className="battle">
      <Confetti show={confetti} />

      {/* --- じぶんの虫をえらぶ --- */}
      {phase === 'pickMine' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① きみの虫を えらぼう</h2>
          <BugPicker bugs={bugs} onPick={pickMine} />
        </div>
      )}

      {/* --- あいてをえらぶ --- */}
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
                あいてを きめる 🎲
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

      {/* --- じゃんけん（先攻・後攻） --- */}
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

          {!firstTurn ? (
            <>
              <p className="janken-lead">
                {myHand ? 'あいこ！ もういちど！' : 'てを えらんでね'}
              </p>
              <div className="janken-hands">
                {HANDS.map((h) => (
                  <button
                    key={h.key}
                    className="janken-btn"
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
              <div className="janken-show">
                <span>
                  きみ {HANDS.find((h) => h.key === myHand)?.emoji}
                </span>
                <span>
                  あいて {HANDS.find((h) => h.key === foeHand)?.emoji}
                </span>
              </div>
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
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← さいしょから
          </button>
        </div>
      )}

      {/* --- せんとう --- */}
      {phase === 'battle' && battle && (
        <div className="battle-arena">
          <div className="fighter foe">
            <div className="fighter-info">
              <span className="fighter-name">{battle.foe.name}</span>
              <HpBar side={battle.foe} />
            </div>
            <img
              className={'fighter-photo' + (battle.turn === 'foe' ? ' active' : '')}
              src={battle.foe.photo}
              alt={battle.foe.name}
            />
          </div>

          <div className="fighter me">
            <img
              className={'fighter-photo' + (battle.turn === 'me' ? ' active' : '')}
              src={battle.me.photo}
              alt={battle.me.name}
            />
            <div className="fighter-info">
              <span className="fighter-name">{battle.me.name}</span>
              <HpBar side={battle.me} />
            </div>
          </div>

          <div className="battle-log" ref={logRef}>
            {battle.log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {!battle.over && (
            <div className="battle-actions">
              {battle.turn === 'me' ? (
                <>
                  <button className="btn btn-primary" onClick={() => myMove('normal')}>
                    ⚔️ こうげき
                  </button>
                  <button
                    className="btn btn-camera"
                    onClick={() => myMove('special')}
                    disabled={battle.me.moveLeft <= 0}
                  >
                    {effectInfo(battle.me.move.effect).emoji} {battle.me.move.name}
                    （のこり{battle.me.moveLeft}）
                  </button>
                </>
              ) : (
                <p className="battle-wait">あいての ターン…</p>
              )}
            </div>
          )}
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
