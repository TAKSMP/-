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
  { id: 'sky1', tags: ['sky'], emoji: '☁️', text: (n) => `じめんに ゆらゆら うごく かげが みえた。そらを みあげると、なんと ${n} が とんでいた！ こちらに きづいた ${n} は、まっすぐ ふってきたぞ！` },
  { id: 'sky2', tags: ['sky'], emoji: '🌬️', text: (n) => `ひゅう と かぜが なった。かぜの むこうから ${n} が すべるように あらわれた。「いい かぜだ」と いうように、${n} が まいおりてくる！` },
  { id: 'sky3', tags: ['sky'], emoji: '☀️', text: (n) => `おひさまが まぶしくて めを ほそめた その とき、ひかりの なかから ${n} が とびだしてきた！ びっくりして のけぞる ひまも ない！` },
  { id: 'sky4', tags: ['sky'], emoji: '🌸', text: (n) => `おはなの まわりを なにかが ぐるぐる まわっている。よく みると ${n} だ。じぶんの ばしょを とられると おもったのか、${n} が むかってきた！` },
  { id: 'sky5', tags: ['sky'], emoji: '🍃', text: (n) => `はっぱが いちまい、ひらり と おちてきた…と おもったら ${n} だった！ すがたを みせた ${n} は、うれしそうに はねを ふるわせている。` },
  { id: 'sky6', tags: ['sky'], emoji: '⚡', text: (n) => `ぶーん という おとが どんどん おおきくなる。おとの しょうたいは ${n}！ すごい はやさで まわりを とびまわりはじめた！` },
  // --- じめん・くさむら ---
  { id: 'gnd1', tags: ['ground'], emoji: '🌿', text: (n) => `くさが がさがさと ゆれた。そーっと のぞきこむと、そこに いたのは ${n}！ めが あった しゅんかん、${n} が とびだしてきた！` },
  { id: 'gnd2', tags: ['ground'], emoji: '🪨', text: (n) => `おおきな いしを そっと どかしてみた。ひんやりした つちの うえに ${n} が いる！ おこられたと おもったのか、${n} が かまえた！` },
  { id: 'gnd3', tags: ['ground'], emoji: '👣', text: (n) => `じめんに ちいさな あしあとが ならんでいる。たどっていくと…${n} が ふりかえった！ 「ついてこないで」と いうように、${n} が こうげきの ポーズ！` },
  { id: 'gnd4', tags: ['ground'], emoji: '🍂', text: (n) => `おちばの やまが もぞもぞ うごいている。ゆうきを だして めくると、なかから ${n} が とびだした！` },
  { id: 'gnd5', tags: ['ground'], emoji: '🌾', text: (n) => `せの たかい くさの あいだを すすんでいく。ふいに めのまえが ひらけて、${n} と ばったり であって しまった！` },
  { id: 'gnd6', tags: ['ground'], emoji: '🕳️', text: (n) => `つちの うえに ちいさな あなが あいている。じっと みていると、なかから ${n} が ぬっと あらわれた！` },
  // --- き・じゅえき ---
  { id: 'tre1', tags: ['tree'], emoji: '🌳', text: (n) => `きの みきから あまい においが する。じゅえきの でる ばしょには、せんきゃくの ${n} が いた！ 「ここは ぼくの ばしょだ」と ${n} が むねを はる！` },
  { id: 'tre2', tags: ['tree'], emoji: '🪵', text: (n) => `こしかけようと した きりかぶ。そこに いたのは ${n} だった！ おどろいた ${n} が、いきおいよく むかってくる！` },
  { id: 'tre3', tags: ['tree'], emoji: '🍁', text: (n) => `えだを ゆらすと、ぱらぱらと はっぱが おちてきた。いっしょに おりてきたのは ${n}！ たいせいを たてなおして、${n} が こちらを にらむ！` },
  { id: 'tre4', tags: ['tree'], emoji: '🐾', text: (n) => `きの かわの したから カリカリと おとが する。そっと はがすと ${n} が かくれていた！ みつかった ${n} は、かくごを きめたようだ！` },
  { id: 'tre5', tags: ['tree'], emoji: '🌰', text: (n) => `きのみが ころころと ころがってきた。ころがしていたのは ${n}！ じゃまを されたと おもったのか、${n} が おこっている！` },
  // --- みずべ ---
  { id: 'wat1', tags: ['water'], emoji: '💧', text: (n) => `いけの みずめんに、とんと はもんが ひろがった。まんなかに いるのは ${n}！ みずしぶきを あげて、${n} が とびかかってきた！` },
  { id: 'wat2', tags: ['water'], emoji: '🌊', text: (n) => `かわの ながれの すぐ そば。すべらないように あしもとを みると、ぬれた いしの うえに ${n} が いた！` },
  { id: 'wat3', tags: ['water'], emoji: '🪷', text: (n) => `はすの はの うえで ひとやすみ している ${n} を みつけた。めが あうと、${n} は さっと たちあがった！` },
  { id: 'wat4', tags: ['water'], emoji: '🫧', text: (n) => `みずの なかから あわが ぷくぷく のぼってくる。しばらく みていると、${n} が いきおいよく でてきた！` },
  // --- かくれる・ぎたい ---
  { id: 'hid1', tags: ['hide'], emoji: '🫥', text: (n) => `なにも いない はずの えだ。…でも なんだか へんだ。じっと みていると、えだの いっぽんが うごいた。${n} だ！` },
  { id: 'hid2', tags: ['hide'], emoji: '👀', text: (n) => `だれかに みられている きが する。ふりむくと、くさの かげから ${n} が じっと こちらを みていた！` },
  { id: 'hid3', tags: ['hide'], emoji: '🍃', text: (n) => `はっぱと おなじ いろ、おなじ かたち。でも ひとつだけ ちがう。まばたきの あいだに ${n} が うごきだした！` },
  { id: 'hid4', tags: ['hide'], emoji: '🤫', text: (n) => `しずかだ。しずかすぎる。そっと いっぽ ふみだした しゅんかん、まちぶせしていた ${n} が とびだしてきた！` },
  { id: 'hid5', tags: ['hide'], emoji: '🌙', text: (n) => `こかげが すこし こくなった。かげの なかで、${n} が ゆっくりと かまえを とっている！` },
  // --- どの むしでも ---
  { id: 'any1', tags: ['any'], emoji: '❗', text: (n) => `とつぜん めのまえに ${n} が あらわれた！ おたがい びっくりして、うごきが とまる。…さきに うごいたのは ${n} だった！` },
  { id: 'any2', tags: ['any'], emoji: '🔥', text: (n) => `${n} は どうやら きげんが わるいみたい。ちかづいた とたん、ぐっと からだを おおきく みせて いかくしてきた！` },
  { id: 'any3', tags: ['any'], emoji: '🏁', text: (n) => `みちの まんなかで ${n} が とおせんぼ。よけて とおろうと したけれど、${n} も おなじ ほうへ うごいてしまう。しょうぶ するしか なさそうだ！` },
  { id: 'any4', tags: ['any'], emoji: '🎵', text: (n) => `どこからか きれいな おとが きこえる。おとの ぬしは ${n} だった。うたを とめられた ${n} は、ちょっと おこっている！` },
  { id: 'any5', tags: ['any'], emoji: '🍽️', text: (n) => `${n} が ごはんちゅうだった。おいしそうに たべている ところを じゃま されて、${n} が すごい いきおいで ふりむいた！` },
  { id: 'any6', tags: ['any'], emoji: '💤', text: (n) => `${n} が すやすや ねむっている。そーっと とおりすぎようと した その とき…ぽきっ。えだを ふんでしまった！ ${n} が ぱっちり めを あけた！` },
  { id: 'any7', tags: ['any'], emoji: '🤝', text: (n) => `${n} が こちらを じっと みている。どうやら つよい あいてを さがしていたようだ。「きみで ためさせて」と いうように、${n} が かまえた！` },
  { id: 'any8', tags: ['any'], emoji: '🌀', text: (n) => `つむじかぜが まきおこった。すなぼこりが おさまると、まんなかに ${n} が たっていた！` },
  { id: 'any9', tags: ['any'], emoji: '🏃', text: (n) => `なにかが すごい はやさで よこぎった。おいかけた さきに いたのは ${n}！ ${n} も ひきさがる きは ないようだ！` },
  { id: 'any10', tags: ['any'], emoji: '🎁', text: (n) => `キラキラ ひかる ものを みつけた。ひろおうと てを のばした しゅんかん、${n} が よこから とびだしてきた！` },
  { id: 'any11', tags: ['any'], emoji: '🧭', text: (n) => `みちに まよって しまった。あたりを みまわすと、${n} が どうどうと まちかまえていた！` },
  { id: 'any12', tags: ['any'], emoji: '⚔️', text: (n) => `${n} が しっぽを ぴんと たてた。これは「かかってこい」の あいず。うけて たとう！` },
  { id: 'any13', tags: ['any'], emoji: '🌤️', text: (n) => `くもが きれて、あたりが ぱっと あかるくなった。ひかりの なかで ${n} が こちらに きづいた！` },
  { id: 'any14', tags: ['any'], emoji: '👑', text: (n) => `この あたりで いちばん つよいと うわさの ${n}。うわさは ほんとうだった。${n} が ゆっくりと ちかづいてくる！` },
  { id: 'any15', tags: ['any'], emoji: '🫨', text: (n) => `じめんが かすかに ゆれた。ゆれの もとを たどると、${n} が ちからを ためているところだった！` },
  { id: 'any16', tags: ['any'], emoji: '🔎', text: (n) => `ずかんで みた すがたと そっくりな かげ。ちかづいて たしかめると、やっぱり ${n} だ！ きづかれた！` },
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
