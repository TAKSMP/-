// =============================================================
//  わざ道場（レベル50いじょうの 虫が つかえる）
//   ・しんわざの しゅうとく：ひっきテスト（15もん）に ごうかく → わざを おぼえる
//   ・わざを きたえる：リスニングテスト（15もん）に ごうかく → わざが つよくなる
// =============================================================
import { useMemo, useState } from 'react'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { BugPicker } from '../components/BugPicker'
import { DojoQuiz } from '../components/DojoQuiz'
import { DEX, GROUPS, loadDexSeen, markMovesSeen, type DexEntry, type MoveGroup } from '../lib/moveDex'
import { moveSummary } from '../lib/moveLibrary'
import { mainPhoto } from '../lib/storage'
import { sfx } from '../lib/sound'
import {
  DOJO_MIN_LEVEL,
  addUltimate,
  ULTIMATE_LEVELS,
  allMovesOf,
  applyTraining,
  baseMovesOf,
  levelOf,
  loadStory,
  moveSlots,
  saveStory,
  setMoves,
  trainMove,
  trainOptions,
  trainedSteps,
  type StorySave,
  type TrainKey,
} from '../lib/story'

type Mode = 'learn' | 'train'
type Step =
  | 'menu'
  | 'pickBug'
  | 'pickMove' // learn：おぼえる わざを えらぶ ／ train：きたえる わざを えらぶ
  | 'pickAspect' // train：なにを きたえるか
  | 'quiz'
  | 'replace' // learn：どの わざと とりかえるか
  | 'done'

// わざの つよさ → えいごテストの むずかしさ（1〜3）
export function moveTier(m: SpecialMoveV2): 1 | 2 | 3 {
  if (m.ultimate || m.hpToOne || m.revive || m.chaos || m.copyMove) return 3
  if (m.kind === 'attack') {
    const hits = m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1
    const p = (m.fixedDamage ?? m.power) * hits
    return p >= 85 ? 3 : p >= 55 ? 2 : 1
  }
  if (m.restoreStats && m.restoreStats.length >= 2) return 2
  if (m.flattenBoosts && m.target === 'allFoes') return 2
  return m.healRatio && m.healRatio >= 0.5 ? 2 : 1
}

const stars = (t: number) => '★'.repeat(t) + '☆'.repeat(3 - t)

function valueText(m: SpecialMoveV2, key: TrainKey): string {
  switch (key) {
    case 'power':
      return String(m.fixedDamage ?? m.power)
    case 'accuracy':
      return `${m.accuracy}%`
    case 'heal':
      return `${Math.round((m.healRatio ?? 0) * 100)}%`
    case 'revive':
      return `${Math.round((m.revive?.chance ?? 0) * 100)}%`
    case 'uses':
      return `${m.uses}かい`
  }
}

