// =============================================================
//  ともだちに おくる（トップの メニューから ひらく）
// -------------------------------------------------------------
//  おくる … 虫を えらぶ → あいことばを ともだちに つたえる
//  もらう … ともだちの あいことばを いれる
//  こうかん … 虫を えらぶ → へやを つくる／あいことばで はいる
// =============================================================
import { useState } from 'react'
import type { CaughtBug } from '../types'
import { BugPicker } from '../components/BugPicker'
import { GiftModal, type GiftMode } from '../components/GiftModal'
import { mainPhoto } from '../lib/storage'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onReceived: (bugs: CaughtBug[], received: CaughtBug) => void
  onGoCapture: () => void
}

export function GiftPage({ bugs, onReceived, onGoCapture }: Props) {
  // pick … おくる・こうかん で 虫を えらんでいる ところ
  const [mode, setMode] = useState<GiftMode | null>(null)
  const [picking, setPicking] = useState(false)
  const [bug, setBug] = useState<CaughtBug | null>(null)

  function start(m: GiftMode) {
    sfx.tap()
    setMode(m)
    setBug(null)
    setPicking(m !== 'receive')
  }

  function close() {
    setMode(null)
    setBug(null)
    setPicking(false)
  }

  return (
    <div className="page gift-page">
      <header className="page-head">
        <h1>🎁 ともだちに おくる</h1>
        <p className="sub">あいことばで ともだちと 虫を おくりあおう</p>
      </header>

      {!picking && (
        <div className="game-menu gift-page-menu">
          <button className="game-card gift-card send" onClick={() => start('send')}>
            <span className="game-emoji">🎁</span>
            <span className="game-title">おくる</span>
            <span className="game-desc">じぶんの 虫を ともだちに おくる</span>
          </button>
          <button className="game-card gift-card receive" onClick={() => start('receive')}>
            <span className="game-emoji">📬</span>
            <span className="game-title">もらう</span>
            <span className="game-desc">ともだちの あいことばを いれて うけとる</span>
          </button>
          <button className="game-card gift-card trade" onClick={() => start('trade')}>
            <span className="game-emoji">🔄</span>
            <span className="game-title">こうかん</span>
            <span className="game-desc">じぶんの 虫と ともだちの 虫を とりかえっこ</span>
          </button>
          <p className="gift-note">
            おくった 虫は じぶんの 図鑑にも のこるよ。
            <br />
            もらった 虫は レベル1・さいしょの わざから はじまるよ。
          </p>
        </div>
      )}

      {picking && (
        <div className="gift-pick">
          <p className="gift-lead">{mode === 'trade' ? 'こうかん する 虫を えらんでね' : 'おくる 虫を えらんでね'}</p>
          {bugs.length === 0 ? (
            <>
              <p className="dojo-empty">まだ 図鑑に 虫が いないよ。</p>
              <button className="btn btn-big btn-primary" onClick={onGoCapture}>
                🔎 虫を しらべに いく
              </button>
            </>
          ) : (
            <BugPicker
              bugs={bugs}
              onPick={(b) => {
                sfx.tap()
                setBug(b)
              }}
              renderCard={(b) => (
                <div className="story-bug">
                  <img src={mainPhoto(b)} alt={b.name} />
                  <span className="story-bug-name">{b.name}</span>
                  {b.giftFrom && <span className="story-bug-lv">🎁 もらった</span>}
                </div>
              )}
            />
          )}
          <button className="btn btn-ghost" onClick={close}>
            ← もどる
          </button>
        </div>
      )}

      {mode === 'receive' && (
        <GiftModal mode="receive" onClose={close} onReceived={onReceived} />
      )}
      {mode && mode !== 'receive' && bug && (
        <GiftModal mode={mode} bug={bug} onClose={close} onReceived={onReceived} />
      )}
    </div>
  )
}
