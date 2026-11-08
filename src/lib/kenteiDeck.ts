// =============================================================
//  昆虫検定の「まだ 出していない もんだい」の きろく
// -------------------------------------------------------------
//  おなじ もんだいが なんども 出ない ように、級ごとに 出した もんだいの 番号を おぼえておく。
//  ・10もんは「まだ 出していない もんだい」から ランダムに えらぶ
//  ・ぜんぶ 出しおわったら（ひとまわり したら）きろくを リセットして また さいしょから
//  ・のこりが 10もんより すくない ときは、のこりを ぜんぶ 出して、たりない ぶんは
//    リセットした あとの もんだいから えらぶ（その回の なかで おなじ もんだいは 出さない）
//  きろくは もんだいを「がめんに 出した」ときに つける（とちゅうで やめた ぶんは 出していない あつかい）。
// =============================================================
import type { KenteiLevel, KenteiQuestion } from '../data/kentei'

export const KENTEI_DECK_KEY = 'chomushi.kentei.v1'

type Deck = Record<KenteiLevel, number[]>

function empty(): Deck {
  return { beginner: [], intermediate: [] }
}

function nums(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
}

export function normalizeDeck(raw: unknown): Deck {
  if (!raw || typeof raw !== 'object') return empty()
  const d = raw as Partial<Record<KenteiLevel, unknown>>
  return { beginner: nums(d.beginner), intermediate: nums(d.intermediate) }
}

export function loadDeck(): Deck {
  try {
    const raw = localStorage.getItem(KENTEI_DECK_KEY)
    return raw ? normalizeDeck(JSON.parse(raw)) : empty()
  } catch {
    return empty()
  }
}

function saveDeck(d: Deck): void {
  try {
    localStorage.setItem(KENTEI_DECK_KEY, JSON.stringify(d))
  } catch (e) {
    console.warn('昆虫検定の きろくの ほぞんに しっぱい', e)
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// まだ 出していない もんだいの かず（ぜんぶ 出しおわって いれば ぜんぶの かず）
export function remainingCount(level: KenteiLevel, all: KenteiQuestion[]): number {
  const used = new Set(loadDeck()[level])
  const left = all.filter((q) => !used.has(q.no)).length
  return left === 0 ? all.length : left
}

// 10もん えらぶ。
// のこりが たりない ときは「のこり ぜんぶ → あたらしい ひとまわりの ぶん」の じゅんに ならべる。
// のこりの さいごを 出した ところで markShown が きろくを リセットするので、
// うしろの ぶんだけが あたらしい ひとまわりの「出した」に かぞえられる。
export function drawQuestions(
  level: KenteiLevel,
  all: KenteiQuestion[],
  count: number,
): KenteiQuestion[] {
  const used = new Set(loadDeck()[level])
  const fresh = shuffle(all.filter((q) => !used.has(q.no)))
  if (fresh.length >= count) return fresh.slice(0, count)
  const pickedNos = new Set(fresh.map((q) => q.no))
  const nextRound = shuffle(all.filter((q) => !pickedNos.has(q.no))).slice(0, count - fresh.length)
  return [...fresh, ...nextRound]
}

// がめんに 出した もんだいを「出した」に する。ぜんぶ そろったら つぎの ひとまわりへ
export function markShown(level: KenteiLevel, no: number, total: number): void {
  const deck = loadDeck()
  const list = deck[level]
  if (list.includes(no)) return
  const next = [...list, no]
  saveDeck({ ...deck, [level]: next.length >= total ? [] : next })
}
