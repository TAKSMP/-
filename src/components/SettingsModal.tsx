import { useState } from 'react'
import { clearApiKey, getApiKeyMasked, hasRealAi, setApiKey } from '../lib/ai'
import { sfx } from '../lib/sound'

interface Props {
  onClose: () => void
  onChanged: () => void
}

// 本物AI（Claudeの画像認識）をつかうための、APIキー設定画面。
// キーはこの端末（ブラウザ）だけに保存され、どこにも送信・保存されません。
export function SettingsModal({ onClose, onChanged }: Props) {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const masked = getApiKeyMasked()
  const on = hasRealAi()

  function save() {
    if (!key.trim()) return
    setApiKey(key.trim())
    setKey('')
    setSaved(true)
    sfx.discover()
    onChanged()
    setTimeout(() => setSaved(false), 1600)
  }

  function remove() {
    clearApiKey()
    sfx.tap()
    onChanged()
    setSaved(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>

        <h2 className="modal-name">⚙️ AIせってい</h2>

        <div className={'ai-status ' + (on ? 'on' : 'off')}>
          {on ? (
            <>
              ✅ 本物AIモード（Claudeの画像認識）で動いています
              <div className="ai-status-key">いまのキー: {masked}</div>
            </>
          ) : (
            <>
              ⚠️ いまは「デモモード」（写真の色から推理するだけ）です。
              <br />
              正確に判定するには、下でAPIキーを入れてください。
            </>
          )}
        </div>

        <div className="settings-help">
          <p>
            このアプリは、あなたの <b>Anthropic APIキー</b>{' '}
            をつかって、写真の虫を本物のAI（Claude）で正確に判定します。
          </p>
          <ul>
            <li>
              キーは <b>この端末のブラウザだけ</b>{' '}
              に保存され、ほかのどこにも送られません。
            </li>
            <li>
              キーは{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.anthropic.com
              </a>{' '}
              で作れます（<code>sk-ant-…</code> ではじまる文字列）。
            </li>
            <li>使った分だけAnthropicから料金がかかります。</li>
          </ul>
        </div>

        <input
          className="apikey-input"
          type="password"
          placeholder="sk-ant-… をここに貼りつけ"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={save} disabled={!key.trim()}>
            💾 ほぞんして有効化
          </button>
          {masked && (
            <button className="btn btn-danger settings-remove" onClick={remove}>
              🗑️ キーをけす
            </button>
          )}
        </div>

        {saved && <p className="settings-saved">✅ ほぞんしました！</p>}
      </div>
    </div>
  )
}
