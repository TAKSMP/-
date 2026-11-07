// =============================================================
//  むしバトル v2（1〜4ひき ずつ。じぶんと あいての かずは べつべつに えらべる）
// -------------------------------------------------------------
//  ・さいしょに「なんびきで たたかう？」で じぶんと あいての かずを えらぶ（1〜4）。
//  ・さいしょに「ずかんのむし」か「そだてたむし」を えらぶ。
//    ずかんのむし：ずかんの虫を ぜんぶ つかう（これまでどおり）。
//    そだてたむし：ストーリーで レベルアップさせた虫だけ。レベルと おぼえた わざも そのまま つかう。
//  ・せんとうロジックは src/lib/battleEngine.ts に ぜんぶ ある。
//    このファイルは「UI（みため）」と「えんしゅつ」だけ。
//  ・1ターンぶんの めいれい（Command）を あつめて resolveTurn を 1回よぶ。
//  ・かえってきた field.log を 1行ずつ ゆっくり ながす。
// =============================================================
import { countHiki } from '../lib/format'
import { useMemo, useState } from 'react'
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { battleStatsV2 } from '../lib/battleSetup'
import { levelOf, loadStory, movesOf, statsWithLevel, type StorySave } from '../lib/story'
import { makeFighter, type Fighter } from '../lib/battleEngine'
import { BugPicker } from '../components/BugPicker'
import { StarRating } from '../components/StarRating'
import { BattleStage, type BattleResult } from '../components/BattleStage'
import { sfx } from '../lib/sound'
import { moveSummary } from '../lib/moveLibrary'


// -------------------------------------------------------------
//  虫の ステータスカード（v2：すばやさ と わざ3つ）
// -------------------------------------------------------------
// grown：そだてた虫（ストーリーの レベルと おぼえた わざを はんえい）
type Stats = ReturnType<typeof battleStatsV2>

function StatCardV2({ bug, grown }: { bug: CaughtBug; grown?: { save: StorySave } }) {
  const level = grown ? levelOf(grown.save, bug.id).level : 0
  const s: Stats = grown
    ? { ...statsWithLevel(bug, level), moves: movesOf(grown.save, bug, level) }
    : battleStatsV2(bug)
  const [open, setOpen] = useState(false)
  return (
    <div className="statcard">
      <div className="statcard-top">
        <img className="statcard-photo" src={mainPhoto(bug)} alt={bug.name} />
        <div className="statcard-name">
          {bug.name}
          {grown && <span className="statcard-lv"> Lv {level}</span>}
        </div>
      </div>
      <div className="statrow">
        <span className="statlabel">たいりょく</span>
        <span className="statval">
          <span className="hpbar mini">
            <span
              className="hpbar-fill"
              style={{ width: Math.min(100, Math.round((s.hp / 60) * 100)) + '%' }}
            />
          </span>
          {s.hp}
        </span>
      </div>
      {grown ? (
        // レベルが あがると 星の かずを こえるので、かずで ひょうじ
        <div className="statrow statrow-nums">
          <span>⚔️ {s.attack}</span>
          <span>🛡️ {s.defense}</span>
          <span>⚡ {s.speed}</span>
        </div>
      ) : (
        <>
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
        </>
      )}
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
                {moveSummary(m)} ／{' '}
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

// こうどうの じゅんばんの がめんで つかう すばやさの ひょうじ（そだてた虫は 星を こえるので かず）
function SpeedView({ value, grown }: { value: number; grown: boolean }) {
  return grown ? (
    <span className="speed-num">⚡ {value}</span>
  ) : (
    <StarRating value={value} size={12} max={10} />
  )
}

// -------------------------------------------------------------
//  ページ本体
// -------------------------------------------------------------
interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const COUNT_KEY = 'chomushi.battlecount.v1'
const COUNTS = [1, 2, 3, 4] as const
const COUNT_LABEL: Record<number, string> = { 1: '1ぴき', 2: '2ひき', 3: '3びき', 4: '4ひき' }
function loadCounts(): { me: number; foe: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) ?? 'null')
    const ok = (n: unknown) => (typeof n === 'number' && n >= 1 && n <= 4 ? n : 1)
    return raw ? { me: ok(raw.me), foe: ok(raw.foe) } : { me: 1, foe: 1 }
  } catch {
    return { me: 1, foe: 1 }
  }
}
function saveCounts(c: { me: number; foe: number }) {
  try { localStorage.setItem(COUNT_KEY, JSON.stringify(c)) } catch { /* storage unavailable */ }
}

