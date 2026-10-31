// =============================================================
//  バトルクイズ
// -------------------------------------------------------------
//  ・ほんものの バトル画面で「この ばめん、どの わざが いちばん いい？」
//  ・えらんだ わざは ほんものの エンジン（resolveTurn）で 1ターン うごかして
//    けっかを 1ぎょうずつ 見せる → かいせつ
//  ・まちがえた ときは「せいかいの わざ」でも うごかして 見くらべられる
//  ・もんだいは src/data/battleQuiz.ts（100もん）。1かい 10もん。
//    まだ せいかい して いない もんだいから さきに でる。
// =============================================================
import { useMemo, useRef, useState } from 'react'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import type { Fighter, TurnStep } from '../lib/battleEngine'
import { moveSummary } from '../lib/moveLibrary'
import { BATTLE_QUIZ, type BattleQuizQuestion } from '../data/battleQuiz'
import { buildField, moveOf, playQuizTurn, type Cast } from '../lib/battleQuiz'
import { BUG_SPECIES } from '../data/bugs'
import { mainPhoto } from '../lib/storage'
import { cueFor, FighterSlot, playCueSound } from '../components/BattleStage'
import { ParkScene } from '../components/ParkScene'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

const QUESTION_COUNT = 10
const CLEARED_KEY = 'chomushi-battlequiz-cleared'

