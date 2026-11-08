// =============================================================
//  昆虫検定の 出題えらび（ちしきを しっかり みにつける ための しくみ）
// -------------------------------------------------------------
//  もくてき：ぜんぶの もんだいを まんべんなく やりつつ、まちがえやすい もんだいほど よく 出す。
//  「学習カード（ライトナー方式）」＋「わすれたころに 復習（間隔反復）」の かんがえかた。
//
//  もんだい ごとに きろく する もの（級ごと）
//   n：出た かいすう／ok：せいかい した かいすう／streak：いま なんかい れんぞく せいかい中か
//   last：さいごに 出た「回」（10もんを 1回と かぞえる）
//
//  もんだいには「つぎに 出す 回」が ある：まちがえたら 1回あと、れんぞく せいかい 1かい→3回あと、
//  2かい→6回あと、3かい いじょう→12回あと（おぼえた ものほど あいだを あける）。
//  その 回が きた もんだいは「じかんの きた もの」。まちがえた かずが おおい ほど さきに 出す。
//
//  10もんの えらびかた（上から じゅんに うめる。おなじ 回で おなじ もんだいは 出ない）
//   1) まえに まちがえて じかんの きた もの …… さいだい WEAK_MAX もん
//   2) まだ いちども 出ていない もの …………… すくなくとも NEW_MIN もん（のこっていれば）
//   3) じかんの きた もの（せいかい していた もの＝復習）
//   4) あまったら：まだの もの → いちばん じかんの ちかい もの
//  こたえる たびに きろくを つける（とちゅうで やめても こたえた ぶんは のこる）。
//  きめかたの こんきょ：こどもの きおくを まねた しさん（2026-11-08）で、ひとまわり するまで 出さない
//  いままでの しくみより、にがてな もんだいが よく おぼえられる ことを たしかめた。
// =============================================================
import type { KenteiLevel, KenteiQuestion } from '../data/kentei'

export const KENTEI_DECK_KEY = 'chomushi.kentei.v2'
const OLD_KEY_V1 = 'chomushi.kentei.v1' // まえの「ひとまわりするまで 出さない」きろく

export interface QStat {
  n: number // 出た かいすう
  ok: number // せいかい した かいすう
  streak: number // いまの れんぞく せいかい
  last: number // さいごに 出た 回
}

export interface LevelDeck {
  round: number // いままでに やった 回の かず
  q: Record<number, QStat> // もんだい番号 → きろく
}

export type Deck = Record<KenteiLevel, LevelDeck>

// ---- ちょうせい できる あたい ----
export const WEAK_MAX = 4 // 1回に いれる「まえに まちがえた もんだい」の さいだい
export const NEW_MIN = 6 // 1回に いれる「まだ 出ていない もんだい」の さいてい（のこっていれば）
const STREAK_GAP = [1, 3, 6, 12] // つぎに 出すまで あける 回数（れんぞく せいかい 0／1／2／3いじょう）
export const MASTER_STREAK = 2 // れんぞく これだけ せいかいで「おぼえた」

const emptyLevel = (): LevelDeck => ({ round: 0, q: {} })
const empty = (): Deck => ({ beginner: emptyLevel(), intermediate: emptyLevel() })

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

function normalizeLevel(raw: unknown): LevelDeck {
  // まえの かたち（出した 番号の ならび）は「1かい 出て せいかい」あつかいで ひきつぐ
  if (Array.isArray(raw)) {
    const q: Record<number, QStat> = {}
    for (const no of raw) if (typeof no === 'number') q[no] = { n: 1, ok: 1, streak: 1, last: 0 }
    return { round: raw.length > 0 ? 1 : 0, q }
  }
  if (!raw || typeof raw !== 'object') return emptyLevel()
  const d = raw as { round?: unknown; q?: unknown }
  const q: Record<number, QStat> = {}
  if (d.q && typeof d.q === 'object') {
    for (const [k, v] of Object.entries(d.q as Record<string, unknown>)) {
      const no = Number(k)
      if (!Number.isFinite(no) || !v || typeof v !== 'object') continue
      const s = v as Partial<QStat>
      const n = num(s.n)
      q[no] = { n, ok: Math.min(n, num(s.ok)), streak: num(s.streak), last: num(s.last) }
    }
  }
  return { round: num(d.round), q }
}

// バックアップからも よぶ（まえの かたちも うけつける）
export function normalizeDeck(raw: unknown): Deck {
  if (!raw || typeof raw !== 'object') return empty()
  const d = raw as Partial<Record<KenteiLevel, unknown>>
  return { beginner: normalizeLevel(d.beginner), intermediate: normalizeLevel(d.intermediate) }
}

