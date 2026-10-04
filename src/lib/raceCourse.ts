// =============================================================
//  レースの コース（こうえんの なかを ぐるっと 1しゅう）
// -------------------------------------------------------------
//  ・とおる てん（CONTROL）を なめらかな 線で つないで みちに する
//  ・みちは 4ずつ くぎった てんの ならびで もつ（すすんだ きょり → ばしょ が すぐ わかる）
//  ・こうえんの 絵（いけ・ふんすい・あそびば・はなばたけ・木）は 1かいだけ かいて つかいまわす
//  画像ファイルは つかわず、ぜんぶ canvas で えがく（オフラインでも 出る）。
// =============================================================

export const WORLD_W = 2400
export const WORLD_H = 1800
export const ROAD_HALF = 60 // みちの はば の はんぶん
export const LANE_LIMIT = 45 // 虫が はしれる よこはば（まんなかから）
const STEP = 4

// コースの とおる てん（とけいまわり）。スタートは さいしょの てんの すこし さき
const CONTROL: [number, number][] = [
  [520, 1560],
  [1100, 1590],
  [1650, 1545],
  [2050, 1400],
  [2230, 1110],
  [2130, 830],
  [1840, 760],
  [1580, 900],
  [1310, 1060],
  [1030, 1010],
  [900, 790],
  [1050, 570],
  [1400, 525],
  [1760, 505],
  [2060, 410],
  [2140, 240],
  [1820, 160],
  [1300, 200],
  [800, 180],
  [420, 270],
  [215, 560],
  [300, 860],
  [560, 960],
  [440, 1170],
  [290, 1390],
]

export interface Track {
  L: number // 1しゅうの ながさ
  n: number
  x: Float32Array
  y: Float32Array
  tx: Float32Array // すすむ むき
  ty: Float32Array
  curv: Float32Array // まがりぐあい（＋で みぎまがり）
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export function buildTrack(): Track {
  // ① なめらかな 線を こまかく とる
  const raw: [number, number][] = []
  const m = CONTROL.length
  for (let i = 0; i < m; i++) {
    const p0 = CONTROL[(i - 1 + m) % m]
    const p1 = CONTROL[i]
    const p2 = CONTROL[(i + 1) % m]
    const p3 = CONTROL[(i + 2) % m]
    for (let k = 0; k < 60; k++) {
      const t = k / 60
      raw.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  // ② きょりを はかって、STEP ごとに とりなおす
  const cum = [0]
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1]
    const b = raw[i % raw.length]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const L = cum[cum.length - 1]
  const n = Math.floor(L / STEP)
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    const d = i * STEP
    while (cum[j + 1] < d) j++
    const a = raw[j]
    const b = raw[(j + 1) % raw.length]
    const f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1)
    x[i] = a[0] + (b[0] - a[0]) * f
    y[i] = a[1] + (b[1] - a[1]) * f
  }
  // ③ むきと まがりぐあい
  const tx = new Float32Array(n)
  const ty = new Float32Array(n)
  const ang = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = (i - 2 + n) % n
    const b = (i + 2) % n
    const dx = x[b] - x[a]
    const dy = y[b] - y[a]
    const len = Math.hypot(dx, dy) || 1
    tx[i] = dx / len
    ty[i] = dy / len
    ang[i] = Math.atan2(dy, dx)
  }
  const curv = new Float32Array(n)
  const W = 8 // ±32 の はんいで ならす
  for (let i = 0; i < n; i++) {
    let da = ang[(i + W) % n] - ang[(i - W + n) % n]
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    curv[i] = da / (STEP * W * 2)
  }
  return { L: n * STEP, n, x, y, tx, ty, curv }
}

export const wrapS = (t: Track, s: number) => ((s % t.L) + t.L) % t.L

// コースの きょり s・よこずれ lat → せかいの ざひょう
export function trackPos(t: Track, s: number, lat = 0) {
  const u = wrapS(t, s) / STEP
  const i = Math.floor(u) % t.n
  const k = (i + 1) % t.n
  const f = u - Math.floor(u)
  const tx = t.tx[i] + (t.tx[k] - t.tx[i]) * f
  const ty = t.ty[i] + (t.ty[k] - t.ty[i]) * f
  const len = Math.hypot(tx, ty) || 1
  const ux = tx / len
  const uy = ty / len
  // よこ（すすむ むきの みぎ がわが ＋）
  return {
    x: t.x[i] + (t.x[k] - t.x[i]) * f - uy * lat,
    y: t.y[i] + (t.y[k] - t.y[i]) * f + ux * lat,
    tx: ux,
    ty: uy,
    curv: t.curv[i],
  }
}

