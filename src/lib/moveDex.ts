// =============================================================
//  ひっさつわざリスト（わざ図鑑）
// -------------------------------------------------------------
//  ・バトルで 見た／つかった わざだけ、くわしく 見られる
//  ・見たことの ない わざは「????」の まま
//  ・おぼえた かどうかは この たんまつの ブラウザに のこる
// =============================================================
import { MOVE_LIBRARY, MOVE_PATTERNS, ULTIMATE_MOVES, type LibraryMove } from './moveLibrary'

// 引き継ぎバックアップ（storage.ts）からも 直接 よみかきする ので export する
export const MOVEDEX_KEY = 'chomushi.movedex.v1'
const KEY = MOVEDEX_KEY

export type MoveGroup = 'attack' | 'status' | 'heal' | 'ultimate'

export const GROUPS: { key: MoveGroup; label: string; emoji: string }[] = [
  { key: 'attack', label: 'こうげきワザ', emoji: '⚔️' },
  { key: 'status', label: 'へんかワザ', emoji: '✨' },
  { key: 'heal', label: 'かいふくワザ', emoji: '💚' },
  { key: 'ultimate', label: 'さいきょうワザ', emoji: '👑' },
]

// さいきょうワザの なかの しゅるい（こうげき／へんか／かいふく）
export const ULTIMATE_KIND_LABEL: Record<'attack' | 'status' | 'heal', string> = {
  attack: 'こうげき',
  status: 'へんか',
  heal: 'かいふく',
}

export function groupOf(m: LibraryMove): MoveGroup {
  if (m.ultimate) return 'ultimate'
  if (m.healRatio || m.restSleep || m.regen || m.cureStatus || m.cureStatusKey) return 'heal'
  return m.kind === 'attack' ? 'attack' : 'status'
}

export interface DexEntry {
  no: number // 1から じゅんばん
  move: LibraryMove
  group: MoveGroup
}

// ぜんぶの わざを No.つきで
export const DEX: DexEntry[] = [...MOVE_LIBRARY, ...ULTIMATE_MOVES].map((move, i) => ({
  no: i + 1,
  move,
  group: groupOf(move),
}))

// わざの パターン名（「2〜5かい れんぞく こうげき」など）
export function patternLabel(m: LibraryMove): string {
  if (m.typeLabel) return m.typeLabel
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

export function saveDexSeen(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch (e) {
    console.warn('わざリストの ほぞんに しっぱい', e)
  }
}

const libraryIds = new Set(DEX.map((d) => d.move.id))

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
