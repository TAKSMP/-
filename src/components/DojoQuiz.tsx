// =============================================================
//  わざ道場の えいごテスト（10もん ぜんぶ せいかいで ごうかく）
// -------------------------------------------------------------
//  ひとつでも まちがえたら「でなおしてきなさい！」
// =============================================================
import { useEffect, useMemo, useState } from 'react'
import { buildQuiz, isCorrect, type QuizMode } from '../data/englishQuiz'
import { speakEnglish, speechSupported, stopSpeaking } from '../lib/speak'
import { sfx } from '../lib/sound'

// ひっきもんだいで よみあげる えいご（1ぎょうめが えいごの ときだけ）。□は「ブランク」と よむ
const isEnglish = (t: string) => /^[A-Za-z]/.test(t.trim())
function bodyEnglish(body?: string): string | null {
  const first = body?.split('\n')[0] ?? ''
  return isEnglish(first) ? first.replace(/□/g, 'blank') : null
}

export function DojoQuiz({
  mode,
  tier,
  onClear,
  onExit,
}: {
  mode: QuizMode
  tier: 1 | 2 | 3
  onClear: () => void
  onExit: () => void
}) {
  const [round, setRound] = useState(0) // やりなおす ごとに ふえる
  const quiz = useMemo(() => buildQuiz(mode, tier), [mode, tier, round])
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null) // まちがえた ときの せいかい
  const [shownOk, setShownOk] = useState(false)

  const q = quiz[idx]
  const choices = useMemo(() => {
    if (!q?.choices) return []
    const a = [...q.choices]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [q])

  // リスニングは もんだいが 出たら じどうで よみあげる
  useEffect(() => {
    if (q?.speak && !failed) speakEnglish(q.speak)
    return () => stopSpeaking()
  }, [q, failed])

  function judge(given: string) {
    if (!q || shownOk || failed) return
    if (isCorrect(q, given)) {
      sfx.tap()
      setShownOk(true)
    } else {
      setFailed(q.answers[0])
    }
  }

  function next() {
    if (idx + 1 >= quiz.length) {
      onClear()
      return
    }
    setIdx(idx + 1)
    setTyped('')
    setPicked(null)
    setShownOk(false)
  }

  function retry() {
    setRound((r) => r + 1)
    setIdx(0)
    setTyped('')
    setPicked(null)
    setShownOk(false)
    setFailed(null)
  }

  if (failed) {
    return (
      <div className="dojo-panel dojo-fail">
        <div className="dojo-fail-big">でなおしてきなさい！</div>
        <p className="dojo-fail-sub">
          {idx + 1}もんめで まちがえたよ。10もん ぜんぶ せいかいで ごうかく！
        </p>
        <p className="dojo-fail-ans">
          せいかいは <b>{failed}</b>
        </p>
        <button className="btn btn-big btn-primary" onClick={retry}>
          🔁 もういちど ちょうせん
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
        <button className="btn dojo-speak dojo-kiku" onClick={() => speakEnglish(bodyEnglish(q.body)!)}>
          🔊 きく
        </button>
      )}
      {q.hint && <p className="dojo-q-hint">ヒント：{q.hint}</p>}

      {q.fmt === 'choice' ? (
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
              {!q.speak && isEnglish(c) && (
                <button className="dojo-kiku-mini" aria-label={`${c}を きく`} onClick={() => speakEnglish(c)}>
                  🔊
                </button>
              )}
            </div>
          ))}
        </div>
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
            {idx + 1 >= quiz.length ? '🎉 ごうかく！' : 'つぎへ →'}
          </button>
        </div>
      )}
      <button className="btn btn-ghost dojo-quit" onClick={onExit}>
        ← やめる
      </button>
    </div>
  )
}
