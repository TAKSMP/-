// =============================================================
//  わざ道場の えいごテスト（15もん ぜんぶ せいかいで ごうかく）
// -------------------------------------------------------------
//  ひとつでも まちがえたら「でなおしてきなさい！」
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { arrangeChoices, buildQuiz, isCorrect, type EnglishQ, type QuizMode, type QuizVariant } from '../data/englishQuiz'
import { isSlow, setSlow, speakEnglish, speakWithMask, speechSupported, stopSpeaking } from '../lib/speak'
import { sfx } from '../lib/sound'

// ひっきもんだいで よみあげる えいご（1ぎょうめが えいごの ときだけ）。□は「ぴろぴろ」で かくす
// 1もじめが □ の ぶん（□ old are you? など）も よみあげる
const isEnglish = (t: string) => /^[A-Za-z□]/.test(t.trim())
function bodyEnglish(body?: string): string | null {
  const first = body?.split('\n')[0] ?? ''
  return isEnglish(first) ? first : null
}

// せいかいの えいごを よみあげる ぶん（あなうめは □ を こたえで うめる）
function sayAnswer(q: EnglishQ): string | null {
  const ans = q.answers[0] ?? ''
  const first = (q.body ?? '').split('\n')[0]
  if (/^[A-Za-z]/.test(ans.trim())) return first.includes('□') ? first.replace('□', ans) : ans
  return q.speak ?? bodyEnglish(q.body)?.replace('□', '') ?? null
}

