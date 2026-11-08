// =============================================================
//  レベルアップの えんしゅつで 1まいずつ 見せる もの
// -------------------------------------------------------------
//  ストーリーモードと ちょうむしショップ（ふしぎなアメ）で おなじ ものを つかう。
//  ・ステータスの かわりかた（レベルアップ）
//  ・2レベルごとの あたらしい わざ
//  ・Lv30／40／50 の さいきょうわざ
// =============================================================
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { mainPhoto } from './storage'
import { moveSummary } from './moveLibrary'
import {
  allMovesOf,
  learnLevelCrossed,
  missingUltimates,
  moveSlotsOf,
  newMoveFor,
  statsWithLevel,
  ultimateMoveFor,
  ultimatesOf,
  type BugLevel,
  type StorySave,
} from './story'

export interface LevelUpInfo {
  bugId: string
  name: string
  photo: string
  fromLv: number
  toLv: number
  rows: { label: string; emoji: string; from: number; to: number }[]
  buddy: boolean // なかまの ぶんか
}
export interface LearnInfo {
  bugId: string
  name: string
  buddy: boolean
  move: SpecialMoveV2
  current: SpecialMoveV2[]
  forcedIndex: number | null // わくが ふえた ときは えらばずに ついか
}
export type Celebration = { kind: 'level'; info: LevelUpInfo } | { kind: 'learn'; info: LearnInfo }

// レベルが あがったら「ステータスの かわりかた」、2レベルごとに「あたらしい わざ」
export function celebrationsFor(
  bug: CaughtBug,
  res: { before: BugLevel; after: BugLevel; levelUps: number },
  saveAfter: StorySave,
  buddy: boolean,
): Celebration[] {
  if (res.levelUps <= 0) return []
  const a = statsWithLevel(bug, res.before.level)
  const b = statsWithLevel(bug, res.after.level)
  const out: Celebration[] = [
    {
      kind: 'level',
      info: {
        bugId: bug.id,
        name: bug.name,
        photo: mainPhoto(bug),
        fromLv: res.before.level,
        toLv: res.after.level,
        buddy,
        rows: [
          { label: 'たいりょく', emoji: '❤️', from: a.hp, to: b.hp },
          { label: 'こうげき', emoji: '⚔️', from: a.attack, to: b.attack },
          { label: 'ぼうぎょ', emoji: '🛡️', from: a.defense, to: b.defense },
          { label: 'すばやさ', emoji: '⚡', from: a.speed, to: b.speed },
        ],
      },
    },
  ]
  const learnLv = learnLevelCrossed(res.before.level, res.after.level)
  if (learnLv !== null) {
    const all = allMovesOf(saveAfter, bug)
    // まきもので ふやした わくも ふくめる（ふやした わざを レベルアップで うわがき しない ため）
    const before = moveSlotsOf(saveAfter, bug.id, res.before.level)
    const after = moveSlotsOf(saveAfter, bug.id, res.after.level)
    const nm = newMoveFor(bug, learnLv, all)
    if (nm) {
      out.push({
        kind: 'learn',
        info: {
          bugId: bug.id,
          name: bug.name,
          buddy,
          move: nm,
          current: all.slice(0, Math.max(1, before)),
          forcedIndex: after > before ? after - 1 : null,
        },
      })
    }
  }
  // Lv30／40／50 の さいきょうわざ。ふつうの わざ 3つとは べつわく なので、えらばずに かならず おぼえる。
  // （まだ もっていない ぶんを まとめて しらべるので、まえに おぼえそびれて いても ここで おぼえる）
  for (const u of missingUltimates(saveAfter, bug.id, res.after.level)) {
    const nm = ultimateMoveFor(bug, u.group, ultimatesOf(saveAfter, bug.id, res.after.level))
    if (!nm) continue
    out.push({
      kind: 'learn',
      info: { bugId: bug.id, name: bug.name, buddy, move: nm, current: [], forcedIndex: null },
    })
  }
  return out
}

// わざの みじかい せつめい（いりょく／へんかわざ など）
export const moveLabel = (m: SpecialMoveV2) => (m.ultimate ? '👑 ' : '') + moveSummary(m)
