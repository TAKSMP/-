// =============================================================
//  むしレースの がめん（うえから みた こうえんの コース）
// -------------------------------------------------------------
//  けいさんは raceEngine、ここは 絵と ボタンだけ。
//  canvas に まいコマ かく。React の state は わざ・じゅんい が
//  かわった ときだけ かえる（60かい／びょう かきかえない）。
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { buildTrack, renderPark, trackPos, WORLD_H, WORLD_W, type Track } from '../lib/raceCourse'
import { createRace, standings, stepRace, type Racer, type RacerInit, type RaceState } from '../lib/raceEngine'
import { EFFECT_INFO } from '../lib/raceMoves'
import { sfx } from '../lib/sound'

export interface RaceResult {
  id: string
  rank: number
  time: number
}

interface Props {
  racers: RacerInit[]
  laps: number
  onFinish: (results: RaceResult[]) => void
}

const VIEW_W = 560 // がめんの よこに みえる せかいの はば
const DT = 1 / 60

let trackCache: Track | null = null
const parkCache = new Map<number, HTMLCanvasElement>()
function getTrack() {
  if (!trackCache) trackCache = buildTrack()
  return trackCache
}
function getPark(scale: number) {
  const key = Math.round(scale * 4) / 4
  let cv = parkCache.get(key)
  if (!cv) {
    cv = renderPark(getTrack(), key)
    parkCache.set(key, cv)
  }
  return cv
}

// しゃしんを まるく きりぬいて おく（まいコマ clip すると おもい）
function circlePhoto(src: string, done: (c: HTMLCanvasElement) => void) {
  const img = new Image()
  img.onload = () => {
    const size = 72
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    g.beginPath()
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    g.clip()
    const s = Math.min(img.width, img.height)
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    done(c)
  }
  img.src = src
}

interface Hud {
  rank: number
  total: number
  lap: number
  itemName: string
  itemEmoji: string
  itemDesc: string
  rolling: boolean
  hasItem: boolean
}

