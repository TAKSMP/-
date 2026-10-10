// =============================================================
//  つうしんの「あいことば」（へやの なまえ）
// -------------------------------------------------------------
//  ランダムな 4もじ の かわりに、こどもが おぼえる えいごの ことばを つかう。
//  へやを つくると ことばが 1つ えらばれ、あいては その つづりを うって はいる。
//  ・3〜9もじの やさしい ことば（むし・どうぶつ・たべもの・いろ・かず など）
//  ・ききまちがえやすい くみあわせ（SEA/SEE、GRASS/GLASS、BUS/BATH…）は かたほうだけ いれる
//  ・ことばは そのまま データベースの かぎ（rooms/{ことば}）に なる。えいじ だけに する
// =============================================================

export interface RoomWord {
  word: string // おおもじ
  ja: string // いみ
  emoji: string
}

const W = (word: string, ja: string, emoji: string): RoomWord => ({ word, ja, emoji })

export const ROOM_WORDS: RoomWord[] = [
  // むし
  W('ANT', 'あり', '🐜'),
  W('BEE', 'ハチ（むし）', '🐝'),
  W('BUG', 'むし', '🐛'),
  W('BEETLE', 'カブトムシの なかま', '🪲'),
  W('SPIDER', 'クモ（むし）', '🕷️'),
  W('MOTH', 'が', '🦋'),
  W('LADYBUG', 'てんとうむし', '🐞'),
  W('CRICKET', 'こおろぎ', '🦗'),
  W('CICADA', 'せみ', '🌳'),
  W('MANTIS', 'かまきり', '🌿'),
  W('FIREFLY', 'ほたる', '✨'),
  W('SNAIL', 'かたつむり', '🐌'),
  W('WORM', 'みみず', '🪱'),
  W('BUTTERFLY', 'ちょう', '🦋'),
  W('DRAGONFLY', 'とんぼ', '🌾'),
  // どうぶつ
  W('CAT', 'ねこ', '🐱'),
  W('DOG', 'いぬ', '🐶'),
  W('BIRD', 'とり', '🐦'),
  W('FISH', 'さかな', '🐟'),
  W('LION', 'ライオン', '🦁'),
  W('BEAR', 'くま', '🐻'),
  W('FROG', 'かえる', '🐸'),
  W('DUCK', 'あひる', '🦆'),
  W('PIG', 'ぶた', '🐷'),
  W('COW', 'うし', '🐮'),
  W('HORSE', 'うま', '🐴'),
  W('SHEEP', 'ひつじ', '🐑'),
  W('MOUSE', 'ねずみ', '🐭'),
  W('RABBIT', 'うさぎ', '🐰'),
  W('MONKEY', 'さる', '🐵'),
  W('TIGER', 'とら', '🐯'),
  W('PANDA', 'パンダ', '🐼'),
  W('KOALA', 'コアラ', '🐨'),
  W('ZEBRA', 'しまうま', '🦓'),
  W('WHALE', 'くじら', '🐳'),
  W('SNAKE', 'へび', '🐍'),
  W('TURTLE', 'かめ', '🐢'),
  W('PENGUIN', 'ペンギン', '🐧'),
  W('FOX', 'きつね', '🦊'),
  W('OWL', 'ふくろう', '🦉'),
  W('DEER', 'しか', '🦌'),
  W('GOAT', 'やぎ', '🐐'),
  W('CRAB', 'かに', '🦀'),
  W('SHARK', 'さめ', '🦈'),
  W('DOLPHIN', 'いるか', '🐬'),
  W('CHICKEN', 'にわとり', '🐔'),
  W('ELEPHANT', 'ぞう', '🐘'),
  W('GIRAFFE', 'きりん', '🦒'),
  W('HIPPO', 'かば', '🦛'),
  W('GORILLA', 'ゴリラ', '🦍'),
  W('OCTOPUS', 'たこ', '🐙'),
  W('DINOSAUR', 'きょうりゅう', '🦖'),
  // たべもの
  W('APPLE', 'りんご', '🍎'),
  W('BANANA', 'バナナ', '🍌'),
  W('ORANGE', 'オレンジ', '🍊'),
  W('GRAPE', 'ぶどう', '🍇'),
  W('PEACH', 'もも', '🍑'),
  W('LEMON', 'レモン', '🍋'),
  W('MELON', 'メロン', '🍈'),
  W('CHERRY', 'さくらんぼ', '🍒'),
  W('KIWI', 'キウイ', '🥝'),
  W('TOMATO', 'トマト', '🍅'),
  W('CARROT', 'にんじん', '🥕'),
  W('ONION', 'たまねぎ', '🧅'),
  W('POTATO', 'じゃがいも', '🥔'),
  W('CORN', 'とうもろこし', '🌽'),
  W('MUSHROOM', 'きのこ', '🍄'),
  W('RICE', 'ごはん', '🍚'),
  W('BREAD', 'パン', '🍞'),
  W('CAKE', 'ケーキ', '🍰'),
  W('MILK', 'ぎゅうにゅう', '🥛'),
  W('EGG', 'たまご', '🥚'),
  W('JUICE', 'ジュース', '🧃'),
  W('PIZZA', 'ピザ', '🍕'),
  W('CANDY', 'キャンディー', '🍬'),
  W('HONEY', 'はちみつ', '🍯'),
  W('COOKIE', 'クッキー', '🍪'),
  W('SALAD', 'サラダ', '🥗'),
  W('WATER', 'みず', '💧'),
  W('TEA', 'おちゃ', '🍵'),
  W('SOUP', 'スープ', '🥣'),
  W('CHEESE', 'チーズ', '🧀'),
  // いろ
  W('RED', 'あか', '🔴'),
  W('BLUE', 'あお', '🔵'),
  W('GREEN', 'みどり', '🟢'),
  W('YELLOW', 'きいろ', '🟡'),
  W('PINK', 'ピンク', '🌸'),
  W('BLACK', 'くろ', '⚫'),
  W('WHITE', 'しろ', '⚪'),
  W('BROWN', 'ちゃいろ', '🟤'),
  W('PURPLE', 'むらさき', '🟣'),
  // しぜん
  W('SUN', 'たいよう', '☀️'),
  W('MOON', 'つき', '🌙'),
  W('STAR', 'ほし', '⭐'),
  W('SKY', 'そら', '🌤️'),
  W('RAIN', 'あめ（てんき）', '☔'),
  W('SNOW', 'ゆき', '❄️'),
  W('WIND', 'かぜ', '🍃'),
  W('CLOUD', 'くも（そら）', '☁️'),
  W('TREE', 'き', '🌳'),
  W('FLOWER', 'はな（さく はな）', '🌼'),
  W('LEAF', 'はっぱ', '🍂'),
  W('RIVER', 'かわ', '🏞️'),
  W('SEA', 'うみ', '🌊'),
  W('PARK', 'こうえん', '🛝'),
  W('FOREST', 'もり', '🌲'),
  W('GRASS', 'くさ', '🌱'),
  W('LAKE', 'みずうみ', '🛶'),
  W('STONE', 'いし', '🪨'),
  W('RAINBOW', 'にじ', '🌈'),
  W('MOUNTAIN', 'やま', '⛰️'),
  W('FIRE', 'ひ', '🔥'),
  W('ICE', 'こおり', '🧊'),
  // もの
  W('BOOK', 'ほん', '📖'),
  W('PEN', 'ペン', '🖊️'),
  W('PENCIL', 'えんぴつ', '✏️'),
  W('BALL', 'ボール', '⚽'),
  W('BAG', 'かばん', '🎒'),
  W('HAT', 'ぼうし', '👒'),
  W('CUP', 'カップ', '☕'),
  W('DESK', 'つくえ', '📚'),
  W('CHAIR', 'いす', '🪑'),
  W('BED', 'ベッド', '🛏️'),
  W('CAR', 'くるま', '🚗'),
  W('BUS', 'バス', '🚌'),
  W('BIKE', 'じてんしゃ', '🚲'),
  W('TRAIN', 'でんしゃ', '🚃'),
  W('BOAT', 'ボート', '⛵'),
  W('SHIP', 'おおきな ふね', '🚢'),
  W('PLANE', 'ひこうき', '✈️'),
  W('ROCKET', 'ロケット', '🚀'),
  W('ROBOT', 'ロボット', '🤖'),
  W('KEY', 'かぎ', '🔑'),
  W('BOX', 'はこ', '📦'),
  W('CLOCK', 'とけい', '🕐'),
  W('DOOR', 'ドア', '🚪'),
  W('HOUSE', 'いえ', '🏠'),
  W('SCHOOL', 'がっこう', '🏫'),
  W('CAMERA', 'カメラ', '📷'),
  W('GUITAR', 'ギター', '🎸'),
  W('PIANO', 'ピアノ', '🎹'),
  W('DRUM', 'たいこ', '🥁'),
  W('LAMP', 'ランプ', '💡'),
  W('RING', 'ゆびわ', '💍'),
  W('UMBRELLA', 'かさ', '☂️'),
  W('NET', 'あみ', '🥅'),
  W('MAP', 'ちず', '🗺️'),
  W('CROWN', 'おうかん', '👑'),
  W('TENT', 'テント', '⛺'),
  // かず
  W('ONE', '1（いち）', '1️⃣'),
  W('TWO', '2（に）', '2️⃣'),
  W('THREE', '3（さん）', '3️⃣'),
  W('FOUR', '4（よん）', '4️⃣'),
  W('FIVE', '5（ご）', '5️⃣'),
  W('SIX', '6（ろく）', '6️⃣'),
  W('SEVEN', '7（なな）', '7️⃣'),
  W('EIGHT', '8（はち）', '8️⃣'),
  W('NINE', '9（きゅう）', '9️⃣'),
  W('TEN', '10（じゅう）', '🔟'),
  // からだ
  W('HAND', 'て', '✋'),
  W('FOOT', 'あし', '🦶'),
  W('EYE', 'め', '👁️'),
  W('EAR', 'みみ', '👂'),
  W('NOSE', 'はな（かお）', '👃'),
  W('HEAD', 'あたま', '🙂'),
  W('MOUTH', 'くち', '👄'),
  W('TOOTH', 'は', '🦷'),
  // うごき・ようす
  W('RUN', 'はしる', '🏃'),
  W('JUMP', 'ジャンプする', '🤸'),
  W('SWIM', 'およぐ', '🏊'),
  W('SING', 'うたう', '🎤'),
  W('PLAY', 'あそぶ', '🎮'),
  W('EAT', 'たべる', '🍽️'),
  W('SLEEP', 'ねる', '😴'),
  W('WALK', 'あるく', '🚶'),
  W('DANCE', 'おどる', '💃'),
  W('SMILE', 'えがお', '😊'),
  W('HAPPY', 'うれしい', '😄'),
  W('BIG', 'おおきい', '🐘'),
  W('SMALL', 'ちいさい', '🐜'),
  W('FAST', 'はやい', '⚡'),
  W('STRONG', 'つよい', '💪'),
  // そのほか
  W('FRIEND', 'ともだち', '🤝'),
  W('FAMILY', 'かぞく', '👪'),
  W('MUSIC', 'おんがく', '🎵'),
  W('GAME', 'ゲーム', '🕹️'),
  W('DREAM', 'ゆめ', '💭'),
  W('HEART', 'ハート', '❤️'),
  W('KING', 'おうさま', '🤴'),
  W('QUEEN', 'じょおうさま', '👸'),
  W('STORY', 'おはなし', '📚'),
  W('SPRING', 'はる', '🌷'),
  W('SUMMER', 'なつ', '🌻'),
  W('WINTER', 'ふゆ', '⛄'),
  W('MORNING', 'あさ', '🌅'),
  W('NIGHT', 'よる', '🌃'),
]

