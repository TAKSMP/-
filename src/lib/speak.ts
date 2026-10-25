// えいごの よみあげ（ブラウザの こえ）。おとが でない たんまつでは speechSupported() が false
//  ・よむ たびに だんせいの こえ と じょせいの こえを こうごに つかう
//  ・「ゆっくり さいせい」が ONの ときは ゆっくり（rate 0.5）
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const SLOW_KEY = 'chomushi.speak.slow.v1'
// ブラウザの rate は たんまつで きこえかたが ちがう ので、ちがいが わかる ように はなす
const SLOW_RATE = 0.5
// こどもむけに、すこし はやく・あかるく（ゆっくりの ときは そのまま）
const NORMAL_RATE = 1.05

// こえの たかさ。たかい ほうが あかるく きこえる
const PITCH = { female: 1.35, male: 1.15 } as const
const PITCH_NO_VOICE = { female: 1.45, male: 1.0 } as const // こえが えらべない ときは たかさで 男女を わける

let slow = (() => {
  try {
    return localStorage.getItem(SLOW_KEY) === '1'
  } catch {
    return false
  }
})()

export function isSlow(): boolean {
  return slow
}
export function setSlow(v: boolean): void {
  slow = v
  try {
    localStorage.setItem(SLOW_KEY, v ? '1' : '0')
  } catch {
    /* むし */
  }
}

type Gender = 'female' | 'male'
let nextGender: Gender = 'female' // じょせい → だんせい → … の じゅん

const FEMALE_RE = /female|woman|samantha|zira|aria|jenny|karen|victoria|susan|hazel|moira|tessa|fiona|allison|ava|joanna|kendra|salli|google us english/i
const MALE_RE = /\bmale\b|david|mark|guy|alex|daniel|fred|george|james|ryan|tom|arthur|matthew|joey|justin|brian/i

function pickVoice(gender: Gender): { voice?: SpeechSynthesisVoice; pitch: number } {
  // アメリカ英語（en-US）の こえだけを つかう（イギリス・オーストラリア などは ださない）
  // ネットの こえ（localService=false）は はやさを かえられない ことが あるので、たんまつの こえを さきに
  const en = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us')
    .sort((a, b) => Number(b.localService) - Number(a.localService))
  const hit = en.find((v) =>
    gender === 'female' ? FEMALE_RE.test(v.name) : MALE_RE.test(v.name) && !/female/i.test(v.name),
  )
  if (hit) return { voice: hit, pitch: PITCH[gender] }
  // こえが みつからない ときは ピッチで ちがいを だす
  // （en-US の こえが 1つも なければ voice を きめず、u.lang='en-US' に まかせる）
  return { voice: en[0], pitch: PITCH_NO_VOICE[gender] }
}

// よみあげの せいぎょ（stopSpeaking／あたらしい よみあげで ふるい つづきを やめる）
let token = 0

function takeGender(): Gender {
  const g = nextGender
  nextGender = g === 'female' ? 'male' : 'female'
  return g
}

// □を みつけたら「ぴろぴろ」の こうかおん（mask）で かくして つづきを よむ（ながさ maskMs）
export function speakWithMask(text: string, mask: (ms: number) => void, maskMs = 600): void {
  const parts = text.split('□')
  if (parts.length === 1) {
    speakEnglish(text)
    return
  }
  const my = ++token
  const gender = takeGender() // ぜんぶ おなじ ひとの こえで
  const run = (i: number) => {
    if (my !== token || i >= parts.length) return
    const next = () => {
      if (my !== token) return
      if (i < parts.length - 1) {
        mask(maskMs)
        window.setTimeout(() => run(i + 1), maskMs + 100)
      }
    }
    const part = parts[i].trim()
    if (!part) return next()
    speakEnglish(part, next, true, gender)
  }
  run(0)
}

// ぶんの くぎり（. ? ! 。）で わけて、ひとつずつ よむ。くぎりごとに ひといき やすむ
// （「.」を そのまま わたすと「ふる すとっぷ」と よむ こえが あるので、ピリオドは とって よむ）
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((t) => t.replace(/[.。]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((t) => /[A-Za-z0-9]/.test(t))
}

// くぎりの あいだの ひといき（ミリびょう）
const PAUSE_MS = 450
const PAUSE_SLOW_MS = 800

export function speakEnglish(
  text: string,
  onEnd?: () => void,
  keepToken = false,
  gender?: Gender,
): void {
  if (!keepToken) token++
  const my = token
  if (!speechSupported()) {
    onEnd?.()
    return
  }
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const parts = splitSentences(text)
    if (parts.length === 0) {
      onEnd?.()
      return
    }
    const { voice, pitch } = pickVoice(gender ?? takeGender()) // ぜんぶの ぶんを おなじ ひとの こえで
    const rate = slow ? SLOW_RATE : NORMAL_RATE
    const pause = slow ? PAUSE_SLOW_MS : PAUSE_MS
    const run = (i: number) => {
      if (my !== token) return
      if (i >= parts.length) {
        onEnd?.()
        return
      }
      const u = new SpeechSynthesisUtterance(parts[i])
      u.lang = 'en-US'
      u.rate = rate
      if (voice) u.voice = voice
      u.pitch = pitch
      // おわり を まつ。ブラウザによっては onend が こない ので ほけんの タイマーも
      let done = false
      const fin = () => {
        if (done) return
        done = true
        if (i + 1 < parts.length) window.setTimeout(() => run(i + 1), pause)
        else run(i + 1)
      }
      u.onend = fin
      u.onerror = fin
      window.setTimeout(fin, (700 + parts[i].length * 120) / (slow ? SLOW_RATE : 1))
      synth.speak(u)
    }
    run(0)
  } catch (e) {
    console.warn('よみあげに しっぱい', e)
  }
}

export function stopSpeaking(): void {
  token++
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* むし */
  }
}
