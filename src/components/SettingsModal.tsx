import { useRef, useState, type ChangeEvent } from 'react'
import type { CaughtBug } from '../types'
import { clearApiKey, getApiKeyMasked, hasRealAi, setApiKey } from '../lib/ai'
import {
  createBackupJson,
  loadZukan,
  restoreBackupJson,
} from '../lib/storage'
import { sfx } from '../lib/sound'

interface Props {
  onClose: () => void
  onChanged: () => void
  onDataRestored: (bugs: CaughtBug[]) => void
}

// 本物AI（Claudeの画像認識）をつかうための、APIキー設定画面。
// キーはこの端末（ブラウザ）だけに保存され、どこにも送信・保存されません。
export function SettingsModal({ onClose, onChanged, onDataRestored }: Props) {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [dataBusy, setDataBusy] = useState(false)
  const [dataMessage, setDataMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)
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

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportData() {
    setDataBusy(true)
    setDataMessage(null)
    try {
      const date = new Date().toISOString().slice(0, 10)
      const file = new File([createBackupJson()], `chomushi-backup-${date}.json`, {
        type: 'application/json',
      })

      // iPhoneでは共有シートから「ファイルに保存」を選ぶのが確実。
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: 'ちょうむし バックアップ',
          text: '図鑑データのバックアップです。',
          files: [file],
        })
      } else {
        downloadFile(file)
      }

      setDataMessage({
        type: 'success',
        text: `✅ 図鑑 ${loadZukan().length}しゅるいのバックアップを作りました。`,
      })
      sfx.discover()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('バックアップの書き出しに失敗しました', error)
      setDataMessage({
        type: 'error',
        text: 'バックアップを保存できませんでした。もう一度ためしてください。',
      })
    } finally {
      setDataBusy(false)
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const currentCount = loadZukan().length
    const question = currentCount
      ? `いまの図鑑（${currentCount}しゅるい）を、このバックアップで上書きします。よろしいですか？`
      : 'このバックアップから図鑑を復元しますか？'
    if (!confirm(question)) return

    setDataBusy(true)
    setDataMessage(null)
    try {
      const bugs = restoreBackupJson(await file.text())
      onDataRestored(bugs)
      setDataMessage({
        type: 'success',
        text: `✅ 図鑑 ${bugs.length}しゅるいを復元しました！`,
      })
      sfx.discover()
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'バックアップを復元できませんでした。'
      setDataMessage({ type: 'error', text })
      sfx.tap()
    } finally {
      setDataBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>

        <h2 className="modal-name">⚙️ せってい</h2>

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

        <section className="settings-backup">
          <h3>📦 データのバックアップ</h3>
          <p>
            図鑑の写真・記録・バッジ・ミッションを、ほかのブラウザへ
            ひっこしできます。APIキーは入りません。
          </p>

          <div className="settings-backup-actions">
            <button
              className="btn btn-ghost"
              onClick={exportData}
              disabled={dataBusy}
            >
              📤 バックアップを保存
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => backupInputRef.current?.click()}
              disabled={dataBusy}
            >
              📥 バックアップから復元
            </button>
          </div>

          <input
            ref={backupInputRef}
            className="settings-backup-input"
            type="file"
            accept=".json,application/json"
            onChange={importData}
          />

          <p className="settings-backup-guide">
            Chromeで保存 → Safariで復元 の順におこなってください。
          </p>
          {dataMessage && (
            <p className={`settings-data-message ${dataMessage.type}`}>
              {dataMessage.text}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
