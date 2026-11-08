// =============================================================
//  右上の「P」ボタン（せってい ⚙️ の ひだり）
// -------------------------------------------------------------
//  おすと、もっている 虫ポイントと もちものが ポップアップで 出る。
// =============================================================
import { useEffect, useState } from 'react'
import { usePoints } from '../lib/points'
import { sfx } from '../lib/sound'

// variant="home"：森デザインの ホーム（絵の なかの ⚙ の ひだり）に おく
export function PointsButton({ variant }: { variant?: 'home' }) {
  const wallet = usePoints()
  const [open, setOpen] = useState(false)

  // そとを おしたら とじる
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const id = window.setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('click', close)
    }
  }, [open])

  return (
    <>
      <button
        className={(variant === 'home' ? 'points-fab-home' : 'points-fab') + (open ? ' on' : '')}
        onClick={() => {
          sfx.tap()
          setOpen((v) => !v)
        }}
        aria-label="虫ポイント"
        title="虫ポイント"
      >
        <span className="points-coin">P</span>
      </button>
      {open && (
        <div className="points-pop" role="dialog" onClick={(e) => e.stopPropagation()}>
          <span className="points-pop-label">もっている 虫ポイント</span>
          <span className="points-pop-value">
            {wallet.points}
            <small>P</small>
          </span>
          {(wallet.items.butterflyCandy > 0 || wallet.items.dragonflyCandy > 0) && (
            <span className="points-pop-items">
              {wallet.items.butterflyCandy > 0 && <>🦋 チョウチョちゃんあめ ×{wallet.items.butterflyCandy}</>}
              {wallet.items.butterflyCandy > 0 && wallet.items.dragonflyCandy > 0 && <br />}
              {wallet.items.dragonflyCandy > 0 && <>🍭 トンボあめ ×{wallet.items.dragonflyCandy}</>}
            </span>
          )}
          <span className="points-pop-hint">昆虫検定で せいかいすると たまるよ</span>
        </div>
      )}
    </>
  )
}
