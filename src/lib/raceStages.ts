// =============================================================
//  レースの ステージ（5しゅるいの こうえん）
// -------------------------------------------------------------
//  ステージごとに コースの かたち（とおる てん）・いろ・おく ものが ちがう。
//  絵は ステージを えらんだ ときに 1かいだけ かいて つかいまわす。
// =============================================================
import {
  bench,
  buildTrack,
  bush,
  distToRoad,
  flowerBed,
  fountain,
  jungleGym,
  lamp,
  pond,
  ROAD_HALF,
  rng,
  sandbox,
  slide,
  swings,
  trackPos,
  tree,
  WORLD_H,
  WORLD_W,
  type Ctx,
  type Track,
} from './raceCourse'

interface Palette {
  grass: string
  grass2: string // かりこみの しま
  tuft: string // くさの つぶ
  fence: string
  roadShadow: string
  edge: string // ふちいし
  road: string
  road2: string // みちの まんなか
  stones: string
  speck: string
  curb: [string, string]
}

type TreeStyle = 'round' | 'pine' | 'mixed' | 'snow' | 'cherry'

export interface StageDef {
  id: string
  name: string
  emoji: string
  desc: string
  control: [number, number][]
  pal: Palette
  treeStyle: TreeStyle
  treeCount: number
  keepOut: [number, number, number][] // 木を おかない ところ（x, y, はんけい）
  keepOutRects?: [number, number, number, number][] // 木を おかない しかく（まんなか x, y, はば, たかさ）
  features: (c: Ctx, rnd: () => number) => void // みちより したに かく もの
  extras?: (c: Ctx, t: Track, rnd: () => number) => void // 木の あとに かく もの
}

// ── あたらしい 部品 ─────────────────────────────
function shadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.2) {
  c.fillStyle = `rgba(20,40,20,${a})`
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  c.fill()
}

function star(c: Ctx, x: number, y: number, r: number, points: number, inner: number, rot: number) {
  c.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r
    const a = rot + (i / (points * 2)) * Math.PI * 2
    if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  c.closePath()
  c.fill()
}

function pine(c: Ctx, x: number, y: number, r: number, rnd: () => number, snow = false) {
  shadow(c, x + r * 0.35, y + r * 0.4, r, r * 0.85, 0.22)
  const rot = rnd() * Math.PI
  const cols = snow ? ['#3f6f4f', '#4f8a5f', '#6fa77a'] : ['#2f6f32', '#3f8a3c', '#5aa84e']
  cols.forEach((col, i) => {
    c.fillStyle = col
    star(c, x, y, r * (1 - i * 0.28), 9, 0.62, rot + i * 0.3)
  })
  if (snow) {
    c.fillStyle = '#ffffff'
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2
      const d = r * (0.2 + rnd() * 0.6)
      c.beginPath()
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.12 + rnd() * 0.12), 0, Math.PI * 2)
      c.fill()
    }
    c.beginPath()
    c.arc(x, y, r * 0.16, 0, Math.PI * 2)
    c.fill()
  }
}

function mushroom(c: Ctx, x: number, y: number, s: number, color = '#e8443a') {
  shadow(c, x + 3, y + 4, s, s * 0.7, 0.18)
  c.fillStyle = color
  c.beginPath()
  c.arc(x, y, s, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#fff'
  for (const [dx, dy, r] of [
    [-0.4, -0.3, 0.22],
    [0.35, -0.2, 0.18],
    [0, 0.35, 0.2],
    [0.45, 0.4, 0.12],
  ]) {
    c.beginPath()
    c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2)
    c.fill()
  }
}