type Phase = 'count' | 'source' | 'pickMine' | 'pickFoe' | 'speed' | 'battle' | 'result'
type Source = 'zukan' | 'grown'

export function BattlePage2({ bugs: allBugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('count')
  // じぶんと あいての かず（1〜4）
  const [counts, setCounts] = useState(() => loadCounts())
  const myCount = Math.min(counts.me, allBugs.length)
  const foeCount = counts.foe
  const [source, setSource] = useState<Source>('zukan')
  // ストーリーの ほぞん（そだてた虫の レベルと わざ）。このページを ひらく たびに よみなおす
  const save = useMemo(() => loadStory(), [])
  // そだてた虫 ＝ ストーリーで レベルアップ（Lv2いじょう）した虫
  const grownBugs = useMemo(
    () => allBugs.filter((b) => levelOf(save, b.id).level >= 2),
    [allBugs, save],
  )
  const grown = source === 'grown'
  // えらべる虫（ずかんのむし＝ぜんぶ／そだてたむし＝そだてた虫だけ）。あいても おなじ なかまから
  const bugs = grown ? grownBugs : allBugs
  // 虫ごとの せんとう用ステータス（そだてた虫は レベルと わざを はんえい）
  const statsOf = (b: CaughtBug): Stats =>
    grown
      ? { ...statsWithLevel(b, levelOf(save, b.id).level), moves: movesOf(save, b, levelOf(save, b.id).level) }
      : battleStatsV2(b)
  const cardOf = (b: CaughtBug) => <StatCardV2 bug={b} grown={grown ? { save } : undefined} />
  const [myPicks, setMyPicks] = useState<CaughtBug[]>([])
  const [foeMode, setFoeMode] = useState<'random' | 'choose'>('random')
  const [foePicks, setFoePicks] = useState<CaughtBug[]>([])
  // せんとうは BattleStage が ぜんぶ もつ。ここは「だれが 出るか」だけ。
  const [fighters, setFighters] = useState<Fighter[] | null>(null)
  const [result, setResult] = useState<BattleResult | null>(null)
  const [battleKey, setBattleKey] = useState(0)

  if (allBugs.length < 2) {
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
    setPhase('count')
    setMyPicks([])
    setFoePicks([])
    setFighters(null)
    setResult(null)
  }

  // 「ずかんのむし」か「そだてたむし」を えらんだ
  function chooseSource(src: Source) {
    sfx.tap()
    setSource(src)
    setMyPicks([])
    setFoePicks([])
    setPhase('pickMine')
  }

  // ── ①じぶんの虫を えらぶ（2たい2なら 2ひき）
  function pickMine(bug: CaughtBug) {
    sfx.tap()
    const next = [...myPicks, bug]
    setMyPicks(next)
    if (next.length >= myCount) setPhase('pickFoe')
  }

  // ── ②あいてを えらぶ
  function pickFoe(bug: CaughtBug) {
    sfx.tap()
    const next = [...foePicks, bug]
    setFoePicks(next)
    if (next.length >= foeCount || foeChoices(next).length === 0) setPhase('speed')
  }

  function pickRandomFoe() {
    sfx.tap()
    const myIds = new Set(myPicks.map((b) => b.id))
    const pool = bugs.filter((b) => !myIds.has(b.id))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, foeCount)
    // たりないときは（虫が すくないとき）のこりを ぜんたいから おぎなう
    while (picked.length < foeCount) {
      picked.push(bugs[Math.floor(Math.random() * bugs.length)])
    }
    setFoePicks(picked)
    setPhase('speed')
  }

  // ── ③バトル かいし（ファイターを つくって BattleStage に わたす）
  function startBattle() {
    if (myPicks.length < myCount || foePicks.length < 1) return
    sfx.tap()
    const mine = myPicks.map((b, i) =>
      makeFighter(b, statsOf(b), `me${i}`, 'me', mainPhoto(b)),
    )
    const foes = foePicks.map((b, i) =>
      makeFighter(b, statsOf(b), `foe${i}`, 'foe', mainPhoto(b)),
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
  // あいてに えらべる虫：まだ あいてに えらんでいない虫。
  // じぶんの虫と かぶらない虫を さきに。たりなければ じぶんと おなじ虫も えらべる
  function foeChoices(picked: CaughtBug[]): CaughtBug[] {
    const rest = bugs.filter((b) => !picked.some((p) => p.id === b.id))
    const fresh = rest.filter((b) => !myIds.has(b.id))
    return fresh.length >= foeCount - picked.length ? fresh : rest
  }
  // そだてたむしは、じぶんの かずだけ いれば あそべる
  const grownOk = grownBugs.length >= Math.max(1, myCount)

  return (
    <div className="battle">
      {/* --- なんびきで たたかう？ --- */}
      {phase === 'count' && (
        <div className="battle-step">
          <h2 className="battle-step-title">なんびきで たたかう？</h2>
          <div className="count-pick">
            {(['me', 'foe'] as const).map((side) => (
              <div key={side} className="count-row">
                <span className="count-label">{side === 'me' ? 'きみ' : 'あいて'}</span>
                <div className="count-chips">
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      className={'chip count-chip' + (counts[side] === n ? ' on' : '')}
                      disabled={side === 'me' && n > allBugs.length}
                      onClick={() => {
                        sfx.tap()
                        const next = { ...counts, [side]: n }
                        setCounts(next)
                        saveCounts(next)
                      }}
                    >
                      {COUNT_LABEL[n]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="count-vs">
            {'🐛'.repeat(myCount)} <b>VS</b> {'🐛'.repeat(foeCount)}
          </p>
          <button className="btn btn-big btn-primary count-next" onClick={() => { sfx.tap(); setPhase('source') }}>
            つぎへ ▶
          </button>
        </div>
      )}

      {/* --- ⓪ ずかんのむし／そだてたむし --- */}
      {phase === 'source' && (
        <div className="battle-step">
          <button className="btn btn-ghost battle-back" onClick={reset}>
            ← かずを えらびなおす
          </button>
          <h2 className="battle-step-title">⓪ どの虫で たたかう？</h2>
          <div className="mode-cards">
            <button className="mode-card" onClick={() => chooseSource('zukan')}>
              <span className="mode-emoji">📖</span>
              <span className="mode-title">ずかんのむし</span>
              <span className="mode-desc">ずかんに のっている 虫から えらぶ</span>
            </button>
            <button
              className="mode-card"
              disabled={!grownOk}
              onClick={() => chooseSource('grown')}
            >
              <span className="mode-emoji">🌱</span>
              <span className="mode-title">そだてたむし</span>
              <span className="mode-desc">
                {grownOk
                  ? 'ストーリーで レベルアップさせた 虫から えらぶ（レベルと わざも そのまま）'
                  : `ストーリーで レベルアップさせた 虫が ${myCount}ひき いると えらべるよ（いま ${grownBugs.length}ひき）`}
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
            {myCount >= 2 && `（${countHiki(myPicks.length + 1)}め ／ ${countHiki(myCount)}）`}
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
            renderCard={cardOf}
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
            {foeCount >= 2 &&
              foeMode === 'choose' &&
              `（${countHiki(foePicks.length + 1)}め ／ ${countHiki(foeCount)}）`}
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
                bugs={foeChoices(foePicks)}
                onPick={pickFoe}
                renderCard={cardOf}
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
                  <SpeedView value={statsOf(b).speed} grown={grown} />
                </div>
              ))}
            </div>
            <div className="speed-team">
              <span className="speed-team-label">あいて</span>
              {foePicks.map((b, i) => (
                <div key={b.id + i} className="speed-row">
                  <img src={mainPhoto(b)} alt={b.name} />
                  <span className="speed-name">{b.name}</span>
                  <SpeedView value={statsOf(b).speed} grown={grown} />
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
          big={myCount === 1 && foePicks.length === 1}
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
          <p className="battle-result-sub">
            {grown ? '🌱 そだてたむし' : '📖 ずかんのむし'} ／ {result.turns} ターンの たたかい
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
