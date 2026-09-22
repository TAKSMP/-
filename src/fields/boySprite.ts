// =============================================================
//  あるく 男の子（ドット絵）— どの マップでも つかう
// -------------------------------------------------------------
//  public/fields/boy.png：よこ3コマ × たて4れつ。
//  たて：0=まえ(down) 1=よこ(つかわない) 2=みぎ 3=うしろ(up)
//  ※ もとの 絵は ひだりの れつも かおが みぎを むいているので、
//    ひだりむきは「みぎの れつを さゆう はんてん」して つかう。
//  よこ：0と2が あしを 出した ところ、1が たっている ところ
// =============================================================

export interface WalkerState {
  x: number // あしもと
  y: number
  facing?: string
  travel: number // あるいた きょり
  moving: boolean
}

const FRAME_W = 132 // 1コマの よこ（もとの 絵の ピクセル）
const FRAME_H = 128 // 1コマの たて
const FOOT_PAD = 8 // コマの したから あしもとまでの よはく
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

export function boySheetUrl(): string {
  return new URL('fields/boy.png', new URL(import.meta.env.BASE_URL, document.baseURI)).href
}

export function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('よみこめません: ' + src))
    signal.addEventListener('abort', () => reject(new Error('やめました')), { once: true })
    img.src = src
  })
}

// height：がめん（または マップ）の 上での たかさ
// stepPx：なんピクセル あるいたら つぎの コマに するか
export function drawBoySprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  s: WalkerState,
  height: number,
  stepPx: number,
) {
  const face = s.facing ?? 'down'
  const row = ROW_OF[face] ?? ROW_DOWN
  const flip = face === 'left'
  const col = s.moving
    ? WALK_CYCLE[Math.floor(s.travel / stepPx) % WALK_CYCLE.length]
    : 1
  const scale = height / FRAME_H
  const w = FRAME_W * scale
  const h = FRAME_H * scale
  const x = Math.round(s.x)
  const y = Math.round(s.y)

  // あしもとの かげ
  ctx.fillStyle = 'rgba(35,59,65,0.32)'
  ctx.beginPath()
  ctx.ellipse(x, y, height * 0.21, height * 0.095, 0, 0, Math.PI * 2)
  ctx.fill()

  const smooth = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true // ちいさく する ので なめらかに
  if (flip) {
    ctx.save()
    ctx.translate(x * 2, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(sheet, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, x - w / 2, y + FOOT_PAD * scale - h, w, h)
  if (flip) ctx.restore()
  ctx.imageSmoothingEnabled = smooth
}
