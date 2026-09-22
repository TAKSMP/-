// =============================================================
//  あるいて さがす フィールド
// -------------------------------------------------------------
//  ・せなかの 絵の 上を、男の子の アイコンで あるく
//  ・カメラが ついてくる（はしっこで とまる）
//  ・くさむらを あるいていると、ときどき むしに であう（エンカウント）
//  うごきの しくみ（あたり判定・カメラ）は src/fields/field.js。
// =============================================================
import { useEffect, useRef } from 'react'
import {
  canStand,
  createField,
  type FieldHandle,
  type FieldPlayerState,
  type FieldZone,
} from '../fields/field'
import '../fields/field.css'
import { boySheetUrl, drawBoySprite, loadImage } from '../fields/boySprite'
import { encounterDistance } from '../lib/encounter'

interface Props {
  base: string // 'fields/yuyuu/' のような ばしょ（BASE_URL からの あいたい）
  paused?: boolean
  onEncounter?: (zoneId: string | null) => void
  onZoneEnter?: (zone: FieldZone) => void
  onError?: (e: unknown) => void
}

// バトルに いって もどってきた とき、さっきの ばしょから つづける。
// （マップごとに、さいごに いた ところを おぼえておく）
const lastPos = new Map<string, { x: number; y: number; facing?: string }>()

// 男の子の たかさ（マップの 上）と、コマを すすめる きょり
const BOY_H = 42
const STEP_PX = 14

// 絵が よみこめなかった ときの よび（てがきの 男の子）
function drawBoy(ctx: CanvasRenderingContext2D, s: FieldPlayerState) {
  const x = Math.round(s.x)
  const y = Math.round(s.y)
  const step = s.moving ? Math.sin(s.travel * 0.35) * 2 : 0
  const face = s.facing ?? 'down'

  // かげ
  ctx.fillStyle = 'rgba(35,59,65,0.4)'
  ctx.beginPath()
  ctx.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // あし
  ctx.fillStyle = '#3a4a6b'
  ctx.fillRect(x - 6, y - 8 + step, 4, 8)
  ctx.fillRect(x + 2, y - 8 - step, 4, 8)
  // くつ
  ctx.fillStyle = '#2b2b2b'
  ctx.fillRect(x - 6, y - 2 + step, 4, 2)
  ctx.fillRect(x + 2, y - 2 - step, 4, 2)

  // からだ（Tシャツ）
  ctx.fillStyle = '#4aa8e0'
  ctx.fillRect(x - 8, y - 21, 16, 13)
  ctx.fillStyle = '#3d8fc0'
  ctx.fillRect(x - 8, y - 11, 16, 3) // すその かげ
  // うで
  ctx.fillStyle = '#efc5a0'
  ctx.fillRect(x - 10, y - 19 - step, 3, 8)
  ctx.fillRect(x + 7, y - 19 + step, 3, 8)

  // あたま
  ctx.fillStyle = '#efc5a0'
  ctx.fillRect(x - 7, y - 32, 14, 11)
  // かみ／ぼうし
  ctx.fillStyle = '#5a3a22'
  ctx.fillRect(x - 8, y - 34, 16, 5)
  if (face === 'up') {
    // うしろむき：かみが おおい
    ctx.fillRect(x - 7, y - 30, 14, 6)
  } else {
    ctx.fillRect(x - 8, y - 31, 4, 3)
    ctx.fillRect(x + 4, y - 31, 4, 3)
    // め
    ctx.fillStyle = '#2f3a24'
    if (face === 'left') {
      ctx.fillRect(x - 5, y - 27, 2, 2)
      ctx.fillRect(x - 1, y - 27, 2, 2)
    } else if (face === 'right') {
      ctx.fillRect(x - 1, y - 27, 2, 2)
      ctx.fillRect(x + 3, y - 27, 2, 2)
    } else {
      ctx.fillRect(x - 4, y - 27, 2, 2)
      ctx.fillRect(x + 2, y - 27, 2, 2)
    }
  }
  // ぼうしの つば
  ctx.fillStyle = '#7a4f2e'
  if (face === 'down') ctx.fillRect(x - 8, y - 29, 16, 2)
  else if (face === 'left') ctx.fillRect(x - 12, y - 30, 6, 2)
  else if (face === 'right') ctx.fillRect(x + 6, y - 30, 6, 2)
}

