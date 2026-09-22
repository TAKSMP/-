// =============================================================
//  マップごとに「どの虫が 出るか」
// -------------------------------------------------------------
//  せってい画面で 図鑑から えらぶ。えらんでいない ときは、
//  その ばしょで みつけた虫が そのまま 出る。
// =============================================================
import type { CaughtBug } from '../types'
import { fieldById, type FieldDef } from '../data/fields'

const KEY = 'chomushi.fieldbugs.v1'

export type FieldBugs = Record<string, string[]> // フィールドID → 虫のID

export function loadFieldBugs(): FieldBugs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? (d as FieldBugs) : {}
  } catch {
    return {}
  }
}

export function saveFieldBugs(v: FieldBugs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch (e) {
    console.warn('マップの むしの ほぞんに しっぱい', e)
  }
}

// せっていが ないときの きほん：その ばしょで みつけた虫。
// ばしょに ひもづかない マップ（つるせ など）は ずかんの 虫 ぜんぶ。
export function defaultBugsOfField(field: FieldDef, bugs: CaughtBug[]): CaughtBug[] {
  if (!field.place) return bugs
  return bugs.filter((b) =>
    b.captures.some((c) => (c.place ?? '').trim() === field.place),
  )
}

// じっさいに 出る虫
export function bugsForField(
  fieldId: string,
  bugs: CaughtBug[],
  saved: FieldBugs = loadFieldBugs(),
): CaughtBug[] {
  const field = fieldById(fieldId)
  if (!field) return []
  const ids = saved[fieldId]
  if (!ids) return defaultBugsOfField(field, bugs)
  const picked = ids
    .map((id) => bugs.find((b) => b.id === id))
    .filter((b): b is CaughtBug => !!b)
  // ぜんぶ けしていたら、その ばしょの虫に もどす
  return picked.length > 0 ? picked : defaultBugsOfField(field, bugs)
}

export function setFieldBugs(fieldId: string, ids: string[]): FieldBugs {
  const next = { ...loadFieldBugs(), [fieldId]: ids }
  saveFieldBugs(next)
  return next
}
