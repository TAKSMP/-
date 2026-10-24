// =============================================================
//  むしバトル v2（1たい1／2たい2）
// -------------------------------------------------------------
//  ・1たい1か 2たい2かは、バトルの メニューで えらんで mode で わたされる。
//  ・さいしょに「ずかんのむし」か「そだてたむし」を えらぶ。
//    ずかんのむし：ずかんの虫を ぜんぶ つかう（これまでどおり）。
//    そだてたむし：ストーリーで レベルアップさせた虫だけ。レベルと おぼえた わざも そのまま つかう。
//  ・せんとうロジックは src/lib/battleEngine.ts に ぜんぶ ある。
//    このファイルは「UI（みため）」と「えんしゅつ」だけ。
//  ・1ターンぶんの めいれい（Command）を あつめて resolveTurn を 1回よぶ。
//  ・かえってきた field.log を 1行ずつ ゆっくり ながす。
// =============================================================
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
  mode: Mode // 1たい1 か 2たい2（バトルの メニューで えらぶ）
  onGoCapture: () => void
}

type Mode = 1 | 2
type Phase = 'source' | 'pickMine' | 'pickFoe' | 'speed' | 'battle' | 'result'
type Source = 'zukan' | 'grown'

export function BattlePage2({ bugs: allBugs, mode, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('source')
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

  if (allBugs.length < 2 || (mode === 2 && allBugs.length < 4)) {
    return (
      <div className="battle-empty">
        <div className="quiz-start-emoji">⚔️🐛</div>
        <p>
          バトルを するには、虫を
          <br />
          <b>{mode === 2 ? '4ひき' : '2ひき'} いじょう</b> あつめてね！
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
    setPhase('source')
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
  const foeCandidates = bugs.filter((b) => !myIds.has(b.id))

  return (
    <div className="battle">
      {/* --- ⓪ ずかんのむし／そだてたむし --- */}
      {phase === 'source' && (
        <div className="battle-step">
          <h2 className="battle-step-title">⓪ どの虫で たたかう？</h2>
          <div className="mode-cards">
            <button className="mode-card" onClick={() => chooseSource('zukan')}>
              <span className="mode-emoji">📖</span>
              <span className="mode-title">ずかんのむし</span>
              <span className="mode-desc">ずかんに のっている 虫から えらぶ</span>
            </button>
            <button
              className="mode-card"
              disabled={grownBugs.length < mode * 2}
              onClick={() => chooseSource('grown')}
            >
              <span className="mode-emoji">🌱</span>
              <span className="mode-title">そだてたむし</span>
              <span className="mode-desc">
                {grownBugs.length >= mode * 2
                  ? 'ストーリーで レベルアップさせた 虫から えらぶ（レベルと わざも そのまま）'
                  : `ストーリーで レベルアップさせた 虫が ${mode * 2}ひき いると えらべるよ（いま ${grownBugs.length}ひき）`}
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
