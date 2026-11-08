// =============================================================
//  虫ポイントの ばいばいルーレット（昆虫検定で 10もん ぜんぶ せいかい したとき）
// -------------------------------------------------------------
//  ・円ばんが まわりつづけ、STOP を おすと ゆっくり とまる
//  ・どこで とまるかは STOP を おした しゅんかんに くじで きめる（目おし できない）
//  ・わくの おおきさは でやすさと おなじ わりあい（×1:30% ×1.5:30% ×2:20% ×3:15% ×10:5%）
// =============================================================
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sound'

export interface RouletteSlot {
  mult: number
  label: string
  percent: number
  color: string
  ink: string
}

export const ROULETTE_SLOTS: RouletteSlot[] = [
  { mult: 1, label: '×1', percent: 30, color: '#d8f0c8', ink: '#3f7a30' },
  { mult: 1.5, label: '×1.5', percent: 30, color: '#fff1a8', ink: '#8a6500' },
  { mult: 2, label: '×2', percent: 20, color: '#ffd0a0', ink: '#a04a00' },
  { mult: 3, label: '×3', percent: 15, color: '#ffc2d6', ink: '#a8285a' },
  { mult: 10, label: '×10', percent: 5, color: '#ff5a4e', ink: '#ffffff' },
]

const SPIN_DEG_PER_SEC = 720 // まわっている ときの はやさ
const R = 130 // 円ばんの はんけい（SVG の ざひょう）

// わくの はじまりと おわりの かくど（まうえ＝0、とけいまわり）
const SPANS = (() => {
  let at = 0
  return ROULETTE_SLOTS.map((s) => {
    const from = at
    at += (s.percent / 100) * 360
    return { from, to: at }
  })
})()

// くじびき（でやすさの とおり）
export function rollSlot(rand = Math.random()): number {
  let acc = 0
  for (let i = 0; i < ROULETTE_SLOTS.length; i++) {
    acc += ROULETTE_SLOTS[i].percent / 100
    if (rand < acc) return i
  }
  return ROULETTE_SLOTS.length - 1
}

function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(rad), r * Math.sin(rad)]
}

function wedgePath(from: number, to: number): string {
  const [x1, y1] = polar(from, R)
  const [x2, y2] = polar(to, R)
  const large = to - from > 180 ? 1 : 0
  return `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

type Phase = 'spin' | 'stopping' | 'done'

interface Props {
  basePoints: number // この回で もらった ポイント（×1 の とき）
  onResult: (slot: RouletteSlot) => void
}

export function PointRoulette({ basePoints, onResult }: Props) {
  const [phase, setPhase] = useState<Phase>('spin')
  const [result, setResult] = useState<number | null>(null)
  const wheelRef = useRef<SVGGElement>(null)
  const angle = useRef(0)
  const anim = useRef<{ from: number; to: number; start: number; dur: number } | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const a = anim.current
      if (a) {
        const t = Math.min(1, (now - a.start) / a.dur)
        angle.current = a.from + (a.to - a.from) * easeOutCubic(t)
        if (t >= 1) {
          anim.current = null
          setPhase('done')
        }
      } else if (phaseRef.current === 'spin') {
        angle.current += SPIN_DEG_PER_SEC * dt
      }
      wheelRef.current?.setAttribute('transform', `rotate(${angle.current % 360})`)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (phase !== 'done' || result === null) return
    const slot = ROULETTE_SLOTS[result]
    if (slot.mult >= 3) sfx.win()
    else sfx.discover()
    onResultRef.current(slot)
  }, [phase, result])

  function stop() {
    if (phase !== 'spin') return
    sfx.tap()
    // ここで けっかを きめる（いま どこを むいているかとは かんけい ない）
    const idx = rollSlot()
    const span = SPANS[idx]
    const margin = Math.min(4, (span.to - span.from) * 0.2)
    const target = span.from + margin + Math.random() * (span.to - span.from - margin * 2)
    // 円ばんを θ まわすと、まうえの はりの したに くるのは (-θ) の ところ
    const cur = angle.current
    const curMod = ((cur % 360) + 360) % 360
    const wantMod = (360 - target) % 360
    let delta = wantMod - curMod
    if (delta < 0) delta += 360
    delta += 720 // すくなくとも 2しゅう まわってから とまる
    // まわっていた はやさの まま すーっと おそく なる ながさ（easeOutCubic の はじめの はやさ＝3Δ/T）
    const dur = ((3 * delta) / SPIN_DEG_PER_SEC) * 1000
    anim.current = { from: cur, to: cur + delta, start: performance.now(), dur }
    setResult(idx)
    setPhase('stopping')
  }

  const slot = result !== null ? ROULETTE_SLOTS[result] : null

  return (
    <div className="roulette">
      <p className="roulette-lead">
        🎉 ぜんもん せいかい！ ルーレットで <b>{basePoints}P</b> が ふえるかも！
      </p>
      <div className="roulette-wheel-wrap">
        <svg className="roulette-svg" viewBox="-150 -158 300 308" role="img" aria-label="ルーレット">
          <g ref={wheelRef}>
            {ROULETTE_SLOTS.map((s, i) => {
              const { from, to } = SPANS[i]
              const mid = (from + to) / 2
              const small = to - from < 30
              const [tx, ty] = polar(mid, small ? R * 0.8 : R * 0.64)
              return (
                <g key={s.label}>
                  <path d={wedgePath(from, to)} fill={s.color} stroke="#fff" strokeWidth={3} />
                  <text
                    x={tx}
                    y={ty}
                    fill={s.ink}
                    fontSize={small ? 15 : 24}
                    fontWeight={900}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${mid} ${tx} ${ty})`}
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}
            <circle r={R} fill="none" stroke="#5a9e49" strokeWidth={6} />
          </g>
          <circle r={20} fill="#fff" stroke="#5a9e49" strokeWidth={5} />
          <text y={1} fontSize={16} textAnchor="middle" dominantBaseline="central">
            🐞
          </text>
          {/* まうえの はり */}
          <path d="M0 -118 L-14 -152 L14 -152 Z" fill="#e0662b" stroke="#fff" strokeWidth={3} />
        </svg>
      </div>
      {phase === 'spin' && (
        <button className="btn btn-big btn-primary roulette-stop" onClick={stop}>
          STOP ✋
        </button>
      )}
      {phase === 'stopping' && <p className="roulette-wait">とまるかな…？</p>}
      {phase === 'done' && slot && (
        <div className={'roulette-result' + (slot.mult >= 3 ? ' big' : '')}>
          <span className="roulette-result-mult">{slot.label}</span>
          <span className="roulette-result-pts">
            {basePoints}P → <b>{Math.round(basePoints * slot.mult)}P</b>
          </span>
        </div>
      )}
    </div>
  )
}
