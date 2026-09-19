// =============================================================
//  むしバトル v2（1たい1／2たい2）
// -------------------------------------------------------------
//  ・せんとうロジックは src/lib/battleEngine.ts に ぜんぶ ある。
//    このファイルは「UI（みため）」と「えんしゅつ」だけ。
//  ・1ターンぶんの めいれい（Command）を あつめて resolveTurn を 1回よぶ。
//  ・かえってきた field.log を 1行ずつ ゆっくり ながす。
// =============================================================
import { useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { battleStatsV2 } from '../lib/battleSetup'
import { makeFighter, type Fighter } from '../lib/battleEngine'
import { INSECT_ORDERS, canonicalOrder, orderEmoji } from '../data/orders'
import { StarRating } from '../components/StarRating'
import { BattleStage, type BattleResult } from '../components/BattleStage'
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
//  ページ本体
// -------------------------------------------------------------
interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

type Mode = 1 | 2
type Phase = 'mode' | 'pickMine' | 'pickFoe' | 'speed' | 'battle' | 'result'

export function BattlePage2({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('mode')
  const [mode, setMode] = useState<Mode>(1)
  const [myPicks, setMyPicks] = useState<CaughtBug[]>([])
  const [foeMode, setFoeMode] = useState<'random' | 'choose'>('random')
  const [foePicks, setFoePicks] = useState<CaughtBug[]>([])
  // せんとうは BattleStage が ぜんぶ もつ。ここは「だれが 出るか」だけ。
  const [fighters, setFighters] = useState<Fighter[] | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const [battleKey, setBattleKey] = useState(0)

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
    setPhase('mode')
    setMyPicks([])
    setFoePicks([])
    setFighters(null)
    setResult(null)
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

  // ── ③バトル かいし（ファイターを つくって BattleStage に わたす）
  function startBattle() {
    if (myPicks.length < mode || foePicks.length < mode) return
    sfx.tap()
    const mine = myPicks.map((b, i) =>
      makeFighter(b, battleStatsV2(b), `me${i}`, 'me', mainPhoto(b)),
    )
    const foes = foePicks.map((b, i) =>
      makeFighter(b, battleStatsV2(b), `foe${i}`, 'foe', mainPhoto(b)),
    )
    setFighters([...mine, ...foes])
    setResult(null)
    setBattleKey((k) => k + 1) // あたらしい せんとうとして つくり直す
    setPhase('battle')
  }

  // -----------------------------------------------------------
  //  みため
  // -----------------------------------------------------------
  const myIds = new Set(myPicks.map((b) => b.id))
  const foeCandidates = bugs.filter((b) => !myIds.has(b.id))
  const canTwo = bugs.length >= 4

  return (
    <div className="battle">
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

      {/* --- ④ せんとう（共通の せんとう画面） --- */}
      {phase === 'battle' && fighters && (
        <BattleStage
          key={battleKey}
          fighters={fighters}
          big={mode === 1}
          onQuit={reset}
          onFinish={(r) => {
            setResult(r)
            setPhase('result')
          }}
        />
      )}

      {/* --- けっか --- */}
      {phase === 'result' && result && (
        <div className="battle-result">
          <div className="battle-result-emoji">
            {result.winner === 'me' ? '🏆' : '😢'}
          </div>
          <h2>{result.winner === 'me' ? 'きみの かち！' : 'まけちゃった…'}</h2>
          <p className="battle-result-sub">
            {myPicks.map((b) => b.name).join('・')} <b>VS</b>{' '}
            {foePicks.map((b) => b.name).join('・')}
          </p>
          <p className="battle-result-sub">{result.turns} ターンの たたかい</p>
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
