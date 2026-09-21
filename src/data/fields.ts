// =============================================================
//  あるける マップ（フィールド）の いちらん
// -------------------------------------------------------------
//  絵と あたり判定は public/fields/<id>/ に おいてある。
//  あたらしい マップを ふやす ときは、ここに 1行 たすだけ。
// =============================================================
export interface FieldDef {
  id: string
  name: string // がめんに 出す 名前
  base: string // public からの ばしょ
  place: string // ひもづく「みつけたばしょ」
}

export const FIELDS: FieldDef[] = [
  {
    id: 'yuyuu',
    name: 'ゆうゆうの丘公園',
    base: 'fields/yuyuu/',
    place: 'ゆうゆうの丘公園',
  },
]

export function fieldById(id: string): FieldDef | undefined {
  return FIELDS.find((f) => f.id === id)
}

// その「みつけたばしょ」に あるける マップが あるか
export function fieldForPlace(place: string): FieldDef | undefined {
  const p = place.trim()
  return FIELDS.find((f) => f.place === p)
}