export const ROOM_CODE_MIN = 3
export const ROOM_CODE_MAX = 12

const BY_WORD = new Map(ROOM_WORDS.map((w) => [w.word, w]))

// うった もじを そろえる（おおもじ・えいすうじ だけ）
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // ぜんかく → はんかく
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_MAX)
}

export function roomWordInfo(code: string): RoomWord | undefined {
  return BY_WORD.get(code.toUpperCase())
}

function randomWord(): string {
  return ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)].word
}

// むかしの かたち（ランダム 4もじ）。ことばが ぜんぶ つかわれている ときの よび
const OLD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomOldCode(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += OLD_CHARS[Math.floor(Math.random() * OLD_CHARS.length)]
  return s
}

// まだ つかわれていない あいことばを えらぶ。taken は「その へやが いま あるか」を しらべる
export async function pickFreeRoomCode(taken: (code: string) => Promise<boolean>): Promise<string> {
  const tried = new Set<string>()
  for (let i = 0; i < 12; i++) {
    const code = randomWord()
    if (tried.has(code)) continue
    tried.add(code)
    if (!(await taken(code))) return code
  }
  for (let i = 0; i < 5; i++) {
    const code = randomOldCode()
    if (!(await taken(code))) return code
  }
  return randomOldCode()
}

// へやが のこったままに なる ことが ある（つうしんが きれた など）。ふるい へやは あいている あつかい
export const ROOM_STALE_MS = 6 * 60 * 60 * 1000

// えいごで よみあげる（spell なら つづりを 1もじずつ）。おとが 出せない 端末では なにも しない
export function speakRoomWord(word: string, spell = false): void {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(spell ? word.toUpperCase().split('').join(', ') : word.toLowerCase())
    u.lang = 'en-US'
    u.rate = spell ? 0.7 : 0.8
    synth.speak(u)
  } catch {
    // よみあげ できなくても きにしない
  }
}
