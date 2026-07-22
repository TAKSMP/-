// =============================================================
//  ミッション（虫さがしが たのしくなる おだい）
// -------------------------------------------------------------
//  Easy / Normal / Hard の 3レベル。各レベルを 1トラックとして、
//  達成すると つぎのミッションに きりかわる。達成で バッジ獲得。
//
//  ★ おだいは「いまの図鑑」からの ふえた分（差分）で はんていする。
//    はじめて ミッションページを ひらいた ときの じょうたいを
//    「きじゅん（baseline）」として ほぞんし、そこから どれだけ
//    ふえたかで すすむ。だから いつも「これから がんばる」おだいになる。
// =============================================================
import type { CaughtBug } from '../types'
import { canonicalOrder } from './orders'

export type Level = 'easy' | 'normal' | 'hard'

// はかる ものさし（ふえていく かず）
export type MetricKey =
  | 'kinds' // ちがう虫の しゅるい
  | 'orders' // 目（もく）の かず
  | 'places' // みつけた ばしょの かず
  | 'rare4' // 星4いじょうの 虫の かず
  | 'rare5' // 星5の 虫の かず
  | 'beetle' // コウチュウ目の かず
  | 'captures' // とった写真の まいすう

export interface Baseline {
  kinds: number
  orders: number
  places: number
  rare4: number
  rare5: number
  beetle: number
  captures: number
}

export interface Mission {
  id: string
  level: Level
  emoji: string
  title: string // おだいの文（「あと◯」の 差分でかく）
  metric: MetricKey
  goal: number // きじゅんから ふやす かず
  badge: { emoji: string; name: string }
}

// いまの図鑑から、ものさしの 生の かずを だす
export function rawMetric(bugs: CaughtBug[], key: MetricKey): number {
  switch (key) {
    case 'kinds':
      return bugs.length
    case 'orders': {
      const s = new Set<string>()
      for (const b of bugs) {
        const o = canonicalOrder(b.order) ?? b.order
        if (o && o !== 'ふめい') s.add(o)
      }
      return s.size
    }
    case 'places': {
      const s = new Set<string>()
      for (const b of bugs)
        for (const c of b.captures) {
          const p = c.place?.trim()
          if (p) s.add(p)
        }
      return s.size
    }
    case 'rare4':
      return bugs.filter((b) => b.rarity >= 4).length
    case 'rare5':
      return bugs.filter((b) => b.rarity >= 5).length
    case 'beetle':
      return bugs.filter((b) => (canonicalOrder(b.order) ?? b.order) === 'コウチュウ目')
        .length
    case 'captures':
      return bugs.reduce((m, b) => m + b.captures.length, 0)
  }
}

// いまの図鑑を「きじゅん」として ほぞんする ためのスナップショット
export function computeBaseline(bugs: CaughtBug[]): Baseline {
  return {
    kinds: rawMetric(bugs, 'kinds'),
    orders: rawMetric(bugs, 'orders'),
    places: rawMetric(bugs, 'places'),
    rare4: rawMetric(bugs, 'rare4'),
    rare5: rawMetric(bugs, 'rare5'),
    beetle: rawMetric(bugs, 'beetle'),
    captures: rawMetric(bugs, 'captures'),
  }
}

// きじゅんからの ふえた分（0いじょう）
export function metricProgress(
  bugs: CaughtBug[],
  base: Baseline,
  key: MetricKey,
): number {
  return Math.max(0, rawMetric(bugs, key) - base[key])
}

export const MISSIONS: Mission[] = [
  // ---------------- Easy（かんたん） ----------------
  {
    id: 'e1',
    level: 'easy',
    emoji: '🔰',
    title: 'ちがう虫を あと3しゅるい みつけよう',
    metric: 'kinds',
    goal: 3,
    badge: { emoji: '🥉', name: 'はじめの いっぽ' },
  },
  {
    id: 'e2',
    level: 'easy',
    emoji: '🐾',
    title: 'あたらしい 目（もく）を 1つ ふやそう',
    metric: 'orders',
    goal: 1,
    badge: { emoji: '🐛', name: 'もく はじめ' },
  },
  {
    id: 'e3',
    level: 'easy',
    emoji: '📸',
    title: '写真を あと5まい とろう',
    metric: 'captures',
    goal: 5,
    badge: { emoji: '🔁', name: 'カメラ すき' },
  },
  {
    id: 'e4',
    level: 'easy',
    emoji: '🗺️',
    title: 'あたらしい ばしょで 2かしょ みつけよう',
    metric: 'places',
    goal: 2,
    badge: { emoji: '🧭', name: 'たんけんか' },
  },
  // ---------------- Normal（ふつう） ----------------
  {
    id: 'n1',
    level: 'normal',
    emoji: '🎒',
    title: 'ちがう虫を あと8しゅるい あつめよう',
    metric: 'kinds',
    goal: 8,
    badge: { emoji: '🥈', name: 'むし コレクター' },
  },
  {
    id: 'n2',
    level: 'normal',
    emoji: '🐾',
    title: 'あたらしい 目（もく）を 3つ ふやそう',
    metric: 'orders',
    goal: 3,
    badge: { emoji: '🎖️', name: 'もくべつ 名人' },
  },
  {
    id: 'n3',
    level: 'normal',
    emoji: '✨',
    title: 'レアな虫（星4いじょう）を 1ぴき みつけよう',
    metric: 'rare4',
    goal: 1,
    badge: { emoji: '💎', name: 'レア ハンター' },
  },
  {
    id: 'n4',
    level: 'normal',
    emoji: '🗺️',
    title: 'あたらしい ばしょで 4かしょ みつけよう',
    metric: 'places',
    goal: 4,
    badge: { emoji: '🧗', name: 'だい たんけんか' },
  },
  // ---------------- Hard（むずかしい） ----------------
  {
    id: 'h1',
    level: 'hard',
    emoji: '📚',
    title: 'ちがう虫を あと15しゅるい あつめよう',
    metric: 'kinds',
    goal: 15,
    badge: { emoji: '🥇', name: 'むし はかせ' },
  },
  {
    id: 'h2',
    level: 'hard',
    emoji: '🐾',
    title: 'あたらしい 目（もく）を 6つ ふやそう',
    metric: 'orders',
    goal: 6,
    badge: { emoji: '👑', name: 'もく マスター' },
  },
  {
    id: 'h3',
    level: 'hard',
    emoji: '🌟',
    title: 'でんせつの虫（星5）を 1ぴき みつけよう',
    metric: 'rare5',
    goal: 1,
    badge: { emoji: '🏆', name: 'でんせつ ハンター' },
  },
  {
    id: 'h4',
    level: 'hard',
    emoji: '🪲',
    title: 'コウチュウ目を あと5ひき あつめよう',
    metric: 'beetle',
    goal: 5,
    badge: { emoji: '🪲', name: 'カブトむし けんきゅうか' },
  },
]

export const LEVELS: { key: Level; label: string; emoji: string }[] = [
  { key: 'easy', label: 'かんたん', emoji: '🟢' },
  { key: 'normal', label: 'ふつう', emoji: '🟡' },
  { key: 'hard', label: 'むずかしい', emoji: '🔴' },
]
