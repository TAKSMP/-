// =============================================================
//  わざ道場の えいごもんだい
// -------------------------------------------------------------
//  ・write：ひっき（かく）もんだい ／ listen：リスニング
//  ・pattern 1〜5 ごとに 3もん（テスト用）。ふやす ときは QUESTIONS に ならべるだけ
//  ・tier：パターンの むずかしさ（1〜3）。わざが つよい ほど むずかしい パターンを だす
// =============================================================
export type QuizMode = 'write' | 'listen'
export type QuizFmt = 'choice' | 'input'

export interface EnglishQ {
  id: string
  mode: QuizMode
  pattern: 1 | 2 | 3 | 4 | 5
  fmt: QuizFmt
  title: string // もんだいの しゅるい（あたまに 出す）
  body?: string // もんだい文
  emoji?: string
  speak?: string // リスニング：よみあげる えいご
  answers: string[] // せいかい（さいしょの 1つを 見せる）。にゅうりょくは どれでも OK
  choices?: string[] // えらぶ もんだい：せいかいを ふくむ
  pics?: Record<string, string> // リスニングで えいごの えらびかたを よめない こ むけ：えらびかた → イラスト（えもじ）
  hint?: string
}

// -------------------------------------------------------------
//  ひっき（しんわざの しゅうとく）
// -------------------------------------------------------------
const WD = 'えいごの いみを えらぼう（にちじょうの ことば）'
const WS = 'ものがたり：なんて いった？ えいごを えらぼう'
const W1 = '日本語を えいごに しよう（えらぶ）'
const W2 = 'えいごの いみを えらぼう'
const W3 = 'えいごを えらぼう（つづり）'
const W4 = 'ぶんの □に はいる ことばを えらぼう'
const W5 = 'ぶんの □に はいる ことばを えらぼう（つづり）'

