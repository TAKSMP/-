// =============================================================
//  あるける マップ（フィールド）の いちらん
// -------------------------------------------------------------
//  絵と あたり判定は public/fields/<id>/ に おいてある。
//  あたらしい マップを ふやす ときは、ここに 1こ たすだけ。
// =============================================================
export type MapList = 'quest' | 'place'

export interface FieldDef {
  id: string
  name: string // がめんに 出す 名前
  base: string // public からの ばしょ
  // ひもづく「みつけたばしょ」。ある マップは そこで みつけた虫が 出て、
  // 「みつけたばしょ」の リストの その ばしょの ところに 出る。
  // ない マップは ずかんの 虫 ぜんぶが 出る。
  place?: string
  // field：ゆうゆう／アンビシャス（map.json schemaVersion 1）
  // world：つるせ など 道路だけ あるける 大きい マップ（schemaVersion 2）
  engine?: 'field' | 'world'
  // 'player'：てきの レベルを じぶんの 虫に あわせる（ないときは Lv1）
  enemyLevel?: 'player'
  thumb?: string // リストの 絵（public からの ばしょ）
  // place が ない マップを どの リストの あたまに 出すか
  lists?: MapList[]
}

export const FIELDS: FieldDef[] = [
  {
    id: 'yuyuu',
    name: 'ゆうゆうの丘公園',
    base: 'fields/yuyuu/',
    place: 'ゆうゆうの丘公園',
  },
  {
    id: 'ambitious',
    name: 'アンビシャス',
    base: 'fields/ambitious/',
    place: 'アンビシャス',
  },
  {
    id: 'tsuruse',
    name: 'つるせ',
    base: 'fields/tsuruse/',
    engine: 'world',
    enemyLevel: 'player',
    thumb: 'fields/tsuruse/thumb.jpg',
    lists: ['quest', 'place'],
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

// ばしょに ひもづかない マップのうち、その リストに 出すもの
export function fieldsInList(list: MapList): FieldDef[] {
  return FIELDS.filter((f) => !f.place && f.lists?.includes(list))
}

// public の なかの ファイルの URL
export function publicUrl(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, document.baseURI)).href
}
