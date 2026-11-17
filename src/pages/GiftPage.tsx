// =============================================================
//  ともだちに おくる（トップの メニューから ひらく）
// -------------------------------------------------------------
//  おくる … 虫を えらぶ → あいことばを ともだちに つたえる
//  もらう … ともだちの あいことばを いれる
//  こうかん … 虫を えらぶ → へやを つくる／あいことばで はいる
//  「もどる」は したに くわえて、うえ（森の デザインでは ホームの よこ）にも だす
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CaughtBug } from '../types'
import { BugPicker } from '../components/BugPicker'
import { GiftModal, type GiftMode, type GiftModalHandle } from '../components/GiftModal'
import { mainPhoto } from '../lib/storage'
import { sfx } from '../lib/sound'

interface Props {
  bugs: CaughtBug[]
  onReceived: (bugs: CaughtBug[], received: CaughtBug) => void
  onGoCapture: () => void
}

type Step = 'menu' | 'pick' | 'flow'

export function GiftPage({ bugs, onReceived, onGoCapture }: Props) {
  const [step, setStep] = useState<Step>('menu')
  const [mode, setMode] = useState<GiftMode>('send')
  const [bug, setBug] = useState<CaughtBug | null>(null)
  const flowRef = useRef<GiftModalHandle>(null)

  // 森の デザインの「ホーム」の よこの 場所（もとの デザインでは null → ページの うえに だす）
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setSlot(document.getElementById('forest-topbar-slot'))
  }, [])

  function start(m: GiftMode) {
    sfx.tap()
    setMode(m)
    setBug(null)
    setStep(m === 'receive' ? 'flow' : 'pick')
  }

  function toMenu() {
    setStep('menu')
    setBug(null)
  }

  // ひとつ まえの がめんへ
  function back() {
    if (step === 'flow' && flowRef.current?.back()) return
    sfx.tap()
    if (step === 'flow' && mode !== 'receive') {
      setBug(null)
      setStep('pick')
    } else {
      toMenu()
    }
  }

  const topBack =
    step === 'menu' ? null : (
      <button className={slot ? 'forest-topbar-back' : 'btn btn-ghost play-back'} onClick={back}>
        ← もどる
      </button>
    )

  return (
    <div className="page gift-page">
      {topBack && (slot ? createPortal(topBack, slot) : topBack)}

      {step !== 'flow' && (
        <header className="page-head">
          <h1>🎁 ともだちに おくる</h1>
          <p className="sub">あいことばで ともだちと 虫を おくりあおう</p>
        </header>
      )}

      {step === 'menu' && (
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

      {step === 'pick' && (
        <div className="gift-pick">
          <p className="gift-lead">{mode === 'trade' ? '🔄 こうかん する 虫を えらんでね' : '🎁 おくる 虫を えらんでね'}</p>
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
                setStep('flow')
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
          <button className="btn btn-ghost" onClick={back}>
            ← もどる
          </button>
        </div>
      )}

      {step === 'flow' && (mode === 'receive' || bug) && (
        <>
          <GiftModal
            ref={flowRef}
            inline
            mode={mode}
            bug={bug ?? undefined}
            onClose={toMenu}
            onExit={back}
            onReceived={onReceived}
          />
        </>
      )}
    </div>
  )
}