export function FieldMap({ base, paused = false, onEncounter, onZoneEnter, onError }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<FieldHandle | null>(null)
  const encounterCb = useRef(onEncounter)
  const zoneCb = useRef(onZoneEnter)
  const errorCb = useRef(onError)
  const pausedRef = useRef(paused)
  const zoneRef = useRef<string | null>(null)
  const nextAt = useRef(Infinity) // マップを よんでから きめる
  const travelRef = useRef(0)
  const speedRef = useRef(94)
  const sheet = useRef<HTMLImageElement | null>(null)
  encounterCb.current = onEncounter
  zoneCb.current = onZoneEnter
  errorCb.current = onError
  pausedRef.current = paused

  const wasPaused = useRef(paused)
  useEffect(() => {
    engine.current?.setPaused(paused)
    // とまっていたのが うごきだしたら、いまの きょりから かぞえなおす。
    // （マウントした ときは さわらない。マップを よんだ ときに きめる）
    if (wasPaused.current && !paused) {
      nextAt.current = travelRef.current + encounterDistance(speedRef.current)
    }
    wasPaused.current = paused
  }, [paused])

  useEffect(() => {
    let disposed = false
    const abort = new AbortController()
    const baseUrl = new URL(base, new URL(import.meta.env.BASE_URL, document.baseURI))
    ;(async () => {
      const res = await fetch(new URL('map.json', baseUrl), { signal: abort.signal })
      if (!res.ok) throw new Error(`map.json HTTP ${res.status}`)
      const map = await res.json()
      if (disposed || !host.current) return
      // まえに いた ばしょから さいかい する（入口へ ボタンは ほんとうの 入口へ）
      const entrance = { ...map.spawn }
      const back = lastPos.get(base)
      const resumed = !!(back && canStand(map, back.x, back.y))
      if (resumed) map.spawn = { ...back! }
      // 男の子の ドット絵を よみこむ（しっぱいしても フィールドは うごく）
      try {
        sheet.current = await loadImage(boySheetUrl(), abort.signal)
      } catch {
        sheet.current = null
      }
      if (disposed || !host.current) return
      speedRef.current = map.player?.speed ?? 94
      // はじめて 入った ときは ながめ、バトルから もどった ときは ふつう
      nextAt.current = encounterDistance(speedRef.current, !resumed)
      const field = await createField(host.current, {
        map,
        imageUrl: new URL(map.background, baseUrl).href,
        signal: abort.signal,
        onZoneEnter: (zone) => {
          zoneRef.current = zone.id
          zoneCb.current?.(zone)
        },
        drawPlayer: (ctx, state) => {
          if (sheet.current) drawBoySprite(ctx, sheet.current, state, BOY_H, STEP_PX)
          else drawBoy(ctx, state)
          travelRef.current = state.travel
          // あるいた きょりが たまったら むしに であう
          if (!pausedRef.current && state.moving && state.travel >= nextAt.current) {
            nextAt.current = state.travel + encounterDistance(speedRef.current)
            encounterCb.current?.(zoneRef.current)
          }
        },
      })
      if (disposed) {
        field.destroy()
        return
      }
      map.spawn = entrance // 「入口へ」は 本来の 入口に もどす
      engine.current = field
      field.setPaused(pausedRef.current)
    })().catch((e) => {
      if (disposed || (e as Error)?.name === 'AbortError') return
      if (host.current) host.current.textContent = 'マップを よみこめませんでした。'
      errorCb.current?.(e)
    })
    return () => {
      disposed = true
      abort.abort()
      const pos = engine.current?.getPosition()
      if (pos) lastPos.set(base, pos) // いた ばしょを おぼえる
      engine.current?.destroy()
      engine.current = null
    }
  }, [base])

  return <div className="fieldmap" ref={host} />
}
