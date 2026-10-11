// =============================================================
//  大きい マップ（つるせ など）を あるいて さがす
// -------------------------------------------------------------
//  エンジンは src/fields/world/viewer.js（道路の うえだけ あるける）。
//  FieldMap と おなじ ように つかえる：
//   ・ドット絵の 男の子で あるく
//   ・あるいた きょりが たまると むしに であう
//   ・バトルから もどると、さっきの ばしょから つづける
//  道を タップすると、つながっている 道を とおって じどうで あるく。
//  ダッシュ：矢印キー/WASDで うごいている あいだに、がめんの どこかを おさえ続けると はやく なる
//  （固定ボタンでは なく viewer.js がわで はんてい。くわしくは そちらの コメントを）
//  ちょうちょアメ：ひろうと 100びょう アサギマダラに なって そらを とぶ（たてものも こえられる）。
//  トンボあめ：ひろうと ギンヤンマ（100びょう・ダッシュが ちょうちょの 5ばい）か ウスバキトンボ（200びょう）に なって とぶ。
//  ひだりうえ…では なく みぎうえに、全体地図の 縮小版（ミニマップ）と いまいる ばしょを 出す。
//  ちょうちょちゃんビル：たてものが 1つ ひかっていて、さわると onBuildingReach（レベルを 3かい あげられる）。
//  とんでいる あいだは むしに であわない。じかんぎれで いちばん ちかい 道に おりる。
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
import {
  FLY_INFO,
  NORMAL_DASH_MULT,
  rollDragonflyKind,
  rollFlyKind,
  type FlyKind,
  CANDY_PICKUP_RADIUS,
  isButterfly,
  isDragonfly,
  loadCandy,
  respawnCandy,
  type CandySpot,
} from '../lib/candy'
import {
  BUILDING_TOUCH_RADIUS,
  buildingMaskCanvas,
  currentBuildingIndex,
  loadBuildings,
  nextBuildingIndex,
  touchesBuilding,
  type BuildingShape,
} from '../lib/chouchouBuilding'

interface Props {
  base: string // 'fields/tsuruse/' のような ばしょ
  paused?: boolean
  onEncounter?: () => void
  onError?: (e: unknown) => void
  onCandyPick?: (id: string) => void
  onBuildingReach?: () => void // ちょうちょちゃんビルに さわった
}

// バトルから もどった とき つづきから あるく
const lastPos = new Map<string, { x: number; y: number }>()

// バトルに まけた ときなど、つづきからでは なく スタート地点(map.json の spawn)から
// やりなおさせたい ときに よぶ
export function forgetFieldPosition(base: string) {
  lastPos.delete(base)
}

const BOY_SCREEN_H = 60 // がめんの 上での 男の子の たかさ（CSS ピクセル）

// アサギマダラの ドット絵（public/fields/asagi.png：よこ3コマ×たて4れつ、1コマ 128px）。
// れつ：0=まえ（した むき）、1=ひだり むき、2=みぎ むき、3=うしろ（うえ むき）。元画像は MAP/asagi-sprite/
const BUTTERFLY_CELL = 128
const BUTTERFLY_SCREEN = 64 // がめんの 上での おおきさ
const BUTTERFLY_ROW: Record<string, number> = { down: 0, left: 1, right: 2, up: 3 }
const BUTTERFLY_FLAP = [0, 1, 2, 1] // はねを ぱたぱた（とまっていても はばたく）

// トンボの ドット絵（public/fields/ginyanma.png・usubakitonbo.png：レイアウトは アサギマダラと おなじ。
// 元画像と つくりかたは MAP/tonbo-sprite/）。トンボは よこに ながいので ちょうちょより おおきく かく
const DRAGONFLY_SCREEN = 88
const DRAGONFLY_FLAP_MS = 60 // トンボは はねを はやく ぱたぱた

function flySheetUrl(kind: FlyKind): string {
  return new URL(FLY_INFO[kind].sheet, new URL(import.meta.env.BASE_URL, document.baseURI)).href
}