const WRITE: EnglishQ[] = [
  // ① にちじょうの ことば（えいご → 日本語）
  { id: 'wd1a', mode: 'write', pattern: 1, fmt: 'choice', title: WD, body: 'Good morning', answers: ['おはよう'], choices: ['おはよう', 'おやすみ', 'さようなら', 'いただきます'] },
  { id: 'wd1b', mode: 'write', pattern: 1, fmt: 'choice', title: WD, body: 'Thank you', answers: ['ありがとう'], choices: ['ありがとう', 'ごめんなさい', 'こんにちは', 'おめでとう'] },
  { id: 'wd1c', mode: 'write', pattern: 1, fmt: 'choice', title: WD, body: 'Good night', answers: ['おやすみ'], choices: ['おやすみ', 'おはよう', 'いただきます', 'ただいま'] },
  { id: 'wd1d', mode: 'write', pattern: 1, fmt: 'choice', title: WD, body: 'I am hungry.', answers: ['おなかが すいた'], choices: ['おなかが すいた', 'ねむい', 'たのしい', 'さむい'] },
  { id: 'wd1e', mode: 'write', pattern: 1, fmt: 'choice', title: WD, body: 'See you!', answers: ['またね'], choices: ['またね', 'はじめまして', 'いただきます', 'ごちそうさま'] },

  // ③ 虫の ものがたり：なんて いった？（日本語の おはなし → えいごの ことば）
  { id: 'wd3a', mode: 'write', pattern: 3, fmt: 'choice', title: WS, emoji: '🦋', body: 'カマキリが、くものすに ひっかかった ちょうちょを たすけて あげた。\nちょうちょは なんて いった？', answers: ['Thank you'], choices: ['Thank you', 'Good morning', 'Help', 'Angry'] },
  { id: 'wd3b', mode: 'write', pattern: 3, fmt: 'choice', title: WS, emoji: '🐞', body: 'あさ、てんとうむしが ありに あった。\nなんて あいさつする？', answers: ['Good morning'], choices: ['Good morning', 'Good night', 'Sorry', 'Goodbye'] },
  { id: 'wd3c', mode: 'write', pattern: 3, fmt: 'choice', title: WS, emoji: '🪲', body: 'かぶとむしが ころんで しまった。\nくわがたは なんて きいた？', answers: ['Are you OK?', 'Are you OK'], choices: ['Are you OK?', 'I am hungry', 'Good night', 'See you'] },
  { id: 'wd3d', mode: 'write', pattern: 3, fmt: 'choice', title: WS, emoji: '✨', body: 'よるに なった。ほたるは おともだちに なんて いう？', answers: ['Good night'], choices: ['Good night', 'Good morning', 'Thank you', 'Sorry'] },

  // 虫の たんご：日本語 → えいご（4たく）
  { id: 'w1a', mode: 'write', pattern: 2, fmt: 'choice', title: W1, emoji: '🦋', body: 'ちょうちょ', answers: ['butterfly'], choices: ['butterfly', 'beetle', 'spider', 'ant'] },
  { id: 'w1b', mode: 'write', pattern: 2, fmt: 'choice', title: W1, emoji: '🪲', body: 'かぶとむし', answers: ['beetle'], choices: ['bee', 'beetle', 'butterfly', 'worm'] },
  { id: 'w1c', mode: 'write', pattern: 2, fmt: 'choice', title: W1, emoji: '🐞', body: 'てんとうむし', answers: ['ladybug'], choices: ['ladybug', 'firefly', 'cricket', 'mosquito'] },

  // 虫の たんご：えいご → 日本語（4たく）
  { id: 'w2a', mode: 'write', pattern: 2, fmt: 'choice', title: W2, body: 'dragonfly', answers: ['とんぼ'], choices: ['とんぼ', 'せみ', 'かまきり', 'はち'] },
  { id: 'w2b', mode: 'write', pattern: 2, fmt: 'choice', title: W2, body: 'caterpillar', answers: ['あおむし（けむし）'], choices: ['あおむし（けむし）', 'みみず', 'かたつむり', 'こおろぎ'] },
  { id: 'w2c', mode: 'write', pattern: 2, fmt: 'choice', title: W2, body: 'grasshopper', answers: ['ばった'], choices: ['ばった', 'あり', 'ほたる', 'くも'] },

  // 虫の たんご：つづりを えらぶ
  { id: 'w3a', mode: 'write', pattern: 2, fmt: 'choice', title: W3, emoji: '🐝', body: 'はち', answers: ['bee'], choices: ['bee', 'ant', 'fly', 'bat'] },
  { id: 'w3b', mode: 'write', pattern: 2, fmt: 'choice', title: W3, emoji: '🐜', body: 'あり', answers: ['ant'], choices: ['ant', 'art', 'and', 'arm'] },
  { id: 'w3c', mode: 'write', pattern: 2, fmt: 'choice', title: W3, emoji: '🕷️', body: 'くも', answers: ['spider'], choices: ['spider', 'spinner', 'spicy', 'spoon'] },

  // ④ ぶんの あなうめ（4たく）
  { id: 'w4a', mode: 'write', pattern: 4, fmt: 'choice', title: W4, body: 'A spider has eight □.\n（くもは 8ほんの □を もつ）', answers: ['legs'], choices: ['legs', 'wings', 'hands', 'ears'] },
  { id: 'w4b', mode: 'write', pattern: 4, fmt: 'choice', title: W4, body: 'I □ a beetle in the park.\n（こうえんで かぶとむしを みつけた）', answers: ['found'], choices: ['find', 'found', 'finding', 'finds'] },
  { id: 'w4c', mode: 'write', pattern: 4, fmt: 'choice', title: W4, body: 'Fireflies □ at night.\n（ほたるは よる ひかる）', answers: ['shine'], choices: ['shine', 'shines', 'shined', 'shining'] },

  // ⑤ ぶんの あなうめ（にゅうりょく）
  { id: 'w5a', mode: 'write', pattern: 5, fmt: 'choice', title: W5, body: 'Butterflies have beautiful □.\n（ちょうちょは きれいな □を もつ）', answers: ['wings'], choices: ['wings', 'wins', 'wind', 'wigs'] },
  { id: 'w5b', mode: 'write', pattern: 5, fmt: 'choice', title: W5, body: 'An insect has □ legs.\n（こんちゅうは □ほんの あし）', answers: ['six', '6'], choices: ['six', 'sit', 'sick', 'seven'] },
  { id: 'w5c', mode: 'write', pattern: 5, fmt: 'choice', title: W5, body: 'Ants are very □.\n（ありは とても ちいさい）', answers: ['small', 'tiny'], choices: ['small', 'tall', 'smell', 'snail'] },
]