export function curvAt(t: Track, s: number): number {
  return t.curv[Math.floor(wrapS(t, s) / STEP) % t.n]
}

// いちばん ちかい みちまでの きょり（こうえんの ものを みちに かさねない ため）
function distToRoad(t: Track, px: number, py: number): number {
  let best = Infinity
  for (let i = 0; i < t.n; i += 3) {
    const d = (t.x[i] - px) ** 2 + (t.y[i] - py) ** 2
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// -------------------------------------------------------------
//  こうえんの 絵
// -------------------------------------------------------------
type Ctx = CanvasRenderingContext2D

function tree(c: Ctx, x: number, y: number, r: number, leaf: string, leafHi: string) {
  c.fillStyle = 'rgba(30,60,20,0.22)'
  c.beginPath()
  c.ellipse(x + r * 0.35, y + r * 0.4, r * 1.05, r * 0.9, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = leaf
  for (const [dx, dy, rr] of [
    [0, 0, 1],
    [-0.55, 0.2, 0.7],
    [0.55, 0.15, 0.72],
    [0.1, -0.5, 0.7],
    [0.05, 0.55, 0.66],
  ]) {
    c.beginPath()
    c.arc(x + dx * r, y + dy * r, r * rr, 0, Math.PI * 2)
    c.fill()
  }
  c.fillStyle = leafHi
  c.beginPath()
  c.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, Math.PI * 2)
  c.fill()
}

function bush(c: Ctx, x: number, y: number, r: number, rnd: () => number) {
  c.fillStyle = 'rgba(30,60,20,0.18)'
  c.beginPath()
  c.ellipse(x + 4, y + 5, r * 1.3, r * 0.8, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#4f9a3c'
  for (let i = 0; i < 4; i++) {
    c.beginPath()
    c.arc(x + (rnd() - 0.5) * r * 1.4, y + (rnd() - 0.5) * r * 0.8, r * (0.55 + rnd() * 0.3), 0, Math.PI * 2)
    c.fill()
  }
  if (rnd() < 0.5) {
    c.fillStyle = ['#ff9ec4', '#fff', '#ffd23f'][Math.floor(rnd() * 3)]
    for (let i = 0; i < 5; i++) {
      c.beginPath()
      c.arc(x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r, 2.6, 0, Math.PI * 2)
      c.fill()
    }
  }
}

function pond(c: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number) {
  c.fillStyle = '#c9b98a'
  c.beginPath()
  c.ellipse(x, y, rx + 14, ry + 12, 0.1, 0, Math.PI * 2)
  c.fill()
  const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 10, x, y, Math.max(rx, ry))
  g.addColorStop(0, '#7fd0ef')
  g.addColorStop(1, '#3d9cc8')
  c.fillStyle = g
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0.1, 0, Math.PI * 2)
  c.fill()
  // さざなみ
  c.strokeStyle = 'rgba(255,255,255,0.45)'
  c.lineWidth = 3
  for (let i = 0; i < 9; i++) {
    const px = x + (rnd() - 0.5) * rx * 1.3
    const py = y + (rnd() - 0.5) * ry * 1.2
    c.beginPath()
    c.arc(px, py, 14, Math.PI * 1.15, Math.PI * 1.85)
    c.stroke()
  }
  // はすの は
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2
    const px = x + Math.cos(a) * rx * (0.55 + rnd() * 0.3)
    const py = y + Math.sin(a) * ry * (0.55 + rnd() * 0.3)
    c.fillStyle = '#5fb54a'
    c.beginPath()
    c.moveTo(px, py)
    c.arc(px, py, 13, a + 0.4, a + Math.PI * 2 - 0.2)
    c.closePath()
    c.fill()
    if (i % 3 === 0) {
      c.fillStyle = '#ffb3d1'
      c.beginPath()
      c.arc(px + 3, py - 3, 5, 0, Math.PI * 2)
      c.fill()
    }
  }
  // アヒル
  for (const [dx, dy] of [
    [-0.3, 0.1],
    [-0.18, 0.2],
  ]) {
    const px = x + dx * rx
    const py = y + dy * ry
    c.fillStyle = '#fff'
    c.beginPath()
    c.ellipse(px, py, 13, 9, 0, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.arc(px + 10, py - 6, 6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#ff9f1c'
    c.beginPath()
    c.moveTo(px + 15, py - 7)
    c.lineTo(px + 22, py - 5)
    c.lineTo(px + 15, py - 3)
    c.fill()
  }
}

function fountain(c: Ctx, x: number, y: number) {
  // しきいし の ひろば
  c.fillStyle = '#e9dfc9'
  c.beginPath()
  c.arc(x, y, 150, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#d4c6a6'
  c.lineWidth = 2
  for (let r = 40; r < 150; r += 26) {
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    c.beginPath()
    c.moveTo(x + Math.cos(a) * 60, y + Math.sin(a) * 60)
    c.lineTo(x + Math.cos(a) * 150, y + Math.sin(a) * 150)
    c.stroke()
  }
  c.fillStyle = '#b8b1a3'
  c.beginPath()
  c.arc(x, y, 70, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#62bde6'
  c.beginPath()
  c.arc(x, y, 60, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#b8b1a3'
  c.beginPath()
  c.arc(x, y, 18, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(255,255,255,0.85)'
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    c.beginPath()
    c.arc(x + Math.cos(a) * 34, y + Math.sin(a) * 34, 6, 0, Math.PI * 2)
    c.fill()
  }
  c.beginPath()
  c.arc(x, y, 9, 0, Math.PI * 2)
  c.fill()
  // ベンチ
  for (const a of [0.4, 2.0, 3.6, 5.2]) bench(c, x + Math.cos(a) * 125, y + Math.sin(a) * 125, a + Math.PI / 2)
}

function bench(c: Ctx, x: number, y: number, rot: number) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.fillStyle = 'rgba(0,0,0,0.18)'
  c.fillRect(-20, -6, 44, 16)
  c.fillStyle = '#a0683a'
  c.fillRect(-22, -9, 44, 6)
  c.fillRect(-22, -1, 44, 6)
  c.fillStyle = '#5a5a5a'
  c.fillRect(-20, -10, 4, 17)
  c.fillRect(16, -10, 4, 17)
  c.restore()
}

function sandbox(c: Ctx, x: number, y: number) {
  c.fillStyle = '#b0773f'
  c.fillRect(x - 85, y - 60, 170, 120)
  c.fillStyle = '#f2dc9a'
  c.fillRect(x - 75, y - 50, 150, 100)
  c.fillStyle = '#e3c87a'
  c.beginPath()
  c.ellipse(x + 20, y + 5, 34, 22, 0, 0, Math.PI * 2)
  c.fill()
  // バケツと スコップ
  c.fillStyle = '#ff6b6b'
  c.beginPath()
  c.arc(x - 35, y - 15, 11, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#3d8bff'
  c.fillRect(x + 40, y - 30, 6, 24)
  c.fillRect(x + 36, y - 34, 14, 8)
}

function slide(c: Ctx, x: number, y: number) {
  c.save()
  c.translate(x, y)
  c.fillStyle = 'rgba(0,0,0,0.18)'
  c.fillRect(-26, -40, 60, 150)
  // かいだん
  c.fillStyle = '#8f9aa6'
  c.fillRect(-24, -60, 48, 50)
  c.fillStyle = '#cfd6dd'
  for (let i = 0; i < 5; i++) c.fillRect(-20, -56 + i * 10, 40, 4)
  // うえの だい
  c.fillStyle = '#ff9f1c'
  c.fillRect(-28, -14, 56, 34)
  // すべる ところ
  const g = c.createLinearGradient(0, 20, 0, 120)
  g.addColorStop(0, '#ffd23f')
  g.addColorStop(1, '#ffb703')
  c.fillStyle = g
  c.fillRect(-18, 20, 36, 100)
  c.fillStyle = '#ff6b6b'
  c.fillRect(-22, 20, 4, 100)
  c.fillRect(18, 20, 4, 100)
  c.restore()
}

function swings(c: Ctx, x: number, y: number) {
  c.fillStyle = 'rgba(0,0,0,0.15)'
  c.fillRect(x - 86, y - 10, 180, 30)
  c.fillStyle = '#d9534f'
  c.fillRect(x - 90, y - 6, 180, 10)
  c.fillStyle = '#7a4f2a'
  c.fillRect(x - 96, y - 14, 12, 26)
  c.fillRect(x + 84, y - 14, 12, 26)
  for (const dx of [-45, 0, 45]) {
    c.strokeStyle = '#777'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(x + dx - 10, y)
    c.lineTo(x + dx - 10, y + 34)
    c.moveTo(x + dx + 10, y)
    c.lineTo(x + dx + 10, y + 34)
    c.stroke()
    c.fillStyle = '#3d8bff'
    c.fillRect(x + dx - 14, y + 32, 28, 9)
  }
  // ふまれて はげた ところ
  c.fillStyle = 'rgba(190,160,100,0.55)'
  for (const dx of [-45, 0, 45]) {
    c.beginPath()
    c.ellipse(x + dx, y + 60, 16, 10, 0, 0, Math.PI * 2)
    c.fill()
  }
}

function jungleGym(c: Ctx, x: number, y: number) {
  c.fillStyle = 'rgba(0,0,0,0.15)'
  c.fillRect(x - 52, y - 46, 112, 104)
  c.strokeStyle = '#2f9e6e'
  c.lineWidth = 5
  for (let i = 0; i <= 4; i++) {
    c.beginPath()
    c.moveTo(x - 55 + i * 27.5, y - 55)
    c.lineTo(x - 55 + i * 27.5, y + 55)
    c.stroke()
    c.beginPath()
    c.moveTo(x - 55, y - 55 + i * 27.5)
    c.lineTo(x + 55, y - 55 + i * 27.5)
    c.stroke()
  }
  c.fillStyle = '#ffd23f'
  for (let i = 0; i <= 4; i++)
    for (let k = 0; k <= 4; k++) {
      c.beginPath()
      c.arc(x - 55 + i * 27.5, y - 55 + k * 27.5, 4, 0, Math.PI * 2)
      c.fill()
    }
}

function flowerBed(c: Ctx, x: number, y: number, w: number, h: number, colors: string[], rnd: () => number) {
  c.fillStyle = '#9b6b43'
  c.beginPath()
  c.roundRect(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12, 16)
  c.fill()
  c.fillStyle = '#6e4a2c'
  c.beginPath()
  c.roundRect(x - w / 2, y - h / 2, w, h, 12)
  c.fill()
  const rows = Math.max(2, Math.round(h / 26))
  for (let r = 0; r < rows; r++) {
    const col = colors[r % colors.length]
    const py = y - h / 2 + (r + 0.5) * (h / rows)
    for (let px = x - w / 2 + 12; px < x + w / 2 - 8; px += 20) {
      const jx = px + (rnd() - 0.5) * 6
      const jy = py + (rnd() - 0.5) * 6
      c.fillStyle = '#4f9a3c'
      c.beginPath()
      c.arc(jx, jy, 8, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = col
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        c.beginPath()
        c.arc(jx + Math.cos(a) * 4.5, jy + Math.sin(a) * 4.5, 3.6, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = '#ffe36e'
      c.beginPath()
      c.arc(jx, jy, 2.4, 0, Math.PI * 2)
      c.fill()
    }
  }
}

function lamp(c: Ctx, x: number, y: number) {
  c.fillStyle = 'rgba(0,0,0,0.2)'
  c.beginPath()
  c.ellipse(x + 6, y + 6, 8, 5, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#3d4450'
  c.beginPath()
  c.arc(x, y, 6, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#fff3b0'
  c.beginPath()
  c.arc(x, y, 3.5, 0, Math.PI * 2)
  c.fill()
}

// こうえん ぜんたいを 1まいの canvas に かく（scale で こまかさを えらぶ）
export function renderPark(t: Track, scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = Math.round(WORLD_W * scale)
  cv.height = Math.round(WORLD_H * scale)
  const c = cv.getContext('2d')!
  c.scale(scale, scale)
  const rnd = rng(20261004)

  // しばふ（かりこんだ しまもよう）
  c.fillStyle = '#8fd16a'
  c.fillRect(0, 0, WORLD_W, WORLD_H)
  c.fillStyle = '#86c962'
  for (let x = 0; x < WORLD_W; x += 160) c.fillRect(x, 0, 80, WORLD_H)
  c.fillStyle = 'rgba(70,140,50,0.35)'
  for (let i = 0; i < 1600; i++) {
    const x = rnd() * WORLD_W
    const y = rnd() * WORLD_H
    c.fillRect(x, y, 2, 6)
    c.fillRect(x + 3, y + 1, 2, 5)
  }
  // そとがわの さく
  c.strokeStyle = '#b5884f'
  c.lineWidth = 10
  c.strokeRect(14, 14, WORLD_W - 28, WORLD_H - 28)

  // おおきな もの（みちの うちがわに おく）
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

  // みち（ふちいし → つち → まんなかの うすい すじ）
  const path = () => {
    c.beginPath()
    c.moveTo(t.x[0], t.y[0])
    for (let i = 1; i < t.n; i++) c.lineTo(t.x[i], t.y[i])
    c.closePath()
  }
  c.lineJoin = 'round'
  c.lineCap = 'round'
  path()
  c.strokeStyle = 'rgba(0,0,0,0.12)'
  c.lineWidth = ROAD_HALF * 2 + 28
  c.stroke()
  c.strokeStyle = '#c8bca2'
  c.lineWidth = ROAD_HALF * 2 + 18
  c.stroke()
  c.strokeStyle = '#e6d3a1'
  c.lineWidth = ROAD_HALF * 2
  c.stroke()
  c.strokeStyle = '#dcc690'
  c.lineWidth = ROAD_HALF * 1.2
  c.stroke()
  // ふちいし の つぶつぶ
  c.fillStyle = '#b4a888'
  for (let i = 0; i < t.n; i += 5) {
    for (const side of [-1, 1]) {
      const px = t.x[i] - t.ty[i] * side * (ROAD_HALF + 5)
      const py = t.y[i] + t.tx[i] * side * (ROAD_HALF + 5)
      c.beginPath()
      c.arc(px, py, 3.2, 0, Math.PI * 2)
      c.fill()
    }
  }
  // すなの こまかい もよう
  c.fillStyle = 'rgba(160,130,80,0.25)'
  for (let i = 0; i < t.n; i += 2) {
    const lat = (rnd() - 0.5) * ROAD_HALF * 1.8
    c.fillRect(t.x[i] - t.ty[i] * lat, t.y[i] + t.tx[i] * lat, 2.5, 2.5)
  }
  // まがりかどの しるし（あか しろの ふち）
  for (let i = 0; i < t.n; i++) {
    if (Math.abs(t.curv[i]) < 0.0045) continue
    const side = t.curv[i] > 0 ? 1 : -1
    const px = t.x[i] - t.ty[i] * side * (ROAD_HALF + 3)
    const py = t.y[i] + t.tx[i] * side * (ROAD_HALF + 3)
    c.fillStyle = Math.floor(i / 4) % 2 ? '#ff5a5a' : '#fff'
    c.beginPath()
    c.arc(px, py, 5, 0, Math.PI * 2)
    c.fill()
  }
  // スタート／ゴールの チェッカー
  {
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
    // ゲート
    for (const side of [-1, 1]) {
      const gx = p.x - p.ty * side * (ROAD_HALF + 22)
      const gy = p.y + p.tx * side * (ROAD_HALF + 22)
      c.fillStyle = '#ff6b6b'
      c.beginPath()
      c.arc(gx, gy, 10, 0, Math.PI * 2)
      c.fill()
    }
  }

  // みちの わきの ベンチと がいとう
  for (let s = 150; s < t.L; s += 230) {
    const side = Math.floor(s / 230) % 2 ? 1 : -1
    const p = trackPos(t, s, side * (ROAD_HALF + 30))
    if (Math.floor(s / 230) % 3 === 0) bench(c, p.x, p.y, Math.atan2(p.ty, p.tx) + (side > 0 ? Math.PI : 0))
    else lamp(c, p.x, p.y)
  }

  // 木と しげみ（みちや ほかの ものに かさならない ところだけ）
  const keepOut: [number, number, number][] = [
    [1420, 715, 270],
    [610, 640, 160],
    [900, 1290, 105],
    [1190, 1270, 90],
    [1520, 1250, 110],
    [1830, 1260, 80],
    [1080, 360, 140],
    [1450, 350, 150],
    [1800, 330, 110],
    [1960, 1060, 100],
  ]
  const placed: [number, number, number][] = []
  for (let tries = 0; tries < 2600 && placed.length < 230; tries++) {
    const x = 40 + rnd() * (WORLD_W - 80)
    const y = 40 + rnd() * (WORLD_H - 80)
    const r = 22 + rnd() * 26
    if (distToRoad(t, x, y) < ROAD_HALF + 30 + r) continue
    if (keepOut.some(([kx, ky, kr]) => Math.hypot(kx - x, ky - y) < kr + r * 0.6)) continue
    if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < (pr + r) * 0.85)) continue
    placed.push([x, y, r])
  }
  placed.sort((a, b) => a[1] - b[1])
  for (const [x, y, r] of placed) {
    if (r < 30) bush(c, x, y, r * 0.8, rnd)
    else {
      const autumn = rnd() < 0.12
      tree(c, x, y, r, autumn ? '#e08a3c' : rnd() < 0.5 ? '#3f8f32' : '#4fa03c', autumn ? '#f2ad5c' : '#6fbf50')
    }
  }
  return cv
}
