// えいごの よみあげ（ブラウザの こえ）。おとが でない たんまつでは supported() が false
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// よみあげの せいぎょ（stopSpeaking／あたらしい よみあげで ふるい つづきを やめる）
let token = 0

// □を みつけたら「ピー」などの こうかおん（mask）で かくして つづきを よむ
export function speakWithMask(text: string, mask: () => void): void {
  const parts = text.split('□')
  if (parts.length === 1) {
    speakEnglish(text)
    return
  }
  const my = ++token
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
    speakEnglish(part, next, true)
  }
  run(0)
}

export function speakEnglish(text: string, onEnd?: () => void, keepToken = false): void {
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
    u.rate = 0.8
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('en'))
    if (voice) u.voice = voice
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
      window.setTimeout(fin, 700 + text.length * 120)
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
