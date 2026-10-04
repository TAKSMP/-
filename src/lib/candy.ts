// =============================================================
//  あめ（キャンディ）：あるけるマップに いつも5個 おちている
// -------------------------------------------------------------
//  ひろうと、すきな虫の レベルを けいけんちなしで 1つ あげられる。
//  それとは べつに「ちょうちょアメ」が いつも 1個 おちていて、ひろうと 20びょう そらを とべる。
//  ひろった ばしょには、べつの ばしょに おなじ しゅるいの あたらしい あめが 出る。
//  ばしょは マップの id ごとに localStorage に ほぞん（次に 開いても おなじ）。
// =============================================================
import type { WorldMapData } from '../fields/world/viewer'
import { isRoad } from '../fields/world/navigation'

export type CandyKind = 'normal' | 'butterfly'

export interface CandySpot {
  id: string
  x: number
  y: number
  kind?: CandyKind // ふるい ほぞんデータには ない（＝ふつうの あめ）
}

export const CANDY_COUNT = 5 // ふつうの あめ
export const BUTTERFLY_CANDY_COUNT = 1 // ちょうちょアメ
export const BUTTERFLY_FLY_SEC = 20 // ちょうちょアメで そらを とべる じかん
// プレイヤーの あしもとから これより ちかいと ひろえる（元画像の ピクセル）
export const CANDY_PICKUP_RADIUS = 16

// 引き継ぎバックアップが localStorage を まとめて さがす ときに つかう プレフィックス
export const CANDY_KEY_PREFIX = 'chomushi.candy.v1.'

function keyFor(fieldId: string): string {
  return `${CANDY_KEY_PREFIX}${fieldId}`
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// 道路の うえの てきとうな1点を えらぶ（当たるまで ためす→ダメなら 全部さがす）
function randomRoadPoint(map: WorldMapData, mask: Uint8Array): { x: number; y: number } {
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(Math.random() * map.width)
    const y = Math.floor(Math.random() * map.height)
    if (isRoad(map, mask, x, y)) return { x: x + 0.5, y: y + 0.5 }
  }
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) return { x: (i % map.width) + 0.5, y: Math.floor(i / map.width) + 0.5 }
  }
  return { x: map.width / 2, y: map.height / 2 }
}

function saveCandy(fieldId: string, spots: CandySpot[]): void {
  try {
    localStorage.setItem(keyFor(fieldId), JSON.stringify(spots))
  } catch {
    // 容量オーバー等は 無視（次に開いた ときに 作り直す）
  }
}

export const isButterfly = (c: CandySpot): boolean => c.kind === 'butterfly'

function newSpot(kind: CandyKind, map: WorldMapData, mask: Uint8Array): CandySpot {
  return { id: makeId(), ...randomRoadPoint(map, mask), kind }
}

// 保存ずみの あめを 読みこむ。たりない ぶん（ふつう 5個・ちょうちょ 1個）は あたらしく つくる。
// ふるい ほぞん（ふつうの あめ 5個だけ）には ちょうちょアメを 1個 たす。
export function loadCandy(fieldId: string, map: WorldMapData, mask: Uint8Array): CandySpot[] {
  let saved: CandySpot[] = []
  try {
    const raw = localStorage.getItem(keyFor(fieldId))
    const parsed = raw ? (JSON.parse(raw) as CandySpot[]) : []
    if (Array.isArray(parsed)) saved = parsed
  } catch {
    // こわれていたら 下で 作り直す
  }
  const normals = saved.filter((c) => !isButterfly(c)).slice(0, CANDY_COUNT)
  const flies = saved.filter(isButterfly).slice(0, BUTTERFLY_CANDY_COUNT)
  while (normals.length < CANDY_COUNT) normals.push(newSpot('normal', map, mask))
  while (flies.length < BUTTERFLY_CANDY_COUNT) flies.push(newSpot('butterfly', map, mask))
  const spots = [...normals, ...flies]
  if (spots.length !== saved.length || spots.some((c, i) => c.id !== saved[i]?.id)) saveCandy(fieldId, spots)
  return spots
}

// ひろった あめを、べつの ばしょの あたらしい あめに 入れかえる
export function respawnCandy(
  fieldId: string,
  spots: CandySpot[],
  pickedId: string,
  map: WorldMapData,
  mask: Uint8Array,
): CandySpot[] {
  const next = spots.map((s) =>
    s.id === pickedId ? newSpot(isButterfly(s) ? 'butterfly' : 'normal', map, mask) : s,
  )
  saveCandy(fieldId, next)
  return next
}
