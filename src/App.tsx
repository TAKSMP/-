import { useEffect, useState } from 'react'
import type { CaptureInput, CaughtBug } from './types'
import {
  collectPlaces,
  loadZukan,
  recordCapture,
  removeFromZukan,
  setMainCapture,
  updateBug,
} from './lib/storage'
import type { BugPatch } from './lib/storage'
import { saveZukan } from './lib/storage'
import { compressImage, dataUrlBytes } from './lib/image'
import { CapturePage } from './pages/CapturePage'
import { ZukanPage } from './pages/ZukanPage'
import { SearchPage } from './pages/SearchPage'
import { PlayPage } from './pages/PlayPage'
import { SettingsModal } from './components/SettingsModal'
import { sfx } from './lib/sound'

// 図鑑の中の「大きすぎる写真」を小さくしなおす（容量節約）。
// 変わったものがあれば あたらしい配列を、なければ null をかえす。
async function recompressBugs(bugs: CaughtBug[]): Promise<CaughtBug[] | null> {
  let changed = false
  const out: CaughtBug[] = []
  for (const bug of bugs) {
    const caps = []
    for (const c of bug.captures) {
      if (c.photo && dataUrlBytes(c.photo) > 35000) {
        const small = await compressImage(c.photo)
        if (small.length < c.photo.length) {
          caps.push({ ...c, photo: small })
          changed = true
          continue
        }
      }
      caps.push(c)
    }
    out.push({ ...bug, captures: caps })
  }
  return changed ? out : null
}

type Tab = 'capture' | 'zukan' | 'search' | 'quiz'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'capture', label: 'しらべる', emoji: '🔎' },
  { id: 'zukan', label: 'ずかん', emoji: '📖' },
  { id: 'search', label: 'けんさく', emoji: '🔍' },
  { id: 'quiz', label: 'あそぶ', emoji: '🎮' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('capture')
  const [bugs, setBugs] = useState<CaughtBug[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  // AIせっていが変わったら子を再描画してモード表示を更新するためのカウンタ
  const [aiVersion, setAiVersion] = useState(0)

  // さいしょに図鑑データをよみこむ。
  // ついでに、大きすぎる写真を小さくしなおして容量を節約する（1回だけ）。
  useEffect(() => {
    const loaded = loadZukan()
    setBugs(loaded)
    recompressBugs(loaded).then((next) => {
      if (next) {
        saveZukan(next)
        setBugs(next)
      }
    })
  }, [])

  // 撮影を保存。すでにいる虫なら履歴に足す（merged=true）。
  function handleSaved(input: CaptureInput): boolean {
    const { bugs: next, merged } = recordCapture(input)
    setBugs(next)
    return merged
  }

  function handleDelete(id: string) {
    setBugs(removeFromZukan(id))
  }

  function handleSetMain(bugId: string, captureId: string) {
    setBugs(setMainCapture(bugId, captureId))
  }

  function handleUpdate(bugId: string, patch: BugPatch) {
    setBugs(updateBug(bugId, patch))
  }

  return (
    <div className="app">
      <button
        className="settings-fab"
        onClick={() => {
          sfx.tap()
          setSettingsOpen(true)
        }}
        aria-label="AIせってい"
        title="AIせってい"
      >
        ⚙️
      </button>

      <main className="app-main">
        {/* 「しらべる」はタブを切りかえても入力が消えないよう、
            アンマウントせずに 非表示にするだけにする（登録するまでデータ保持）。 */}
        <div style={{ display: tab === 'capture' ? 'contents' : 'none' }}>
          <CapturePage
            key={aiVersion}
            onSaved={handleSaved}
            pastPlaces={collectPlaces(bugs)}
          />
        </div>
        {tab === 'zukan' && (
          <ZukanPage
            bugs={bugs}
            onDelete={handleDelete}
            onSetMain={handleSetMain}
            onUpdate={handleUpdate}
            pastPlaces={collectPlaces(bugs)}
            onGoCapture={() => setTab('capture')}
          />
        )}
        {tab === 'search' && (
          <SearchPage
            bugs={bugs}
            onDelete={handleDelete}
            onSetMain={handleSetMain}
            onUpdate={handleUpdate}
            pastPlaces={collectPlaces(bugs)}
          />
        )}
        {tab === 'quiz' && (
          <PlayPage bugs={bugs} onGoCapture={() => setTab('capture')} />
        )}
      </main>

      {/* した の ナビゲーション */}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tabbar-btn' + (tab === t.id ? ' active' : '')}
            onClick={() => {
              sfx.tap()
              setTab(t.id)
            }}
          >
            <span className="tabbar-emoji">{t.emoji}</span>
            <span className="tabbar-label">{t.label}</span>
            {t.id === 'zukan' && bugs.length > 0 && (
              <span className="tabbar-badge">{bugs.length}</span>
            )}
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onChanged={() => setAiVersion((v) => v + 1)}
        />
      )}
    </div>
  )
}