function stump(c: Ctx, x: number, y: number, r: number) {
  shadow(c, x + 4, y + 5, r * 1.1, r * 0.9)
  c.fillStyle = '#7a5130'
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#d9b07a'
  c.beginPath()
  c.arc(x, y, r * 0.8, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#b8895a'
  c.lineWidth = 1.5
  for (let k = 0.2; k < 0.8; k += 0.2) {
    c.beginPath()
    c.arc(x, y, r * k, 0, Math.PI * 2)
    c.stroke()
  }
}

function logPile(c: Ctx, x: number, y: number, rot: number) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  shadow(c, 6, 8, 60, 26)
  for (let i = 0; i < 3; i++) {
    c.fillStyle = '#8a5a32'
    c.fillRect(-55, -24 + i * 16, 110, 14)
    c.fillStyle = '#d9b07a'
    c.beginPath()
    c.ellipse(55, -17 + i * 16, 5, 7, 0, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function cabin(c: Ctx, x: number, y: number) {
  shadow(c, x + 14, y + 16, 110, 80)
  c.fillStyle = '#8f4a2a'
  c.fillRect(x - 100, y - 70, 200, 140)
  c.fillStyle = '#b25a32'
  c.fillRect(x - 100, y - 70, 200, 68)
  c.strokeStyle = '#6a3018'
  c.lineWidth = 3
  for (let k = -90; k <= 90; k += 18) {
    c.beginPath()
    c.moveTo(x + k, y - 70)
    c.lineTo(x + k, y + 70)
    c.stroke()
  }
  c.fillStyle = '#5a2a14'
  c.fillRect(x - 104, y - 4, 208, 8)
  // えんとつ
  c.fillStyle = '#9a9a9a'
  c.fillRect(x + 50, y - 50, 22, 22)
  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.beginPath()
  c.arc(x + 70, y - 64, 10, 0, Math.PI * 2)
  c.arc(x + 84, y - 78, 13, 0, Math.PI * 2)
  c.fill()
}

function campfire(c: Ctx, x: number, y: number) {
  c.fillStyle = '#9a9a9a'
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    c.beginPath()
    c.arc(x + Math.cos(a) * 24, y + Math.sin(a) * 24, 7, 0, Math.PI * 2)
    c.fill()
  }
  c.fillStyle = '#6a3a1a'
  c.save()
  c.translate(x, y)
  for (const a of [0.4, -0.5, 1.6]) {
    c.rotate(a)
    c.fillRect(-16, -3, 32, 6)
  }
  c.restore()
  c.fillStyle = '#ff9f1c'
  star(c, x, y, 14, 6, 0.5, 0)
  c.fillStyle = '#ffe36e'
  star(c, x, y, 7, 6, 0.5, 0.3)
}

function windmill(c: Ctx, x: number, y: number) {
  shadow(c, x + 12, y + 14, 70, 60)
  c.fillStyle = '#e9e2d0'
  c.beginPath()
  c.arc(x, y, 52, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#c9583a'
  star(c, x, y, 40, 8, 0.85, 0.2)
  c.save()
  c.translate(x, y)
  c.rotate(0.6)
  for (let i = 0; i < 4; i++) {
    c.rotate(Math.PI / 2)
    c.fillStyle = '#7a5130'
    c.fillRect(-4, 0, 8, 110)
    c.fillStyle = '#fffaf0'
    c.fillRect(4, 26, 22, 84)
    c.strokeStyle = '#c8bca2'
    c.lineWidth = 1.5
    for (let k = 34; k < 110; k += 12) {
      c.beginPath()
      c.moveTo(4, k)
      c.lineTo(26, k)
      c.stroke()
    }
  }
  c.fillStyle = '#5a3a1a'
  c.beginPath()
  c.arc(0, 0, 9, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

// しましまの チューリップばたけ
function tulipField(c: Ctx, x: number, y: number, w: number, h: number, colors: string[], rnd: () => number) {
  c.fillStyle = '#7a5a3a'
  c.beginPath()
  c.roundRect(x - w / 2, y - h / 2, w, h, 18)
  c.fill()
  const rows = Math.max(3, Math.round(h / 30))
  const rh = h / rows
  for (let r = 0; r < rows; r++) {
    const py = y - h / 2 + r * rh
    c.fillStyle = '#5c9a3e'
    c.fillRect(x - w / 2 + 10, py + rh * 0.18, w - 20, rh * 0.64)
    c.fillStyle = colors[r % colors.length]
    for (let px = x - w / 2 + 18; px < x + w / 2 - 12; px += 13) {
      c.beginPath()
      c.arc(px + (rnd() - 0.5) * 3, py + rh / 2 + (rnd() - 0.5) * 4, 5, 0, Math.PI * 2)
      c.fill()
    }
  }
}

function greenhouse(c: Ctx, x: number, y: number, w: number, h: number) {
  shadow(c, x + 10, y + 12, w * 0.55, h * 0.55)
  c.fillStyle = 'rgba(200,235,250,0.9)'
  c.fillRect(x - w / 2, y - h / 2, w, h)
  c.strokeStyle = '#ffffff'
  c.lineWidth = 3
  c.strokeRect(x - w / 2, y - h / 2, w, h)
  c.lineWidth = 1.5
  for (let k = x - w / 2 + 22; k < x + w / 2; k += 22) {
    c.beginPath()
    c.moveTo(k, y - h / 2)
    c.lineTo(k, y + h / 2)
    c.stroke()
  }
  c.beginPath()
  c.moveTo(x - w / 2, y)
  c.lineTo(x + w / 2, y)
  c.stroke()
  c.fillStyle = 'rgba(90,160,70,0.55)'
  for (let k = x - w / 2 + 11; k < x + w / 2; k += 22) {
    c.beginPath()
    c.arc(k, y - h / 4, 7, 0, Math.PI * 2)
    c.arc(k, y + h / 4, 7, 0, Math.PI * 2)
    c.fill()
  }
}

function beehive(c: Ctx, x: number, y: number) {
  shadow(c, x + 5, y + 6, 20, 16)
  c.fillStyle = '#f2c14e'
  c.fillRect(x - 16, y - 14, 32, 28)
  c.fillStyle = '#d99a1e'
  c.fillRect(x - 16, y - 4, 32, 4)
  c.fillRect(x - 16, y + 6, 32, 4)
  c.fillStyle = '#3a2a10'
  c.fillRect(x - 5, y + 10, 10, 4)
}

function reeds(c: Ctx, x: number, y: number, rnd: () => number) {
  for (let i = 0; i < 7; i++) {
    const px = x + (rnd() - 0.5) * 30
    const py = y + (rnd() - 0.5) * 20
    c.strokeStyle = '#4f8a3c'
    c.lineWidth = 2.5
    c.beginPath()
    c.moveTo(px, py)
    c.lineTo(px + (rnd() - 0.5) * 8, py - 16)
    c.stroke()
    c.fillStyle = '#8a5a32'
    c.beginPath()
    c.ellipse(px, py - 16, 2.5, 5, 0, 0, Math.PI * 2)
    c.fill()
  }
}

function swanBoat(c: Ctx, x: number, y: number, rot: number) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.fillStyle = 'rgba(0,40,80,0.18)'
  c.beginPath()
  c.ellipse(3, 4, 30, 18, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.ellipse(0, 0, 28, 17, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ff9ec4'
  c.fillRect(-12, -9, 18, 18)
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.arc(24, 0, 8, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ff9f1c'
  c.beginPath()
  c.moveTo(31, -3)
  c.lineTo(39, 0)
  c.lineTo(31, 3)
  c.fill()
  c.restore()
}

function pier(c: Ctx, x: number, y: number, len: number, rot: number) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.fillStyle = 'rgba(0,30,60,0.2)'
  c.fillRect(4, -14, len, 32)
  c.fillStyle = '#b07a4a'
  c.fillRect(0, -16, len, 32)
  c.strokeStyle = '#8a5a32'
  c.lineWidth = 2
  for (let k = 10; k < len; k += 12) {
    c.beginPath()
    c.moveTo(k, -16)
    c.lineTo(k, 16)
    c.stroke()
  }
  c.restore()
}

function parasol(c: Ctx, x: number, y: number, col: string) {
  shadow(c, x + 8, y + 10, 26, 20)
  c.fillStyle = col
  star(c, x, y, 26, 8, 0.92, 0)
  c.fillStyle = '#ffffff'
  for (let i = 0; i < 8; i += 2) {
    const a = (i / 8) * Math.PI * 2
    c.beginPath()
    c.moveTo(x, y)
    c.arc(x, y, 24, a, a + Math.PI / 4)
    c.closePath()
    c.fill()
  }
  c.fillStyle = '#7a5130'
  c.beginPath()
  c.arc(x, y, 3, 0, Math.PI * 2)
  c.fill()
}

function frozenPond(c: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number) {
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.ellipse(x, y, rx + 16, ry + 14, 0, 0, Math.PI * 2)
  c.fill()
  const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 10, x, y, Math.max(rx, ry))
  g.addColorStop(0, '#e6f6ff')
  g.addColorStop(1, '#a8d8f0')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  c.fill()
  // スケートの あと
  c.strokeStyle = 'rgba(255,255,255,0.9)'
  c.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    c.beginPath()
    c.ellipse(x + (rnd() - 0.5) * rx * 0.6, y + (rnd() - 0.5) * ry * 0.6, rx * (0.2 + rnd() * 0.4), ry * (0.15 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 1.3)
    c.stroke()
  }
  // ひび
  c.strokeStyle = 'rgba(120,170,200,0.6)'
  c.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    let px = x + (rnd() - 0.5) * rx
    let py = y + (rnd() - 0.5) * ry
    c.beginPath()
    c.moveTo(px, py)
    for (let k = 0; k < 4; k++) {
      px += (rnd() - 0.5) * 40
      py += (rnd() - 0.5) * 30
      c.lineTo(px, py)
    }
    c.stroke()
  }
}

function snowman(c: Ctx, x: number, y: number, s = 1) {
  shadow(c, x + 8 * s, y + 10 * s, 26 * s, 20 * s, 0.15)
  c.fillStyle = '#ffffff'
  c.strokeStyle = '#c9d8e6'
  c.lineWidth = 2
  c.beginPath()
  c.arc(x, y + 6 * s, 20 * s, 0, Math.PI * 2)
  c.fill()
  c.stroke()
  c.beginPath()
  c.arc(x, y - 16 * s, 13 * s, 0, Math.PI * 2)
  c.fill()
  c.stroke()
  c.fillStyle = '#d9534f'
  c.fillRect(x - 13 * s, y - 6 * s, 26 * s, 5 * s)
  c.fillStyle = '#3a4a6a'
  c.beginPath()
  c.arc(x, y - 22 * s, 8 * s, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ff9f1c'
  c.beginPath()
  c.moveTo(x, y - 16 * s)
  c.lineTo(x + 9 * s, y - 14 * s)
  c.lineTo(x, y - 12 * s)
  c.fill()
}

function kamakura(c: Ctx, x: number, y: number) {
  shadow(c, x + 12, y + 14, 66, 56, 0.15)
  const g = c.createRadialGradient(x - 20, y - 20, 8, x, y, 64)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#d6e4f0')
  c.fillStyle = g
  c.beginPath()
  c.arc(x, y, 62, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#3a4a5a'
  c.beginPath()
  c.ellipse(x, y + 50, 22, 12, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ffd98f'
  c.beginPath()
  c.ellipse(x, y + 52, 10, 5, 0, 0, Math.PI * 2)
  c.fill()
}

function snowMound(c: Ctx, x: number, y: number, r: number) {
  shadow(c, x + r * 0.3, y + r * 0.35, r, r * 0.75, 0.12)
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(180,205,230,0.5)'
  c.beginPath()
  c.arc(x + r * 0.25, y + r * 0.25, r * 0.6, 0, Math.PI * 2)
  c.fill()
}

function sledHill(c: Ctx, x: number, y: number, rnd: () => number) {
  const g = c.createRadialGradient(x - 60, y - 40, 20, x, y, 230)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#d2e2ef')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(x, y, 230, 120, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(150,180,210,0.7)'
  c.lineWidth = 2.5
  for (let i = 0; i < 4; i++) {
    const off = (rnd() - 0.5) * 120
    c.beginPath()
    c.moveTo(x - 40 + off * 0.3, y - 60)
    c.quadraticCurveTo(x + off, y + 10, x + off * 1.4, y + 100)
    c.stroke()
  }
  // そり
  c.fillStyle = '#d9534f'
  c.beginPath()
  c.roundRect(x + 30, y + 30, 34, 18, 6)
  c.fill()
  c.fillStyle = '#3d8bff'
  c.beginPath()
  c.roundRect(x - 70, y + 50, 34, 18, 6)
  c.fill()
}

function bigLake(c: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number) {
  c.fillStyle = '#d9c99a'
  c.beginPath()
  c.ellipse(x, y, rx + 20, ry + 18, 0.05, 0, Math.PI * 2)
  c.fill()
  const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 20, x, y, Math.max(rx, ry))
  g.addColorStop(0, '#79cdef')
  g.addColorStop(1, '#2f8fc0')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0.05, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.4)'
  c.lineWidth = 3
  for (let i = 0; i < 18; i++) {
    const px = x + (rnd() - 0.5) * rx * 1.5
    const py = y + (rnd() - 0.5) * ry * 1.4
    c.beginPath()
    c.arc(px, py, 16, Math.PI * 1.15, Math.PI * 1.85)
    c.stroke()
  }
  // しま
  c.fillStyle = '#d9c99a'
  c.beginPath()
  c.ellipse(x + rx * 0.25, y - ry * 0.05, 78, 54, 0.3, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#8fd47c'
  c.beginPath()
  c.ellipse(x + rx * 0.25, y - ry * 0.05, 64, 42, 0.3, 0, Math.PI * 2)
  c.fill()
  tree(c, x + rx * 0.25 - 10, y - ry * 0.05 - 6, 30, '#ff9ec4', '#ffc4dc')
}

// ── みちと まわりの ものを かく（どの ステージも おなじ てじゅん） ─────────
function drawRoad(c: Ctx, t: Track, pal: Palette, rnd: () => number) {
  const path = () => {
    c.beginPath()
    c.moveTo(t.x[0], t.y[0])
    for (let i = 1; i < t.n; i++) c.lineTo(t.x[i], t.y[i])
    c.closePath()
  }
  c.lineJoin = 'round'
  c.lineCap = 'round'
  path()
  c.strokeStyle = pal.roadShadow
  c.lineWidth = ROAD_HALF * 2 + 28
  c.stroke()
  c.strokeStyle = pal.edge
  c.lineWidth = ROAD_HALF * 2 + 18
  c.stroke()
  c.strokeStyle = pal.road
  c.lineWidth = ROAD_HALF * 2
  c.stroke()
  c.strokeStyle = pal.road2
  c.lineWidth = ROAD_HALF * 1.2
  c.stroke()
  c.fillStyle = pal.stones
  for (let i = 0; i < t.n; i += 5) {
    for (const side of [-1, 1]) {
      const px = t.x[i] - t.ty[i] * side * (ROAD_HALF + 5)
      const py = t.y[i] + t.tx[i] * side * (ROAD_HALF + 5)
      c.beginPath()
      c.arc(px, py, 3.2, 0, Math.PI * 2)
      c.fill()
    }
  }
  c.fillStyle = pal.speck
  for (let i = 0; i < t.n; i += 2) {
    const lat = (rnd() - 0.5) * ROAD_HALF * 1.8
    c.fillRect(t.x[i] - t.ty[i] * lat, t.y[i] + t.tx[i] * lat, 2.5, 2.5)
  }
  for (let i = 0; i < t.n; i++) {
    if (Math.abs(t.curv[i]) < 0.0045) continue
    const side = t.curv[i] > 0 ? 1 : -1
    const px = t.x[i] - t.ty[i] * side * (ROAD_HALF + 3)
    const py = t.y[i] + t.tx[i] * side * (ROAD_HALF + 3)
    c.fillStyle = Math.floor(i / 4) % 2 ? pal.curb[0] : pal.curb[1]
    c.beginPath()
    c.arc(px, py, 5, 0, Math.PI * 2)
    c.fill()
  }
  // スタート／ゴール
  const p = trackPos(t, 0)
  c.save()
  c.translate(p.x, p.y)
  c.rotate(Math.atan2(p.ty, p.tx))
  const sq = 10
  for (let r = 0; r < 2; r++)
    for (let k = -ROAD_HALF; k < ROAD_HALF; k += sq) {
      c.fillStyle = (Math.floor(k / sq) + r) % 2 ? '#222' : '#fff'
      c.fillRect(-sq + r * sq, k, sq, sq)
    }
  c.restore()
  for (const side of [-1, 1]) {
    c.fillStyle = '#ff6b6b'
    c.beginPath()
    c.arc(p.x - p.ty * side * (ROAD_HALF + 22), p.y + p.tx * side * (ROAD_HALF + 22), 10, 0, Math.PI * 2)
    c.fill()
  }
  // わきの ベンチと がいとう
  for (let s = 150; s < t.L; s += 230) {
    const side = Math.floor(s / 230) % 2 ? 1 : -1
    const q = trackPos(t, s, side * (ROAD_HALF + 30))
    if (Math.floor(s / 230) % 3 === 0) bench(c, q.x, q.y, Math.atan2(q.ty, q.tx) + (side > 0 ? Math.PI : 0))
    else lamp(c, q.x, q.y)
  }
}

export function renderPark(stage: StageDef, t: Track, scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = Math.round(WORLD_W * scale)
  cv.height = Math.round(WORLD_H * scale)
  const c = cv.getContext('2d')!
  c.scale(scale, scale)
  const rnd = rng(20261004 + stage.id.length * 7919)
  const pal = stage.pal

  c.fillStyle = pal.grass
  c.fillRect(0, 0, WORLD_W, WORLD_H)
  c.fillStyle = pal.grass2
  for (let x = 0; x < WORLD_W; x += 160) c.fillRect(x, 0, 80, WORLD_H)
  c.fillStyle = pal.tuft
  for (let i = 0; i < 1600; i++) {
    const x = rnd() * WORLD_W
    const y = rnd() * WORLD_H
    c.fillRect(x, y, 2, 6)
    c.fillRect(x + 3, y + 1, 2, 5)
  }
  c.strokeStyle = pal.fence
  c.lineWidth = 10
  c.strokeRect(14, 14, WORLD_W - 28, WORLD_H - 28)

  stage.features(c, rnd)
  drawRoad(c, t, pal, rnd)

  // 木と しげみ（みちや ほかの ものに かさならない ところだけ）
  const placed: [number, number, number][] = []
  for (let tries = 0; tries < 3200 && placed.length < stage.treeCount; tries++) {
    const x = 40 + rnd() * (WORLD_W - 80)
    const y = 40 + rnd() * (WORLD_H - 80)
    const r = 22 + rnd() * 26
    if (distToRoad(t, x, y) < ROAD_HALF + 30 + r) continue
    if (stage.keepOut.some(([kx, ky, kr]) => Math.hypot(kx - x, ky - y) < kr + r * 0.6)) continue
    if (stage.keepOutRects?.some(([kx, ky, kw, kh]) => Math.abs(kx - x) < kw / 2 + r * 0.8 && Math.abs(ky - y) < kh / 2 + r * 0.8))
      continue
    if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < (pr + r) * 0.85)) continue
    placed.push([x, y, r])
  }
  placed.sort((a, b) => a[1] - b[1])
  for (const [x, y, r] of placed) {
    const st = stage.treeStyle
    if (st === 'snow') {
      if (r < 30) snowMound(c, x, y, r * 0.7)
      else pine(c, x, y, r, rnd, true)
    } else if (r < 30) bush(c, x, y, r * 0.8, rnd)
    else if (st === 'pine' || (st === 'mixed' && rnd() < 0.55)) pine(c, x, y, r, rnd)
    else if (st === 'cherry' && rnd() < 0.45) tree(c, x, y, r, '#ff9ec4', '#ffc4dc')
    else {
      const autumn = rnd() < 0.12
      tree(c, x, y, r, autumn ? '#e08a3c' : rnd() < 0.5 ? '#3f8f32' : '#4fa03c', autumn ? '#f2ad5c' : '#6fbf50')
    }
  }
  stage.extras?.(c, t, rnd)
  return cv
}

// ── 5つの ステージ ─────────────────────────────
const GREEN: Palette = {
  grass: '#8fd16a',
  grass2: '#86c962',
  tuft: 'rgba(70,140,50,0.35)',
  fence: '#b5884f',
  roadShadow: 'rgba(0,0,0,0.12)',
  edge: '#c8bca2',
  road: '#e6d3a1',
  road2: '#dcc690',
  stones: '#b4a888',
  speck: 'rgba(160,130,80,0.25)',
  curb: ['#ff5a5a', '#fff'],
}

export const STAGES: StageDef[] = [
  {
    id: 'hiroba',
    name: 'ひろばの こうえん',
    emoji: '⛲',
    desc: 'ふんすい・いけ・あそびばの ある こうえん',
    control: [
      [520, 1560], [1100, 1590], [1650, 1545], [2050, 1400], [2230, 1110], [2130, 830], [1840, 760], [1580, 900],
      [1310, 1060], [1030, 1010], [900, 790], [1050, 570], [1400, 525], [1760, 505], [2060, 410], [2140, 240],
      [1820, 160], [1300, 200], [800, 180], [420, 270], [215, 560], [300, 860], [560, 960], [440, 1170], [290, 1390],
    ],
    pal: GREEN,
    treeStyle: 'round',
    treeCount: 230,
    keepOut: [
      [1420, 715, 270], [610, 640, 160], [900, 1290, 105], [1190, 1270, 90], [1520, 1250, 110], [1830, 1260, 80],
      [1080, 360, 140], [1450, 350, 150], [1800, 330, 110], [1960, 1060, 100],
    ],
    features: (c, rnd) => {
      pond(c, 1420, 715, 250, 105, rnd)
      fountain(c, 610, 640)
      sandbox(c, 900, 1290)
      slide(c, 1190, 1240)
      swings(c, 1520, 1230)
      jungleGym(c, 1830, 1260)
      flowerBed(c, 1080, 360, 260, 90, ['#ff6b8b', '#ffd23f', '#fff'], rnd)
      flowerBed(c, 1450, 350, 280, 90, ['#c49eff', '#ff9ec4', '#ffd23f'], rnd)
      flowerBed(c, 1800, 330, 200, 70, ['#ff9f1c', '#fff', '#ff6b8b'], rnd)
      flowerBed(c, 1960, 1060, 120, 160, ['#ff6b8b', '#fff'], rnd)
    },
  },
  {
    id: 'mori',
    name: 'もりの こうえん',
    emoji: '🌲',
    desc: 'くねくね みちの ふかい もり。きのこが いっぱい',
    control: [
      [420, 1610], [900, 1630], [1300, 1520], [1500, 1270], [1310, 1070], [1020, 1110], [790, 1000], [810, 750],
      [1060, 640], [1360, 760], [1610, 900], [1860, 1040], [2110, 950], [2210, 700], [2060, 450], [1760, 380],
      [1500, 250], [1150, 180], [800, 250], [550, 180], [260, 300], [210, 600], [390, 800], [310, 1050],
      [200, 1300], [260, 1520],
    ],
    pal: {
      grass: '#6fae5c',
      grass2: '#68a656',
      tuft: 'rgba(40,90,30,0.35)',
      fence: '#7a5130',
      roadShadow: 'rgba(0,0,0,0.16)',
      edge: '#8f7f62',
      road: '#c9a877',
      road2: '#bf9d6c',
      stones: '#7a6a50',
      speck: 'rgba(110,80,40,0.3)',
      curb: ['#ffd23f', '#5a3a1a'],
    },
    treeStyle: 'mixed',
    treeCount: 330,
    keepOut: [
      [1060, 880, 170], [1720, 640, 150], [1900, 1350, 140], [600, 470, 90], [700, 1350, 120],
    ],
    features: (c, rnd) => {
      pond(c, 1060, 880, 130, 85, rnd)
      cabin(c, 1720, 620)
      campfire(c, 1600, 740)
      logPile(c, 1880, 760, 0.3)
      // きのこの わ
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        mushroom(c, 1900 + Math.cos(a) * 80, 1350 + Math.sin(a) * 60, 11 + rnd() * 5, i % 3 ? '#e8443a' : '#f2a23a')
      }
      stump(c, 1900, 1350, 26)
      for (const [x, y] of [[600, 470], [560, 520], [650, 430], [700, 1350], [760, 1400], [640, 1300]])
        mushroom(c, x, y, 10 + rnd() * 6)
      stump(c, 640, 1380, 22)
      stump(c, 1450, 1420, 20)
      logPile(c, 1180, 420, -0.2)
    },
  },
  {
    id: 'hana',
    name: 'はなばたけ こうえん',
    emoji: '🌷',
    desc: 'チューリップばたけを ジグザグに はしる',
    control: [
      [350, 1610], [1200, 1630], [2000, 1600], [2230, 1380], [2000, 1180], [1400, 1200], [900, 1150], [650, 950],
      [900, 780], [1500, 800], [2050, 760], [2230, 540], [2050, 320], [1500, 280], [900, 300], [450, 250],
      [230, 450], [220, 800], [240, 1150], [200, 1420],
    ],
    pal: {
      grass: '#a6dc7a',
      grass2: '#9dd472',
      tuft: 'rgba(80,150,60,0.3)',
      fence: '#ffffff',
      roadShadow: 'rgba(0,0,0,0.1)',
      edge: '#e8d8b8',
      road: '#f4e4bc',
      road2: '#eedaa8',
      stones: '#d4c098',
      speck: 'rgba(200,160,100,0.25)',
      curb: ['#ff7ac6', '#fff'],
    },
    treeStyle: 'cherry',
    treeCount: 150,
    keepOut: [[1720, 540, 130], [430, 700, 130], [440, 1150, 90], [900, 960, 80]],
    keepOutRects: [
      [1150, 1400, 820, 150],
      [1850, 1400, 150, 110],
      [1500, 990, 760, 130],
      [1150, 540, 700, 150],
    ],
    features: (c, rnd) => {
      tulipField(c, 1150, 1400, 820, 150, ['#ff5a6e', '#ffd23f', '#ff9ec4', '#fff'], rnd)
      greenhouse(c, 1850, 1400, 150, 110)
      tulipField(c, 1500, 990, 760, 130, ['#c49eff', '#ff7ac6', '#ffffff'], rnd)
      tulipField(c, 1150, 540, 700, 150, ['#ff9f1c', '#ff5a6e', '#ffd23f'], rnd)
      windmill(c, 1720, 540)
      windmill(c, 430, 700)
      for (const [x, y] of [[380, 1120], [440, 1170], [500, 1120]]) beehive(c, x, y)
      flowerBed(c, 900, 960, 120, 70, ['#ff6b8b', '#fff'], rnd)
    },
  },
  {
    id: 'mizuumi',
    name: 'みずうみの こうえん',
    emoji: '🦢',
    desc: 'おおきな みずうみを ぐるっと まわる',
    control: [
      [400, 1560], [1000, 1620], [1600, 1600], [2050, 1450], [2240, 1150], [2200, 800], [1950, 560], [1650, 330],
      [1400, 450], [1200, 620], [950, 470], [700, 300], [400, 280], [220, 520], [250, 850], [420, 1080], [300, 1330],
    ],
    pal: { ...GREEN, grass: '#92d67e', grass2: '#8acd76', road: '#eadcab', road2: '#e2d09a', curb: ['#3d8bff', '#fff'] },
    treeStyle: 'cherry',
    treeCount: 190,
    keepOut: [[1200, 1050, 540], [1900, 1250, 150], [600, 650, 140]],
    features: (c, rnd) => {
      bigLake(c, 1200, 1050, 480, 250, rnd)
      pier(c, 1640, 1180, 130, 0.25)
      swanBoat(c, 1000, 980, 0.4)
      swanBoat(c, 1350, 1200, -2.6)
      swanBoat(c, 880, 1150, 2.2)
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * (0.6 + i * 0.09)
        reeds(c, 1200 + Math.cos(a) * 500, 1050 + Math.sin(a) * 268, rnd)
      }
      // すなはま
      c.fillStyle = '#f2dfa8'
      c.beginPath()
      c.ellipse(1900, 1250, 150, 110, 0.2, 0, Math.PI * 2)
      c.fill()
      parasol(c, 1860, 1220, '#ff6b6b')
      parasol(c, 1950, 1290, '#3d8bff')
      fountain(c, 600, 650)
    },
  },
  {
    id: 'yuki',
    name: 'ゆきの こうえん',
    emoji: '⛄',
    desc: 'まっしろな ゆきの こうえん。ゆきだるまも いるよ',
    control: [
      [450, 1580], [1300, 1610], [2000, 1540], [2230, 1280], [2100, 1020], [1750, 950], [1550, 750], [1700, 500],
      [2050, 420], [2150, 230], [1750, 170], [1300, 250], [900, 180], [450, 220], [230, 480], [400, 750],
      [750, 820], [900, 1080], [650, 1300], [300, 1360],
    ],
    pal: {
      grass: '#f3f7fb',
      grass2: '#ebf2f8',
      tuft: 'rgba(160,190,220,0.35)',
      fence: '#8a6a4a',
      roadShadow: 'rgba(60,90,120,0.14)',
      edge: '#a9bccd',
      road: '#d4e0ea',
      road2: '#cbd8e4',
      stones: '#8fa4b8',
      speck: 'rgba(120,150,180,0.3)',
      curb: ['#ff7a3c', '#fff'],
    },
    treeStyle: 'snow',
    treeCount: 210,
    keepOut: [[1200, 760, 260], [1350, 1320, 280], [1900, 1300, 110], [600, 520, 120]],
    features: (c, rnd) => {
      frozenPond(c, 1200, 760, 210, 150, rnd)
      sledHill(c, 1350, 1320, rnd)
    },
    extras: (c) => {
      for (const [x, y, s] of [[930, 590, 1], [1440, 1000, 0.9], [1900, 1300, 1.2], [560, 520, 1], [640, 560, 0.8]])
        snowman(c, x, y, s)
      kamakura(c, 1800, 1290)
    },
  },
]

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0]

const trackCache = new Map<string, Track>()
export function stageTrack(id: string): Track {
  let t = trackCache.get(id)
  if (!t) {
    t = buildTrack(stageById(id).control)
    trackCache.set(id, t)
  }
  return t
}

const parkCache = new Map<string, HTMLCanvasElement>()
export function stagePark(id: string, scale: number): HTMLCanvasElement {
  const key = `${id}@${Math.round(scale * 4) / 4}`
  let cv = parkCache.get(key)
  if (!cv) {
    cv = renderPark(stageById(id), stageTrack(id), Math.round(scale * 4) / 4)
    parkCache.set(key, cv)
  }
  return cv
}

// えらぶ がめん用の ちいさな え（dataURL）
const thumbCache = new Map<string, string>()
export function stageThumb(id: string): string {
  let u = thumbCache.get(id)
  if (!u) {
    u = renderPark(stageById(id), stageTrack(id), 0.1).toDataURL('image/jpeg', 0.8)
    thumbCache.set(id, u)
  }
  return u
}