// -------------------------------------------------------------
//  リスニング（わざを きたえる）。speak を こえで よみあげる
// -------------------------------------------------------------
const LB = 'こえを きいて、どんな 虫か えらぼう'
const L1 = 'こえを きいて、いみを えらぼう'
const L2 = 'こえを きいて、こたえを えらぼう'
const L3 = 'こえを きいて、つづりを えらぼう'
const L4 = 'ぶんを きいて、いみを えらぼう'
const L5 = 'ぶんを きいて、おなじ ぶんを えらぼう'

const LISTEN: EnglishQ[] = [
  // ① にちじょうの ことばを きいて いみを えらぶ
  { id: 'ld1a', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'Good morning', answers: ['おはよう'], choices: ['おはよう', 'おやすみ', 'さようなら', 'いただきます'] },
  { id: 'ld1b', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'Thank you', answers: ['ありがとう'], choices: ['ありがとう', 'ごめんなさい', 'こんにちは', 'おめでとう'] },
  { id: 'ld1c', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'I am hungry', answers: ['おなかが すいた'], choices: ['おなかが すいた', 'ねむい', 'たのしい', 'さむい'] },
  { id: 'ld1d', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'See you', answers: ['またね'], choices: ['またね', 'はじめまして', 'いただきます', 'ごちそうさま'] },

  // ③ どんな 虫？（いろ・おおきさ ＋ 虫）
  { id: 'ld3a', mode: 'listen', pattern: 3, fmt: 'choice', title: LB, speak: 'Blue butterfly', answers: ['あおい ちょうちょ'], choices: ['あおい ちょうちょ', 'やわらかい ちょうちょ', 'あかい ちょうちょ', 'おおきい ちょうちょ'] },
  { id: 'ld3b', mode: 'listen', pattern: 3, fmt: 'choice', title: LB, speak: 'Big beetle', answers: ['おおきい かぶとむし'], choices: ['おおきい かぶとむし', 'ちいさい かぶとむし', 'あかい かぶとむし', 'はやい かぶとむし'] },
  { id: 'ld3c', mode: 'listen', pattern: 3, fmt: 'choice', title: LB, speak: 'Red ladybug', answers: ['あかい てんとうむし'], choices: ['あかい てんとうむし', 'あおい てんとうむし', 'ちいさい てんとうむし', 'くろい てんとうむし'] },
  { id: 'ld3d', mode: 'listen', pattern: 3, fmt: 'choice', title: LB, speak: 'Small ant', answers: ['ちいさい あり'], choices: ['ちいさい あり', 'おおきい あり', 'くろい はち', 'ちいさい くも'] },

  // ① たんごを きいて いみを えらぶ
  { id: 'l1a', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'butterfly', answers: ['ちょうちょ'], choices: ['ちょうちょ', 'かぶとむし', 'はち', 'くも'] },
  { id: 'l1b', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'grasshopper', answers: ['ばった'], choices: ['ばった', 'あり', 'せみ', 'とんぼ'] },
  { id: 'l1c', mode: 'listen', pattern: 1, fmt: 'choice', title: L1, speak: 'caterpillar', answers: ['あおむし（けむし）'], choices: ['あおむし（けむし）', 'かたつむり', 'みみず', 'こおろぎ'] },

  // ② いろ・かずを きいて えらぶ
  { id: 'l2a', mode: 'listen', pattern: 2, fmt: 'choice', title: L2, speak: 'seven', answers: ['7'], choices: ['5', '6', '7', '8'] },
  { id: 'l2b', mode: 'listen', pattern: 2, fmt: 'choice', title: L2, speak: 'yellow', answers: ['きいろ'], choices: ['あか', 'あお', 'きいろ', 'みどり'] },
  { id: 'l2c', mode: 'listen', pattern: 2, fmt: 'choice', title: L2, speak: 'green', answers: ['みどり'], choices: ['みどり', 'しろ', 'くろ', 'ももいろ'] },

  // ③ たんごを きいて にゅうりょく
  { id: 'l3a', mode: 'listen', pattern: 3, fmt: 'choice', title: L3, speak: 'bee', answers: ['bee'], choices: ['bee', 'pea', 'bed', 'bean'], pics: {'bee': '🐝', 'pea': '🫛', 'bed': '🛏️', 'bean': '🫘'} },
  { id: 'l3b', mode: 'listen', pattern: 3, fmt: 'choice', title: L3, speak: 'leaf', answers: ['leaf'], choices: ['leaf', 'leg', 'loaf', 'lie'], pics: {'leaf': '🍃', 'leg': '🦵', 'loaf': '🍞', 'lie': '🤥'} },
  { id: 'l3c', mode: 'listen', pattern: 3, fmt: 'choice', title: L3, speak: 'flower', answers: ['flower'], choices: ['flower', 'floor', 'flour', 'flavor'], pics: {'flower': '🌸', 'floor': '🪵', 'flour': '🌾', 'flavor': '😋'} },

  // ④ みじかい ぶんを きいて いみを えらぶ
  { id: 'l4a', mode: 'listen', pattern: 4, fmt: 'choice', title: L4, speak: 'I found a big beetle.', answers: ['おおきい かぶとむしを みつけた'], choices: ['おおきい かぶとむしを みつけた', 'ちいさい ありを みつけた', 'かぶとむしを にがした', 'おおきい かえるを みた'] },
  { id: 'l4b', mode: 'listen', pattern: 4, fmt: 'choice', title: L4, speak: 'The butterfly is on the flower.', answers: ['ちょうちょが はなの うえに いる'], choices: ['ちょうちょが はなの うえに いる', 'ちょうちょが はなの したに いる', 'はちが はなの うえに いる', 'ちょうちょが いえに はいった'] },
  { id: 'l4c', mode: 'listen', pattern: 4, fmt: 'choice', title: L4, speak: 'Bugs live in the forest.', answers: ['むしは もりに すんでいる'], choices: ['むしは もりに すんでいる', 'むしは うみに すんでいる', 'むしは もりで ねている', 'むしは そらを とんでいる'] },

  // ⑤ ぶんを きいて ぜんぶ にゅうりょく
  { id: 'l5a', mode: 'listen', pattern: 5, fmt: 'choice', title: L5, speak: 'I like bugs.', answers: ['I like bugs.'], choices: ['I like bugs.', 'I like bags.', 'I like bees.', 'I lick bugs.'], pics: {'I like bugs.': '🐛❤️', 'I like bags.': '👜❤️', 'I like bees.': '🐝❤️', 'I lick bugs.': '👅🐛'} },
  { id: 'l5b', mode: 'listen', pattern: 5, fmt: 'choice', title: L5, speak: 'The bee is small.', answers: ['The bee is small.'], choices: ['The bee is small.', 'The bee is tall.', 'The bed is small.', 'The beet is small.'], pics: {'The bee is small.': '🐝🤏', 'The bee is tall.': '🐝📏', 'The bed is small.': '🛏️🤏', 'The beet is small.': '🥬🤏'} },
  { id: 'l5c', mode: 'listen', pattern: 5, fmt: 'choice', title: L5, speak: 'A frog is green.', answers: ['A frog is green.'], choices: ['A frog is green.', 'A frog is gray.', 'A dog is green.', 'A fog is green.'], pics: {'A frog is green.': '🐸🟢', 'A frog is gray.': '🐸🩶', 'A dog is green.': '🐶🟢', 'A fog is green.': '🌫️🟢'} },
]

export const QUESTIONS: EnglishQ[] = [...WRITE, ...LISTEN]

// パターンごとの むずかしさ
const PATTERN_LEVEL: Record<number, 1 | 2 | 3> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 }

// わざの むずかしさ（1〜3）に あう パターンから 10もん えらぶ
export const QUIZ_LENGTH = 10

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export function buildQuiz(mode: QuizMode, tier: 1 | 2 | 3, length = QUIZ_LENGTH): EnglishQ[] {
  // tier1: ①②③／tier2: ②③④／tier3: ③④⑤（まんなかの パターンを ちゅうしんに）
  const lo = tier
  const hi = tier + 2
  const pool = QUESTIONS.filter(
    (q) => q.mode === mode && q.pattern >= lo && q.pattern <= hi,
  )
  // もんだいが たりない ぶんは くりかえす（おなじ もんだいは OK）
  const out: EnglishQ[] = []
  while (out.length < length) {
    for (const q of shuffle(pool)) {
      if (out.length >= length) break
      out.push(q)
    }
  }
  return shuffle(out)
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

export function levelOfPattern(p: number): 1 | 2 | 3 {
  return PATTERN_LEVEL[p] ?? 1
}
