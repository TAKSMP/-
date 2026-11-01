import { useEffect, useRef, useState } from 'react'
import {
  ALL_LOCK_KEYS,
  checkLockPassword,
  LOCK_TREE,
  loadLock,
  loadUsage,
  lockState,
  resetUsage,
  saveLock,
  type LockConfig,
} from '../lib/childLock'
import { sfx } from '../lib/sound'

// せっていの いちばん下：チャイルドロック（パスワードを入れないと すすめない）
export function ChildLockSettings() {
  const [askPass, setAskPass] = useState(false)
  const [open, setOpen] = useState(false)
  const st = lockState(loadLock(), loadUsage())
  return (
    <section className="settings-dex lock-section">
      <h3>🔒 チャイルドロック</h3>
      <p>あそぶ 時間や 日数を おうちの人が 決められます。パスワードが ひつようです。</p>
      <button type="button" className="btn btn-primary settings-dex-btn" onClick={() => { sfx.tap(); setAskPass(true) }}>
        🔒 ひらく
      </button>
      {loadLock().enabled && st.active && <p className="settings-backup-guide">いま：ロック ON</p>}
      {askPass && (
        <PasswordPrompt
          onCancel={() => setAskPass(false)}
          onOk={() => { setAskPass(false); setOpen(true) }}
        />
      )}
      {open && <LockEditor onClose={() => setOpen(false)} />}
    </section>
  )
}

function PasswordPrompt({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  function submit() {
    if (checkLockPassword(value)) { sfx.tap(); onOk() }
    else { setBad(true); setValue(''); sfx.error() }
  }
  return (
    <div className="lock-back" onClick={onCancel}>
      <form className="lock-pop lock-pass" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <h3 className="lock-pop-title">🔒 パスワード</h3>
        <p className="lock-sub">おうちの人が パスワードを 入れてください。</p>
        <input
          ref={ref}
          className="lock-input"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => { setValue(e.target.value); setBad(false) }}
          aria-label="パスワード"
        />
        {bad && <p className="lock-bad">パスワードが ちがいます。</p>}
        <div className="battle-result-actions">
          <button type="submit" className="btn btn-big btn-primary">OK</button>
          <button type="button" className="btn btn-big" onClick={onCancel}>やめる</button>
        </div>
      </form>
    </div>
  )
}

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30) // 0.5〜8時間（分）
const fmtHours = (min: number) => `${min / 60}時間`

function LockEditor({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<LockConfig>(() => loadLock())
  const [confirmReset, setConfirmReset] = useState(false)
  const st = lockState(cfg, loadUsage())

  function update(next: LockConfig) {
    setCfg(next)
    saveLock(next)
  }
  function toggleKeys(keys: string[], on: boolean) {
    const set = new Set(cfg.items)
    keys.forEach((k) => (on ? set.add(k) : set.delete(k)))
    update({ ...cfg, items: ALL_LOCK_KEYS.filter((k) => set.has(k)) })
  }
  const Check = ({ keys, label, strong }: { keys: string[]; label: string; strong?: boolean }) => {
    const n = keys.filter((k) => cfg.items.includes(k)).length
    return (
      <label className={'lock-check' + (strong ? ' strong' : '')}>
        <input
          type="checkbox"
          checked={n === keys.length}
          ref={(el) => { if (el) el.indeterminate = n > 0 && n < keys.length }}
          onChange={(e) => toggleKeys(keys, e.target.checked)}
        />
        <span>{label}</span>
      </label>
    )
  }

  return (
    <div className="lock-back" onClick={onClose}>
      <div className="lock-pop lock-editor" role="dialog" aria-label="チャイルドロックの せってい" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">✕</button>
        <h3 className="lock-pop-title">🔒 チャイルドロック</h3>

        <label className="lock-switch">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => update({ ...cfg, enabled: e.target.checked })} />
          <span>ロックを つかう</span>
        </label>

        <div className="lock-field">
          <label htmlFor="lock-daily">1日に あそべる 時間</label>
          <select
            id="lock-daily"
            value={cfg.dailyMinutes ?? ''}
            onChange={(e) => update({ ...cfg, dailyMinutes: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">せいげん なし</option>
            {HOUR_OPTIONS.map((m) => <option key={m} value={m}>{fmtHours(m)}</option>)}
          </select>
        </div>
        <div className="lock-field">
          <label htmlFor="lock-week">1週間（月〜日）に あそべる 日数</label>
          <select
            id="lock-week"
            value={cfg.weekDays ?? ''}
            onChange={(e) => update({ ...cfg, weekDays: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">せいげん なし</option>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d}日</option>)}
          </select>
        </div>
        <p className="lock-note">
          時間は ロックする 項目ぜんぶの 合計です。{DAY_NOTE}
        </p>

        <h4 className="lock-h4">ロックする 項目</h4>
        <div className="lock-tree">
          <div className="lock-quick">
            <button type="button" className="btn btn-ghost" onClick={() => toggleKeys(ALL_LOCK_KEYS, true)}>ぜんぶ えらぶ</button>
            <button type="button" className="btn btn-ghost" onClick={() => toggleKeys(ALL_LOCK_KEYS, false)}>ぜんぶ はずす</button>
          </div>
          {LOCK_TREE.map((sec) => (
            <div key={sec.label} className="lock-sec">
              <Check strong label={sec.label} keys={sec.groups.flatMap((g) => g.leaves.map((l) => l.key))} />
              {sec.groups.map((g) => (
                <div key={g.label} className={g.label ? 'lock-grp' : 'lock-leaves'}>
                  {g.label && <Check label={g.label} keys={g.leaves.map((l) => l.key)} />}
                  <div className="lock-leaves">
                    {g.leaves.map((l) => <Check key={l.key} label={l.label} keys={[l.key]} />)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <p className="lock-sub">
          きょう：{Math.floor(st.todaySeconds / 60)}ふん あそんだ／今週：{st.daysUsed}日 あそんだ
        </p>
        {!confirmReset ? (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>あそんだ きろくを リセット</button>
        ) : (
          <div className="battle-result-actions">
            <button type="button" className="btn btn-primary" onClick={() => { resetUsage(); setConfirmReset(false) }}>リセットする</button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>やめる</button>
          </div>
        )}
        <button type="button" className="btn btn-big btn-primary lock-done" onClick={onClose}>とじる</button>
      </div>
    </div>
  )
}
const DAY_NOTE = 'ゲームの 最中に 時間がきた ときは、メニューに もどるまで あそべます（結果が出るまで）。1分も あそんでいない 日は 日数に 数えません（1分以上で 1日）。'
