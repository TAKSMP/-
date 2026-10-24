// えいごの よみあげ（ブラウザの こえ）。おとが でない たんまつでは supported() が false
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speakEnglish(text: string): void {
  if (!speechSupported()) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.8
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('en'))
    if (voice) u.voice = voice
    synth.speak(u)
  } catch (e) {
    console.warn('よみあげに しっぱい', e)
  }
}

export function stopSpeaking(): void {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* むし */
  }
}
