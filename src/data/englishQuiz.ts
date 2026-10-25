// =============================================================
//  わざ道場の えいごもんだい
// -------------------------------------------------------------
//  ・write：ひっき（しんわざの しゅうとく）／ listen：リスニング（わざを きたえる）
//  ・level 1〜3：わざの つよさ（★1〜3）に あわせて だす。各レベル 200もん（ふつう100 + むずかしい100。englishBank.json）
//  ・ぜんぶ 4たく。えらびかたの ならびは まいかい ランダム（まえと おなじ ばしょに こたえが こない）
// =============================================================
import BANK from './englishBank.json'

export type QuizMode = 'write' | 'listen'
export type QuizFmt = 'choice' | 'input'

export interface EnglishQ {
  id: string
  mode: QuizMode
  level: 1 | 2 | 3
  kind?: string // もんだいの しゅるい（たんご・ものがたり など）
  fmt: QuizFmt
  title: string // もんだいの しゅるい（あたまに 出す）
  body?: string // もんだい文
  emoji?: string
  speak?: string // リスニング：よみあげる えいご
  answers: string[] // せいかい（さいしょの 1つを 見せる）
  choices?: string[] // えらびかた：せいかいを ふくむ（ならびは arrangeChoices で まぜる）
  hint?: string
  why?: string // まちがえた とき だす、こどもむけの かんたんな かいせつ
  pics?: Record<string, string> // えいごの えらびかた → イラスト（えもじ）
}

export const QUESTIONS: EnglishQ[] = BANK as EnglishQ[]

export const QUIZ_LENGTH = 15

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// わざの むずかしさ（★1〜3）ごとの もんだいの まぜかた [Lv1, Lv2, Lv3]（ごうけい 15もん）
export const QUIZ_MIX: Record<1 | 2 | 3, [number, number, number]> = {
  1: [9, 6, 0],
  2: [3, 8, 4],
  3: [0, 4, 11],
}

// ★の かずに あわせて 15もん（やさしい じゅんに ならべる。おなじ テストの なかでは かぶらない）
export function buildQuiz(mode: QuizMode, tier: 1 | 2 | 3): EnglishQ[] {
  const out: EnglishQ[] = []
  QUIZ_MIX[tier].forEach((n, i) => {
    const pool = shuffle(QUESTIONS.filter((q) => q.mode === mode && q.level === i + 1))
    out.push(...pool.slice(0, n))
  })
  return out
}

// -------------------------------------------------------------
//  えらびかたの ならび：まいかい ランダム。
//  おなじ もんだいが また でても、こたえが まえと おなじ ばしょに ならない ように する
// -------------------------------------------------------------
const POS_KEY = 'chomushi.quizpos.v1'
let lastPos: Record<string, number> | null = null

function loadPos(): Record<string, number> {
  if (lastPos) return lastPos
  try {
    lastPos = JSON.parse(localStorage.getItem(POS_KEY) ?? '{}') ?? {}
  } catch {
    lastPos = {}
  }
  return lastPos!
}

export function arrangeChoices(q: EnglishQ): string[] {
  const choices = q.choices ?? []
  if (choices.length < 2) return [...choices]
  const pos = loadPos()
  const prev = pos[q.id]
  const ans = (c: string) => q.answers.includes(c)
  let out = shuffle(choices)
  for (let i = 0; i < 20 && out.findIndex(ans) === prev; i++) out = shuffle(choices)
  pos[q.id] = out.findIndex(ans)
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos))
  } catch {
    /* むし */
  }
  return out
}

// こたえあわせ（おおきい ちいさい・くとうてんは むし）
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,!?'"’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCorrect(q: EnglishQ, given: string): boolean {
  const g = normalizeAnswer(given)
  return q.answers.some((a) => normalizeAnswer(a) === g)
}
