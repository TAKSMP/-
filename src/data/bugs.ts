import type { BugSpecies } from '../types'

// ちょうむし図鑑の「ずかんデータ」。
// 身近でこどもに人気の虫を中心に集めました。
// color は AI（デモモード）が写真の色から虫を推理するときのヒントに使います。
export const BUG_SPECIES: BugSpecies[] = [
  {
    id: 'kabutomushi',
    name: 'カブトムシ',
    order: 'コウチュウ目',
    rarity: 4,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#5b3a29',
    fact: 'オスのツノでけんかをするよ。夜にクヌギの木のしるをなめにくるんだ。',
  },
  {
    id: 'kuwagata',
    name: 'クワガタムシ',
    order: 'コウチュウ目',
    rarity: 4,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#2b2b2b',
    fact: '大きなアゴがトレードマーク。木のうろにかくれているよ。',
  },
  {
    id: 'monshirochou',
    name: 'モンシロチョウ',
    order: 'チョウ目',
    rarity: 1,
    habitat: 'くさむら',
    emoji: '🦋',
    color: '#f5f5f0',
    fact: 'キャベツ畑でよく見かける白いチョウ。よう虫はアオムシだよ。',
  },
  {
    id: 'agehachou',
    name: 'アゲハチョウ',
    order: 'チョウ目',
    rarity: 2,
    habitat: 'にわ',
    emoji: '🦋',
    color: '#f2d43a',
    fact: '黄色と黒のもよう。ミカンの葉っぱにたまごをうむよ。',
  },
  {
    id: 'nanahoshi',
    name: 'ナナホシテントウ',
    order: 'コウチュウ目',
    rarity: 2,
    habitat: 'くさむら',
    emoji: '🐞',
    color: '#e23b2e',
    fact: '赤いせなかに黒い点が7つ。アブラムシを食べるよ。',
  },
  {
    id: 'shouryoubatta',
    name: 'ショウリョウバッタ',
    order: 'バッタ目',
    rarity: 1,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#7cb342',
    fact: 'とがった頭がとくちょう。とぶときキチキチと音を出すよ。',
  },
  {
    id: 'tonosamabatta',
    name: 'トノサマバッタ',
    order: 'バッタ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#8a9a3a',
    fact: 'ジャンプ力バツグン！とてもよくとぶ大きなバッタ。',
  },
  {
    id: 'kamakiri',
    name: 'カマキリ',
    order: 'カマキリ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦖',
    color: '#6aa84f',
    fact: '前あしのカマでえものをつかまえるハンター。たまごはあわのおうちの中。',
  },
  {
    id: 'oniyanma',
    name: 'オニヤンマ',
    order: 'トンボ目',
    rarity: 4,
    habitat: 'かわ',
    emoji: '🪰',
    color: '#3a5c1e',
    fact: '日本でいちばん大きいトンボ。目がとても大きいよ。',
  },
  {
    id: 'akiakane',
    name: 'アキアカネ',
    order: 'トンボ目',
    rarity: 2,
    habitat: 'たんぼ',
    emoji: '🪰',
    color: '#d94f2b',
    fact: 'あきになると赤くなる「あかとんぼ」のなかま。',
  },
  {
    id: 'aburazemi',
    name: 'アブラゼミ',
    order: 'カメムシ目',
    rarity: 2,
    habitat: 'き',
    emoji: '🐝',
    color: '#6b4423',
    fact: '「ジージー」となく茶色いセミ。あぶらであげる音ににているよ。',
  },
  {
    id: 'minminzemi',
    name: 'ミンミンゼミ',
    order: 'カメムシ目',
    rarity: 3,
    habitat: 'き',
    emoji: '🐝',
    color: '#2e7d32',
    fact: '「ミーンミンミン」となく緑色のセミ。',
  },
  {
    id: 'kanabun',
    name: 'カナブン',
    order: 'コウチュウ目',
    rarity: 2,
    habitat: 'ぞうきばやし',
    emoji: '🪲',
    color: '#8a9a2b',
    fact: 'ピカピカ光るせなか。ブーンととびながら木のしるを食べにくるよ。',
  },
  {
    id: 'tamamushi',
    name: 'タマムシ',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'き',
    emoji: '💚',
    color: '#00897b',
    fact: 'にじ色にかがやくとってもきれいな虫。見つけたらラッキー！',
  },
  {
    id: 'mitsubachi',
    name: 'ミツバチ',
    order: 'ハチ目',
    rarity: 1,
    habitat: 'はなばたけ',
    emoji: '🐝',
    color: '#f6b93b',
    fact: '花のみつをあつめてハチミツを作る。おしりのハリに気をつけて。',
  },
  {
    id: 'kumaari',
    name: 'クロオオアリ',
    order: 'ハチ目',
    rarity: 1,
    habitat: 'つち',
    emoji: '🐜',
    color: '#222222',
    fact: '日本で大きめのアリ。みんなで力を合わせてはたらくよ。',
  },
  {
    id: 'dangomushi',
    name: 'ダンゴムシ',
    order: 'ワラジムシ目',
    rarity: 1,
    habitat: 'いしのした',
    emoji: '🪨',
    color: '#616161',
    fact: 'さわるとまるくなる。じつは虫ではなくエビのなかまなんだ。',
  },
  {
    id: 'katatsumuri',
    name: 'カタツムリ',
    order: 'マイマイ目',
    rarity: 2,
    habitat: 'はっぱのうら',
    emoji: '🐌',
    color: '#a1887f',
    fact: 'せなかにおうちをせおっている。雨の日に元気になるよ。',
  },
  {
    id: 'koganegumo',
    name: 'コガネグモ',
    order: 'クモ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🕷️',
    color: '#fbc02d',
    fact: '黄色と黒のしまもよう。大きなあみをはってえものをまつよ。',
  },
  {
    id: 'suzumushi',
    name: 'スズムシ',
    order: 'バッタ目',
    rarity: 3,
    habitat: 'くさむら',
    emoji: '🦗',
    color: '#3e3e3e',
    fact: '「リーンリーン」ときれいな音でなく。あきの虫の代表だよ。',
  },
  {
    id: 'genjibotaru',
    name: 'ゲンジボタル',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'かわ',
    emoji: '✨',
    color: '#c6ff00',
    fact: 'おしりが光る夜の虫。きれいな水のそばにしかいないよ。',
  },
  {
    id: 'hanmyou',
    name: 'ハンミョウ',
    order: 'コウチュウ目',
    rarity: 5,
    habitat: 'やまみち',
    emoji: '🌈',
    color: '#7e57c2',
    fact: '人の前をとびながら道あんないするみたいに動く。色がとてもきれい。',
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
