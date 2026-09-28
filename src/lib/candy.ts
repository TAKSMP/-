// =============================================================
//  あめ（キャンディ）：あるけるマップに いつも5個 おちている
// -------------------------------------------------------------
//  ひろうと、すきな虫の レベルを けいけんちなしで 1つ あげられる。
//  ひろった ばしょには、べつの ばしょに あたらしい あめが 出る。
//  ばしょは マップの id ごとに localStorage に ほぞん（次に 開いても おなじ）。
// =============================================================
import type { WorldMapData } from '../fields/world/viewer'
import { isRoad } from '../fields/world/navigation'

export interface CandySpot {
  id: string
  x: number
  y: number
}

export const CANDY_COUNT = 5
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

// 保存ずみの あめを 読みこむ。無ければ 5個 あたらしく つくる。
export function loadCandy(fieldId: string, map: WorldMapData, mask: Uint8Array): CandySpot[] {
  try {
    const raw = localStorage.getItem(keyFor(fieldId))
    if (raw) {
      const parsed = JSON.parse(raw) as CandySpot[]
      if (Array.isArray(parsed) && parsed.length === CANDY_COUNT) return parsed
    }
  } catch {
    // こわれていたら 下で 作り直す
  }
  const spots = Array.from({ length: CANDY_COUNT }, () => ({
    id: makeId(),
    ...randomRoadPoint(map, mask),
  }))
  saveCandy(fieldId, spots)
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
    s.id === pickedId ? { id: makeId(), ...randomRoadPoint(map, mask) } : s,
  )
  saveCandy(fieldId, next)
  return next
}