export function loadDeck(): Deck {
  try {
    const raw = localStorage.getItem(KENTEI_DECK_KEY)
    if (raw) return normalizeDeck(JSON.parse(raw))
    const old = localStorage.getItem(OLD_KEY_V1)
    return old ? normalizeDeck(JSON.parse(old)) : empty()
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

// -------------------------------------------------------------
//  えらびかたの なかみ（localStorage を つかわない ので しさんにも つかえる）
// -------------------------------------------------------------
const missRate = (s: QStat) => 1 - (s.ok + 0.5) / (s.n + 1)
const gapOf = (s: QStat) => STREAK_GAP[Math.min(s.streak, STREAK_GAP.length - 1)]
// 1いじょうで「じかんが きた」。おおきい ほど ながく まっている
export const overdue = (s: QStat, round: number) => (round - s.last) / gapOf(s)
// さきに 出す じゅん：ながく まっている／まちがいが おおい／いま まちがえている ほど たかい
export const priorityOf = (s: QStat, round: number) =>
  overdue(s, round) * (1 + 2 * missRate(s)) * (s.streak === 0 ? 2 : 1)

// おもみつきで k こ えらぶ（おなじ ものは 2どと えらばない。Efraimidis–Spirakis 方式）
function weightedSample<T>(items: T[], weight: (x: T) => number, k: number, rand: () => number): T[] {
  return items
    .map((x) => ({ x, key: Math.pow(rand(), 1 / Math.max(1e-9, weight(x))) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((e) => e.x)
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// round 回めの 10もんを えらぶ
export function chooseNos(
  deck: LevelDeck,
  nos: number[],
  count: number,
  round: number,
  rand: () => number = Math.random,
): number[] {
  const out: number[] = []
  const take = (xs: number[]) => {
    for (const x of xs) if (out.length < count && !out.includes(x)) out.push(x)
  }
  const st = (no: number) => deck.q[no]
  const seen = nos.filter((no) => st(no)?.n > 0)
  const unseen = nos.filter((no) => !(st(no)?.n > 0))
  const due = seen.filter((no) => overdue(st(no), round) >= 1)
  const prio = (no: number) => priorityOf(st(no), round)
  take(weightedSample(due.filter((no) => st(no).streak === 0), prio, WEAK_MAX, rand)) // 1) まちがえた もの
  take(weightedSample(unseen, () => 1, NEW_MIN, rand)) // 2) まだの もの
  take(weightedSample(due, prio, count, rand)) // 3) じかんの きた もの
  take(weightedSample(unseen, () => 1, count, rand)) // 4) あまり
  take(weightedSample(seen, prio, count, rand))
  return shuffle(out, rand)
}

export function recordAnswer(deck: LevelDeck, no: number, correct: boolean, round: number): LevelDeck {
  const s = deck.q[no] ?? { n: 0, ok: 0, streak: 0, last: 0 }
  const next: QStat = {
    n: s.n + 1,
    ok: s.ok + (correct ? 1 : 0),
    streak: correct ? s.streak + 1 : 0,
    last: round,
  }
  return { ...deck, q: { ...deck.q, [no]: next } }
}

// -------------------------------------------------------------
//  がめんから よぶ もの
// -------------------------------------------------------------
export interface DrawResult {
  round: number
  questions: KenteiQuestion[]
  review: Set<number> // まえに まちがえて、もういちど 出す もんだい
}

// あたらしい 回を はじめて 10もん えらぶ
export function drawQuestions(level: KenteiLevel, all: KenteiQuestion[], count: number): DrawResult {
  const deck = loadDeck()
  const lv = deck[level]
  const round = lv.round + 1
  saveDeck({ ...deck, [level]: { ...lv, round } })
  const nos = chooseNos(lv, all.map((q) => q.no), count, round)
  const byNo = new Map(all.map((q) => [q.no, q]))
  const review = new Set(nos.filter((no) => (lv.q[no]?.n ?? 0) > 0 && lv.q[no].streak === 0))
  return { round, questions: nos.map((no) => byNo.get(no)!).filter(Boolean), review }
}

// こたえた ときに きろく する
export function saveAnswer(level: KenteiLevel, no: number, correct: boolean, round: number): void {
  const deck = loadDeck()
  saveDeck({ ...deck, [level]: recordAnswer(deck[level], no, correct, round) })
}

// 級えらびに 出す かず：おぼえた／にがて／まだ
export function progressOf(
  level: KenteiLevel,
  all: KenteiQuestion[],
): { mastered: number; weak: number; unseen: number; total: number } {
  const q = loadDeck()[level].q
  let mastered = 0
  let weak = 0
  let unseen = 0
  for (const { no } of all) {
    const s = q[no]
    if (!s || s.n === 0) unseen++
    else if (s.streak === 0) weak++
    else if (s.streak >= MASTER_STREAK) mastered++
  }
  return { mastered, weak, unseen, total: all.length }
}
