// =============================================================
//  公園の せなかの 絵（10しゅるい）
// -------------------------------------------------------------
//  ストーリーモードの マップの したに しく イラスト。
//  ばしょの名前から どの絵に なるかが きまる（いつも おなじ）。
//  画像ファイルは つかわず、ぜんぶ SVGで えがく（オフラインでも 出る）。
// =============================================================

interface Palette {
  name: string
  sky: [string, string] // そら（うえ→した）
  grass: [string, string] // しばふ
  path: string // みち
  pond: string // いけ
  tree: [string, string] // 木（は・みき）
  flower: string[]
}

// 10しゅるいの 色あい（はる〜ふゆ、あさ〜ゆうがた）
const PALETTES: Palette[] = [
  { name: 'はるの公園', sky: ['#bfe8ff', '#e6f7ff'], grass: ['#9ad96f', '#7cc36a'], path: '#e8d9a8', pond: '#7ec8e8', tree: ['#5fae4c', '#8a6236'], flower: ['#ff9ec4', '#ffd23f', '#fff'] },
  { name: 'なつの公園', sky: ['#7fd4ff', '#d9f4ff'], grass: ['#6fc95a', '#4fa33f'], path: '#f0e2b0', pond: '#4bb8e0', tree: ['#3f8f32', '#7a5430'], flower: ['#ff6b6b', '#ffd23f', '#ff9ec4'] },
  { name: 'あきの公園', sky: ['#ffd9a8', '#ffeed6'], grass: ['#c9b45f', '#a8923f'], path: '#e8cf9a', pond: '#6fb8cf', tree: ['#e08a3c', '#7a5430'], flower: ['#e05c3c', '#ffb03a', '#fff0c4'] },
  { name: 'ゆうがたの公園', sky: ['#ffb07c', '#ffe0c4'], grass: ['#8fae5f', '#6f8f4a'], path: '#e0cfa0', pond: '#8fa8d9', tree: ['#4f7a3c', '#6a4a2c'], flower: ['#ff8fae', '#ffd98f', '#fff'] },
  { name: 'あさの公園', sky: ['#d9f0ff', '#f4fbff'], grass: ['#a8e07c', '#86c45f'], path: '#f0e6c4', pond: '#8fd9f0', tree: ['#6fbf50', '#8a6236'], flower: ['#fff', '#ffe08f', '#c4e8a8'] },
  { name: 'みずべの公園', sky: ['#cfeeff', '#eaf8ff'], grass: ['#8fd47c', '#6fb45c'], path: '#e6dcb0', pond: '#3fb0d9', tree: ['#4fa03c', '#7a5430'], flower: ['#9ed9ff', '#fff', '#ffd23f'] },
  { name: 'もりの公園', sky: ['#c4e8d9', '#e6f7ef'], grass: ['#6fae5c', '#4f8a3f'], path: '#d9c9a0', pond: '#5fa8b0', tree: ['#2f7a2c', '#6a4a2c'], flower: ['#fff0a8', '#c4e8a8', '#ffd9e8'] },
  { name: 'はなばたけの公園', sky: ['#e8d9ff', '#f7f0ff'], grass: ['#9ed96f', '#7cc36a'], path: '#f0e2c4', pond: '#9ec8f0', tree: ['#5fae4c', '#8a6236'], flower: ['#ff9ec4', '#c49eff', '#ffd23f'] },
  { name: 'ひろばの公園', sky: ['#cfe8ff', '#eef7ff'], grass: ['#b0d98f', '#8fbf6f'], path: '#f0e4bc', pond: '#7ec8e8', tree: ['#6fae4c', '#8a6236'], flower: ['#fff', '#ffd23f', '#ff9ec4'] },
  { name: 'ふゆの公園', sky: ['#dceaf5', '#f2f8fc'], grass: ['#cfe0cf', '#aec9ae'], path: '#e8e2d2', pond: '#a8cfe0', tree: ['#7a9e6f', '#6a4a2c'], flower: ['#fff', '#dce8ff', '#ffd9e8'] },
]

