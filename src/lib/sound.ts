// かんたんな音（Web Audio API）。ボタンや「はっけん！」のときに鳴らします。
// 画像や音声ファイルをつかわないので、そのまま遊べます。
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

function beep(freq: number, duration: number, delay = 0, type: OscillatorType = 'sine') {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const start = c.currentTime + delay
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export const sfx = {
  tap() {
    beep(660, 0.08)
  },
  shutter() {
    beep(880, 0.05, 0, 'square')
    beep(440, 0.08, 0.05, 'square')
  },
  // 「はっけん！」のときのファンファーレ
  discover() {
    beep(523, 0.12, 0) // ド
    beep(659, 0.12, 0.12) // ミ
    beep(784, 0.12, 0.24) // ソ
    beep(1047, 0.25, 0.36) // 高いド
  },
  error() {
    beep(200, 0.2, 0, 'sawtooth')
  },
}
