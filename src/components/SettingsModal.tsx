import { useRef, useState, type ChangeEvent } from 'react'
import { MoveDexModal } from './MoveDexModal'
import { FieldBugsModal } from './FieldBugsModal'
import { sfx } from '../lib/sound'
import type { CaughtBug } from '../types'
import {
  createBackupJson,
  loadZukan,
  restoreBackupJson,
} from '../lib/storage'

interface Props {
  onClose: () => void
  onChanged: () => void
  onDataRestored: (bugs: CaughtBug[]) => void
}

// せってい画面：ひっさつわざリストと、データのバックアップ／復元。
// onChanged は AIキーの ための ものだった（いまは つかわない）
export function SettingsModal({ onClose, onDataRestored }: Props) {
  const [dexOpen, setDexOpen] = useState(false)
  const [fieldBugsOpen, setFieldBugsOpen] = useState(false)
  const [dataBusy, setDataBusy] = useState(false)
  const [dataMessage, setDataMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)

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

        <section className="settings-dex">
          <h3>🗺️ マップに 出る むし</h3>
          <p>
            ストーリーの「あるいて さがす マップ」で、どの虫に であうかを
            図鑑から えらべます。
          </p>
          <button
            className="btn btn-primary settings-dex-btn"
            onClick={() => {
              sfx.tap()
              setFieldBugsOpen(true)
            }}
          >
            🗺️ でる むしを えらぶ
          </button>
        </section>

        <section className="settings-dex">
          <h3>📜 ひっさつわざリスト</h3>
          <p>
            バトルで 見たり つかったりした ひっさつわざを、
            No.じゅんに まとめて 見られるよ。
          </p>
          <button
            className="btn btn-primary settings-dex-btn"
            onClick={() => {
              sfx.tap()
              setDexOpen(true)
            }}
          >
            📜 わざリストを ひらく
          </button>
        </section>

        <section className="settings-backup">
          <h3>📦 データのバックアップ</h3>
          <p>
            図鑑の写真・記録・バッジ・ミッションを、ほかのブラウザへ
            ひっこしできます。
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

      {dexOpen && <MoveDexModal onClose={() => setDexOpen(false)} />}
      {fieldBugsOpen && <FieldBugsModal onClose={() => setFieldBugsOpen(false)} />}
    </div>
  )
}
