// =============================================================
//  むしとりチャレンジ（つるせMAP専用の ミニゲーム）
// -------------------------------------------------------------
//  ・むしとりバトルの かわりに、そっと ちかづいて あみを ふる ゲーム
//  ・むしの うごきは 3パターン（catchBehavior.ts）
//     とんでる／はねてる／とまってる
//  ・「ダッシュ」（ジョイスティックを おおきく たおす／Shift）で
//    ちかくの むしに 気づかれる。ふつうに あるけば 気づかれない。
//  ・あみの ボタンを おすと、その しゅんかんの きょりで はんてい。
//    はずれても ペナルティは 無い（気づかれるのは ダッシュだけ）。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { catchPatternForOrder, type CatchPattern } from '../lib/catchBehavior'
import { boySheetUrl, drawBoySprite, loadImage, type WalkerState } from '../fields/boySprite'
import { sfx } from '../lib/sound'

interface Props {
  bugId: string // 変わったら むしを つかまえなおす（key がわりの 判定にも つかう）
  bugName: string
  order: string
  emoji: string
  onCatch: () => void
  onEscape: () => void
}

const WALK_SPEED = 110 // px/びょう（ふつう あるき）
const DASH_MULT = 2.2
const STICK_MAX = 44 // ジョイスティックが うごける はんい（px）
const DASH_ZONE = 0.66 // これより おおきく たおすと ダッシュ あつかい
const NOTICE_RADIUS = 100 // ダッシュちゅうに これより ちかいと 気づかれる
const SWING_RANGE = 58 // あみが とどく きょり
const SWING_ANIM_SEC = 0.36
const FLEE_SPEED = 230
const FLEE_TIMEOUT = 1.4
const MARGIN = 34
const STEP_SEC = 0.15

type BugState = 'idle' | 'fleeing' | 'caught'

interface BugRuntime {
  x: number
  y: number
  homeX: number
  homeY: number
  vx: number
  vy: number
  pattern: CatchPattern
  state: BugState
  wanderT: number // つぎに 方向/ホップを かえるまでの じかん
  hopT: number // ホップの アニメ中の のこり時間（0なら じっとしてる）
  hopFrom: { x: number; y: number }
  hopTo: { x: number; y: number }
  fleeDir: { x: number; y: number }
  fleeT: number
  noticedFlash: number // 「！」を 出す のこり時間
}