// おなじ 10まいの 絵を「ひるま／ゆうぐれ／よる」で つかいまわす。
// sceneIndex 0〜9=ひるま、10〜19=ゆうぐれ、20〜29=よる。
interface Tone {
  name: string
  veil?: string // ぜんたいに かける いろ
  veilOpacity?: number
  sun?: string // おひさま／おつきさま の いろ
  stars?: boolean
}
const TONES: Tone[] = [
  { name: '', sun: '#fff6c4' },
  { name: 'ゆうぐれ', veil: '#ff7a2f', veilOpacity: 0.3, sun: '#ffd9a0' },
  { name: 'よる', veil: '#12224a', veilOpacity: 0.52, sun: '#fdf6d0', stars: true },
]
export const TONE_COUNT = TONES.length
const toneOf = (index: number): Tone =>
  TONES[Math.floor(index / PALETTES.length) % TONES.length]

// ばしょごとに いつも おなじ 絵に するための かんたんな らんすう
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function parkName(index: number): string {
  const base = PALETTES[index % PALETTES.length].name
  const t = toneOf(index)
  return t.name ? `${base}（${t.name}）` : base
}

export function ParkScene({
  index,
  fit = 'slice',
}: {
  index: number
  fit?: 'slice' | 'meet' // meet=ぜんたいを 見せる（サムネ用）
}) {
  const p = PALETTES[index % PALETTES.length]
  const tone = toneOf(index)
  const r = rng(index * 7919 + 13)
  const id = `pk${index}`

  // 木・花・池は らんすうで ちらす（でも index が おなじなら いつも おなじ）
  const trees = Array.from({ length: 14 }, () => ({
    x: r() * 100,
    y: 26 + r() * 70,
    s: 0.7 + r() * 0.7,
  }))
  const flowers = Array.from({ length: 26 }, () => ({
    x: r() * 100,
    y: 28 + r() * 68,
    c: p.flower[Math.floor(r() * p.flower.length)],
    s: 0.6 + r() * 0.8,
  }))
  const pondX = 10 + r() * 60
  const pondY = 58 + r() * 22
  const stars = Array.from({ length: 22 }, () => ({
    x: r() * 100,
    y: 1 + r() * 20,
    r: 0.3 + r() * 0.5,
    o: 0.5 + r() * 0.5,
  }))

  return (
    <svg
      className="park-scene"
      viewBox="0 0 100 100"
      preserveAspectRatio={fit === "meet" ? "xMidYMid meet" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="100%" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`${id}grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.grass[0]} />
          <stop offset="100%" stopColor={p.grass[1]} />
        </linearGradient>
      </defs>

      {/* そら と しばふ */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#${id}sky)`} />
      <rect x="0" y="22" width="100" height="78" fill={`url(#${id}grass)`} />
      {/* おひさま */}
      <circle cx="82" cy="9" r="6" fill={tone.sun} opacity="0.9" />
      {/* よるの ほし */}
      {tone.stars &&
        stars.map((st, i) => (
          <circle key={`s${i}`} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={st.o} />
        ))}

      {/* とおくの 丘 */}
      <ellipse cx="20" cy="26" rx="34" ry="10" fill={p.grass[0]} opacity="0.9" />
      <ellipse cx="72" cy="24" rx="30" ry="9" fill={p.grass[0]} opacity="0.75" />

      {/* いけ */}
      <ellipse cx={pondX} cy={pondY} rx="16" ry="8" fill={p.pond} opacity="0.85" />
      <ellipse cx={pondX} cy={pondY} rx="16" ry="8" fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.5" />

      {/* 花 */}
      {flowers.map((f, i) => (
        <circle key={`f${i}`} cx={f.x} cy={f.y} r={0.8 * f.s} fill={f.c} opacity="0.9" />
      ))}

      {/* 木 */}
      {trees.map((t, i) => (
        <g key={`t${i}`} transform={`translate(${t.x} ${t.y}) scale(${t.s})`} opacity="0.95">
          <rect x="-0.7" y="0" width="1.4" height="3.4" fill={p.tree[1]} rx="0.5" />
          <circle cx="0" cy="-1.2" r="3.1" fill={p.tree[0]} />
          <circle cx="-2" cy="0.2" r="2.2" fill={p.tree[0]} opacity="0.9" />
          <circle cx="2" cy="0.2" r="2.2" fill={p.tree[0]} opacity="0.9" />
        </g>
      ))}

      {/* じかんたいの いろ（ゆうぐれ・よる） */}
      {tone.veil && (
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill={tone.veil}
          opacity={tone.veilOpacity}
          style={{ mixBlendMode: 'multiply' }}
        />
      )}
    </svg>
  )
}
