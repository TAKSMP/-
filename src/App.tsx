import { useEffect, useState } from 'react'
import type { CaptureInput, CaughtBug } from './types'
import {
  collectPlaces,
  loadZukan,
  recordCapture,
  removeFromZukan,
  setMainCapture,
} from './lib/storage'
import { CapturePage } from './pages/CapturePage'
import { ZukanPage } from './pages/ZukanPage'
import { SearchPage } from './pages/SearchPage'
import { QuizPage } from './pages/QuizPage'
import { SettingsModal } from './components/SettingsModal'
import { sfx } from './lib/sound'

type Tab = 'capture' | 'zukan' | 'search' | 'quiz'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'capture', label: 'しらべる', emoji: '🔎' },
  { id: 'zukan', label: 'ずかん', emoji: '📖' },
  { id: 'search', label: 'けんさく', emoji: '🔍' },
  { id: 'quiz', label: 'クイズ', emoji: '🧠' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('capture')
  const [bugs, setBugs] = useState<CaughtBug[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  // AIせっていが変わったら子を再描画してモード表示を更新するためのカウンタ
  const [aiVersion, setAiVersion] = useState(0)

  // さいしょに図鑑データをよみこむ
  useEffect(() => {
    setBugs(loadZukan())
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
        {tab === 'capture' && (
          <CapturePage
            key={aiVersion}
            onSaved={handleSaved}
            pastPlaces={collectPlaces(bugs)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {tab === 'zukan' && (
          <ZukanPage
            bugs={bugs}
            onDelete={handleDelete}
            onSetMain={handleSetMain}
            onGoCapture={() => setTab('capture')}
          />
        )}
        {tab === 'search' && <SearchPage bugs={bugs} />}
        {tab === 'quiz' && <QuizPage />}
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
