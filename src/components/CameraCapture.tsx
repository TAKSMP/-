import { useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sound'

interface Props {
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

// カメラを立ち上げて、その場でシャッターをおして撮影するモーダル。
// スマホでもパソコン（Webカメラ）でも動きます。
export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string>('')
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setReady(false)
      setError('')
      // まえのストリームがあればとめる
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('このブラウザではカメラがつかえないみたい。写真をえらんでね📷')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch {
        setError(
          'カメラをつかえませんでした。カメラのきょかをかくにんするか、写真をえらんでね📷',
        )
      }
    }

    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [facing])

  function shoot() {
    const video = videoRef.current
    if (!video || !ready) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // まえ向き（自分どり）のときは鏡にならないようにそのままでOK
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    sfx.shutter()
    setFlash(true)
    setTimeout(() => {
      onCapture(dataUrl)
    }, 180)
  }

  return (
    <div className="camera-modal">
      {flash && <div className="camera-flash" />}
      <button className="camera-close" onClick={onClose} aria-label="とじる">
        ✕
      </button>

      {error ? (
        <div className="camera-error">
          <div className="camera-error-emoji">📷</div>
          <p>{error}</p>
          <button className="btn btn-big" onClick={onClose}>
            もどる
          </button>
        </div>
      ) : (
        <>
          <div className="camera-view">
            <video ref={videoRef} playsInline muted />
            <div className="camera-frame" />
            {!ready && (
              <div className="camera-loading">📷 カメラをよびだし中…</div>
            )}
          </div>

          <div className="camera-controls">
            <button
              className="camera-switch"
              onClick={() =>
                setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
              }
              aria-label="カメラをきりかえ"
            >
              🔄
            </button>
            <button
              className="camera-shutter"
              onClick={shoot}
              disabled={!ready}
              aria-label="さつえい"
            >
              <span className="camera-shutter-inner" />
            </button>
            <div className="camera-spacer" />
          </div>
          <p className="camera-hint">虫をまん中にいれてボタンをおしてね📸</p>
        </>
      )}
    </div>
  )
}
