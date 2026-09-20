// =============================================================
//  しゃしんの きりとり（トリミング）
// -------------------------------------------------------------
//  ・ゆびで うごかして、＋−で 大きさを かえる
//  ・しかくい わくの ぶぶんだけを きりとる
//  ・きりとった あとは かならず きまった 大きさ（512px）に そろえる
//    （ちいさく きりとっても 大きく ひきのばす）
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sound'

// きりとった あとの 大きさ（たて・よこ おなじ）
export const CROP_SIZE = 512

interface Props {
  src: string
  title?: string
  onDone: (dataUrl: string) => void
  onCancel: () => void
}

export function ImageCropper({ src, title = '✂️ きりとる', onDone, onCancel }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState(0) // わくの 大きさ（がめんの ピクセル）
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // しゃしんを よみこんで、もとの 大きさを しる
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setNat({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = src
  }, [src])

  // わくの 大きさ（がめんに あわせる）
  useEffect(() => {
    const update = () => {
      const w = boxRef.current?.clientWidth ?? 0
      if (w) setBox(w)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [nat])

  // わくを うめる いちばん ちいさい ばいりつ
  const base = nat && box ? box / Math.min(nat.w, nat.h) : 1
  const k = base * zoom
  const dispW = nat ? nat.w * k : 0
  const dispH = nat ? nat.h * k : 0

  // わくの そとが 見えないように おさめる
  function clamp(x: number, y: number) {
    const minX = box - dispW
    const minY = box - dispH
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    }
  }

  // さいしょは まんなかを うつす
  const centered = useRef(false)
  useEffect(() => {
    if (!nat || !box) return
    if (!centered.current) {
      centered.current = true
      setOff({ x: (box - nat.w * base) / 2, y: (box - nat.h * base) / 2 })
      return
    }
    setOff((o) => clamp(o.x, o.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, box, nat])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    setOff(clamp(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py)))
  }
  function onPointerUp() {
    drag.current = null
  }

  // きりとって、きまった 大きさに ひきのばす
  function cut() {
    const img = imgRef.current
    if (!img || !nat || !box) return
    const canvas = document.createElement('canvas')
    canvas.width = CROP_SIZE
    canvas.height = CROP_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    const sx = -off.x / k
    const sy = -off.y / k
    const sSize = box / k
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_SIZE, CROP_SIZE)
    sfx.shutter()
    onDone(canvas.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal cropper" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="cropper-hint">
          ゆびで うごかして、まるい ボタンで 大きさを かえてね。
          <br />
          しかくの なかが しゃしんに なるよ。
        </p>
        <div
          className="cropper-box"
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {nat && (
            <img
              className="cropper-img"
              src={src}
              alt=""
              draggable={false}
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(${off.x}px, ${off.y}px)`,
              }}
            />
          )}
          <span className="cropper-frame" />
        </div>
        <div className="cropper-zoom">
          <button
            className="cropper-zoom-btn"
            onClick={() => { sfx.tap(); setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2))) }}
            aria-label="ちいさく"
          >
            ➖
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button
            className="cropper-zoom-btn"
            onClick={() => { sfx.tap(); setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2))) }}
            aria-label="おおきく"
          >
            ➕
          </button>
        </div>
        <div className="battle-result-actions">
          <button className="btn btn-big btn-primary" onClick={cut} disabled={!nat}>
            これで きりとる ✂️
          </button>
          <button className="btn btn-big" onClick={() => { sfx.tap(); onCancel() }}>
            やめる
          </button>
        </div>
      </div>
    </div>
  )
}
