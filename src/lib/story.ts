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
import { assignEncounters } from '../data/encounters'

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
  level?: number // 敵の レベル（10マップモードで 1より 大きくなる）
  encounterId?: string // であいの おはなし（マップの中で かぶらない）
  col: number
  row: number
}

export interface StoryStage {
  id: string // ほぞんの かぎ（'ばしょ名' または 'quest:0'）
  title: string // がめんに 出す 名前
  kind: 'place' | 'quest'
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
  const stories = assignEncounters(list.map((b) => b.order), `place:${place}`)
  const kinds: { kind: CellKind; bugId?: string; encounterId?: string }[] = [
    { kind: 'start' },
    ...list.map((b, i) => ({
      kind: 'battle' as const,
      bugId: b.id,
      encounterId: stories[i],
    })),
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
    return { index: i, kind: k.kind, bugId: k.bugId, encounterId: k.encounterId, col, row }
  })

  return {
    id: place,
    title: place,
    kind: 'place',
    cells,
    cols,
    rows,
    sceneIndex: hashStr(place) % SCENE_COUNT,
  }
}

// -------------------------------------------------------------
//  10マップモード（みつけた虫 ぜんぶが たいしょう）
// -------------------------------------------------------------
//  ・10この マップ。1マップに 5ひき
//  ・さきに すすむほど つよい虫＋レベルも あがる
//  ・ひとつ クリアすると つぎの マップが あく
export const QUEST_MAPS = 10
export const QUEST_PER_MAP = 5

export const questId = (index: number) => `quest:${index}`

// マップが とおしで なんばんめの 敵か → レベル
function questLevel(slot: number): number {
  // 0〜49 を 1〜10 くらいに。さいごの 1ぴき（ボス）は すこし つよい
  const base = 1 + Math.floor(slot / 5)
  const boss = slot % QUEST_PER_MAP === QUEST_PER_MAP - 1 ? 1 : 0
  return Math.min(MAX_LEVEL, base + boss)
}

export function buildQuestStage(bugs: CaughtBug[], index: number): StoryStage {
  // よわい順に ならべて、マップごとに「まど」を ずらしながら 5ひき とる。
  // （1つの マップには ちがう虫が ならぶ。さきの マップほど つよい虫に なる）
  const sorted = [...bugs].sort((a, b) => bugPower(a) - bugPower(b) || a.name.localeCompare(b.name))
  const n = sorted.length
  const start =
    n <= QUEST_PER_MAP
      ? 0
      : Math.round((index * (n - QUEST_PER_MAP)) / (QUEST_MAPS - 1))
  const picks: { bug: CaughtBug; level: number }[] = []
  for (let i = 0; i < QUEST_PER_MAP; i++) {
    const slot = index * QUEST_PER_MAP + i
    // 虫が 5ひき より すくない ときだけ、おなじ虫が くりかえし 出る
    const at = n <= QUEST_PER_MAP ? i % n : start + i
    picks.push({ bug: sorted[at], level: questLevel(slot) })
  }

  const stories = assignEncounters(picks.map((p) => p.bug.order), questId(index))
  const kinds: { kind: CellKind; bugId?: string; level?: number; encounterId?: string }[] = [
    { kind: 'start' },
    ...picks.map((p, i) => ({
      kind: 'battle' as const,
      bugId: p.bug.id,
      level: p.level,
      encounterId: stories[i],
    })),
    { kind: 'goal' as const },
  ]
  const total = kinds.length
  const cols = Math.min(4, Math.max(2, total))
  const rows = Math.ceil(total / cols)
  const cells: StoryCell[] = kinds.map((k, i) => {
    const row = Math.floor(i / cols)
    const inRow = i % cols
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow
    return {
      index: i,
      kind: k.kind,
      bugId: k.bugId,
      level: k.level,
      encounterId: k.encounterId,
      col,
      row,
    }
  })

  return {
    id: questId(index),
    title: `ステージ ${index + 1}`,
    kind: 'quest',
    cells,
    cols,
    rows,
    sceneIndex: index % SCENE_COUNT, // 10マップ ＝ 10しゅるいの 公園
  }
}

