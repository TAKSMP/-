// =============================================================
//  ひっさつわざリスト（わざ図鑑）
// -------------------------------------------------------------
//  ・バトルで 見た／つかった わざだけ、くわしく 見られる
//  ・見たことの ない わざは「????」の まま
//  ・おぼえた かどうかは この たんまつの ブラウザに のこる
// =============================================================
import { MOVE_LIBRARY, MOVE_PATTERNS, type LibraryMove } from './moveLibrary'

const KEY = 'chomushi.movedex.v1'

export type MoveGroup = 'attack' | 'status' | 'heal'

export const GROUPS: { key: MoveGroup; label: string; emoji: string }[] = [
  { key: 'attack', label: 'こうげきワザ', emoji: '⚔️' },
  { key: 'status', label: 'へんかワザ', emoji: '✨' },
  { key: 'heal', label: 'かいふくワザ', emoji: '💚' },
]

export function groupOf(m: LibraryMove): MoveGroup {
  if (m.healRatio || m.restSleep || m.regen || m.cureStatus) return 'heal'
  return m.kind === 'attack' ? 'attack' : 'status'
}

export interface DexEntry {
  no: number // 1から じゅんばん
  move: LibraryMove
  group: MoveGroup
}

// ぜんぶの わざを No.つきで
export const DEX: DexEntry[] = MOVE_LIBRARY.map((move, i) => ({
  no: i + 1,
  move,
  group: groupOf(move),
}))

// わざの パターン名（「2〜5かい れんぞく こうげき」など）
export function patternLabel(m: LibraryMove): string {
  return MOVE_PATTERNS.find((p) => p.key === m.pattern)?.label ?? ''
}

// -------------------------------------------------------------
//  見た／つかった わざの きろく
// -------------------------------------------------------------
export function loadDexSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? (arr as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveDexSeen(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch (e) {
    console.warn('わざリストの ほぞんに しっぱい', e)
  }
}

const libraryIds = new Set(MOVE_LIBRARY.map((m) => m.id))

// わざを「見た」ことに する。ふえたら true
export function markMovesSeen(ids: (string | undefined)[]): boolean {
  const set = loadDexSeen()
  let changed = false
  for (const id of ids) {
    if (!id || !libraryIds.has(id) || set.has(id)) continue
    set.add(id)
    changed = true
  }
  if (changed) saveDexSeen(set)
  return changed
}

export function dexCount(seen: Set<string>): { found: number; total: number } {
  return { found: DEX.filter((d) => seen.has(d.move.id)).length, total: DEX.length }
}