export function DojoQuiz({
  mode,
  tier,
  variant = 'kids',
  onClear,
  onExit,
}: {
  mode: QuizMode
  tier: 1 | 2 | 3
  variant?: QuizVariant
  onClear: () => void
  onExit: () => void
}) {
  const quiz = useMemo(() => buildQuiz(mode, tier, variant), [mode, tier, variant])
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null) // まちがえた ときの せいかい
  const [shownOk, setShownOk] = useState(false)
  const [redo, setRedo] = useState(0) // まちがえた もんだいを やりなおした かいすう
  const [slow, setSlowState] = useState(isSlow())
  const [pic, setPic] = useState<string | null>(null) // イラストを みせている えらびかた
  const [askQuit, setAskQuit] = useState(false) // 「ほんとうに やめますか？」を だして いる

  const q = quiz[idx]
  // えらびかたの ならびは まいかい ランダム（まえと おなじ ばしょに こたえが こない）
  const choices = useMemo(() => (q ? arrangeChoices(q) : []), [quiz, idx, redo]) // eslint-disable-line react-hooks/exhaustive-deps

  // リスニングは もんだいが 出たら じどうで よみあげる
  useEffect(() => {
    if (q?.speak && !failed) speakEnglish(q.speak)
    return () => stopSpeaking()
  }, [q, failed])

  function judge(given: string) {
    if (!q || shownOk || failed) return
    if (isCorrect(q, given)) {
      sfx.correct()
      setShownOk(true)
    } else {
      sfx.wrong()
      setFailed(q.answers[0])
    }
  }

  function next() {
    if (redo > 0) {
      // やりなおしの せいかい → どうじょうの さいしょの がめんへ
      onExit()
      return
    }
    if (idx + 1 >= quiz.length) {
      sfx.win()
      onClear()
      return
    }
    setIdx(idx + 1)
    setTyped('')
    setPicked(null)
    setShownOk(false)
    setPic(null)
  }

  // まちがえた もんだいを もういちど（せいかいしたら どうじょうの さいしょの がめんへ もどる）
  function retry() {
    setRedo((r) => r + 1)
    setTyped('')
    setPicked(null)
    setShownOk(false)
    setFailed(null)
    setPic(null)
  }

  if (failed) {
    return (
      <div className="dojo-panel dojo-fail">
        <div className="dojo-fail-big">でなおしてきなさい！</div>
        <p className="dojo-fail-sub">
          {idx + 1}もんめで まちがえたよ。15もん ぜんぶ せいかいで ごうかく！
          <br />
          もういちど この もんだいを といて、せいかいしたら どうじょうに もどるよ。
        </p>
        <p className="dojo-fail-ans">
          せいかいは <b>{failed}</b>
        </p>
        {q?.why && (
          <div className="dojo-why">
            <p className="dojo-why-title">💡 かいせつ</p>
            <p className="dojo-why-text">{q.why}</p>
            {q && sayAnswer(q) && (
              <button className="btn dojo-speak dojo-kiku" onClick={() => speakEnglish(sayAnswer(q)!)}>
                🔊 せいかいを きく
              </button>
            )}
          </div>
        )}
        <button className="btn btn-big btn-primary" onClick={retry}>
          🔁 この もんだいを もういちど
        </button>
        <button className="btn btn-ghost" onClick={onExit}>
          ← やめる
        </button>
      </div>
    )
  }

  if (!q) return null
  const canSpeak = speechSupported()

  return (
    <div className="dojo-panel dojo-quiz">
      <button
        className="dojo-slow dojo-quit-top"
        onClick={() => {
          sfx.tap()
          setAskQuit(true)
        }}
      >
        ← やめる
      </button>
      <button
        className={'dojo-slow' + (slow ? ' on' : '')}
        aria-pressed={slow}
        onClick={() => {
          sfx.tap()
          setSlow(!slow)
          setSlowState(!slow)
        }}
      >
        🐢 ゆっくりさいせい {slow ? 'ON' : 'OFF'}
      </button>
      <div className="dojo-dots" aria-label={`${idx + 1}もんめ／${quiz.length}もん`}>
        {quiz.map((_, i) => (
          <span key={i} className={'dojo-dot' + (i < idx || (i === idx && shownOk) ? ' done' : i === idx ? ' now' : '')} />
        ))}
      </div>
      <p className="dojo-q-count">
        {idx + 1} / {quiz.length}もんめ
      </p>
      <p className="dojo-q-title">{q.title}</p>

      {q.speak && (
        <div className="dojo-listen">
          <button className="btn btn-big dojo-speak" onClick={() => speakEnglish(q.speak!)}>
            🔊 もういちど きく
          </button>
          {!canSpeak && (
            <p className="dojo-q-note">この たんまつでは おとが でないよ。「{q.speak}」</p>
          )}
        </div>
      )}
      {q.emoji && <div className="dojo-q-emoji">{q.emoji}</div>}
      {q.body && <p className="dojo-q-body">{q.body}</p>}
      {!q.speak && bodyEnglish(q.body) && (
        <button className="btn dojo-speak dojo-kiku" onClick={() => speakWithMask(bodyEnglish(q.body)!, sfx.blankMask, 350 + 130 * (q.answers[0]?.length ?? 4))}>
          🔊 きく
        </button>
      )}
      {q.hint && <p className="dojo-q-hint">ヒント：{q.hint}</p>}

      {q.fmt === 'choice' ? (
        <>
        {pic && q.pics?.[pic] && (
          <div className="dojo-pic" onClick={() => setPic(null)}>
            <span className="dojo-pic-emoji">{q.pics[pic]}</span>
            <span className="dojo-pic-text">{pic}</span>
          </div>
        )}
        <div className="dojo-choices">
          {choices.map((c) => (
            <div key={c} className="dojo-choice-wrap">
              <button
                className={'dojo-choice' + (shownOk && c === q.answers[0] ? ' ok' : '') + (picked === c ? ' picked' : '')}
                disabled={shownOk}
                onClick={() => {
                  setPicked(c)
                  judge(c)
                }}
              >
                {c}
              </button>
              {q.speak && q.pics?.[c] && (
                <button
                  className={'dojo-kiku-mini dojo-pic-btn' + (pic === c ? ' on' : '')}
                  aria-label="イラストを みる"
                  onClick={() => {
                    sfx.tap()
                    setPic(pic === c ? null : c)
                  }}
                >
                  🖼️
                </button>
              )}
              {!q.speak && isEnglish(c) && (
                <button className="dojo-kiku-mini" aria-label={`${c}を きく`} onClick={() => speakEnglish(c)}>
                  🔊
                </button>
              )}
            </div>
          ))}
        </div>
        </>
      ) : (
        <form
          className="dojo-input-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) judge(typed)
          }}
        >
          <input
            className="dojo-input"
            value={typed}
            disabled={shownOk}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="えいごで いれてね"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={shownOk || !typed.trim()}>
            こたえる
          </button>
        </form>
      )}

      {shownOk && (
        <div className="dojo-ok">
          <div className="dojo-ok-big">⭕ せいかい！</div>
          <button className="btn btn-big btn-primary" onClick={next}>
            {redo > 0 ? '🏠 どうじょうに もどる' : idx + 1 >= quiz.length ? '🎉 ごうかく！' : 'つぎへ →'}
          </button>
        </div>
      )}
      {askQuit && (
        <div className="dojo-confirm-back" onClick={() => setAskQuit(false)}>
          <div className="dojo-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="dojo-confirm-q">ほんとうに やめますか？</p>
            <div className="dojo-confirm-btns">
              <button
                className="btn btn-big btn-primary"
                onClick={() => {
                  sfx.tap()
                  setAskQuit(false)
                }}
              >
                つづける
              </button>
              <button
                className="btn btn-big"
                onClick={() => {
                  sfx.tap()
                  stopSpeaking()
                  onExit()
                }}
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