// そのマップが あいているか（ひとつ まえを クリアしたか）
export function questUnlocked(save: StorySave, index: number): boolean {
  if (index === 0) return true
  return !!save.goal[questId(index - 1)]
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
export function expForWin(enemy: CaughtBug, myLevel: number, enemyLevel = 1): number {
  const base = Math.round((bugPower(enemy) / 4) * (1 + (enemyLevel - 1) * 0.18))
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
  cleared: Record<string, string[]> // マップ → たおした マス
  goal: Record<string, boolean> // マップ → ゴールに ついたか
  seen: Record<string, string[]> // マップ → もう 出会った マス（しゃしんを 見せる）
}

const emptySave = (): StorySave => ({ levels: {}, cleared: {}, goal: {}, seen: {} })

export function loadStory(): StorySave {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return emptySave()
    const d = JSON.parse(raw) as Partial<StorySave>
    return {
      levels: d.levels ?? {},
      cleared: d.cleared ?? {},
      goal: d.goal ?? {},
      seen: d.seen ?? {},
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
export function isCleared(save: StorySave, stageId: string, cell: StoryCell): boolean {
  if (cell.kind === 'start') return true
  if (cell.kind === 'goal') return !!save.goal[stageId]
  return (save.cleared[stageId] ?? []).includes(cellKey(cell))
}

// おなじ虫が べつのマスに 出ることが あるので、マスの ばんごうも いれて おぼえる
export function cellKey(cell: StoryCell): string {
  return `${cell.index}:${cell.bugId ?? ''}`
}

// いま いる マス（スタートから たおしつづけた ところまで）
export function currentIndex(save: StorySave, stage: StoryStage): number {
  let i = 0
  for (const cell of stage.cells) {
    if (cell.kind === 'start') continue
    if (isCleared(save, stage.id, cell)) i = cell.index
    else break
  }
  return i
}

// いま いける いちばん さきの マス（とうたつずみ＋そのつぎ1マス）
export function reachableIndex(save: StorySave, stage: StoryStage): number {
  let i = 0
  for (const cell of stage.cells) {
    if (cell.kind === 'start') { i = cell.index; continue }
    if (isCleared(save, stage.id, cell)) i = cell.index
    else return cell.index // まだの マスまでは いける（そこで バトル）
  }
  return i
}

export function markCleared(save: StorySave, stageId: string, cell: StoryCell): StorySave {
  if (cell.kind === 'goal') return { ...save, goal: { ...save.goal, [stageId]: true } }
  if (cell.kind !== 'battle' || !cell.bugId) return save
  const list = save.cleared[stageId] ?? []
  const key = cellKey(cell)
  if (list.includes(key)) return save
  return { ...save, cleared: { ...save.cleared, [stageId]: [...list, key] } }
}

// そのマップの すすみぐあいだけを まっさらに する（おはなしも また 見られる）
export function resetStage(save: StorySave, stageId: string): StorySave {
  const cleared = { ...save.cleared }
  const goal = { ...save.goal }
  const seen = { ...save.seen }
  delete cleared[stageId]
  delete goal[stageId]
  delete seen[stageId]
  return { ...save, cleared, goal, seen }
}

// 虫の レベルを 1に もどす（すすみぐあいは そのまま）
export function resetLevel(save: StorySave, bugId: string): StorySave {
  const levels = { ...save.levels }
  delete levels[bugId]
  return { ...save, levels }
}

// ぜんぶの虫の レベルを 1に もどす
export function resetAllLevels(save: StorySave): StorySave {
  return { ...save, levels: {} }
}

// しゃしんを あかす（一度 出会った マス）
export function isSeen(save: StorySave, stageId: string, cell: StoryCell): boolean {
  if (cell.kind !== 'battle') return true
  return (save.seen[stageId] ?? []).includes(cellKey(cell))
}

export function markSeen(save: StorySave, stageId: string, cell: StoryCell): StorySave {
  if (cell.kind !== 'battle') return save
  const list = save.seen[stageId] ?? []
  const key = cellKey(cell)
  if (list.includes(key)) return save
  return { ...save, seen: { ...save.seen, [stageId]: [...list, key] } }
}