export function RaceTrack({ racers, laps, onFinish }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gaugeRef = useRef<HTMLDivElement>(null)
  const gaugeHintRef = useRef<HTMLSpanElement>(null)
  const accelRef = useRef(false)
  const useRef_ = useRef(false)
  const stateRef = useRef<RaceState | null>(null)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  const [hud, setHud] = useState<Hud>({
    rank: 1,
    total: racers.length,
    lap: 1,
    itemName: '',
    itemEmoji: '',
    itemDesc: '',
    rolling: false,
    hasItem: false,
  })
  const [accelDown, setAccelDown] = useState(false)

  useEffect(() => {
    const track = getTrack()
    const st = createRace(track, racers, laps)
    stateRef.current = st
    const photos = new Map<string, HTMLCanvasElement>()
    for (const r of racers) circlePhoto(r.photo, (c) => photos.set(r.id, c))

    const cv = canvasRef.current!
    const ctx = cv.getContext('2d')!
    let cssW = 0
    let cssH = 0
    let dpr = 1
    let park: HTMLCanvasElement | null = null
    const resize = () => {
      const w = wrapRef.current?.clientWidth ?? 360
      cssW = w
      cssH = Math.round(Math.max(380, Math.min(w * 1.25, window.innerHeight * 0.66)))
      dpr = Math.min(2.5, window.devicePixelRatio || 1)
      cv.width = Math.round(cssW * dpr)
      cv.height = Math.round(cssH * dpr)
      cv.style.height = cssH + 'px'
      park = getPark(Math.min(1.75, (cssW / VIEW_W) * dpr))
    }
    resize()
    window.addEventListener('resize', resize)

    const me = st.racers.find((r) => r.mine)!
    const p0 = trackPos(track, me.s, me.lat)
    let camX = p0.x
    let camY = p0.y
    let acc = 0
    let last = performance.now()
    let raf = 0
    let finished = false
    let hudKey = ''
    let rollFlip = 0

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      acc += Math.min(0.1, (now - last) / 1000)
      last = now
      while (acc >= DT) {
        stepRace(st, DT, { accel: accelRef.current, use: useRef_.current })
        useRef_.current = false
        acc -= DT
      }
      // おと
      for (const ev of st.events) {
        if (ev === 'count') sfx.tap()
        else if (ev === 'go') sfx.battleStart()
        else if (ev === 'pickup') sfx.badge()
        else if (ev === 'dash') sfx.special('attackUp')
        else if (ev === 'hit') sfx.hit()
        else if (ev === 'hitMe') sfx.special('powerStrike')
        else if (ev === 'shield') sfx.special('defenseUp')
        else if (ev === 'refill') sfx.special('heal')
        else if (ev === 'shoot') sfx.dodge()
        else if (ev === 'lap') sfx.nav()
      }
      st.events.length = 0

      draw()

      // ゲージ（DOMを ちょくせつ かえる）
      const ratio = me.stamina / me.tank
      if (gaugeRef.current) {
        gaugeRef.current.style.width = ratio * 100 + '%'
        gaugeRef.current.dataset.low = ratio < 0.25 ? '1' : ''
        gaugeRef.current.dataset.endless = me.endlessT > 0 ? '1' : ''
      }
      if (gaugeHintRef.current) {
        const tired = me.pressing && me.stamina <= 0
        gaugeHintRef.current.textContent = tired
          ? 'へとへと！ はなして やすもう'
          : me.jamT > 0
            ? 'しびれて ふめない！'
            : me.endlessT > 0
              ? 'むげん！ ふみほうだい'
              : 'たいりょく'
      }
      // HUD（かわった ときだけ）
      const order = standings(st)
      const rank = order.indexOf(me) + 1
      if (me.rollT > 0) rollFlip = Math.floor(st.clock * 12)
      const rollingMove = me.rollT > 0 && me.moves.length ? me.moves[rollFlip % me.moves.length] : null
      const shown = rollingMove ?? me.item
      const key = `${rank}|${st.myLap}|${shown?.id ?? ''}|${me.rollT > 0}`
      if (key !== hudKey) {
        hudKey = key
        setHud({
          rank,
          total: st.racers.length,
          lap: st.myLap,
          itemName: shown?.name ?? '',
          itemEmoji: shown?.emoji ?? '',
          itemDesc: shown && !rollingMove ? EFFECT_INFO[shown.effect].label : '',
          rolling: !!rollingMove,
          hasItem: !!me.item && me.rollT <= 0,
        })
      }
      if (st.over && !finished) {
        finished = true
        const res = standings(st).map((r, i) => ({ id: r.id, rank: i + 1, time: r.finishTime ?? 0 }))
        setTimeout(() => finishRef.current(res), 300)
      }
    }

    const draw = () => {
      const zoom = cssW / VIEW_W
      // カメラ：じぶんの むしの すこし さきを みる
      const mp = trackPos(track, me.s + Math.min(110, me.speed * 0.5), me.lat)
      camX += (mp.x - camX) * 0.12
      camY += (mp.y - camY) * 0.12
      const halfW = cssW / zoom / 2
      const halfH = cssH / zoom / 2
      const cx = Math.max(halfW, Math.min(WORLD_W - halfW, camX))
      const cy = Math.max(halfH, Math.min(WORLD_H - halfH, camY))
      const k = zoom * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#7cbf5a'
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, (cssW / 2 - cx * zoom) * dpr, (cssH / 2 - cy * zoom) * dpr)
      if (park) ctx.drawImage(park, 0, 0, park.width, park.height, 0, 0, WORLD_W, WORLD_H)

      const t = st.clock
      // 🎁
      for (const b of st.boxes) {
        if (b.readyAt > t) continue
        const p = trackPos(track, b.s, b.lat)
        ctx.save()
        ctx.translate(p.x, p.y + Math.sin(t * 4 + b.lat) * 2)
        ctx.rotate(t * 1.6)
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(-11, -9, 24, 24)
        const g = ctx.createLinearGradient(-12, -12, 12, 12)
        g.addColorStop(0, `hsl(${(t * 120) % 360},90%,65%)`)
        g.addColorStop(1, `hsl(${(t * 120 + 140) % 360},90%,60%)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(-12, -12, 24, 24, 5)
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.rotate(-t * 1.6)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('?', 0, 1)
        ctx.restore()
      }
      // どくだまり
      for (const tp of st.traps) {
        const p = trackPos(track, tp.s, tp.lat)
        ctx.fillStyle = 'rgba(140,60,200,0.55)'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, 22, 15, Math.atan2(p.ty, p.tx), 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(200,140,255,0.6)'
        ctx.beginPath()
        ctx.arc(p.x - 6 + Math.sin(t * 3) * 2, p.y - 3, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(tp.emoji, p.x + 6, p.y + 2)
      }
      // むし（したに いる じゅんに かく）
      const list = st.racers
        .map((r) => ({ r, p: trackPos(track, r.s, r.lat) }))
        .sort((a, b) => a.p.y - b.p.y)
      for (const { r, p } of list) drawRacer(r, p.x, p.y, Math.atan2(p.ty, p.tx), t)
      // とんでいる わざ
      for (const sh of st.shots) {
        const p = trackPos(track, sh.s, sh.lat)
        ctx.fillStyle = sh.ultimate ? 'rgba(255,210,63,0.55)' : 'rgba(255,255,255,0.6)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 17 + Math.sin(t * 20) * 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '24px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(sh.emoji, p.x, p.y + 1)
      }
      // えんしゅつ
      for (const f of st.fx) {
        const r = st.racers.find((x) => x.id === f.racer)
        if (!r) continue
        const p = trackPos(track, r.s, r.lat)
        const a = (t - f.t0) / f.dur
        ctx.save()
        if (f.kind === 'text') {
          ctx.globalAlpha = a < 0.75 ? 1 : (1 - a) * 4
          ctx.font = '900 17px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 4
          ctx.strokeStyle = 'rgba(40,30,20,0.85)'
          const y = p.y - 44 - a * 26
          ctx.strokeText(f.text ?? '', p.x, y)
          ctx.fillStyle = f.color ?? '#fff'
          ctx.fillText(f.text ?? '', p.x, y)
        } else if (f.kind === 'ring') {
          ctx.globalAlpha = 1 - a
          ctx.strokeStyle = f.color ?? '#fff'
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.arc(p.x, p.y, 20 + a * 120, 0, Math.PI * 2)
          ctx.stroke()
        } else if (f.kind === 'star') {
          ctx.font = '40px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🌠', p.x + (1 - a) * 80, p.y - (1 - a) * 160)
        } else if (f.kind === 'swap') {
          ctx.globalAlpha = 1 - a
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + a * 4
            ctx.fillText('✨', p.x + Math.cos(ang) * (16 + a * 30), p.y + Math.sin(ang) * (16 + a * 30))
          }
        } else if (f.kind === 'puff') {
          ctx.globalAlpha = (1 - a) * 0.8
          ctx.fillStyle = '#fff'
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2
            ctx.beginPath()
            ctx.arc(p.x + Math.cos(ang) * (14 + a * 26), p.y + Math.sin(ang) * (14 + a * 26), 8 * (1 - a) + 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.restore()
      }

      // ── ここから がめんに くっつく もの
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawMinimap()
      // カウントダウン
      if (st.countdown > 0 || st.t < 0.8) {
        const txt = st.countdown > 0 ? String(Math.ceil(st.countdown)) : 'ゴー！'
        const big = st.countdown > 0 ? 1 - (Math.ceil(st.countdown) - st.countdown) : 1
        ctx.save()
        ctx.font = `900 ${Math.round(70 + big * 30)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 10
        ctx.strokeStyle = 'rgba(60,40,10,0.8)'
        ctx.strokeText(txt, cssW / 2, cssH * 0.4)
        ctx.fillStyle = st.countdown > 0 ? '#fff' : '#ffd23f'
        ctx.fillText(txt, cssW / 2, cssH * 0.4)
        ctx.restore()
      }
      // メッセージ
      const msgs = st.messages.slice(-2)
      ctx.font = '800 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      msgs.forEach((m, i) => {
        const y = cssH - 22 - (msgs.length - 1 - i) * 30
        const w = Math.min(cssW - 24, ctx.measureText(m.text).width + 24)
        ctx.fillStyle = 'rgba(30,30,40,0.7)'
        ctx.beginPath()
        ctx.roundRect(cssW / 2 - w / 2, y - 13, w, 26, 13)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillText(m.text, cssW / 2, y, cssW - 36)
      })
      // ゴール！
      if (me.finishTime !== null) {
        const rank = standings(st).indexOf(me) + 1
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect(0, cssH * 0.34, cssW, 84)
        ctx.font = '900 40px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = rank === 1 ? '#e0a800' : '#3a4a2a'
        ctx.fillText(`🏁 ゴール！ ${rank}い`, cssW / 2, cssH * 0.34 + 42)
        ctx.restore()
      }
    }

    const drawRacer = (r: Racer, x: number, y: number, base: number, t: number) => {
      const heading = base + Math.atan2(r.latV, Math.max(40, r.speed)) + r.spinAngle
      ctx.save()
      ctx.translate(x, y)
      // かげ
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(4, 6, 24, 18, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.rotate(heading)
      // ダッシュの すじ
      if (r.dashT > 0 || r.turboT > 0) {
        ctx.strokeStyle = r.dashT > 0 ? 'rgba(255,200,60,0.9)' : 'rgba(120,220,255,0.85)'
        ctx.lineWidth = 3
        for (const dy of [-10, 0, 10]) {
          const len = 20 + ((t * 300 + dy * 7) % 18)
          ctx.beginPath()
          ctx.moveTo(-26, dy)
          ctx.lineTo(-26 - len, dy)
          ctx.stroke()
        }
      } else if (r.accelOn) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        for (let i = 0; i < 3; i++) {
          const d = ((t * 90 + i * 9) % 26) + 24
          ctx.beginPath()
          ctx.arc(-d, Math.sin(t * 20 + i) * 6, 5 - (d - 24) / 7, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // あし（はしると うごく）
      ctx.strokeStyle = '#3a2a1a'
      ctx.lineWidth = 2.6
      ctx.lineCap = 'round'
      const ph = r.travel * 0.18
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const lx = -10 + i * 10
          const sw = Math.sin(ph + i * 2.1 + (side > 0 ? Math.PI : 0)) * 5
          ctx.beginPath()
          ctx.moveTo(lx, side * 10)
          ctx.lineTo(lx + sw, side * 21)
          ctx.stroke()
        }
      // しょっかく
      ctx.beginPath()
      ctx.moveTo(18, -5)
      ctx.quadraticCurveTo(28, -10, 32, -16)
      ctx.moveTo(18, 5)
      ctx.quadraticCurveTo(28, 10, 32, 16)
      ctx.stroke()
      // からだ
      ctx.fillStyle = r.color
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(-4, -6, 14, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // かお（しゃしん。まわさない）
      const ph2 = photos.get(r.id)
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(0, 0, 17, 0, Math.PI * 2)
      ctx.fill()
      if (ph2) ctx.drawImage(ph2, -15, -15, 30, 30)
      ctx.strokeStyle = r.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 16.5, 0, Math.PI * 2)
      ctx.stroke()
      // バリア
      if (r.shieldT > 0) {
        ctx.fillStyle = 'rgba(120,220,255,0.22)'
        ctx.strokeStyle = `rgba(120,220,255,${0.6 + Math.sin(t * 8) * 0.3})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, 32, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      // じょうたいの マーク
      const marks: string[] = []
      if (r.sleepT > 0) marks.push('💤')
      if (r.slowT > 0) marks.push('🐌')
      if (r.jamT > 0) marks.push('⚡')
      if (r.endlessT > 0) marks.push('♾️')
      if (r.spinT > 0) marks.push('💫')
      if (marks.length) {
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(marks.join(''), 0, -27 + Math.sin(t * 5) * 2)
      }
      // じぶんの しるし
      if (r.mine) {
        ctx.fillStyle = '#ffd23f'
        ctx.strokeStyle = '#7a5a00'
        ctx.lineWidth = 2
        const by = marks.length ? -46 : -30
        ctx.beginPath()
        ctx.moveTo(0, by + 8)
        ctx.lineTo(-8, by - 4)
        ctx.lineTo(8, by - 4)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawMinimap = () => {
      const w = Math.min(130, cssW * 0.32)
      const h = (w * WORLD_H) / WORLD_W
      const x0 = cssW - w - 8
      const y0 = 8
      const sc = w / WORLD_W
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.beginPath()
      ctx.roundRect(x0 - 4, y0 - 4, w + 8, h + 8, 10)
      ctx.fill()
      ctx.strokeStyle = '#c9a86a'
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < track.n; i += 6) {
        const px = x0 + track.x[i] * sc
        const py = y0 + track.y[i] * sc
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      const sp = trackPos(track, 0)
      ctx.fillStyle = '#222'
      ctx.fillRect(x0 + sp.x * sc - 1, y0 + sp.y * sc - 4, 3, 8)
      const order = [...st.racers].sort((a) => (a.mine ? 1 : -1))
      for (const r of order) {
        const p = trackPos(track, r.s, r.lat)
        ctx.fillStyle = r.color
        ctx.strokeStyle = r.mine ? '#000' : '#fff'
        ctx.lineWidth = r.mine ? 2 : 1.2
        ctx.beginPath()
        ctx.arc(x0 + p.x * sc, y0 + p.y * sc, r.mine ? 5 : 3.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    raf = requestAnimationFrame(loop)

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        accelRef.current = down
        setAccelDown(down)
        e.preventDefault()
      } else if (down && (e.code === 'Enter' || e.code === 'KeyZ' || e.code === 'KeyX')) {
        useRef_.current = true
        e.preventDefault()
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
    // racers / laps は レースの あいだ かわらない
  }, [])

  const press = (down: boolean) => {
    accelRef.current = down
    setAccelDown(down)
  }

  return (
    <div className="rt-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="rt-canvas" />
      <div className="rt-hud">
        <span className="rt-rank">
          <b>{hud.rank}</b>い<small>／{hud.total}</small>
        </span>
        <span className="rt-lap">
          {Math.min(hud.lap, laps)}／{laps}しゅう
        </span>
      </div>
      <div className="rt-controls" onContextMenu={(e) => e.preventDefault()}>
        <button
          className={'rt-move' + (hud.hasItem ? ' ready' : '') + (hud.rolling ? ' rolling' : '')}
          disabled={!hud.hasItem}
          onPointerDown={(e) => {
            e.preventDefault()
            useRef_.current = true
          }}
        >
          {hud.itemEmoji ? (
            <>
              <span className="rt-move-emoji">{hud.itemEmoji}</span>
              <span className="rt-move-name">{hud.itemName}</span>
              {hud.itemDesc && <span className="rt-move-desc">{hud.itemDesc}</span>}
            </>
          ) : (
            <>
              <span className="rt-move-emoji">🎁</span>
              <span className="rt-move-name">？を とって わざ</span>
            </>
          )}
        </button>
        <div className="rt-gauge">
          <div className="rt-gauge-bar">
            <div className="rt-gauge-fill" ref={gaugeRef} />
          </div>
          <span className="rt-gauge-label" ref={gaugeHintRef}>
            たいりょく
          </span>
        </div>
        <button
          className={'rt-accel' + (accelDown ? ' down' : '')}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            press(true)
          }}
          onPointerUp={() => press(false)}
          onPointerCancel={() => press(false)}
          onLostPointerCapture={() => press(false)}
        >
          <span className="rt-accel-icon">🔥</span>
          アクセル
        </button>
      </div>
    </div>
  )
}