// そらを とんでいる アサギマダラ（x,y は あしもと＝かげの いち）
function drawButterfly(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  facing: string,
  t: number,
  dragonfly = false,
) {
  const bob = Math.sin(t / 280) * 4
  const size = dragonfly ? DRAGONFLY_SCREEN : BUTTERFLY_SCREEN
  ctx.save()
  ctx.fillStyle = 'rgba(35,59,65,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y, dragonfly ? 17 : 13, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  if (img) {
    const row = BUTTERFLY_ROW[facing] ?? 0
    const col = BUTTERFLY_FLAP[Math.floor(t / (dragonfly ? DRAGONFLY_FLAP_MS : 90)) % BUTTERFLY_FLAP.length]
    ctx.drawImage(
      img,
      col * BUTTERFLY_CELL,
      row * BUTTERFLY_CELL,
      BUTTERFLY_CELL,
      BUTTERFLY_CELL,
      x - size / 2,
      y - size * 0.8 - 14 + bob,
      size,
      size,
    )
  } else {
    ctx.font = dragonfly ? 'bold 16px sans-serif' : '40px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(dragonfly ? 'トンボ' : '🦋', x, y - 40 + bob)
  }
  ctx.restore()
}

// 地図に おちている ちょうちょアメ（ふつうの あめ 🍬 と ちがう みため：あおく ひかる たま に アサギマダラ）
function drawButterflyCandy(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  t: number,
) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 300)
  ctx.save()
  const g = ctx.createRadialGradient(x, y, 2, x, y, 20)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.55, `rgba(150,225,255,${0.75 + pulse * 0.2})`)
  g.addColorStop(1, 'rgba(120,200,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, 20 + pulse * 3, 0, Math.PI * 2)
  ctx.fill()
  if (img) {
    ctx.drawImage(img, 0, 0, BUTTERFLY_CELL, BUTTERFLY_CELL, x - 15, y - 15, 30, 30)
  } else {
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🦋', x, y)
  }
  ctx.restore()
}
// 地図に おちている トンボあめ（みどりに ひかる たまの なかで ギンヤンマと ウスバキトンボが こうごに あらわれる）
function drawDragonflyCandy(
  ctx: CanvasRenderingContext2D,
  imgs: (HTMLImageElement | null)[],
  x: number,
  y: number,
  t: number,
) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 300)
  ctx.save()
  const g = ctx.createRadialGradient(x, y, 2, x, y, 22)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.55, `rgba(190,235,120,${0.75 + pulse * 0.2})`)
  g.addColorStop(1, 'rgba(150,215,90,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, 22 + pulse * 3, 0, Math.PI * 2)
  ctx.fill()
  const img = imgs[Math.floor(t / 1200) % imgs.length]
  if (img) {
    ctx.drawImage(img, 0, 0, BUTTERFLY_CELL, BUTTERFLY_CELL, x - 19, y - 19, 38, 38)
  } else {
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('トンボ', x, y)
  }
  ctx.restore()
}
const STEP_SEC = 0.15 // この びょうすう ぶん あるくと つぎの コマ
// あるく ときの ズーム だんかい（ひろい じゅんに ならべる）。しょきちは DEFAULT_ZOOM_IDX。
// ＋ボタンで ちかづき（さいだい WALK_ZOOM_LEVELSの さいご）、－ボタンで とおざかる（さいしょう[0]）。
const WALK_ZOOM_LEVELS = [0.7, 1, 1.4, 2, 3.5, 5]
// もとの デフォルト(200%)を まんなかに のこし、そこから ひろげる ことも ちかづける ことも できるように
const DEFAULT_ZOOM_IDX = WALK_ZOOM_LEVELS.indexOf(2)

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

