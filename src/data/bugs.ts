import type { BugSpecies } from '../types'

// ちょうむし図鑑の「ずかんデータ」。
// 身近でこどもに人気の虫を中心に集めました。
// color は AI（デモモード）が写真の色から虫を推理するときのヒントに使います。
// fact（せつめい）は、子どもが読めるように漢字をつかわず、
// ひらがな・カタカナ＋半角スペースで書いています。
export const BUG_SPECIES: BugSpecies[] = [
  {
    id: 'kabutomushi',
    name: 'カブトムシ',
    order: 'コウチュウ目',
    rarity: 4,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#5b3a29',
    fact: 'オスの ツノで けんかを するよ。よるに クヌギの きの しるを なめに くるんだ。',
  },
  {
    id: 'kuwagata',
    name: 'クワガタムシ',
    order: 'コウチュウ目',
    rarity: 4,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#2b2b2b',
    fact: 'おおきな アゴが トレードマーク。きの うろに かくれて いるよ。',
  },
  {
    id: 'monshirochou',
    name: 'モンシロチョウ',
    order: 'チョウ目',
    rarity: 1,
    habitat: 'くさむら',
    emoji: '🦋',
    color: '#f5f5f0',
    fact: 'キャベツばたけで よく みかける しろい チョウ。ようちゅうは アオムシだよ。',
  },
  {
    id: 'agehachou',
    name: 'アゲハチョウ',
    order: 'チョウ目',
    rarity: 2,
    habitat: 'にわ',
    emoji: '🦋',
    color: '#f2d43a',
    fact: 'きいろと くろの もよう。ミカンの はっぱに たまごを うむよ。',
  },
  {
    id: 'nanahoshi',
    name: 'ナナホシテントウ',
    order: 'コウチュウ目',
    rarity: 2,
    habitat: 'くさむら',
    emoji: '🐞',
    color: '#e23b2e',
    fact: 'あかい せなかに くろい てんが ななつ。アブラムシを たべるよ。',
  },
  {
    id: 'shouryoubatta',
    name: 'ショウリョウバッタ',
    order: 'バッタ目',
    rarity: 1,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#7cb342',
    fact: 'とがった あたまが とくちょう。とぶとき キチキチと おとを だすよ。',
  },
  {
    id: 'tonosamabatta',
    name: 'トノサマバッタ',
    order: 'バッタ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#8a9a3a',
    fact: 'ジャンプりょく バツグン！とても よく とぶ おおきな バッタ。',
  },
  {
    id: 'kamakiri',
    name: 'カマキリ',
    order: 'カマキリ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦖',
    color: '#6aa84f',
    fact: 'まえあしの カマで えものを つかまえる ハンター。たまごは あわの おうちの なか。',
  },
  {
    id: 'oniyanma',
    name: 'オニヤンマ',
    order: 'トンボ目',
    rarity: 4,
    habitat: 'かわ',
    emoji: '🪰',
    color: '#3a5c1e',
    fact: 'にっぽんで いちばん おおきい トンボ。めが とても おおきいよ。',
  },
  {
    id: 'akiakane',
    name: 'アキアカネ',
    order: 'トンボ目',
    rarity: 2,
    habitat: 'たんぼ',
    emoji: '🪰',
    color: '#d94f2b',
    fact: 'あきに なると あかく なる「あかとんぼ」の なかま。',
  },
  {
    id: 'aburazemi',
    name: 'アブラゼミ',
    order: 'カメムシ目',
    rarity: 2,
    habitat: 'き',
    emoji: '🐝',
    color: '#6b4423',
    fact: '「ジージー」と なく ちゃいろい セミ。あぶらで あげる おとに にて いるよ。',
  },
  {
    id: 'minminzemi',
    name: 'ミンミンゼミ',
    order: 'カメムシ目',
    rarity: 3,
    habitat: 'き',
    emoji: '🐝',
    color: '#2e7d32',
    fact: '「ミーンミンミン」と なく みどりいろの セミ。',
  },
  {
    id: 'kanabun',
    name: 'カナブン',
    order: 'コウチュウ目',
    rarity: 2,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#8a9a2b',
    fact: 'ピカピカ ひかる せなか。ブーンと とびながら きの しるを たべに くるよ。',
  },
  {
    id: 'tamamushi',
    name: 'タマムシ',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'き',
    emoji: '💚',
    color: '#00897b',
    fact: 'にじいろに かがやく とっても きれいな むし。みつけたら ラッキー！',
  },
  {
    id: 'mitsubachi',
    name: 'ミツバチ',
    order: 'ハチ目',
    rarity: 1,
    habitat: 'はなばたけ',
    emoji: '🐝',
    color: '#f6b93b',
    fact: 'はなの みつを あつめて ハチミツを つくる。おしりの ハリに きを つけて。',
  },
  {
    id: 'kumaari',
    name: 'クロオオアリ',
    order: 'ハチ目',
    rarity: 1,
    habitat: 'つち',
    emoji: '🐜',
    color: '#222222',
    fact: 'にっぽんで おおきめの アリ。みんなで ちからを あわせて はたらくよ。',
  },
  {
    id: 'dangomushi',
    name: 'ダンゴムシ',
    order: '甲殻類',
    rarity: 1,
    habitat: 'いしのした',
    emoji: '🪨',
    color: '#616161',
    fact: 'さわると まるく なる。じつは むしでは なく エビの なかまなんだ。',
  },
  {
    id: 'koganegumo',
    name: 'コガネグモ',
    order: 'クモガタ綱',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🕷️',
    color: '#fbc02d',
    fact: 'きいろと くろの しまもよう。おおきな あみを はって えものを まつよ。',
  },
  {
    id: 'suzumushi',
    name: 'スズムシ',
    order: 'バッタ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#3e3e3e',
    fact: '「リーンリーン」と きれいな おとで なく。あきの むしの だいひょうだよ。',
  },
  {
    id: 'genjibotaru',
    name: 'ゲンジボタル',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'かわ',
    emoji: '✨',
    color: '#c6ff00',
    fact: 'おしりが ひかる よるの むし。きれいな みずの そばにしか いないよ。',
  },
  {
    id: 'hanmyou',
    name: 'ハンミョウ',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'やまみち',
    emoji: '🌈',
    color: '#7e57c2',
    fact: 'ひとの まえを とびながら みちあんない する みたいに うごく。いろが とても きれい。',
  },
]

