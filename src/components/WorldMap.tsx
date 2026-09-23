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
import { useEffect, useRef, useState } from 'react'
import {
  mountWorld,
  type TileManifest,
  type WorldHandle,
  type WorldMapData,
} from '../fields/world/viewer'
import { decodeRoads, isRoad } from '../fields/world/navigation'
import { loadIllustratedMap, type ArtBackground, type ArtManifest } from '../fields/world/artBackground'
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
const WALK_ZOOM = 5 // あるく ときの ズーム（8だと せまい・はやく かんじる ので さげた）
// あるく ときの ズーム だんかい（いちばん ちかい じゅんに ならべる。ボタンで じゅんぐりに きりかえる）
const WALK_ZOOM_LEVELS = [WALK_ZOOM, 3.5, 2]

// 区画の SVG を よみこんだ ときに 1かいだけ ふつうの 絵に する。
// SVG の まま まいフレーム かくと、スマホ（CPU 4ばい おそい ていど）で 12fps まで おちた。
async function loadTileBitmap(url: string, signal: AbortSignal): Promise<ImageBitmap | HTMLCanvasElement> {
  const svg = await loadImage(url, signal)
  const w = svg.naturalWidth || 1024
  const h = svg.naturalHeight || 1024
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(svg)
    } catch {
      // SVG を ImageBitmap に できない ブラウザは canvas に かく
    }
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')?.drawImage(svg, 0, 0, w, h)
  return c
}

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
  const artBgRef = useRef<ArtBackground | null>(null)
  // 世界が ひろいので、いまの いちを 見うしなわない ように 全体地図を 出せる
  const [overview, setOverview] = useState(false)
  // あるく ときの ズームの だんかい（0がいちばん ちかい）
  const [zoomIdx, setZoomIdx] = useState(0)
  // ダッシュボタンを おしている あいだ、はやく あるく
  const [dashing, setDashing] = useState(false)
  encounterCb.current = onEncounter
  errorCb.current = onError
  pausedRef.current = paused

  function toggleOverview() {
    const next = !overview
    setOverview(next)
    engine.current?.setOverview(next)
  }

  function cycleZoom() {
    const next = (zoomIdx + 1) % WALK_ZOOM_LEVELS.length
    setZoomIdx(next)
    engine.current?.setZoom(WALK_ZOOM_LEVELS[next])
  }

  function dashStart() {
    setDashing(true)
    engine.current?.setDash(true)
  }

  function dashEnd() {
    setDashing(false)
    engine.current?.setDash(false)
  }

  const wasPaused = useRef(paused)
  useEffect(() => {
    engine.current?.setPaused(paused)
    // とまっていたのが うごきだしたら かぞえなおす（マウント時は さわらない）
    if (wasPaused.current && !paused) {
      nextAt.current = travelRef.current + encounterDistance(speedRef.current)
    }
    wasPaused.current = paused
    // とまった ときは ダッシュも かいじょ（おしっぱなしの まま バトルに 入っても のこらない ように）
    if (paused) {
      setDashing(false)
      engine.current?.setDash(false)
    }
  }, [paused])

  useEffect(() => {
    let disposed = false
    setOverview(false)
    const abort = new AbortController()
    const baseUrl = new URL(base, new URL(import.meta.env.BASE_URL, document.baseURI))
    ;(async () => {
      const res = await fetch(new URL('map.json', baseUrl), { signal: abort.signal })
      if (!res.ok) throw new Error(`map.json HTTP ${res.status}`)
      const map = (await res.json()) as WorldMapData
      // 区画ごとの 絵（あるいた まわりだけ よみこむ）
      const tres = await fetch(new URL('tiles.json', baseUrl), { signal: abort.signal })
      if (!tres.ok) throw new Error(`tiles.json HTTP ${tres.status}`)
      const tileManifest = (await tres.json()) as TileManifest
      // イラスト背景（あれば）。ないマップは これまでどおり ベクター調の 区画を つかう。
      // イラスト背景は 見るだけの 全体地図 だけで つかう（あるく がめんは 道の
      // ズレが きになる ため ベクター調の まま。viewer.js がわで きりわけて いる）。
      let artBg: ArtBackground | null = null
      let artScale = 1
      try {
        const ares = await fetch(new URL('art-manifest.json', baseUrl), { signal: abort.signal })
        if (ares.ok) {
          const artManifest = (await ares.json()) as ArtManifest
          artBg = await loadIllustratedMap({ baseUrl: baseUrl.href, manifest: artManifest })
          // イラストは べつの ざひょう系（例：1307×2048）。もとの map座標との ひりつを もとめる。
          artScale = artManifest.width / map.width
        }
      } catch {
        artBg = null // よみこめなくても ベクター調に フォールバック
      }
      if (disposed || !host.current) {
        artBg?.destroy()
        return
      }
      artBgRef.current = artBg
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
        tileManifest,
        tileBaseUrl: baseUrl.href,
        loadTile: loadTileBitmap,
        artBg,
        artScale,
        walkZoom: WALK_ZOOM, // しょうりゃく時の 8だと せまくて はやく かんじた ので ひくめに
        detailZoom: Math.min(3, ...WALK_ZOOM_LEVELS), // ズームアウトの さいだいだんかい より ひくく（さもないと したじ画像の ままに なる）
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
        artBg?.destroy()
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
      artBgRef.current?.destroy()
      artBgRef.current = null
    }
  }, [base])

  // あたらしい マップに かわったら ズームの だんかいも さいしょから
  useEffect(() => {
    setZoomIdx(0)
  }, [base])

  return (
    <>
      <div className="fieldmap worldmap" ref={host} />
      <button
        type="button"
        className={'world-overview-btn' + (overview ? ' on' : '')}
        onClick={toggleOverview}
      >
        {overview ? '✕ とじる' : '🗺️ 全体地図'}
      </button>
      {!overview && (
        <button type="button" className="world-zoomcycle-btn" onClick={cycleZoom}>
          🔍 {zoomIdx + 1}/{WALK_ZOOM_LEVELS.length}
        </button>
      )}
      {!overview && (
        <button
          type="button"
          className={'world-dash-btn' + (dashing ? ' on' : '')}
          onPointerDown={dashStart}
          onPointerUp={dashEnd}
          onPointerLeave={dashEnd}
          onPointerCancel={dashEnd}
        >
          ダッシュ
        </button>
      )}
      {/* OpenStreetMap の 地図データを つかっているので、ひょうじが ひつよう */}
      <a
        className="world-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </>
  )
}
