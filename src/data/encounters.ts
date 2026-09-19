// =============================================================
//  であいの おはなし（ストーリーモード）
// -------------------------------------------------------------
//  マスに はいった ときに 出る みじかい おはなし。
//  虫の しゅるい（目）に あった おはなしが えらばれる。
//  おなじ マップの 中では ぜったいに かぶらない。
// =============================================================
import { canonicalOrder } from './orders'

// おはなしの ばめん わけ
export type SceneTag = 'sky' | 'ground' | 'tree' | 'water' | 'hide' | 'any'

export interface Encounter {
  id: string
  tags: SceneTag[]
  emoji: string
  text: (name: string) => string
}

// 目（もく）→ にあう ばめん
const ORDER_TAGS: Record<string, SceneTag[]> = {
  チョウ目: ['sky', 'tree'],
  トンボ目: ['sky', 'water'],
  ハチ目: ['sky', 'tree'],
  ハエ目: ['sky', 'ground'],
  コウチュウ目: ['tree', 'ground'],
  カメムシ目: ['tree', 'ground'],
  バッタ目: ['ground', 'hide'],
  カマキリ目: ['hide', 'ground'],
  ナナフシ目: ['hide', 'tree'],
  アミメカゲロウ目: ['sky', 'water'],
  カゲロウ目: ['water', 'sky'],
  トビケラ目: ['water'],
  クモガタ綱: ['hide', 'tree'],
  多足類: ['ground', 'hide'],
  甲殻類: ['ground', 'water'],
}

