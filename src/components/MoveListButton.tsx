// バトル中の 画面右上に おく「わざリスト」ボタン（おすと わざ図鑑が ひらく）
import { useState } from 'react'
import { MoveDexModal } from './MoveDexModal'
import { sfx } from '../lib/sound'

export function MoveListButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="battle-movelist"
        onClick={() => {
          sfx.tap()
          setOpen(true)
        }}
      >
        📜 わざリスト
      </button>
      {open && <MoveDexModal onClose={() => setOpen(false)} />}
    </>
  )
}
