// =============================================================
//  ちょうちょちゃんビル：あるけるマップの たてものが 1つだけ ひかっている
// -------------------------------------------------------------
//  さわると「ちょうちょちゃんビルに たどりついた！」→ レベルを 3かい あげられる。
//  たどりついたら、べつの たてものに うつる。
//  たてものの かたちは 区画画像から ぬきだした buildings.json（MAP/tsuruse-buildings/extract.py）。
//  ぜんぶ 道の すぐ そばの たてもの なので、とばなくても あるいて たどりつける。
//  いまの ビルは マップごとに localStorage に ほぞん（つぎに 開いても おなじ）。
// =============================================================

export interface BuildingShape {
  x: number // かたちの 左上（元画像の ピクセル）
  y: number
  w: number
  h: number
  runs: [number, number, number][] // [行, 左はし, ながさ]（左上からの そうたい）
}

interface BuildingFile {
  version: number
  touch: number
  buildings: BuildingShape[]
}

// プレイヤーの いちから これより ちかいと「さわった」（元画像の ピクセル）
export const BUILDING_TOUCH_RADIUS = 10

const KEY_PREFIX = 'chomushi.chouchoubiru.v1.'

// buildings.json が ない マップでは null（ビルは 出ない）
export async function loadBuildings(url: string, signal: AbortSignal): Promise<BuildingShape[] | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as BuildingFile
    return Array.isArray(data.buildings) && data.buildings.length > 0 ? data.buildings : null
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    return null
  }
}

function saveIndex(fieldId: string, index: number): void {
  try {
    localStorage.setItem(KEY_PREFIX + fieldId, String(index))
  } catch {
    // ほぞん できなくても その ばでは つかえる
  }
}

// いま ひかっている ビル（ほぞん が なければ ランダムに きめる）
export function currentBuildingIndex(fieldId: string, count: number): number {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + fieldId)
    const n = raw === null ? NaN : Number(raw)
    if (Number.isInteger(n) && n >= 0 && n < count) return n
  } catch {
    // こわれていたら きめなおす
  }
  const n = Math.floor(Math.random() * count)
  saveIndex(fieldId, n)
  return n
}

// たどりついたら べつの ビルへ（おなじ ばしょには しない）
export function nextBuildingIndex(fieldId: string, count: number, prev: number): number {
  let n = Math.floor(Math.random() * count)
  if (count > 1 && n === prev) n = (n + 1 + Math.floor(Math.random() * (count - 1))) % count
  saveIndex(fieldId, n)
  return n
}

// (x, y) から r いないに たてものの ピクセルが あるか
export function touchesBuilding(b: BuildingShape, x: number, y: number, r: number): boolean {
  if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) return false
  for (const [row, start, len] of b.runs) {
    const py = b.y + row + 0.5
    const dy = py - y
    if (Math.abs(dy) > r) continue
    const left = b.x + start
    const right = left + len
    const dx = x < left ? left - x : x > right ? x - right : 0
    if (dx * dx + dy * dy <= r * r) return true
  }
  return false
}

// ひからせる ための かたちの 絵（1かい つくって まいフレーム ひきのばして つかう）
export function buildingMaskCanvas(b: BuildingShape, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = b.w
  c.height = b.h
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = color
    for (const [row, start, len] of b.runs) ctx.fillRect(start, row, len, 1)
  }
  return c
}
