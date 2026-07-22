// =============================================================
//  ミッション（虫さがしが たのしくなる おだい）
// -------------------------------------------------------------
//  Easy / Normal / Hard の 3レベル。各レベルを 1トラックとして、
//  達成すると つぎのミッションに きりかわる。達成で バッジ獲得。
//  進捗は 図鑑データ（あつめた虫）から じどうで はんてい。
// =============================================================
import type { CaughtBug } from '../types'
import { canonicalOrder } from './orders'

export type Level = 'easy' | 'normal' | 'hard'

export interface Mission {
  id: string
  level: Level
  emoji: string
  title: string // おだいの文
  goal: number // たっせいに ひつような かず
  progress: (bugs: CaughtBug[]) => number // いまの かず
  badge: { emoji: string; name: string } // もらえるバッジ
}

// --- 進捗をはかる ヘルパー ---
function distinctOrders(bugs: CaughtBug[]): number {
  const s = new Set<string>()
  for (const b of bugs) {
    const o = canonicalOrder(b.order) ?? b.order
    if (o && o !== 'ふめい') s.add(o)
  }
  return s.size
}
function distinctPlaces(bugs: CaughtBug[]): number {
  const s = new Set<string>()
  for (const b of bugs) {
    for (const c of b.captures) {
      const p = c.place?.trim()
      if (p) s.add(p)
    }
  }
  return s.size
}
function rareCount(bugs: CaughtBug[], min: number): number {
  return bugs.filter((b) => b.rarity >= min).length
}
function maxRepeat(bugs: CaughtBug[]): number {
  return bugs.reduce((m, b) => Math.max(m, b.captures.length), 0)
}
function orderCount(bugs: CaughtBug[], order: string): number {
  return bugs.filter((b) => (canonicalOrder(b.order) ?? b.order) === order).length
}

export const MISSIONS: Mission[] = [
  // ---------------- Easy（かんたん） ----------------
  {
    id: 'e1',
    level: 'easy',
    emoji: '🔰',
    title: 'ちがう虫を 3しゅるい みつけよう',
    goal: 3,
    progress: (b) => b.length,
    badge: { emoji: '🥉', name: 'はじめの いっぽ' },
  },
  {
    id: 'e2',
    level: 'easy',
    emoji: '🐾',
    title: '2つの 目（もく）を あつめよう',
    goal: 2,
    progress: distinctOrders,
    badge: { emoji: '🐛', name: 'もく はじめ' },
  },
  {
    id: 'e3',
    level: 'easy',
    emoji: '📸',
    title: 'おなじ虫を 2かい とろう',
    goal: 2,
    progress: maxRepeat,
    badge: { emoji: '🔁', name: 'リピーター' },
  },
  {
    id: 'e4',
    level: 'easy',
    emoji: '🗺️',
    title: '3つの ばしょで 虫を みつけよう',
    goal: 3,
    progress: distinctPlaces,
    badge: { emoji: '🧭', name: 'たんけんか' },
  },
  // ---------------- Normal（ふつう） ----------------
  {
    id: 'n1',
    level: 'normal',
    emoji: '🎒',
    title: 'ちがう虫を 8しゅるい あつめよう',
    goal: 8,
    progress: (b) => b.length,
    badge: { emoji: '🥈', name: 'むし コレクター' },
  },
  {
    id: 'n2',
    level: 'normal',
    emoji: '🐾',
    title: '4つの 目（もく）を あつめよう',
    goal: 4,
    progress: distinctOrders,
    badge: { emoji: '🎖️', name: 'もくべつ 名人' },
  },
  {
    id: 'n3',
    level: 'normal',
    emoji: '✨',
    title: 'レアな虫（星4いじょう）を みつけよう',
    goal: 1,
    progress: (b) => rareCount(b, 4),
    badge: { emoji: '💎', name: 'レア ハンター' },
  },
  {
    id: 'n4',
    level: 'normal',
    emoji: '🗺️',
    title: '5つの ばしょで 虫を みつけよう',
    goal: 5,
    progress: distinctPlaces,
    badge: { emoji: '🧗', name: 'だい たんけんか' },
  },
  // ---------------- Hard（むずかしい） ----------------
  {
    id: 'h1',
    level: 'hard',
    emoji: '📚',
    title: 'ちがう虫を 15しゅるい あつめよう',
    goal: 15,
    progress: (b) => b.length,
    badge: { emoji: '🥇', name: 'むし はかせ' },
  },
  {
    id: 'h2',
    level: 'hard',
    emoji: '🐾',
    title: '6つの 目（もく）を あつめよう',
    goal: 6,
    progress: distinctOrders,
    badge: { emoji: '👑', name: 'もく マスター' },
  },
  {
    id: 'h3',
    level: 'hard',
    emoji: '🌟',
    title: 'でんせつの虫（星5）を みつけよう',
    goal: 1,
    progress: (b) => rareCount(b, 5),
    badge: { emoji: '🏆', name: 'でんせつ ハンター' },
  },
  {
    id: 'h4',
    level: 'hard',
    emoji: '🪲',
    title: 'コウチュウ目を 5ひき あつめよう',
    goal: 5,
    progress: (b) => orderCount(b, 'コウチュウ目'),
    badge: { emoji: '🪲', name: 'カブトむし けんきゅうか' },
  },
]

export const LEVELS: { key: Level; label: string; emoji: string }[] = [
  { key: 'easy', label: 'かんたん', emoji: '🟢' },
  { key: 'normal', label: 'ふつう', emoji: '🟡' },
  { key: 'hard', label: 'むずかしい', emoji: '🔴' },
]