// --- せいかいした もんだいの きろく（ブラウザに のこす。だめでも うごく） ---
function loadCleared(): Set<number> {
  try {
    const raw = localStorage.getItem(CLEARED_KEY)
    if (raw) return new Set(JSON.parse(raw) as number[])
  } catch {
    /* つかえない ときは からっぽ */
  }
  return new Set()
}
function saveCleared(s: Set<number>): void {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify([...s]))
  } catch {
    /* ほぞん できなくても クイズは つづける */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 写真の ない 虫は えもじの え に する
function emojiPhoto(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fffbe8"/><text x="50" y="68" font-size="56" text-anchor="middle">${emoji}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}


function fakeBug(name: string, id: string): CaughtBug {
  return {
    id,
    name,
    order: '',
    rarity: 1,
    habitat: '',
    captures: [],
    mainCaptureId: '',
    corrected: false,
  }
}

// じぶんの ずかんの 虫から えらぶ（たりなければ ずかんデータで おぎなう）
function pickCast(bugs: CaughtBug[], count: number): Cast[] {
  const mine = shuffle(bugs.filter((b) => mainPhoto(b))).map((b) => ({
    name: b.name,
    photo: mainPhoto(b),
    bug: b,
  }))
  const out: Cast[] = []
  const used = new Set<string>()
  for (const c of mine) {
    if (out.length >= count) break
    if (used.has(c.name)) continue
    used.add(c.name)
    out.push(c)
  }
  for (const s of shuffle(BUG_SPECIES)) {
    if (out.length >= count) break
    if (used.has(s.name)) continue
    used.add(s.name)
    out.push({ name: s.name, photo: emojiPhoto(s.emoji), bug: fakeBug(s.name, 'bq-' + s.id) })
  }
  return out
}

// 「{me}」などを じっさいの なまえに
function fill(text: string, names: Record<string, string>): string {
  return text.replace(/\{(me2?|foe2?)\}/g, (_, k: string) => names[k] ?? k)
}

function rankOf(score: number, total: number): { emoji: string; title: string } {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return { emoji: '👑', title: 'バトル マスター！' }
  if (pct >= 0.8) return { emoji: '🏆', title: 'さくせん めいじん！' }
  if (pct >= 0.5) return { emoji: '🌟', title: 'なかなかの さくせん！' }
  if (pct >= 0.2) return { emoji: '🐛', title: 'これから つよくなる！' }
  return { emoji: '🌱', title: 'また チャレンジしよう！' }
}

interface Round {
  q: BattleQuizQuestion
  options: string[] // シャッフルずみ
  cast: { me: Cast[]; foe: Cast[] }
  names: Record<string, string>
  scene: number
}

type Phase = 'start' | 'playing' | 'done'
// question: えらぶ ／ playback: 1ぎょうずつ さいせい ／ result: かいせつ
type Step = 'question' | 'playback' | 'result'

interface Props {
  bugs: CaughtBug[]
  onQuit?: () => void
}

export function BattleQuizPage({ bugs }: Props) {
  const [phase, setPhase] = useState<Phase>('start')
  const [rounds, setRounds] = useState<Round[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('question')
  const [shownFighters, setShownFighters] = useState<Fighter[]>([])
  const [log, setLog] = useState<string[]>([])
  const [steps, setSteps] = useState<TurnStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [replayMove, setReplayMove] = useState<string | null>(null)
  const [hurtUid, setHurtUid] = useState<string | null>(null)
  const [glowUid, setGlowUid] = useState<string | null>(null)
  const [rankPop, setRankPop] = useState<{ uid: string; up: boolean } | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [hint, setHint] = useState(false) // わざの せつめいを 見せるか
  const [cleared, setCleared] = useState<Set<number>>(() => loadCleared())
  const logRef = useRef<HTMLDivElement>(null)
  // 音を ならす ための からっぽの わざ表（わざリストの「見た」きろくは つけない）
  const silentMoveMap = useRef(new Map<string, SpecialMoveV2>())

  const round = rounds[index]

  function scrollLog() {
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 0)
  }

  // もんだいの ばめんを ひょうじ
  function showQuestion(r: Round) {
    const f = buildField(r.q, r.cast, r.options[0])
    setShownFighters(f.fighters)
    setLog(r.q.log.map((l) => fill(l, r.names)))
    setStep('question')
    setHint(false)
    setPicked(null)
    setReplayMove(null)
    setSteps([])
    setStepIndex(0)
    setHurtUid(null)
    setGlowUid(null)
    setRankPop(null)
    scrollLog()
  }

  function start() {
    sfx.tap()
    // まだ せいかい して いない もんだいを さきに
    const fresh = shuffle(BATTLE_QUIZ.filter((q) => !cleared.has(q.id)))
    const old = shuffle(BATTLE_QUIZ.filter((q) => cleared.has(q.id)))
    const qs = [...fresh, ...old].slice(0, QUESTION_COUNT)
    const rs: Round[] = qs.map((q) => {
      const cast = pickCast(bugs, q.me.length + q.foe.length)
      const me = cast.slice(0, q.me.length)
      const foe = cast.slice(q.me.length)
      return {
        q,
        options: shuffle(q.options),
        cast: { me, foe },
        names: {
          me: me[0]?.name ?? '',
          me2: me[1]?.name ?? '',
          foe: foe[0]?.name ?? '',
          foe2: foe[1]?.name ?? '',
        },
        scene: Math.floor(Math.random() * 6),
      }
    })
    setRounds(rs)
    setIndex(0)
    setScore(0)
    setPhase('playing')
    showQuestion(rs[0])
  }

  // わざを えらんで 1ターン うごかす
  function runWith(moveId: string) {
    if (!round) return
    const { before, after: next } = playQuizTurn(round.q, round.cast, moveId)
    setShownFighters(before.fighters)
    setLog((prev) => [...prev, '― ― ― ― ―'])
    setStep('playback')
    setSteps(next.steps)
    if (next.steps.length === 0) {
      setStep('result')
      return
    }
    showStep(next.steps, 0)
  }

  function showStep(all: TurnStep[], i: number) {
    const s = all[i]
    setStepIndex(i)
    setShownFighters(s.fighters)
    const cue = cueFor(s.line, s.fighters)
    setGlowUid(cue.glow ?? null)
    setHurtUid(cue.hurt ?? null)
    setRankPop(cue.rank ?? null)
    playCueSound(cue, silentMoveMap.current)
    setLog((prev) => [...prev, s.line])
    scrollLog()
  }

  function advance() {
    const nextI = stepIndex + 1
    if (nextI < steps.length) {
      showStep(steps, nextI)
      return
    }
    setHurtUid(null)
    setGlowUid(null)
    setRankPop(null)
    setStep('result')
    // さいしょの さいせいが おわった ときに せいかい／まちがいを はっぴょう
    if (replayMove === null && picked !== null) {
      if (picked === round.q.answer) {
        sfx.discover()
        setConfetti(true)
        setTimeout(() => setConfetti(false), 150)
      } else {
        sfx.error()
      }
    }
  }

  function choose(moveId: string) {
    if (step !== 'question' || picked !== null) return
    sfx.tap()
    setPicked(moveId)
    if (moveId === round.q.answer) {
      setScore((s) => s + 1)
      if (!cleared.has(round.q.id)) {
        const nextSet = new Set(cleared)
        nextSet.add(round.q.id)
        setCleared(nextSet)
        saveCleared(nextSet)
      }
    }
    setLog((prev) => [...prev, `👉 ${round.names.me}の「${moveOf(moveId).name}」を えらんだ！`])
    runWith(moveId)
  }

  // まちがえた とき：せいかいの わざでも うごかして みる
  function replayAnswer() {
    sfx.tap()
    const f = buildField(round.q, round.cast, round.q.answer)
    setShownFighters(f.fighters)
    setReplayMove(round.q.answer)
    setLog([
      ...round.q.log.map((l) => fill(l, round.names)),
      `✨ せいかいの「${moveOf(round.q.answer).name}」だと…`,
    ])
    runWith(round.q.answer)
  }

  function next() {
    sfx.tap()
    if (index + 1 >= rounds.length) {
      setPhase('done')
      if (score * 2 >= rounds.length) sfx.win()
      else sfx.lose()
      setConfetti(true)
      setTimeout(() => setConfetti(false), 150)
      return
    }
    const ni = index + 1
    setIndex(ni)
    showQuestion(rounds[ni])
  }

  function quit() {
    sfx.tap()
    setPhase('start')
  }

  const rank = useMemo(() => rankOf(score, rounds.length), [score, rounds.length])

  // ---------------------------------------------------------
  //  スタート・けっか
  // ---------------------------------------------------------
  if (phase === 'start' || phase === 'done') {
    return (
      <div className="page quiz">
        <Confetti show={confetti} />
        {phase === 'start' ? (
          <div className="quiz-start">
            <div className="quiz-start-emoji">⚔️❓</div>
            <p>
              バトルの ばめんで、
              <br />
              <b>いちばん いい わざ</b>を えらぼう！
            </p>
            <p className="bq-note">
              えらんだ わざは ほんとうに うごくよ。
              <br />
              ぜんぶで {BATTLE_QUIZ.length}もん。1かい {QUESTION_COUNT}もん しゅつだい！
            </p>
            <div className="bq-progress">
              ⭐ クリアした もんだい <b>{cleared.size}</b> / {BATTLE_QUIZ.length}
              <div className="bq-progress-bar">
                <div style={{ width: `${(cleared.size / BATTLE_QUIZ.length) * 100}%` }} />
              </div>
            </div>
            <button className="btn btn-big btn-primary" onClick={start}>
              スタート ▶
            </button>
          </div>
        ) : (
          <div className="quiz-done">
            <div className="quiz-done-emoji">{rank.emoji}</div>
            <h2>{rank.title}</h2>
            <div className="quiz-final-score">
              {score} <span>/ {rounds.length}てん</span>
            </div>
            <div className="bq-progress">
              ⭐ クリアした もんだい <b>{cleared.size}</b> / {BATTLE_QUIZ.length}
              <div className="bq-progress-bar">
                <div style={{ width: `${(cleared.size / BATTLE_QUIZ.length) * 100}%` }} />
              </div>
            </div>
            <button className="btn btn-big btn-primary" onClick={start}>
              もういちど 🔄
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------
  //  バトル画面
  // ---------------------------------------------------------
  const q = round.q
  const ask = fill(q.ask ?? '{me}は どの わざを つかう？', round.names)
  const isCorrect = picked === q.answer
  const foes = shownFighters.filter((x) => x.side === 'foe')
  const mine = shownFighters.filter((x) => x.side === 'me')
  const big = q.me.length === 1 && q.foe.length === 1

  const slot = (f: Fighter) => (
    <div className="bq-slot" key={f.uid}>
      <FighterSlot
        f={f}
        big={big}
        hurt={hurtUid === f.uid}
        glow={glowUid === f.uid}
        rankUp={rankPop?.uid === f.uid ? rankPop.up : null}
        tappable={false}
        onTap={() => {}}
      />
      <span className="bq-spd">
        💨 すばやさ {f.base.speed}
        {f.recharge > 0 && ' ・😵 うごけない'}
        {f.counterGuard && ' ・🦔 かまえ'}
        {f.regen && ' ・🌱 かいふく中'}
        {f.leechedBy && ' ・🩸 すわれ中'}
      </span>
    </div>
  )

  return (
    <div className="battle-stage battle-stage2 bq-stage">
      <div className="battle-bg">
        <ParkScene index={round.scene} />
      </div>
      <Confetti show={confetti} />
      <button className="battle-flee" onClick={quit}>
        ✕ やめる
      </button>
      {step === 'question' && (
        <button
          className={'bq-hint-btn' + (hint ? ' on' : '')}
          onClick={() => {
            sfx.tap()
            setHint((h) => !h)
          }}
        >
          💡 {hint ? 'ヒントを とじる' : 'ヒント'}
        </button>
      )}
      <span className="stage-turn">
        だい {index + 1}もん / {rounds.length}　⭐{score}
      </span>

      <div className="stage-scene stage2">
        <div className="stage2-side foe">{foes.map(slot)}</div>
        <div className="stage2-side me">{mine.map(slot)}</div>
      </div>

      <div className="stage-bottom">
        <div
          className={'stage-log' + (step === 'playback' ? ' tappable' : '')}
          ref={logRef}
          onClick={step === 'playback' ? advance : undefined}
        >
          {log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {step === 'question' && (
          <>
            <p className="stage-prompt">❓ {ask}</p>
            <div className="stage2-moves bq-moves">
              {round.options.map((id) => {
                const m = moveOf(id)
                return (
                  <button
                    key={id}
                    className={'stage-btn sp' + (m.ultimate ? ' ult' : '')}
                    onClick={() => choose(id)}
                  >
                    <span>
                      {m.emoji ?? '✨'} {m.name}
                    </span>
                    <small>
                      {m.ultimate && '👑 '}
                      {moveSummary(m)}
                    </small>
                    {hint && <small className="bq-desc">{m.desc}</small>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 'playback' && (
          <button className="stage-next" onClick={advance}>
            つぎへ
            <span className="stage-next-arrow">▼</span>
          </button>
        )}

        {step === 'result' && (
          <div className={'bq-result' + (isCorrect ? ' ok' : ' ng')}>
            <div className="bq-result-title">
              {isCorrect ? '🎉 せいかい！' : '😢 ざんねん…'}
              <span className="bq-result-answer">
                こたえは <b>{moveOf(q.answer).emoji} {moveOf(q.answer).name}</b>
              </span>
            </div>
            <p className="bq-why">💡 {fill(q.why, round.names)}</p>
            <div className="bq-result-btns">
              {!isCorrect && replayMove === null && (
                <button className="btn" onClick={replayAnswer}>
                  せいかいの わざで 見てみる ▶
                </button>
              )}
              <button className="btn btn-primary" onClick={next}>
                {index + 1 >= rounds.length ? 'けっかを 見る 🏁' : 'つぎの もんだい ▶'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