export function CatchChallenge({ bugId, bugName, order, emoji, onCatch, onEscape }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 320, h: 460 })
  const sheetRef = useRef<HTMLImageElement | null>(null)
  const [hint, setHint] = useState('そっと ちかづいて、あみを ふろう！')
  const [swingBtnOn, setSwingBtnOn] = useState(false)
  const doneRef = useRef(false) // onCatch/onEscape を 1回だけ よぶ ため

  const player = useRef<WalkerState & { vxNorm: number; vyNorm: number; dashing: boolean }>({
    x: 160,
    y: 380,
    facing: 'up',
    travel: 0,
    moving: false,
    vxNorm: 0,
    vyNorm: 0,
    dashing: false,
  })
  const bugRef = useRef<BugRuntime | null>(null)
  const swingT = useRef(0) // 0より おおきい あいだ スイングちゅう
  const tRef = useRef(0)

  // ジョイスティックの ゆび
  const stick = useRef<{
    id: number
    originX: number
    originY: number
    dx: number
    dy: number
  } | null>(null)
  const keys = useRef(new Set<string>())

  useEffect(() => {
    sheetRef.current = null
    const ac = new AbortController()
    loadImage(boySheetUrl(), ac.signal)
      .then((img) => {
        sheetRef.current = img
      })
      .catch(() => {
        sheetRef.current = null
      })
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!host || !canvas) return
      const rect = host.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      const c = canvas.getContext('2d')
      c?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // むしの しょきちを パターンで きめる
    const pattern = catchPatternForOrder(order)
    const { w, h } = sizeRef.current
    const homeX = pattern === 'perched' ? w * 0.5 : w * (0.35 + Math.random() * 0.3)
    const homeY = pattern === 'perched' ? h * 0.3 : h * (0.32 + Math.random() * 0.16)
    bugRef.current = {
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      vx: 0,
      vy: 0,
      pattern,
      state: 'idle',
      wanderT: 0.4 + Math.random() * 0.8,
      hopT: 0,
      hopFrom: { x: homeX, y: homeY },
      hopTo: { x: homeX, y: homeY },
      fleeDir: { x: 0, y: 1 },
      fleeT: 0,
      noticedFlash: 0,
    }
    player.current.x = w * 0.5
    player.current.y = h * 0.86

    function onKeyDown(e: KeyboardEvent) {
      keys.current.add(e.key.toLowerCase())
      if (e.key === ' ') {
        e.preventDefault()
        swing()
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      tRef.current += dt
      step(dt)
      draw(ctx!)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugId])

  function finish(kind: 'catch' | 'escape') {
    if (doneRef.current) return
    doneRef.current = true
    if (kind === 'catch') window.setTimeout(() => onCatch(), 520)
    else window.setTimeout(() => onEscape(), 520)
  }

  function swing() {
    if (doneRef.current || swingT.current > 0) return
    const b = bugRef.current
    swingT.current = SWING_ANIM_SEC
    if (b && b.state === 'idle') {
      // あみは あしもとじゃなく、むねの たかさ（スイングの えの ちゅうしん）から とどく
      const dx = b.x - player.current.x
      const dy = b.y - (player.current.y - 30)
      const dist = Math.hypot(dx, dy)
      if (dist <= SWING_RANGE) {
        b.state = 'caught'
        sfx.discover()
        setHint(`${bugName}を つかまえた！`)
        finish('catch')
        return
      }
    }
    sfx.dodge()
  }

  function step(dt: number) {
    const { w, h } = sizeRef.current
    const p = player.current

    // ── ジョイスティック／キーボードから いどう方向を もとめる
    let dx = stick.current ? stick.current.dx / STICK_MAX : 0
    let dy = stick.current ? stick.current.dy / STICK_MAX : 0
    const stickLen = Math.hypot(dx, dy)
    let dashing = stickLen > DASH_ZONE
    if (keys.current.size) {
      const kx =
        (keys.current.has('arrowright') || keys.current.has('d') ? 1 : 0) -
        (keys.current.has('arrowleft') || keys.current.has('a') ? 1 : 0)
      const ky =
        (keys.current.has('arrowdown') || keys.current.has('s') ? 1 : 0) -
        (keys.current.has('arrowup') || keys.current.has('w') ? 1 : 0)
      if (kx || ky) {
        dx = kx
        dy = ky
        if (keys.current.has('shift')) dashing = true
      }
    }
    const len = Math.hypot(dx, dy)
    const moving = len > 0.08
    p.moving = moving
    p.dashing = moving && dashing
    if (moving) {
      const nx = dx / len
      const ny = dy / len
      const speed = WALK_SPEED * (dashing ? DASH_MULT : 1)
      p.x = Math.min(w - 16, Math.max(16, p.x + nx * speed * dt))
      p.y = Math.min(h - 16, Math.max(16, p.y + ny * speed * dt))
      p.travel += speed * dt
      p.facing =
        Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : ny > 0 ? 'down' : 'up'
    }

    if (swingT.current > 0) swingT.current = Math.max(0, swingT.current - dt)

    const b = bugRef.current
    if (!b) return
    if (b.noticedFlash > 0) b.noticedFlash -= dt

    if (b.state === 'idle') {
      stepIdle(b, dt, w, h)
      const dist = Math.hypot(b.x - p.x, b.y - p.y)
      if (p.dashing && dist < NOTICE_RADIUS) {
        b.state = 'fleeing'
        b.noticedFlash = 0.9
        const fx = b.x - p.x
        const fy = b.y - p.y
        const flen = Math.hypot(fx, fy) || 1
        b.fleeDir = { x: fx / flen, y: fy / flen }
        b.fleeT = 0
        sfx.error()
        setHint('気づかれた！ にげられちゃった…')
      }
    } else if (b.state === 'fleeing') {
      b.fleeT += dt
      b.x += b.fleeDir.x * FLEE_SPEED * dt
      b.y += b.fleeDir.y * FLEE_SPEED * dt
      const off = b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40
      if (off || b.fleeT > FLEE_TIMEOUT) finish('escape')
    }
  }

  function stepIdle(b: BugRuntime, dt: number, w: number, h: number) {
    const lo = MARGIN
    if (b.pattern === 'flying') {
      b.wanderT -= dt
      if (b.wanderT <= 0) {
        const ang = Math.random() * Math.PI * 2
        const spd = 34 + Math.random() * 30
        b.vx = Math.cos(ang) * spd
        b.vy = Math.sin(ang) * spd
        b.wanderT = 1 + Math.random() * 1.4
      }
      let nx = b.x + b.vx * dt
      let ny = b.y + b.vy * dt
      if (nx < lo || nx > w - lo) { b.vx *= -1; nx = Math.min(w - lo, Math.max(lo, nx)) }
      if (ny < lo || ny > h * 0.62) { b.vy *= -1; ny = Math.min(h * 0.62, Math.max(lo, ny)) }
      b.x = nx
      b.y = ny
    } else if (b.pattern === 'hopping') {
      if (b.hopT > 0) {
        b.hopT = Math.max(0, b.hopT - dt)
        const t = 1 - b.hopT / 0.4
        b.x = b.hopFrom.x + (b.hopTo.x - b.hopFrom.x) * t
        b.y = b.hopFrom.y + (b.hopTo.y - b.hopFrom.y) * t
        if (b.hopT === 0) {
          b.wanderT = 1 + Math.random() * 1.4
        }
      } else {
        b.wanderT -= dt
        if (b.wanderT <= 0) {
          const ang = Math.random() * Math.PI * 2
          const dist = 26 + Math.random() * 34
          const tx = Math.min(w - lo, Math.max(lo, b.x + Math.cos(ang) * dist))
          const ty = Math.min(h * 0.7, Math.max(lo, b.y + Math.sin(ang) * dist))
          b.hopFrom = { x: b.x, y: b.y }
          b.hopTo = { x: tx, y: ty }
          b.hopT = 0.4
        }
      }
    }
    // perched：うごかない（何も しない）
  }

  function draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = sizeRef.current
    ctx.clearRect(0, 0, w, h)
    const b = bugRef.current
    const p = player.current
    const t = tRef.current

    // 木（とまってる パターンの ときだけ、むしの ホームの うしろに）
    if (b && b.pattern === 'perched') {
      ctx.fillStyle = '#8a6236'
      ctx.fillRect(b.homeX - 9, b.homeY + 4, 18, 70)
      ctx.fillStyle = '#5fae4c'
      ctx.beginPath()
      ctx.ellipse(b.homeX, b.homeY - 14, 46, 34, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(b.homeX - 30, b.homeY, 26, 22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(b.homeX + 30, b.homeY, 26, 22, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // むし
    if (b && b.state !== 'caught') {
      let drawX = b.x
      let drawY = b.y
      let rot = 0
      let scale = 1
      let shadowY = b.y
      if (b.pattern === 'flying') {
        const bob = Math.sin(t * 5 + b.homeX) * 7
        drawY = b.y + bob
        rot = Math.sin(t * 3.2 + b.homeY) * 0.22
        shadowY = b.y + 26
      } else if (b.pattern === 'hopping' && b.hopT > 0) {
        const hopProgress = 1 - b.hopT / 0.4
        drawY = b.y - Math.sin(hopProgress * Math.PI) * 22
        shadowY = b.y
      } else {
        scale = 1 + Math.sin(t * 2.4) * 0.03
      }
      if (b.pattern !== 'perched') {
        ctx.fillStyle = 'rgba(35,59,65,0.22)'
        ctx.beginPath()
        ctx.ellipse(b.x, shadowY, 14, 5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.save()
      ctx.translate(drawX, drawY)
      ctx.rotate(rot)
      ctx.scale(scale, scale)
      ctx.font = '34px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, 0, 0)
      ctx.restore()
      if (b.noticedFlash > 0) {
        ctx.font = 'bold 22px sans-serif'
        ctx.fillText('❗', drawX, drawY - 34)
      }
    }

    // プレイヤー
    if (sheetRef.current) {
      drawBoySprite(ctx, sheetRef.current, p, 62, WALK_SPEED * STEP_SEC)
    } else {
      ctx.fillStyle = '#f0b429'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2)
      ctx.fill()
    }
    if (p.dashing) {
      ctx.font = '18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('💨', p.x - 20, p.y - 10)
    }

    // あみを ふる アニメ
    if (swingT.current > 0) {
      const prog = 1 - swingT.current / SWING_ANIM_SEC
      const ang = -0.6 + prog * 1.6
      ctx.save()
      ctx.translate(p.x, p.y - 30)
      ctx.rotate(ang)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(20, 0, 20, 14, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // ── ジョイスティックの タッチ操作
  function stickDown(e: React.PointerEvent) {
    if (stick.current) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    stick.current = { id: e.pointerId, originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 }
  }
  function stickMove(e: React.PointerEvent) {
    const s = stick.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.originX
    const dy = e.clientY - s.originY
    const len = Math.hypot(dx, dy) || 1
    const clamped = Math.min(len, STICK_MAX)
    s.dx = (dx / len) * clamped
    s.dy = (dy / len) * clamped
  }
  function stickUp(e: React.PointerEvent) {
    if (stick.current?.id === e.pointerId) stick.current = null
  }

  const knobX = stick.current ? stick.current.dx : 0
  const knobY = stick.current ? stick.current.dy : 0
  const dashingNow = Math.hypot(knobX, knobY) > STICK_MAX * DASH_ZONE

  return (
    <div className="catch-challenge" ref={hostRef}>
      <canvas ref={canvasRef} className="catch-canvas" />
      <p className="catch-hint">{hint}</p>
      <div
        className="catch-stick"
        onPointerDown={stickDown}
        onPointerMove={stickMove}
        onPointerUp={stickUp}
        onPointerCancel={stickUp}
      >
        <div
          className={'catch-stick-knob' + (dashingNow ? ' dash' : '')}
          style={{ transform: `translate(${knobX}px, ${knobY}px)` }}
        />
      </div>
      <button
        type="button"
        className="catch-swing-btn"
        onPointerDown={(e) => {
          e.preventDefault()
          setSwingBtnOn(true)
          swing()
          window.setTimeout(() => setSwingBtnOn(false), 150)
        }}
      >
        <span className={swingBtnOn ? 'on' : ''}>🕸️</span>
      </button>
    </div>
  )
}
