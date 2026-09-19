// =============================================================
//  ストーリーモード（すごろく風のマップを すすむ）
// -------------------------------------------------------------
//  ・マップ＝「みつけたばしょ」。そのばしょで みつけた虫が 敵になる
//  ・スタート（敵なし）→ 虫のマス（よわい順）→ ゴール（敵なし）
//  ・倒すと けいけんち が たまり、レベルが あがると つよくなる
//  ここは けいさんだけ。みため（絵）は StoryPage 側。
// =============================================================
import type { CaughtBug } from '../types'
import { battleStatsV2 } from './battleSetup'

const SAVE_KEY = 'chomushi.story.v1'

// 公園のイラストは 10しゅるい。ばしょの名前から いつも おなじ絵に なる。
export const SCENE_COUNT = 10

// -------------------------------------------------------------
//  マップ（ステージ）の かたち
// -------------------------------------------------------------
export type CellKind = 'start' | 'battle' | 'goal'

export interface StoryCell {
  index: number // 0 から じゅんばん
  kind: CellKind
  bugId?: string // battle のときだけ
  col: number
  row: number
}

export interface StoryStage {
  place: string
  cells: StoryCell[]
  cols: number
  rows: number
  sceneIndex: number // 0〜9：どの公園の絵か
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 虫の つよさ（ならべる ときの ものさし）
export function bugPower(bug: CaughtBug): number {
  const s = battleStatsV2(bug)
  return s.hp + (s.attack + s.defense + s.speed) * 3
}

// そのばしょで みつけた虫（あたらしい順ではなく、よわい順）
export function bugsOfPlace(bugs: CaughtBug[], place: string): CaughtBug[] {
  const p = place.trim()
  return bugs
    .filter((b) => b.captures.some((c) => (c.place ?? '').trim() === p))
    .sort((a, b) => bugPower(a) - bugPower(b) || a.name.localeCompare(b.name))
}

// ばしょの いちらん（虫が 1ぴき いじょう いる ところだけ）
export function storyPlaces(bugs: CaughtBug[]): { place: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const bug of bugs) {
    const seen = new Set<string>()
    for (const c of bug.captures) {
      const p = (c.place ?? '').trim()
      if (!p || seen.has(p)) continue
      seen.add(p) // おなじ虫を 2回 かぞえない
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([place, count]) => ({ place, count }))
    .sort((a, b) => b.count - a.count || a.place.localeCompare(b.place))
}

// マップを くみたてる。
// スタート → 虫のマス（よわい順）→ ゴール を、へびのように おりかえして ならべる。
export function buildStage(bugs: CaughtBug[], place: string): StoryStage {
  const list = bugsOfPlace(bugs, place)
  const kinds: { kind: CellKind; bugId?: string }[] = [
    { kind: 'start' },
    ...list.map((b) => ({ kind: 'battle' as const, bugId: b.id })),
    { kind: 'goal' as const },
  ]
  const total = kinds.length
  const cols = Math.min(4, Math.max(2, total))
  const rows = Math.ceil(total / cols)

  const cells: StoryCell[] = kinds.map((k, i) => {
    const row = Math.floor(i / cols)
    const inRow = i % cols
    // ぐうすうの行は みぎへ、きすうの行は ひだりへ（へび）
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow
    return { index: i, kind: k.kind, bugId: k.bugId, col, row }
  })

  return {
    place,
    cells,
    cols,
    rows,
    sceneIndex: hashStr(place) % SCENE_COUNT,
  }
}

// -------------------------------------------------------------
//  レベルと けいけんち
// -------------------------------------------------------------
export const MAX_LEVEL = 20

// つぎの レベルまでに ひつような けいけんち
export function expToNext(level: number): number {
  return 20 + (level - 1) * 15
}

// 敵を たおした ときに もらえる けいけんち
export function expForWin(enemy: CaughtBug, myLevel: number): number {
  const base = Math.round(bugPower(enemy) / 4)
  // レベルが はなれている ほど もらえる量が かわる（よわい敵は すくなく）
  const gap = Math.max(0.3, 1 - (myLevel - 1) * 0.06)
  return Math.max(3, Math.round(base * gap))
}

export interface BugLevel {
  level: number
  exp: number // いまのレベルでの たまり
}

export interface StorySave {
  levels: Record<string, BugLevel> // 虫のID → レベル
  cleared: Record<string, string[]> // ばしょ → たおした虫のID
  goal: Record<string, boolean> // ばしょ → ゴールに ついたか
}

const emptySave = (): StorySave => ({ levels: {}, cleared: {}, goal: {} })

export function loadStory(): StorySave {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return emptySave()
    const d = JSON.parse(raw) as Partial<StorySave>
    return {
      levels: d.levels ?? {},
      cleared: d.cleared ?? {},
      goal: d.goal ?? {},
    }
  } catch {
    return emptySave()
  }
}