export function DojoPage({ bugs }: { bugs: CaughtBug[] }) {
  const [save, setSave] = useState<StorySave>(() => loadStory())
  const [step, setStep] = useState<Step>('menu')
  const [mode, setMode] = useState<Mode>('learn')
  const [bug, setBug] = useState<CaughtBug | null>(null)
  const [group, setGroup] = useState<MoveGroup>('attack')
  const [target, setTarget] = useState<SpecialMoveV2 | null>(null) // えらんだ わざ（きたえる：まえの わざ）
  const [pendingEntry, setPendingEntry] = useState<DexEntry | null>(null) // おぼえる わざ
  const [aspect, setAspect] = useState<TrainKey | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => loadDexSeen())

  const eligible = useMemo(
    () => bugs.filter((b) => levelOf(save, b.id).level >= DOJO_MIN_LEVEL),
    [bugs, save],
  )
  const level = bug ? levelOf(save, bug.id).level : 1

  function commit(next: StorySave) {
    saveStory(next)
    setSave(next)
  }
  function toMenu() {
    sfx.tap()
    setStep('menu')
    setBug(null)
    setTarget(null)
    setPendingEntry(null)
    setAspect(null)
    setResult(null)
  }
  function start(m: Mode) {
    sfx.tap()
    setMode(m)
    setStep('pickBug')
  }

  const bgUrl = new URL('dojo/dojo-bg.jpg', new URL(import.meta.env.BASE_URL, document.baseURI)).href
  const wrap = (body: React.ReactNode) => (
    <div className="dojo-room" style={{ backgroundImage: `url(${bgUrl})` }}>
      {body}
    </div>
  )
  const backBtn = (to: Step, label = '← もどる') => (
    <button
      className="btn btn-ghost dojo-back"
      onClick={() => {
        sfx.tap()
        setStep(to)
      }}
    >
      {label}
    </button>
  )

  // ---------------- メニュー ----------------
  if (step === 'menu') {
    return wrap(
      <div className="dojo-panel">
        <h2 className="dojo-title">🥋 わざ<ruby>道場<rt>どうじょう</rt></ruby></h2>
        <p className="dojo-lead">
          ここは <b>しんわざ</b> と <b>きたえる</b> ばしょ。ただし、つかえるのは{' '}
          <b>レベル{DOJO_MIN_LEVEL}いじょう</b> の虫だけ！ えいごの テストに ぜんぶ せいかいしたら ねがいが かなうよ。
        </p>
        <p className="dojo-count">
          つかえる 虫：<b>{eligible.length}</b>ひき
        </p>
        <div className="game-menu">
          <button className="game-card story" onClick={() => start('learn')}>
            <span className="game-emoji">📖</span>
            <span className="game-title">しんわざの しゅうとく</span>
            <span className="game-desc">ひっきテスト（かくもんだい）で ほしい わざを おぼえる</span>
          </button>
          <button className="game-card race" onClick={() => start('train')}>
            <span className="game-emoji">🎧</span>
            <span className="game-title">わざを きたえる</span>
            <span className="game-desc">リスニングテスト（ききとり）で おぼえた わざを つよく</span>
          </button>
        </div>
      </div>,
    )
  }

  // ---------------- 虫えらび ----------------
  if (step === 'pickBug') {
    return wrap(
      <div className="dojo-panel">
        {backBtn('menu')}
        <h2 className="dojo-title">{mode === 'learn' ? '📖 しんわざの しゅうとく' : '🎧 わざを きたえる'}</h2>
        <p className="dojo-lead">どの虫に する？（レベル{DOJO_MIN_LEVEL}いじょう）</p>
        {eligible.length === 0 ? (
          <p className="dojo-empty">
            まだ レベル{DOJO_MIN_LEVEL}いじょうの 虫が いないよ。ストーリーで そだててから きてね！
          </p>
        ) : (
          <BugPicker
            bugs={eligible}
            onPick={(b) => {
              sfx.tap()
              setBug(b)
              setStep('pickMove')
            }}
            renderCard={(b) => (
              <div className="story-bug">
                <img src={mainPhoto(b)} alt={b.name} />
                <span className="story-bug-name">{b.name}</span>
                <span className="story-bug-lv">Lv {levelOf(save, b.id).level}</span>
              </div>
            )}
          />
        )}
      </div>,
    )
  }

  if (!bug) return null

  // ---------------- わざえらび ----------------
  if (step === 'pickMove' && mode === 'learn') {
    const owned = new Set([
      ...allMovesOf(save, bug).map((m) => m.id),
      ...(save.ultimates?.[bug.id] ?? []).map((m) => m.id),
    ])
    const list = DEX.filter((d) => d.group === group)
    return wrap(
      <div className="dojo-panel">
        {backBtn('pickBug')}
        <h2 className="dojo-title">どの わざを おぼえる？</h2>
        <p className="dojo-lead">
          {bug.name}（Lv{level}）。「????」の わざも えらべるよ。おぼえると なまえが わかる！
          つよい わざほど テストが むずかしいよ。
        </p>
        <div className="dojo-tabs">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              className={'dojo-tab' + (group === g.key ? ' on' : '')}
              onClick={() => {
                sfx.tap()
                setGroup(g.key)
              }}
            >
              {g.emoji} {g.label}
            </button>
          ))}
        </div>
        <div className="dojo-movelist">
          {list.map((d) => {
            const known = seen.has(d.move.id)
            const have = owned.has(d.move.id)
            return (
              <button
                key={d.move.id}
                className="dojo-move"
                disabled={have}
                onClick={() => {
                  sfx.tap()
                  setPendingEntry(d)
                  setStep('quiz')
                }}
              >
                <span className="dojo-move-no">No.{d.no}</span>
                <span className="dojo-move-emoji">{known ? (d.move.emoji ?? '✨') : '❔'}</span>
                <span className="dojo-move-name">{known ? d.move.name : '????'}</span>
                <span className="dojo-move-sub">
                  {have ? 'おぼえている' : `むずかしさ ${stars(moveTier(d.move))}`}
                  {known && !have && `／${moveSummary(d.move)}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>,
    )
  }

  if (step === 'pickMove' && mode === 'train') {
    const moves = baseMovesOf(save, bug, level)
    return wrap(
      <div className="dojo-panel">
        {backBtn('pickBug')}
        <h2 className="dojo-title">どの わざを きたえる？</h2>
        <p className="dojo-lead">{bug.name}（Lv{level}）の わざ</p>
        <div className="dojo-movelist">
          {moves.map((m) => {
            const now = applyTraining(m, save.trained?.[bug.id]?.[m.id])
            return (
              <button
                key={m.id}
                className="dojo-move"
                onClick={() => {
                  sfx.tap()
                  setTarget(m)
                  setStep('pickAspect')
                }}
              >
                <span className="dojo-move-emoji">{m.emoji ?? '✨'}</span>
                <span className="dojo-move-name">
                  {m.ultimate && '👑 '}
                  {m.name}
                </span>
                <span className="dojo-move-sub">
                  {moveSummary(now)}／{now.uses}かい
                </span>
              </button>
            )
          })}
        </div>
      </div>,
    )
  }

  // ---------------- なにを きたえる？ ----------------
  if (step === 'pickAspect' && target) {
    const opts = trainOptions(target)
    const now = applyTraining(target, save.trained?.[bug.id]?.[target.id])
    return wrap(
      <div className="dojo-panel">
        {backBtn('pickMove')}
        <h2 className="dojo-title">
          {target.emoji} {target.name}
        </h2>
        <p className="dojo-lead">なにを きたえる？ むずかしさ {stars(moveTier(target))}</p>
        <div className="dojo-movelist">
          {opts.map((o) => {
            const steps = trainedSteps(save, bug.id, target.id, o.key)
            const full = steps >= o.max
            return (
              <button
                key={o.key}
                className="dojo-move"
                disabled={full}
                onClick={() => {
                  sfx.tap()
                  setAspect(o.key)
                  setStep('quiz')
                }}
              >
                <span className="dojo-move-emoji">{o.emoji}</span>
                <span className="dojo-move-name">
                  {o.label}（{o.perStep}）
                </span>
                <span className="dojo-move-sub">
                  いま {valueText(now, o.key)}／きたえた {steps}/{o.max}
                  {full && '（もう さいだい！）'}
                </span>
              </button>
            )
          })}
        </div>
      </div>,
    )
  }

  // ---------------- テスト ----------------
  if (step === 'quiz') {
    const tier = mode === 'learn' ? moveTier(pendingEntry!.move) : moveTier(target!)
    return wrap(
      <DojoQuiz
        mode={mode === 'learn' ? 'write' : 'listen'}
        tier={tier}
        onExit={() => setStep(mode === 'learn' ? 'pickMove' : 'pickAspect')}
        onClear={() => {
          sfx.tap()
          if (mode === 'train' && target && aspect) {
            const before = applyTraining(target, save.trained?.[bug.id]?.[target.id])
            const next = trainMove(save, bug.id, target, aspect)
            commit(next)
            const after = applyTraining(target, next.trained?.[bug.id]?.[target.id])
            const label = trainOptions(target).find((o) => o.key === aspect)?.label ?? ''
            setResult(
              `${target.name}の ${label}が ${valueText(before, aspect)} → ${valueText(after, aspect)} に なった！`,
            )
            setStep('done')
            return
          }
          if (mode === 'learn' && pendingEntry) {
            const mv = { ...pendingEntry.move } as SpecialMoveV2
            if (mv.ultimate) {
              // さいきょうわざは 3つまで。いっぱいなら、もっている 3つの うち すきな 1つと とりかえを えらばせる
              const full = (save.ultimates?.[bug.id] ?? []).length >= ULTIMATE_LEVELS.length
              if (full) {
                setStep('replace')
                return
              }
              commit(addUltimate(save, bug.id, mv))
              learned(mv)
              return
            }
            const cur = allMovesOf(save, bug)
            if (cur.length < moveSlots(level)) {
              commit(setMoves(save, bug.id, [...cur, mv]))
              learned(mv)
              return
            }
            setStep('replace')
          }
        }}
      />,
    )
  }

  function learned(mv: SpecialMoveV2, replaced?: string) {
    markMovesSeen([mv.id])
    setSeen(loadDexSeen())
    setResult(
      `${bug!.name}は 「${mv.name}」を おぼえた！` + (replaced ? `（「${replaced}」は わすれた）` : ''),
    )
    setStep('done')
  }

  // ---------------- とりかえ ----------------
  if (step === 'replace' && pendingEntry) {
    const mv = { ...pendingEntry.move } as SpecialMoveV2
    const cur = mv.ultimate
      ? (save.ultimates?.[bug.id] ?? [])
      : allMovesOf(save, bug).slice(0, moveSlots(level))
    return wrap(
      <div className="dojo-panel">
        <h2 className="dojo-title">🎉 ごうかく！</h2>
        <div className={'story-learn-new' + (mv.ultimate ? ' ultimate' : '')}>
          <span className="story-learn-emoji">{mv.emoji ?? '✨'}</span>
          <span className="story-learn-name">{mv.name}</span>
          <span className="story-learn-sub">
            {moveSummary(mv)}／{mv.uses}かい つかえる
          </span>
          <p className="story-learn-desc">{mv.desc}</p>
        </div>
        <p className="story-learn-q">
          {mv.ultimate
            ? 'さいきょうわざは 3つまで。どの さいきょうわざと とりかえる？'
            : 'どの わざと とりかえる？'}
        </p>
        <div className="story-learn-list">
          {cur.map((m, i) => (
            <button
              key={m.id + i}
              className="story-learn-old"
              onClick={() => {
                sfx.tap()
                if (mv.ultimate) {
                  commit(addUltimate(save, bug.id, mv, m.id))
                } else {
                  const all = [...allMovesOf(save, bug)]
                  all[i] = mv
                  commit(setMoves(save, bug.id, all))
                }
                learned(mv, m.name)
              }}
            >
              <span className="story-learn-old-name">
                {m.ultimate && '👑 '}
                {m.emoji} {m.name}
              </span>
              <span className="story-learn-old-sub">
                {moveSummary(m)}／{m.uses}かい
              </span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={toMenu}>
          やっぱり やめる
        </button>
      </div>,
    )
  }

  // ---------------- おわり ----------------
  return wrap(
    <div className="dojo-panel dojo-done">
      <div className="dojo-done-big">🎉 ごうかく！</div>
      <p className="dojo-done-msg">{result}</p>
      <button className="btn btn-big btn-primary" onClick={() => setStep('pickMove')}>
        つづけて やる
      </button>
      <button className="btn btn-ghost" onClick={toMenu}>
        どうじょうの メニューへ
      </button>
    </div>,
  )
}

