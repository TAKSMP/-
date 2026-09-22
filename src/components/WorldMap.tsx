// =============================================================
//  大きい マップ（つるせ など）を あるいて さがす
// -------------------------------------------------------------
//  エンジンは src/fields/world/viewer.js（道路の うえだけ あるける）。
//  FieldMap と おなじ ように つかえる：
//   ・ドット絵の 男の子で あるく
//   ・あるいた きょりが たまると むしに であう
//   ・バトルから もどると、さっきの ばしょから つづける
//  道を タップすると、つながっている 道を とおって じどうで あるく。
// =============================================================
import { useEffect, useRef } from 'react'
import { mountWorld, type WorldHandle, type WorldMapData } from '../fields/world/viewer'
import { decodeRoads, isRoad } from '../fields/world/navigation'
import '../fields/world/viewer.css'
import { boySheetUrl, drawBoySprite, loadImage } from '../fields/boySprite'
import { encounterDistance } from '../lib/encounter'

interface Props {
  base: string // 'fields/tsuruse/' のような ばしょ
  paused?: boolean
  onEncounter?: () => void
  onError?: (e: unknown) => void
}

// バトルから もどった とき つづきから あるく
const lastPos = new Map<string, { x: number; y: number }>()

const BOY_SCREEN_H = 60 // がめんの 上での 男の子の たかさ（CSS ピクセル）
const STEP_SEC = 0.15 // この びょうすう ぶん あるくと つぎの コマ

// ドット絵が よめなかった ときの しるし
function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(35,59,65,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0b429'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y - 14, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

export function WorldMap({ base, paused = false, onEncounter, onError }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<WorldHandle | null>(null)
  const encounterCb = useRef(onEncounter)
  const errorCb = useRef(onError)
  const pausedRef = useRef(paused)
  const nextAt = useRef(Infinity)
  const travelRef = useRef(0)
  const speedRef = useRef(12)
  const sheet = useRef<HTMLImageElement | null>(null)
  encounterCb.current = onEncounter
  errorCb.current = onError
  pausedRef.current = paused

  const wasPaused = useRef(paused)
  useEffect(() => {
    engine.current?.setPaused(paused)
    // とまっていたのが うごきだしたら かぞえなおす（マウント時は さわらない）
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
      const map = (await res.json()) as WorldMapData
      if (disposed || !host.current) return
      // まえに いた 道から さいかい（道の うえで なければ 入口から）
      const back = lastPos.get(base)
      const resumed = !!(back && isRoad(map, decodeRoads(map), back.x, back.y))
      if (resumed) map.spawn = { ...map.spawn, x: back!.x, y: back!.y }
      try {
        sheet.current = await loadImage(boySheetUrl(), abort.signal)
      } catch {
        sheet.current = null
      }
      if (disposed || !host.current) return
      speedRef.current = map.speed
      // はじめて 入った ときは ながめ、バトルから もどった ときは ふつう
      nextAt.current = encounterDistance(map.speed, !resumed)
      const stepPx = map.speed * STEP_SEC
      const world = await mountWorld(host.current, {
        map,
        gameUrl: new URL(map.images.game, baseUrl).href,
        signal: abort.signal,
        startWalking: true,
        // であいの はんていも ここで する ので、絵が なくても かならず わたす
        drawPlayer: (ctx, s) => {
          if (sheet.current) drawBoySprite(ctx, sheet.current, s, BOY_SCREEN_H, stepPx)
          else drawMarker(ctx, s.x, s.y)
          travelRef.current = s.travel
          if (!pausedRef.current && s.moving && s.travel >= nextAt.current) {
            nextAt.current = s.travel + encounterDistance(speedRef.current)
            encounterCb.current?.()
          }
        },
      })
      if (disposed) {
        world.destroy()
        return
      }
      engine.current = world
      world.setPaused(pausedRef.current)
    })().catch((e) => {
      if (disposed || (e as Error)?.name === 'AbortError') return
      if (host.current) host.current.textContent = 'マップを よみこめませんでした。'
      errorCb.current?.(e)
    })
    return () => {
      disposed = true
      abort.abort()
      const pos = engine.current?.getPosition()
      if (pos) lastPos.set(base, pos)
      engine.current?.destroy()
      engine.current = null
    }
  }, [base])

  return <div className="fieldmap worldmap" ref={host} />
}