export function saveStory(s: StorySave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('ストーリーの ほぞんに しっぱい', e)
  }
}

export function levelOf(save: StorySave, bugId: string): BugLevel {
  return save.levels[bugId] ?? { level: 1, exp: 0 }
}

// けいけんちを くわえて、あがった ぶんを かえす
export function addExp(
  save: StorySave,
  bugId: string,
  gained: number,
): { save: StorySave; before: BugLevel; after: BugLevel; levelUps: number } {
  const before = levelOf(save, bugId)
  let { level, exp } = before
  exp += gained
  let levelUps = 0
  while (level < MAX_LEVEL && exp >= expToNext(level)) {
    exp -= expToNext(level)
    level++
    levelUps++
  }
  if (level >= MAX_LEVEL) exp = 0
  const after = { level, exp }
  return {
    save: { ...save, levels: { ...save.levels, [bugId]: after } },
    before,
    after,
    levelUps,
  }
}

// レベルぶんの つよさを ステータスに たす
export function statsWithLevel(bug: CaughtBug, level: number) {
  const s = battleStatsV2(bug)
  const up = level - 1
  return {
    ...s,
    hp: Math.min(99, s.hp + up * 4),
    attack: Math.min(14, s.attack + Math.floor(up / 2)),
    defense: Math.min(14, s.defense + Math.floor(up / 2)),
    speed: Math.min(14, s.speed + Math.floor(up / 3)),
  }
}

// -------------------------------------------------------------
//  すすみぐあい
// -------------------------------------------------------------
export function isCleared(save: StorySave, place: string, cell: StoryCell): boolean {
  if (cell.kind === 'start') return true
  if (cell.kind === 'goal') return !!save.goal[place]
  return (save.cleared[place] ?? []).includes(cell.bugId ?? '')
}

// いま いる マス（スタートから たおしつづけた ところまで）
export function currentIndex(save: StorySave, stage: StoryStage): number {
  let i = 0
  for (const cell of stage.cells) {
    if (cell.kind === 'start') continue
    if (isCleared(save, stage.place, cell)) i = cell.index
    else break
  }
  return i
}

// いま いける いちばん さきの マス（とうたつずみ＋そのつぎ1マス）
export function reachableIndex(save: StorySave, stage: StoryStage): number {
  let i = 0
  for (const cell of stage.cells) {
    if (cell.kind === 'start') { i = cell.index; continue }
    if (isCleared(save, stage.place, cell)) i = cell.index
    else return cell.index // まだの マスまでは いける（そこで バトル）
  }
  return i
}

export function markCleared(save: StorySave, place: string, cell: StoryCell): StorySave {
  if (cell.kind === 'goal') return { ...save, goal: { ...save.goal, [place]: true } }
  if (cell.kind !== 'battle' || !cell.bugId) return save
  const list = save.cleared[place] ?? []
  if (list.includes(cell.bugId)) return save
  return { ...save, cleared: { ...save.cleared, [place]: [...list, cell.bugId] } }
}
