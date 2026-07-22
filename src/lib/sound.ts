// かんたんな音（Web Audio API）。ボタンや「はっけん！」、バトルのときに鳴らします。
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
  // iOS などで とまっていたら さいかいする
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// iOS/Safari は「ユーザーがさわった瞬間」に 音のじゅんびをしないと 鳴らない。
// さいしょのタッチで オーディオを アンロックし、画面に もどったときも さいかいする。
let unlocked = false
function unlockAudio() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  if (!unlocked) {
    try {
      // 無音を1回ならして iOS の ロックを はずす
      const b = c.createBuffer(1, 1, 22050)
      const s = c.createBufferSource()
      s.buffer = b
      s.connect(c.destination)
      s.start(0)
      unlocked = true
    } catch {
      /* むし */
    }
  }
}

if (typeof window !== 'undefined') {
  const opt = { passive: true } as AddEventListenerOptions
  ;['touchend', 'pointerdown', 'mousedown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, opt),
  )
  // バックグラウンドから もどったら（＝self-healリロード後なども）さいかい
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running')
      ctx.resume().catch(() => {})
  })
}

function beep(
  freq: number,
  duration: number,
  delay = 0,
  type: OscillatorType = 'sine',
  peak = 0.2,
) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const start = c.currentTime + delay
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

// しゅうはすうが うごく音（シューッ／キュイーン）
function sweep(
  f0: number,
  f1: number,
  duration: number,
  delay = 0,
  type: OscillatorType = 'sine',
  peak = 0.2,
) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  const start = c.currentTime + delay
  osc.frequency.setValueAtTime(f0, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

// ノイズ（ドンッ／シャッ という 打げき音）
function noise(
  duration: number,
  delay = 0,
  filterType: BiquadFilterType = 'lowpass',
  filterFreq = 800,
  peak = 0.25,
) {
  const c = getCtx()
  if (!c) return
  const frames = Math.max(1, Math.floor(c.sampleRate * duration))
  const buf = c.createBuffer(1, frames, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  const gain = c.createGain()
  const start = c.currentTime + delay
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

// メロディ（音を じゅんばんに ならす）
function melody(
  notes: [freq: number, dur: number][],
  type: OscillatorType = 'triangle',
  gap = 0.02,
  peak = 0.2,
) {
  let t = 0
  for (const [f, d] of notes) {
    beep(f, d, t, type, peak)
    t += d + gap
  }
}

export const sfx = {
  tap() {
    beep(660, 0.08)
  },
  shutter() {
    beep(880, 0.05, 0, 'square')
    beep(440, 0.08, 0.05, 'square')
  },
  // 画面の きりかえ（やさしい音）
  nav() {
    beep(520, 0.06, 0, 'triangle', 0.14)
    beep(700, 0.07, 0.05, 'triangle', 0.14)
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
  // バッジ獲得の キラキラ
  badge() {
    beep(1319, 0.09, 0, 'triangle', 0.18)
    beep(1760, 0.09, 0.09, 'triangle', 0.18)
    beep(2093, 0.16, 0.18, 'triangle', 0.18)
  },
  // バトル：スタート
  battleStart() {
    beep(392, 0.12, 0, 'sawtooth', 0.18)
    beep(523, 0.12, 0.12, 'sawtooth', 0.18)
    beep(784, 0.22, 0.24, 'sawtooth', 0.2)
  },
  // バトル：通常こうげきの ヒット
  hit() {
    beep(170, 0.09, 0, 'square', 0.22)
    noise(0.09, 0, 'lowpass', 900, 0.2)
  },
  // バトル：かいひ（よけた）
  dodge() {
    sweep(900, 320, 0.16, 0, 'sine', 0.18)
  },
  // バトル：ひっさつわざ（こうかで 音がかわる）
  special(kind: string) {
    switch (kind) {
      case 'powerStrike': // ドガーン（大ダメージ）
        noise(0.3, 0, 'lowpass', 520, 0.35)
        beep(90, 0.32, 0, 'sawtooth', 0.28)
        beep(140, 0.28, 0.02, 'square', 0.2)
        break
      case 'doubleAttack': // ザッ ザッ（2回）
        beep(1300, 0.06, 0, 'square', 0.2)
        noise(0.07, 0.0, 'highpass', 2000, 0.18)
        beep(1600, 0.06, 0.12, 'square', 0.2)
        noise(0.07, 0.12, 'highpass', 2000, 0.18)
        break
      case 'heal': // ふわ〜（回復）
        melody([[659, 0.12], [784, 0.12], [988, 0.2]], 'sine', 0.0, 0.18)
        break
      case 'attackUp': // キュイーン（上がる）
        sweep(400, 1000, 0.3, 0, 'sawtooth', 0.18)
        break
      case 'defenseUp': // キン（かたく）
        beep(523, 0.14, 0, 'triangle', 0.2)
        beep(784, 0.2, 0.1, 'triangle', 0.2)
        break
      default:
        beep(880, 0.14, 0, 'square', 0.2)
    }
  },
  // 勝ったとき（かちファンファーレ）
  win() {
    melody(
      [
        [523, 0.14],
        [659, 0.14],
        [784, 0.14],
        [1047, 0.16],
        [784, 0.1],
        [1047, 0.34],
      ],
      'triangle',
      0.02,
      0.22,
    )
  },
  // 負けたとき（しょんぼり）
  lose() {
    melody(
      [
        [440, 0.2],
        [392, 0.2],
        [349, 0.28],
        [262, 0.42],
      ],
      'sine',
      0.03,
      0.2,
    )
  },
}
