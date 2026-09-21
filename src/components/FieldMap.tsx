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

// つぎに むしに であうまでの きょり（ピクセル）
// であうまでに あるく きょり。マップの speed は 94px/びょう なので
// ここの すうじを 94で わると だいたいの びょうすうに なる。
const ENCOUNTER_MIN = 620 // ≒ 6.6びょう
const ENCOUNTER_MAX = 1500 // ≒ 16びょう
// マップに 入った ちょくごは すこし ながく あるいてから であう
const FIRST_MIN = 900 // ≒ 9.6びょう
const FIRST_MAX = 1800 // ≒ 19びょう
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const nextStep = () => rand(ENCOUNTER_MIN, ENCOUNTER_MAX)
const firstStep = () => rand(FIRST_MIN, FIRST_MAX)

function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('よみこめません: ' + src))
    signal.addEventListener('abort', () => reject(new Error('やめました')), { once: true })
    img.src = src
  })
}

// -------------------------------------------------------------
//  あるく 男の子（ドット絵）
// -------------------------------------------------------------
//  1まいの 絵に よこ3コマ × たて4ほうこう が ならんでいる。
//  たて：0=まえ(down) 1=よこ(つかわない) 2=みぎ 3=うしろ(up)
//  ※ もとの 絵は ひだりの れつも かおが みぎを むいているので、
//    ひだりむきは「みぎの れつを さゆう はんてん」して つかう。
//  よこ：0と2が あしを 出した ところ、1が たっている ところ
const FRAME_W = 132 // 1コマの よこ（もとの 絵の ピクセル）
const FRAME_H = 128 // 1コマの たて
const FOOT_PAD = 8 // コマの したから あしもとまでの よはく
const BOY_H = 42 // マップの 上での たかさ
const BOY_SCALE = BOY_H / FRAME_H
const ROW_DOWN = 0
const ROW_RIGHT = 2
const ROW_UP = 3
const ROW_OF: Record<string, number> = {
  down: ROW_DOWN,
  left: ROW_RIGHT, // はんてんして つかう
  right: ROW_RIGHT,
  up: ROW_UP,
}
// あるく コマの じゅんばん（1 が たっている コマ）
const WALK_CYCLE = [0, 1, 2, 1]
const STEP_PX = 14 // なんピクセル あるいたら つぎの コマに するか

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  s: FieldPlayerState,
) {
  const face = s.facing ?? 'down'
  const row = ROW_OF[face] ?? ROW_DOWN
  const flip = face === 'left'
  const col = s.moving
    ? WALK_CYCLE[Math.floor(s.travel / STEP_PX) % WALK_CYCLE.length]
    : 1
  const w = FRAME_W * BOY_SCALE
  const h = FRAME_H * BOY_SCALE
  const x = Math.round(s.x)
  const y = Math.round(s.y)

  // あしもとの かげ
  ctx.fillStyle = 'rgba(35,59,65,0.32)'
  ctx.beginPath()
  ctx.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  if (flip) {
    ctx.save()
    ctx.translate(x * 2, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(
    sheet,
    col * FRAME_W,
    row * FRAME_H,
    FRAME_W,
    FRAME_H,
    x - w / 2,
    y + FOOT_PAD * BOY_SCALE - h,
    w,
    h,
  )
  if (flip) ctx.restore()
}

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
  const nextAt = useRef(firstStep())
  const travelRef = useRef(0)
  const sheet = useRef<HTMLImageElement | null>(null)
  encounterCb.current = onEncounter
  zoneCb.current = onZoneEnter
  errorCb.current = onError
  pausedRef.current = paused

  useEffect(() => {
    engine.current?.setPaused(paused)
    // バトルの あとは、いまの きょりから かぞえなおす
    if (!paused) nextAt.current = travelRef.current + nextStep()
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
      if (back && canStand(map, back.x, back.y)) map.spawn = { ...back }
      // 男の子の ドット絵を よみこむ（しっぱいしても フィールドは うごく）
      const boyUrl = new URL('boy.png', new URL(import.meta.env.BASE_URL, document.baseURI) + 'fields/').href
      try {
        sheet.current = await loadImage(boyUrl, abort.signal)
      } catch {
        sheet.current = null
      }
      if (disposed || !host.current) return
      const field = await createField(host.current, {
        map,
        imageUrl: new URL(map.background, baseUrl).href,
        signal: abort.signal,
        onZoneEnter: (zone) => {
          zoneRef.current = zone.id
          zoneCb.current?.(zone)
        },
        drawPlayer: (ctx, state) => {
          if (sheet.current) drawSprite(ctx, sheet.current, state)
          else drawBoy(ctx, state)
          travelRef.current = state.travel
          // あるいた きょりが たまったら むしに であう
          if (!pausedRef.current && state.moving && state.travel >= nextAt.current) {
            nextAt.current = state.travel + nextStep()
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