// 「目（order）」のいちらん。検索ページのフィルタに使います。
export const ALL_ORDERS = Array.from(
  new Set(BUG_SPECIES.map((b) => b.order)),
)

// 「生息地（habitat）」のいちらん。
export const ALL_HABITATS = Array.from(
  new Set(BUG_SPECIES.map((b) => b.habitat)),
)

export function getSpeciesById(id: string): BugSpecies | undefined {
  return BUG_SPECIES.find((b) => b.id === id)
}

// ひらがな→カタカナに変換して、名前を照合しやすくする
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  )
}
function normalizeName(s: string): string {
  return toKatakana(s.trim().replace(/\s+/g, ''))
}

// 同じ虫かどうかを名前で判定するための正規化（外から使う）
export function normalizeBugName(s: string): string {
  return normalizeName(s)
}

// 名前から図鑑データをさがす（完全一致→部分一致）。
// 訂正した名前をもとに、正しい虫の種類（＝説明文など）を引き当てるのに使う。
export function findSpeciesByName(name: string): BugSpecies | undefined {
  const q = normalizeName(name)
  if (!q) return undefined
  const exact = BUG_SPECIES.find((b) => normalizeName(b.name) === q)
  if (exact) return exact
  return BUG_SPECIES.find((b) => {
    const n = normalizeName(b.name)
    return n.includes(q) || q.includes(n)
  })
}
