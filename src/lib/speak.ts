// えいごの よみあげ（ブラウザの こえ）。おとが でない たんまつでは speechSupported() が false
//  ・よむ たびに だんせいの こえ と じょせいの こえを こうごに つかう
//  ・「ゆっくり さいせい」が ONの ときは ゆっくり（rate 0.5）
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const SLOW_KEY = 'chomushi.speak.slow.v1'
// ブラウザの rate は たんまつで きこえかたが ちがう ので、ちがいが わかる ように はなす
const SLOW_RATE = 0.5
const NORMAL_RATE = 1.0

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
  // ネットの こえ（localService=false）は はやさを かえられない ことが あるので、たんまつの こえを さきに
  const en = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => Number(b.localService) - Number(a.localService))
  const hit = en.find((v) =>
    gender === 'female' ? FEMALE_RE.test(v.name) : MALE_RE.test(v.name) && !/female/i.test(v.name),
  )
  if (hit) return { voice: hit, pitch: 1 }
  // こえが みつからない ときは ピッチで ちがいを だす
  return { voice: en[0], pitch: gender === 'female' ? 1.25 : 0.7 }
}

// よみあげの せいぎょ（stopSpeaking／あたらしい よみあげで ふるい つづきを やめる）
let token = 0

function takeGender(): Gender {
  const g = nextGender
  nextGender = g === 'female' ? 'male' : 'female'
  return g
}

// □を みつけたら「ピー」などの こうかおん（mask）で かくして つづきを よむ
export function speakWithMask(text: string, mask: () => void): void {
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
        mask()
        window.setTimeout(() => run(i + 1), 650)
      }
    }
    const part = parts[i].trim()
    if (!part) return next()
    speakEnglish(part, next, true, gender)
  }
  run(0)
}

export function speakEnglish(
  text: string,
  onEnd?: () => void,
  keepToken = false,
  gender?: Gender,
): void {
  if (!keepToken) token++
  if (!speechSupported()) {
    onEnd?.()
    return
  }
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = slow ? SLOW_RATE : NORMAL_RATE
    const { voice, pitch } = pickVoice(gender ?? takeGender())
    if (voice) u.voice = voice
    u.pitch = pitch
    if (onEnd) {
      // おわり を まつ。ブラウザによっては onend が こない ので ほけんの タイマーも
      let done = false
      const fin = () => {
        if (done) return
        done = true
        onEnd()
      }
      u.onend = fin
      u.onerror = fin
      window.setTimeout(fin, (700 + text.length * 120) / (slow ? SLOW_RATE : 1))
    }
    synth.speak(u)
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