export function WorldMap({
  base,
  paused = false,
  onEncounter,
  onError,
  onCandyPick,
  onBuildingReach,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<WorldHandle | null>(null)
  const encounterCb = useRef(onEncounter)
  const errorCb = useRef(onError)
  const pausedRef = useRef(paused)
  const nextAt = useRef(Infinity)
  const travelRef = useRef(0)
  const speedRef = useRef(12)
  const sheet = useRef<HTMLImageElement | null>(null)
  // ちょうちょの ドット絵：アサギマダラ（ちょうちょアメの アイコンにも つかう）と オオゴマダラ
  const butterflySheet = useRef<HTMLImageElement | null>(null)
  const oogomaSheet = useRef<HTMLImageElement | null>(null)
  // トンボの ドット絵（トンボあめの アイコンにも つかう）
  const ginyanmaSheet = useRef<HTMLImageElement | null>(null)
  const usubakiSheet = useRef<HTMLImageElement | null>(null)
  // いま とんでいる ちょうちょ（ひろう たびに きめなおす）
  const flyKindRef = useRef<FlyKind>('asagi')
  const [flyKind, setFlyKind] = useState<FlyKind>('asagi')
  // ちょうちょちゃんビル（buildings.json が ある マップだけ）
  const buildingsRef = useRef<BuildingShape[] | null>(null)
  const buildingIdx = useRef(-1)
  const buildingMask = useRef<HTMLCanvasElement | null>(null)
  const onBuildingReachRef = useRef(onBuildingReach)
  const [buildingOn, setBuildingOn] = useState(false)
  const buildingDotRef = useRef<HTMLSpanElement | null>(null)
  // ちょうちょアメで そらを とんでいる のこり じかん（ミリびょう。0 なら あるいている）
  const flyRemainMs = useRef(0)
  const lastFrameAt = useRef(0)
  // がめんに 出す のこり びょう（1びょうごとに だけ こうしんする）
  const [flySec, setFlySec] = useState(0)
  const [landedNote, setLandedNote] = useState(false)
  // 全体地図の 縮小版（ミニマップ）：あるいている あいだ みぎうえに 出す。いまいる ばしょは ref で まいフレーム うごかす
  const [miniMap, setMiniMap] = useState<{ src: string; aspect: number } | null>(null)
  const miniDotRef = useRef<HTMLSpanElement | null>(null)
  const artBgRef = useRef<ArtBackground | null>(null)
  // いま おちている あめ（そのマップ限定、localStorage に ほぞん。ロード後に セットする）
  const [candies, setCandies] = useState<CandySpot[]>([])
  // drawPlayer の クロージャから 最新を みるため ref にも もつ
  const candiesRef = useRef<CandySpot[]>([])
  const onCandyPickRef = useRef(onCandyPick)
  // ひろった あめを、setCandies が きく まえに 二重に ひろわない ための ガード
  const pickedGuard = useRef<Set<string>>(new Set())
  // 世界が ひろいので、いまの いちを 見うしなわない ように 全体地図を 出せる
  const [overview, setOverview] = useState(false)
  // あめレーダー：全体地図の あいだだけ、あめの ばしょを てんめつ させる
  const [radarOn, setRadarOn] = useState(false)
  const radarDotRefs = useRef<(HTMLSpanElement | null)[]>([])
  // あるく ときの ズームの だんかい（0がいちばん ひろい＝しょきち）
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_IDX)
  encounterCb.current = onEncounter
  errorCb.current = onError
  pausedRef.current = paused
  candiesRef.current = candies
  onCandyPickRef.current = onCandyPick
  onBuildingReachRef.current = onBuildingReach

  function toggleOverview() {
    const next = !overview
    setOverview(next)
    engine.current?.setOverview(next)
    // 全体地図から もどると エンジンがわの ズームは しょきち(いちばん ひろい)に もどる ので、あわせる
    if (!next) setZoomIdx(DEFAULT_ZOOM_IDX)
  }

  function zoomIn() {
    const next = Math.min(zoomIdx + 1, WALK_ZOOM_LEVELS.length - 1)
    setZoomIdx(next)
    engine.current?.setZoom(WALK_ZOOM_LEVELS[next])
  }

  function zoomOut() {
    const next = Math.max(zoomIdx - 1, 0)
    setZoomIdx(next)
    engine.current?.setZoom(WALK_ZOOM_LEVELS[next])
  }

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
      const mask = decodeRoads(map)
      // ミニマップ：全体地図と おなじ 絵を ちいさく 出す（ブラウザの キャッシュで よみこみは 1かい）
      setMiniMap({ src: new URL(map.images.game, baseUrl).href, aspect: map.width / map.height })
      // まえに いた 道から さいかい（道の うえで なければ 入口から）
      const back = lastPos.get(base)
      const resumed = !!(back && isRoad(map, mask, back.x, back.y))
      if (resumed) map.spawn = { ...map.spawn, x: back!.x, y: back!.y }
      // あめ：保存ずみが あれば それ、なければ 5個 あたらしく
      const initialCandies = loadCandy(base, map, mask)
      candiesRef.current = initialCandies
      setCandies(initialCandies)
      try {
        sheet.current = await loadImage(boySheetUrl(), abort.signal)
      } catch {
        sheet.current = null
      }
      // ちょうちょちゃんビル：いまの ビルを きめて、ひからせる かたちを つくって おく
      const buildings = await loadBuildings(new URL('buildings.json', baseUrl).href, abort.signal)
      buildingsRef.current = buildings
      if (buildings) {
        buildingIdx.current = currentBuildingIndex(base, buildings.length)
        buildingMask.current = buildingMaskCanvas(buildings[buildingIdx.current], '#ffe14d')
        setBuildingOn(true)
      }
      try {
        butterflySheet.current = await loadImage(flySheetUrl('asagi'), abort.signal)
      } catch {
        butterflySheet.current = null // よめなくても 🦋 で かわりに かく
      }
      try {
        oogomaSheet.current = await loadImage(flySheetUrl('oogoma'), abort.signal)
      } catch {
        oogomaSheet.current = null
      }
      try {
        ginyanmaSheet.current = await loadImage(flySheetUrl('ginyanma'), abort.signal)
      } catch {
        ginyanmaSheet.current = null // よめなくても 「トンボ」の もじで かわりに かく
      }
      try {
        usubakiSheet.current = await loadImage(flySheetUrl('usubaki'), abort.signal)
      } catch {
        usubakiSheet.current = null
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
        walkZoom: WALK_ZOOM_LEVELS[WALK_ZOOM_LEVELS.length - 1], // ＋ボタンで ちかづける じょうげん
        startZoom: WALK_ZOOM_LEVELS[DEFAULT_ZOOM_IDX], // あるき はじめは これまでどおりの 200%
        detailZoom: Math.min(3, ...WALK_ZOOM_LEVELS), // ズームアウトの さいだいだんかい より ひくく（さもないと したじ画像の ままに なる）
        signal: abort.signal,
        startWalking: true,
        // であいの はんていも ここで する ので、絵が なくても かならず わたす
        drawPlayer: (ctx, s) => {
          const t = performance.now()
          const dt = lastFrameAt.current ? Math.min(100, t - lastFrameAt.current) : 0
          lastFrameAt.current = t
          // ちょうちょアメ：とまっている（バトル・メニューなど）あいだは じかんを へらさない
          if (flyRemainMs.current > 0 && !pausedRef.current) {
            flyRemainMs.current -= dt
            if (flyRemainMs.current <= 0) {
              flyRemainMs.current = 0
              engine.current?.setFlying(false) // いちばん ちかい 道に おりる
              engine.current?.setDashMult(NORMAL_DASH_MULT) // ギンヤンマの 5ばい ダッシュも おわり
              // おりた とたんに であわない ように、ここから かぞえなおす
              nextAt.current = s.travel + encounterDistance(speedRef.current)
              setFlySec(0)
              setLandedNote(true)
            } else {
              const sec = Math.ceil(flyRemainMs.current / 1000)
              setFlySec((prev) => (prev === sec ? prev : sec))
            }
          }
          // ちょうちょちゃんビル：ひかる たてもの（キャラより したに かく）
          const blds = buildingsRef.current
          if (blds && buildingIdx.current >= 0 && buildingMask.current) {
            const b = blds[buildingIdx.current]
            const bx = s.x + (b.x - s.wx) * s.zoom
            const by = s.y + (b.y - s.wy) * s.zoom
            const bw = b.w * s.zoom
            const bh = b.h * s.zoom
            const pulse = 0.5 + 0.5 * Math.sin(t / 320)
            ctx.save()
            ctx.globalAlpha = 0.5 + pulse * 0.4
            ctx.shadowColor = 'rgba(255, 200, 40, 0.95)'
            ctx.shadowBlur = 14 + pulse * 16
            ctx.drawImage(buildingMask.current, bx, by, bw, bh)
            ctx.drawImage(buildingMask.current, bx, by, bw, bh)
            ctx.restore()
            ctx.save()
            ctx.font = 'bold 13px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.lineWidth = 4
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'
            ctx.fillStyle = '#b35a00'
            const label = '🦋 ちょうちょちゃんビル'
            const ly = by - 6 - pulse * 3
            ctx.strokeText(label, bx + bw / 2, ly)
            ctx.fillText(label, bx + bw / 2, ly)
            ctx.restore()
            // さわったら レベルアップへ。ビルは べつの たてものに うつる
            if (!pausedRef.current && touchesBuilding(b, s.wx, s.wy, BUILDING_TOUCH_RADIUS)) {
              buildingIdx.current = nextBuildingIndex(base, blds.length, buildingIdx.current)
              buildingMask.current = buildingMaskCanvas(blds[buildingIdx.current], '#ffe14d')
              onBuildingReachRef.current?.()
            }
          }
          const flying = flyRemainMs.current > 0
          // ミニマップの げんざいち（あるいて いる あいだも とんでいる あいだも）
          const miniDot = miniDotRef.current
          if (miniDot) {
            miniDot.style.left = `${(s.wx / map.width) * 100}%`
            miniDot.style.top = `${(s.wy / map.height) * 100}%`
          }
          if (flying) {
            const fk = flyKindRef.current
            const img =
              fk === 'oogoma'
                ? oogomaSheet.current
                : fk === 'ginyanma'
                  ? ginyanmaSheet.current
                  : fk === 'usubaki'
                    ? usubakiSheet.current
                    : butterflySheet.current
            drawButterfly(ctx, img, s.x, s.y, s.facing, t, FLY_INFO[fk].dragonfly)
          }
          else if (sheet.current) drawBoySprite(ctx, sheet.current, s, BOY_SCREEN_H, stepPx)
          else drawMarker(ctx, s.x, s.y)
          travelRef.current = s.travel
          // とんでいる あいだは むしに であわない（たてものの 上で バトルに なると もどる ばしょが ない）
          if (flying) nextAt.current = Math.max(nextAt.current, s.travel + 1)
          if (!flying && !pausedRef.current && s.moving && s.travel >= nextAt.current) {
            nextAt.current = s.travel + encounterDistance(speedRef.current)
            encounterCb.current?.()
          }
          // あめ：プレイヤーからの そうたい いちで がめんに かく（カメラは プレイヤーに ついてくる ので、
          // s.x/s.y（がめん）＋ワールド座標の さと で かんたんに もとまる）
          for (const c of candiesRef.current) {
            const sx = s.x + (c.x - s.wx) * s.zoom
            const sy = s.y + (c.y - s.wy) * s.zoom
            const bob = Math.sin(t / 260 + c.x) * 3
            if (isButterfly(c)) {
              drawButterflyCandy(ctx, butterflySheet.current, sx, sy + bob, t)
            } else if (isDragonfly(c)) {
              drawDragonflyCandy(ctx, [ginyanmaSheet.current, usubakiSheet.current], sx, sy + bob, t)
            } else {
              ctx.save()
              ctx.font = '26px sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText('🍬', sx, sy + bob)
              ctx.restore()
            }
            if (!pausedRef.current && !pickedGuard.current.has(c.id)) {
              const dist = Math.hypot(c.x - s.wx, c.y - s.wy)
              if (dist <= CANDY_PICKUP_RADIUS) {
                pickedGuard.current.add(c.id)
                const next = respawnCandy(base, candiesRef.current, c.id, map, mask)
                candiesRef.current = next
                setCandies(next)
                if (isButterfly(c) || isDragonfly(c)) {
                  // ちょうちょアメ・トンボあめ：その ばで そらへ（とんでいる とちゅうでも あたらしい ほうに かわる）
                  const kind = isDragonfly(c) ? rollDragonflyKind() : rollFlyKind()
                  flyKindRef.current = kind
                  setFlyKind(kind)
                  flyRemainMs.current = FLY_INFO[kind].sec * 1000
                  engine.current?.setFlying(true)
                  engine.current?.setDashMult(FLY_INFO[kind].dash) // ギンヤンマは ダッシュが 5ばい
                  setFlySec(FLY_INFO[kind].sec)
                  setLandedNote(false)
                } else {
                  onCandyPickRef.current?.(c.id)
                }
              }
            }
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
      // マウントの とちゅうで ちょうちょアメを ひろって いた ばあいに そろえる
      if (flyRemainMs.current > 0) {
        world.setFlying(true)
        world.setDashMult(FLY_INFO[flyKindRef.current].dash)
      }
    })().catch((e) => {
      if (disposed || (e as Error)?.name === 'AbortError') return
      if (host.current) host.current.textContent = 'マップを よみこめませんでした。'
      errorCb.current?.(e)
    })
    return () => {
      disposed = true
      abort.abort()
      // とんでいる とちゅうで マップを はなれたら、道に おろしてから いちを おぼえる
      // （たてものの 上の いちを おぼえると、つぎは スタート地点から に なってしまう）
      if (flyRemainMs.current > 0) {
        engine.current?.setFlying(false)
        engine.current?.setDashMult(NORMAL_DASH_MULT)
        flyRemainMs.current = 0
      }
      const pos = engine.current?.getPosition()
      if (pos) lastPos.set(base, pos)
      engine.current?.destroy()
      engine.current = null
      artBgRef.current?.destroy()
      artBgRef.current = null
    }
  }, [base])

  useEffect(() => {
    if (!landedNote) return
    const id = window.setTimeout(() => setLandedNote(false), 2200)
    return () => window.clearTimeout(id)
  }, [landedNote])

  // あたらしい マップに かわったら ズームの だんかいも さいしょから
  useEffect(() => {
    setZoomIdx(DEFAULT_ZOOM_IDX)
  }, [base])

  // 全体地図を とじたら レーダーも おふ に もどす
  useEffect(() => {
    if (!overview) setRadarOn(false)
  }, [overview])

  // あめレーダー：全体地図の カメラ（getCamera）を つかって、あめの がめん いちを まいフレーム けいさん
  useEffect(() => {
    if (!overview || !radarOn) return
    let raf = 0
    function frame() {
      const cam = engine.current?.getCamera()
      const h = host.current
      if (cam && cam.mode === 'overview' && h) {
        const w = h.clientWidth
        const hh = h.clientHeight
        const t = performance.now()
        const blink = 0.55 + 0.45 * Math.sin(t / 220)
        const blds = buildingsRef.current
        const bel = buildingDotRef.current
        if (blds && buildingIdx.current >= 0 && bel) {
          const b = blds[buildingIdx.current]
          const bx = w / 2 + (b.x + b.w / 2 - cam.cx) * cam.zoom
          const by = hh / 2 + (b.y + b.h / 2 - cam.cy) * cam.zoom
          bel.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -50%) scale(${1 + blink * 0.3})`
        }
        candiesRef.current.forEach((c, i) => {
          const el = radarDotRefs.current[i]
          if (!el) return
          const sx = w / 2 + (c.x - cam.cx) * cam.zoom
          const sy = hh / 2 + (c.y - cam.cy) * cam.zoom
          el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${1 + blink * 0.5})`
          el.style.opacity = String(0.4 + blink * 0.6)
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [overview, radarOn])

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
        <div className="world-zoompair">
          <button
            type="button"
            className="world-zoompair-btn"
            onClick={zoomOut}
            disabled={zoomIdx <= 0}
            aria-label="ズームアウト"
          >
            −
          </button>
          <button
            type="button"
            className="world-zoompair-btn"
            onClick={zoomIn}
            disabled={zoomIdx >= WALK_ZOOM_LEVELS.length - 1}
            aria-label="ズームイン"
          >
            ＋
          </button>
        </div>
      )}
      {overview && candies.length > 0 && (
        <button
          type="button"
          className={'candy-radar-btn' + (radarOn ? ' on' : '')}
          onClick={() => setRadarOn((v) => !v)}
        >
          🍬 あめレーダー
        </button>
      )}
      {overview && radarOn && (
        <div className="candy-radar-layer">
          {buildingOn && (
            <span ref={buildingDotRef} className="building-radar-dot">
              🏢🦋
            </span>
          )}
          {candies.map((c, i) => (
            <span
              key={c.id}
              ref={(el) => {
                radarDotRefs.current[i] = el
              }}
              className={
                'candy-radar-dot' + (isButterfly(c) ? ' butterfly' : isDragonfly(c) ? ' dragonfly' : '')
              }
            />
          ))}
        </div>
      )}
      {/* 全体地図の 縮小版：あるいている あいだ みぎうえに。あかい てんが いま いる ばしょ */}
      {!overview && miniMap && (
        <div
          className={'world-minimap' + (flySec > 0 || landedNote ? ' below-timer' : '')}
          style={{ aspectRatio: miniMap.aspect }}
          aria-label="いま いる ばしょ"
        >
          <img src={miniMap.src} alt="" draggable={false} />
          <span ref={miniDotRef} className="world-minimap-dot" />
        </div>
      )}
      {flySec > 0 && !overview && (
        <div
          className={
            'butterfly-timer' + (FLY_INFO[flyKind].dragonfly ? ' dragonfly' : '') + (flySec <= 5 ? ' ending' : '')
          }
        >
          <span className="butterfly-timer-label">
            {FLY_INFO[flyKind].dragonfly ? (
              <span
                className="fly-icon"
                style={{ backgroundImage: `url(${flySheetUrl(flyKind)})` }}
                aria-hidden="true"
              />
            ) : (
              '🦋 '
            )}
            {FLY_INFO[flyKind].name}で とんでいる！
            {FLY_INFO[flyKind].dash > NORMAL_DASH_MULT && (
              <small className="butterfly-timer-sub">ダッシュで ちょうちょの {FLY_INFO[flyKind].dash}ばい！</small>
            )}
          </span>
          <span className="butterfly-timer-sec">
            {flySec}
            <small>びょう</small>
          </span>
        </div>
      )}
      {landedNote && !overview && <div className="butterfly-landed">🌿 じめんに おりたよ</div>}
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
