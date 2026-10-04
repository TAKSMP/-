// =============================================================
//  レースの メンバー づくり（ひとりで／つうしん どちらでも つかう）
// -------------------------------------------------------------
//  ・CPUの わくは「えらぶ（虫を してい）」か「おまかせ（ランダム）」
//  ・えらんだ 虫は、その虫の いまの ストーリーの つよさ（Lv・わざ）の まま はしる
//  ・おまかせは つよさ 1〜10 ＝ うまさ（アクセル・わざの つかいかた）＋ 虫の つよさ
//    虫の Lv は きじゅんの Lv（じぶんの むし）から 1→ひくめ、5→おなじ、10→たかめ
// =============================================================
import type { CaughtBug } from '../types'
import { mainPhoto } from './storage'
import { levelOf, MAX_LEVEL, movesOf, statsWithLevel, type StorySave } from './story'
import type { RacerInit } from './raceEngine'
import { toRaceMove } from './raceMoves'

export const MIN_RACERS = 2
export const MAX_RACERS = 6
export const RACE_COLORS = ['#ff6b6b', '#3d8bff', '#ffb703', '#8e5cf7', '#2fbf71', '#ff7ac6']

export interface CpuSlot {
  mode: 'pick' | 'random'
  bugId?: string
  level: number // 1〜10（おまかせ の とき）
  storyLv?: number // えらんだ 虫の ストーリーの Lv（つうしんの ゲストに 見せる ため）
}

// えらんだ 虫の うまさ（ふつう）
const PICK_SKILL = 0.55

export const defaultCpuSlot = (): CpuSlot => ({ mode: 'random', level: 5 })

export function shuffle<T>(a: T[]): T[] {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

// CPUレベル → 虫の Lv（ストーリーの Lv）
export function cpuBugLevel(baseLv: number, cpuLv: number): number {
  const lv = Math.round(baseLv * (0.5 + 0.1 * cpuLv)) + (cpuLv - 5)
  return Math.max(1, Math.min(MAX_LEVEL, lv))
}

// CPUレベル → うまさ 0〜1
export const cpuSkill = (cpuLv: number) => Math.max(0, Math.min(1, (cpuLv - 1) / 9))

export function makeRacerInit(
  bug: CaughtBug,
  level: number,
  save: StorySave,
  o: { id: string; color: string; human: boolean; skill?: number; tag?: string },
): RacerInit {
  const s = statsWithLevel(bug, level)
  const init: RacerInit = {
    id: o.id,
    name: bug.name,
    photo: mainPhoto(bug),
    color: o.color,
    human: o.human,
    skill: o.skill ?? 0.5,
    level,
    speedStat: s.speed,
    hpStat: s.hp,
    moves: movesOf(save, bug, level).map(toRaceMove),
  }
  if (o.tag) init.tag = o.tag
  return init
}

// じぶんの むし（ストーリーの いまの Lv）
export function myRacerInit(bug: CaughtBug, save: StorySave, id: string, color: string, tag?: string): RacerInit {
  return makeRacerInit(bug, levelOf(save, bug.id).level, save, { id, color, human: true, tag })
}

// CPUの わくを うめる。えらんだ 虫は そのまま、おまかせは まだ でていない 虫から ランダム
export function cpuRacerInits(
  slots: CpuSlot[],
  bugs: CaughtBug[],
  save: StorySave,
  o: { baseLv: number; usedBugIds: string[]; firstIndex: number; colors: string[] },
): RacerInit[] {
  const used = new Set(o.usedBugIds)
  for (const s of slots) if (s.mode === 'pick' && s.bugId) used.add(s.bugId)
  let pool = shuffle(bugs.filter((b) => !used.has(b.id)))
  return slots.map((slot, i) => {
    const idx = o.firstIndex + i
    const picked = slot.mode === 'pick' ? bugs.find((b) => b.id === slot.bugId) : undefined
    if (picked) {
      // えらんだ 虫は ストーリーの いまの すがた の まま（そうさは CPU）
      return makeRacerInit(picked, levelOf(save, picked.id).level, save, {
        id: `p${idx}`,
        color: o.colors[idx % o.colors.length],
        human: false,
        skill: PICK_SKILL,
        tag: 'CPU',
      })
    }
    if (!pool.length) pool = shuffle(bugs) // 虫が たりない ときは おなじ虫も でる
    const bug = pool.shift()!
    return makeRacerInit(bug, cpuBugLevel(o.baseLv, slot.level), save, {
      id: `p${idx}`,
      color: o.colors[idx % o.colors.length],
      human: false,
      skill: cpuSkill(slot.level),
      tag: `CPU${slot.level}`,
    })
  })
}

// ── せっていを おぼえておく（つぎに ひらいた ときも おなじ） ─────────
const SETUP_KEY = 'chomushi.race.setup.v1'

export interface RaceSetup {
  count: number
  laps: number
  stage: string
  slots: CpuSlot[] // つねに MAX_RACERS - 1 こ
}

export function loadRaceSetup(): RaceSetup {
  const base: RaceSetup = { count: 6, laps: 1, stage: 'hiroba', slots: Array.from({ length: MAX_RACERS - 1 }, defaultCpuSlot) }
  try {
    const raw = localStorage.getItem(SETUP_KEY)
    if (!raw) return base
    const d = JSON.parse(raw) as Partial<RaceSetup>
    const slots = base.slots.map((def, i) => {
      const s = d.slots?.[i]
      if (!s) return def
      return {
        mode: s.mode === 'pick' ? 'pick' : 'random',
        bugId: typeof s.bugId === 'string' ? s.bugId : undefined,
        level: Math.max(1, Math.min(10, Math.round(Number(s.level) || 5))),
      } as CpuSlot
    })
    return {
      count: Math.max(MIN_RACERS, Math.min(MAX_RACERS, Math.round(Number(d.count) || 6))),
      laps: Math.max(1, Math.min(3, Math.round(Number(d.laps) || 1))),
      stage: typeof d.stage === 'string' ? d.stage : 'hiroba',
      slots,
    }
  } catch {
    return base
  }
}

export function saveRaceSetup(s: RaceSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(s))
  } catch {
    // ほぞん できなくても きにしない
  }
}