export const ENCOUNTERS: Encounter[] = [
  // --- そら ---
  { id: 'sky1', tags: ['sky'], emoji: '☁️', text: (n) => `じめんに ゆらゆら うごく かげが 見えた。空を 見あげると、なんと ${n} が とんでいた！ こちらに 気づいた ${n} は、まっすぐ ふってきたぞ！` },
  { id: 'sky2', tags: ['sky'], emoji: '🌬️', text: (n) => `ひゅう と かぜが なった。かぜの むこうから ${n} が すべるように あらわれた。「いい かぜだ」と いうように、${n} が まいおりてくる！` },
  { id: 'sky3', tags: ['sky'], emoji: '☀️', text: (n) => `おひさまが まぶしくて 目を ほそめた そのとき、ひかりの 中から ${n} が とびだしてきた！ びっくりして のけぞる ひまも ない！` },
  { id: 'sky4', tags: ['sky'], emoji: '🌸', text: (n) => `はなの まわりを なにかが ぐるぐる まわっている。よく 見ると ${n} だ。じぶんの ばしょを とられると おもったのか、${n} が むかってきた！` },
  { id: 'sky5', tags: ['sky'], emoji: '🍃', text: (n) => `はっぱが 1まい、ひらり と おちてきた…と おもったら ${n} だった！ すがたを 見せた ${n} は、うれしそうに はねを ふるわせている。` },
  { id: 'sky6', tags: ['sky'], emoji: '⚡', text: (n) => `ぶーん という 音が どんどん 大きくなる。音の しょうたいは ${n}！ すごい はやさで まわりを とびまわりはじめた！` },
  // --- じめん・くさむら ---
  { id: 'gnd1', tags: ['ground'], emoji: '🌿', text: (n) => `くさが がさがさと ゆれた。そーっと のぞきこむと、そこに いたのは ${n}！ 目が あった しゅんかん、${n} が とびだしてきた！` },
  { id: 'gnd2', tags: ['ground'], emoji: '🪨', text: (n) => `大きな 石を そっと どかしてみた。ひんやりした つちの 上に ${n} が いる！ おこられたと おもったのか、${n} が かまえた！` },
  { id: 'gnd3', tags: ['ground'], emoji: '👣', text: (n) => `じめんに ちいさな あしあとが ならんでいる。たどっていくと…${n} が ふりかえった！ 「ついてこないで」と いうように、${n} が こうげきの ポーズ！` },
  { id: 'gnd4', tags: ['ground'], emoji: '🍂', text: (n) => `おちばの 山が もぞもぞ うごいている。ゆうきを 出して めくると、中から ${n} が とびだした！` },
  { id: 'gnd5', tags: ['ground'], emoji: '🌾', text: (n) => `せの たかい くさの あいだを すすんでいく。ふいに めのまえが ひらけて、${n} と ばったり 出会って しまった！` },
  { id: 'gnd6', tags: ['ground'], emoji: '🕳️', text: (n) => `つちの 上に ちいさな あなが あいている。じっと 見ていると、中から ${n} が ぬっと あらわれた！` },
  // --- 木・じゅえき ---
  { id: 'tre1', tags: ['tree'], emoji: '🌳', text: (n) => `木の みきから あまい においが する。じゅえきの 出る ばしょには、先きゃくの ${n} が いた！ 「ここは ぼくの ばしょだ」と ${n} が むねを はる！` },
  { id: 'tre2', tags: ['tree'], emoji: '🪵', text: (n) => `こしかけようと した きりかぶ。そこに いたのは ${n} だった！ おどろいた ${n} が、いきおいよく むかってくる！` },
  { id: 'tre3', tags: ['tree'], emoji: '🍁', text: (n) => `えだを ゆらすと、ぱらぱらと はっぱが おちてきた。いっしょに おりてきたのは ${n}！ たいせいを たてなおして、${n} が こちらを にらむ！` },
  { id: 'tre4', tags: ['tree'], emoji: '🐾', text: (n) => `木の かわの 下から カリカリと 音が する。そっと はがすと ${n} が かくれていた！ みつかった ${n} は、かくごを きめたようだ！` },
  { id: 'tre5', tags: ['tree'], emoji: '🌰', text: (n) => `木のみが ころころと ころがってきた。ころがしていたのは ${n}！ じゃまを されたと おもったのか、${n} が おこっている！` },
  // --- みずべ ---
  { id: 'wat1', tags: ['water'], emoji: '💧', text: (n) => `いけの みずめんに、とんと はもんが ひろがった。まんなかに いるのは ${n}！ みずしぶきを あげて、${n} が とびかかってきた！` },
  { id: 'wat2', tags: ['water'], emoji: '🌊', text: (n) => `かわの ながれの すぐ そば。すべらないように 足もとを 見ると、ぬれた 石の 上に ${n} が いた！` },
  { id: 'wat3', tags: ['water'], emoji: '🪷', text: (n) => `はすの はの 上で ひとやすみ している ${n} を みつけた。目が あうと、${n} は さっと たちあがった！` },
  { id: 'wat4', tags: ['water'], emoji: '🫧', text: (n) => `みずの 中から あわが ぷくぷく のぼってくる。しばらく 見ていると、${n} が いきおいよく 出てきた！` },
  // --- かくれる・ぎたい ---
  { id: 'hid1', tags: ['hide'], emoji: '🫥', text: (n) => `なにも いない はずの えだ。…でも なんだか へんだ。じっと 見ていると、えだの 1本が うごいた。${n} だ！` },
  { id: 'hid2', tags: ['hide'], emoji: '👀', text: (n) => `だれかに 見られている 気が する。ふりむくと、くさの かげから ${n} が じっと こちらを 見ていた！` },
  { id: 'hid3', tags: ['hide'], emoji: '🍃', text: (n) => `はっぱと おなじ いろ、おなじ かたち。でも 1つだけ ちがう。まばたきの あいだに ${n} が うごきだした！` },
  { id: 'hid4', tags: ['hide'], emoji: '🤫', text: (n) => `しずかだ。しずかすぎる。そっと 1ぽ ふみだした しゅんかん、まちぶせしていた ${n} が とびだしてきた！` },
  { id: 'hid5', tags: ['hide'], emoji: '🌙', text: (n) => `木かげが すこし こくなった。かげの 中で、${n} が ゆっくりと かまえを とっている！` },
  // --- どの虫でも ---
  { id: 'any1', tags: ['any'], emoji: '❗', text: (n) => `とつぜん めのまえに ${n} が あらわれた！ おたがい びっくりして、うごきが とまる。…さきに うごいたのは ${n} だった！` },
  { id: 'any2', tags: ['any'], emoji: '🔥', text: (n) => `${n} は どうやら きげんが わるいみたい。ちかづいた とたん、ぐっと からだを 大きく 見せて いかくしてきた！` },
  { id: 'any3', tags: ['any'], emoji: '🏁', text: (n) => `みちの まんなかで ${n} が とおせんぼ。よけて 通ろうと したけれど、${n} も おなじ ほうへ うごいてしまう。しょうぶ するしか なさそうだ！` },
  { id: 'any4', tags: ['any'], emoji: '🎵', text: (n) => `どこからか きれいな 音が きこえる。音の ぬしは ${n} だった。うたを とめられた ${n} は、ちょっと おこっている！` },
  { id: 'any5', tags: ['any'], emoji: '🍽️', text: (n) => `${n} が ごはんちゅうだった。おいしそうに たべている ところを じゃま されて、${n} が すごい いきおいで ふりむいた！` },
  { id: 'any6', tags: ['any'], emoji: '💤', text: (n) => `${n} が すやすや ねむっている。そーっと 通りすぎようと した その とき…ぽきっ。えだを ふんでしまった！ ${n} が ぱっちり 目を あけた！` },
  { id: 'any7', tags: ['any'], emoji: '🤝', text: (n) => `${n} が こちらを じっと 見ている。どうやら つよい あいてを さがしていたようだ。「きみで ためさせて」と いうように、${n} が かまえた！` },
  { id: 'any8', tags: ['any'], emoji: '🌀', text: (n) => `つむじかぜが まきおこった。すなぼこりが おさまると、まんなかに ${n} が たっていた！` },
  { id: 'any9', tags: ['any'], emoji: '🏃', text: (n) => `なにかが すごい はやさで よこぎった。おいかけた さきに いたのは ${n}！ ${n} も ひきさがる きは ないようだ！` },
  { id: 'any10', tags: ['any'], emoji: '🎁', text: (n) => `キラキラ ひかる ものを みつけた。ひろおうと 手を のばした しゅんかん、${n} が よこから とびだしてきた！` },
  { id: 'any11', tags: ['any'], emoji: '🧭', text: (n) => `みちに まよって しまった。あたりを 見まわすと、${n} が どうどうと まちかまえていた！` },
  { id: 'any12', tags: ['any'], emoji: '⚔️', text: (n) => `${n} が しっぽを ぴんと たてた。これは「かかってこい」の あいず。うけて たとう！` },
  { id: 'any13', tags: ['any'], emoji: '🌤️', text: (n) => `くもが きれて、あたりが ぱっと あかるくなった。ひかりの 中で ${n} が こちらに 気づいた！` },
  { id: 'any14', tags: ['any'], emoji: '👑', text: (n) => `この あたりで いちばん つよいと うわさの ${n}。うわさは ほんとうだった。${n} が ゆっくりと ちかづいてくる！` },
  { id: 'any15', tags: ['any'], emoji: '🫨', text: (n) => `じめんが かすかに ゆれた。ゆれの もとを たどると、${n} が ちからを ためているところだった！` },
  { id: 'any16', tags: ['any'], emoji: '🔎', text: (n) => `ずかんで 見た すがたと そっくりな かげ。ちかづいて たしかめると、やっぱり ${n} だ！ 気づかれた！` },
]

const byId = new Map(ENCOUNTERS.map((e) => [e.id, e]))
export function findEncounter(id: string | undefined): Encounter | undefined {
  return id ? byId.get(id) : undefined
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function tagsOfOrder(order: string): SceneTag[] {
  const co = canonicalOrder(order)
  return (co && ORDER_TAGS[co]) || []
}

// マップの 虫たちに、かぶらないように おはなしを わりあてる
export function assignEncounters(
  orders: string[],
  seed: string,
): string[] {
  const used = new Set<string>()
  return orders.map((order, i) => {
    const want = tagsOfOrder(order)
    const fits = (e: Encounter) =>
      e.tags.includes('any') || e.tags.some((t) => want.includes(t))
    // ①にあう＆まだ つかっていない → ②まだ つかっていない → ③ぜんぶから
    let pool = ENCOUNTERS.filter((e) => fits(e) && !used.has(e.id))
    if (pool.length === 0) pool = ENCOUNTERS.filter((e) => !used.has(e.id))
    if (pool.length === 0) pool = ENCOUNTERS
    const pick = pool[hashStr(`${seed}/${i}/${order}`) % pool.length]
    used.add(pick.id)
    return pick.id
  })
}
