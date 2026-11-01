import { useEffect, useRef, useState } from 'react'
import {
  DAY_COUNT_SECONDS,
  LOCK_BLOCKED_EVENT,
  LOCK_CHANGED_EVENT,
  addUsage,
  loadLock,
  loadUsage,
  lockState,
  type LockConfig,
  type LockUsage,
} from '../lib/childLock'
import { sfx } from '../lib/sound'

interface Props {
  activeKey: string | null // いま ひらいている ロック項目（なければ null）
  onTimeUp: () => void // 時間ぎれで ポップアップを とじた とき（メニューへ もどす）
  deferUntilExit: boolean // ゲームの なかなら、メニューへ もどるまで あそばせてから ロックする
}

const DAYS: [string, string][] = [
  ['月', 'げつ'], ['火', 'か'], ['水', 'すい'], ['木', 'もく'], ['金', 'きん'], ['土', 'ど'], ['日', 'にち'],
]
const BUGS = ['🐞', '🦋', '🐝', '🐛', '🐜', '🐌', '🪲', '🦗']

// 画面のはしの「あと●ふん」・1週間の ポップアップ・「またあそぼうね」ポップアップ
export function ChildLockLayer({ activeKey, onTimeUp, deferUntilExit }: Props) {
  const [cfg, setCfg] = useState<LockConfig>(() => loadLock())
  const [usage, setUsage] = useState<LockUsage>(() => loadUsage())
  const [weekOpen, setWeekOpen] = useState(false)
  const [blocked, setBlocked] = useState<{ reason: 'day' | 'week'; kick: boolean } | null>(null)
  // 時間ぎれに なったが、ゲームの くぎりまで まっている ところ
  const [pending, setPending] = useState<{ reason: 'day' | 'week'; key: string } | null>(null)
  const deferRef = useRef(deferUntilExit)
  deferRef.current = deferUntilExit
  const [bugs, setBugs] = useState<string[]>(['🐞', '🦋', '🐝'])

  function showBlocked(reason: 'day' | 'week', kick: boolean) {
    const pick = [...BUGS].sort(() => Math.random() - 0.5).slice(0, 3)
    setBugs(pick)
    setBlocked({ reason, kick })
    sfx.discover()
  }

  // 設定が かわったら よみなおす／ロック中の 項目を ひらこうとした ときに ポップアップ
  useEffect(() => {
    const reload = () => { setCfg(loadLock()); setUsage(loadUsage()) }
    const onBlocked = (e: Event) => showBlocked((e as CustomEvent).detail === 'week' ? 'week' : 'day', false)
    window.addEventListener(LOCK_CHANGED_EVENT, reload)
    window.addEventListener(LOCK_BLOCKED_EVENT, onBlocked)
    return () => {
      window.removeEventListener(LOCK_CHANGED_EVENT, reload)
      window.removeEventListener(LOCK_BLOCKED_EVENT, onBlocked)
    }
  }, [])

  // 1びょうごとに、ロック項目を あそんでいる あいだだけ 時間を かぞえる
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = loadLock()
      const counting = c.enabled && !!activeKey && c.items.includes(activeKey) && document.visibilityState === 'visible'
      const u = counting ? addUsage(1) : loadUsage()
      setCfg(c)
      setUsage(u)
      const b = counting ? lockState(c, u).blocked : null
      if (b && activeKey) {
        if (deferRef.current) setPending((p) => p ?? { reason: b, key: activeKey })
        else showBlocked(b, true)
      } else if (!counting) {
        // 設定が かわって ロックが なくなって いたら まちを やめる
        const still = activeKey ? lockState(c, u).blocked : null
        if (!still) setPending(null)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [activeKey])

  // ゲームの くぎり（メニューへ もどった）で ロックの ポップアップを だす
  useEffect(() => {
    if (pending && activeKey !== pending.key) {
      showBlocked(pending.reason, false)
      setPending(null)
    }
  }, [activeKey, pending])

  const st = lockState(cfg, usage)
  if (!st.active && !blocked) return null

  const badge = pending
    ? 'このゲームで おしまい'
    : st.secondsLeft != null
      ? `あと${Math.ceil(st.secondsLeft / 60)}ふん`
      : st.daysLeft != null
        ? `あと${st.daysLeft}にち`
        : ''

  function closeBlocked() {
    const kick = blocked?.kick
    setBlocked(null)
    sfx.tap()
    if (kick) onTimeUp()
  }

  return (
    <>
      {st.active && (
        <button type="button" className="lock-badge" onClick={() => { sfx.tap(); setWeekOpen(true) }} aria-label="のこりじかんを みる">
          ⏳ {badge}
        </button>
      )}

      {weekOpen && (
        <div className="lock-back" onClick={() => setWeekOpen(false)}>
          <div className="lock-pop" role="dialog" aria-label="こんしゅうの きろく" onClick={(e) => e.stopPropagation()}>
            <h3 className="lock-pop-title">📅 こんしゅうの きろく</h3>
            <div className="lock-week">
              {DAYS.map(([kanji, kana], i) => (
                <div key={kanji} className={'lock-day' + (i === st.todayIndex ? ' today' : '')}>
                  <ruby>{kanji}<rt>{kana}</rt></ruby>
                  <span className={'lock-mark' + (st.usedDates[i] ? ' on' : '')} aria-label={st.usedDates[i] ? 'あそんだ' : ''} />
                </div>
              ))}
            </div>
            <p className="lock-left">
              {st.daysLeft != null ? <>あと <b>{st.daysLeft}</b> 日</> : <>1しゅうかんの せいげんは ないよ</>}
            </p>
            {st.secondsLeft != null && (
              <p className="lock-sub">きょうは あと <b>{Math.ceil(st.secondsLeft / 60)}</b> ふん</p>
            )}
            <p className="lock-note">まる は {DAY_COUNT_SECONDS / 60}ぷん いじょう あそんだ ひ だよ。</p>
            <button type="button" className="btn btn-big btn-primary" onClick={() => setWeekOpen(false)}>とじる</button>
          </div>
        </div>
      )}

      {blocked && (
        <div className="lock-back" onClick={closeBlocked}>
          <div className="lock-pop lock-bye" role="dialog" aria-label="またあそぼうね" onClick={(e) => e.stopPropagation()}>
            <div className="lock-bugs" aria-hidden="true">
              {bugs.map((b, i) => <span key={i} className={`lock-bug b${i}`}>{b}</span>)}
            </div>
            <p className="lock-bubble">
              {blocked.reason === 'week' ? <>またらいしゅう<br />あそぼうね！</> : <>あしたまた<br />あそぼうね！</>}
            </p>
            <button type="button" className="btn btn-big btn-primary" onClick={closeBlocked}>うん！</button>
          </div>
        </div>
      )}
    </>
  )
}
