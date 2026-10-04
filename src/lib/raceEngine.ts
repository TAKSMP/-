// =============================================================
//  むしレースの うごき（けいさんだけ。絵は RaceTrack 側）
// -------------------------------------------------------------
//  ・ハンドルと ブレーキは じどう。じぶんで おすのは アクセルだけ
//  ・アクセルを おさなくても ゆっくり すすむ（すばやさで はやさが かわる）
//  ・アクセルは たいりょくゲージを つかう（ゲージの おおきさ＝たいりょく）。
//    ゼロに なると ふめない。はなすと みんな おなじ はやさで もどる
//  ・🎁を とると じぶんの わざが 1つ つかえる（マリオカートの アイテムの ように）
// =============================================================
import { curvAt, LANE_LIMIT, wrapS, type Track } from './raceCourse'
import type { RaceMove } from './raceMoves'

// ── はやさの きまり ─────────────────────────────
export const BOOST = 92 // アクセルで ふえる はやさ（みんな おなじ）
export const REGEN = 0.42 // たいりょくの もどる はやさ（1びょうに ゲージ何びょうぶん。みんな おなじ）
const DASH_POW = 120
const SUPER_DASH_POW = 175
const SHOT_SPEED = 440
const STRAIGHT_SPEED = 400
const BOX_RESPAWN = 2.5
const ROLL_SEC = 0.9 // 🎁を とってから わざが きまるまで（ルーレット）

// すばやさ → アクセルなしの はやさ（おおきい すばやさほど のびが ゆるやか）
export function cruiseOf(speedStat: number): number {
  return 70 + 9.5 * Math.sqrt(Math.max(1, Math.min(50, speedStat)))
}
// たいりょく → アクセルを ふみつづけられる びょうすう
export function tankOf(hp: number): number {
  return 4 + ((Math.max(20, Math.min(150, hp)) - 20) / 130) * 10
}

export interface RacerInit {
  id: string
  name: string
  photo: string
  color: string
  mine: boolean
  level: number
  speedStat: number
  hpStat: number
  moves: RaceMove[]
}

export interface Racer extends RacerInit {
  cruise: number
  tank: number
  s: number // スタートから すすんだ きょり（しゅうを またいでも ふえつづける）
  lat: number // よこずれ（みぎが ＋）
  latV: number
  targetLat: number
  speed: number
  stamina: number
  pressing: boolean
  accelOn: boolean // いま ほんとうに アクセルが きいているか
  heading: number
  spinAngle: number
  travel: number // あしの うごき用
  dashT: number
  dashPow: number
  turboT: number
  spinT: number
  sleepT: number
  slowT: number
  jamT: number
  endlessT: number
  shieldT: number
  item: RaceMove | null
  rollT: number
  aiUseAt: number
  aiHi: number
  aiLo: number
  aiHolding: boolean
  laneBias: number
  finishTime: number | null
}

export interface Shot {
  id: number
  owner: string
  kind: 'homing' | 'straight'
  hit: 'spin' | 'sleep' | 'slow'
  target?: string
  s: number
  lat: number
  life: number
  traveled: number
  emoji: string
  name: string
  ultimate: boolean
}

export interface Trap {
  id: number
  owner: string
  s: number // コースの ばしょ（0〜L）
  lat: number
  born: number
  emoji: string
  name: string
}

export interface Box {
  s: number
  lat: number
  readyAt: number
}

export interface Fx {
  kind: 'text' | 'ring' | 'star' | 'swap' | 'puff'
  racer?: string
  x?: number
  y?: number
  s?: number
  lat?: number
  text?: string
  color?: string
  t0: number
  dur: number
}

export type RaceEvent =
  | 'pickup'
  | 'dash'
  | 'hit'
  | 'hitMe'
  | 'shield'
  | 'refill'
  | 'shoot'
  | 'lap'
  | 'finish'
  | 'go'
  | 'count'

export interface RaceState {
  track: Track
  laps: number
  racers: Racer[]
  shots: Shot[]
  traps: Trap[]
  boxes: Box[]
  stars: { owner: string; at: number; name: string; ultimate: boolean }[]
  fx: Fx[]
  messages: { text: string; t: number; mine: boolean }[]
  events: RaceEvent[]
  clock: number // ずっと すすむ とけい（カウントダウンも ふくむ）
  t: number // スタートしてからの じかん
  countdown: number
  myFinishAt: number | null
  over: boolean
  nextId: number
  myLap: number
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

export function createRace(track: Track, inits: RacerInit[], laps: number): RaceState {
  const racers: Racer[] = inits.map((r, i) => {
    const cruise = cruiseOf(r.speedStat)
    const tank = tankOf(r.hpStat)
    return {
      ...r,
      cruise,
      tank,
      s: -40 - i * 34,
      lat: i % 2 === 0 ? -24 : 24,
      latV: 0,
      targetLat: i % 2 === 0 ? -24 : 24,
      speed: 0,
      stamina: tank,
      pressing: false,
      accelOn: false,
      heading: 0,
      spinAngle: 0,
      travel: 0,
      dashT: 0,
      dashPow: 0,
      turboT: 0,
      spinT: 0,
      sleepT: 0,
      slowT: 0,
      jamT: 0,
      endlessT: 0,
      shieldT: 0,
      item: null,
      rollT: 0,
      aiUseAt: 0,
      aiHi: rand(0.45, 1),
      aiLo: rand(0, 0.3),
      aiHolding: true,
      laneBias: rand(-10, 10),
      finishTime: null,
    }
  })
  const boxes: Box[] = []
  for (const f of [0.14, 0.38, 0.6, 0.83]) {
    for (const lat of [-30, 0, 30]) boxes.push({ s: track.L * f, lat, readyAt: 0 })
  }
  return {
    track,
    laps,
    racers,
    shots: [],
    traps: [],
    boxes,
    stars: [],
    fx: [],
    messages: [],
    events: [],
    clock: 0,
    t: 0,
    countdown: 3.6,
    myFinishAt: null,
    over: false,
    nextId: 1,
    myLap: 1,
  }
}

// ── じゅんい ─────────────────────────────
export function standings(st: RaceState): Racer[] {
  return [...st.racers].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime
    if (a.finishTime !== null) return -1
    if (b.finishTime !== null) return 1
    return b.s - a.s
  })
}

const running = (r: Racer) => r.finishTime === null

// コースの うえでの さ（-L/2〜L/2）。しゅうが ちがっても ちかくに いれば ちいさい
function trackDiff(st: RaceState, a: number, b: number): number {
  const L = st.track.L
  let d = wrapS(st.track, a - b)
  if (d > L / 2) d -= L
  return d
}

// まえの むし（いなければ うしろの むし。1いでも わざが むだに ならない ように）
function nextTarget(st: RaceState, r: Racer): Racer | null {
  let ahead: Racer | null = null
  let behind: Racer | null = null
  for (const o of st.racers) {
    if (o === r || !running(o)) continue
    if (o.s > r.s) {
      if (!ahead || o.s < ahead.s) ahead = o
    } else if (!behind || o.s > behind.s) behind = o
  }
  return ahead ?? behind
}

function say(st: RaceState, text: string, mine: boolean) {
  st.messages.push({ text, t: st.clock, mine })
  if (st.messages.length > 4) st.messages.shift()
}

function popText(st: RaceState, r: Racer, text: string, color = '#fff') {
  st.fx.push({ kind: 'text', racer: r.id, text, color, t0: st.clock, dur: 1.3 })
}

// ── こうげきが あたった ─────────────────────────────
function applyHit(st: RaceState, target: Racer, kind: 'spin' | 'sleep' | 'slow' | 'jam', sec: number, by: Racer, moveName: string) {
  if (!running(target)) return
  if (target.shieldT > 0) {
    target.shieldT = 0
    popText(st, target, 'バリア！', '#8fe3ff')
    st.fx.push({ kind: 'ring', racer: target.id, color: '#8fe3ff', t0: st.clock, dur: 0.6 })
    if (target.mine) {
      say(st, `🛡️ バリアで「${moveName}」を ふせいだ！`, true)
      st.events.push('shield')
    }
    return
  }
  if (kind === 'spin') {
    target.spinT = Math.max(target.spinT, sec)
    target.dashT = 0
    popText(st, target, 'くるくる〜', '#ffd23f')
  } else if (kind === 'sleep') {
    target.sleepT = Math.max(target.sleepT, sec)
    target.dashT = 0
    popText(st, target, 'zzz…', '#c9b8ff')
  } else if (kind === 'slow') {
    target.slowT = Math.max(target.slowT, sec)
    popText(st, target, 'のろのろ', '#b6f09c')
  } else {
    target.jamT = Math.max(target.jamT, sec)
    popText(st, target, 'しびしび', '#fff36b')
  }
  st.fx.push({ kind: 'puff', racer: target.id, t0: st.clock, dur: 0.5 })
  if (target.mine) {
    const what = { spin: 'ころんじゃった！', sleep: 'ねむっちゃった！', slow: 'おそく なっちゃった！', jam: 'アクセルが ふめない！' }[kind]
    say(st, `💥 ${by.name}の「${moveName}」で ${what}`, true)
    st.events.push('hitMe')
  } else if (by.mine) {
    say(st, `🎯 「${moveName}」が ${target.name}に あたった！`, true)
    st.events.push('hit')
  }
}

// ── わざを つかう ─────────────────────────────
export function useMove(st: RaceState, r: Racer) {
  const m = r.item
  if (!m || r.rollT > 0 || !running(r)) return
  r.item = null
  const ult = m.ultimate
  const k = ult ? 1.5 : 1
  st.fx.push({ kind: 'text', racer: r.id, text: `${m.emoji}${m.name}`, color: ult ? '#ffd23f' : '#fff', t0: st.clock, dur: 1.6 })
  if (r.mine) say(st, `${m.emoji} 「${m.name}」！`, true)

  const dash = (sec: number, pow: number) => {
    r.dashPow = r.dashT > 0 ? Math.max(r.dashPow, pow) : pow
    r.dashT = Math.max(r.dashT, sec)
    r.spinT = 0
    r.sleepT = 0
    if (r.mine) st.events.push('dash')
  }
  const shoot = (hit: Shot['hit'], target: Racer | null) => {
    if (!target) return dash(1.5, DASH_POW)
    st.shots.push({
      id: st.nextId++,
      owner: r.id,
      kind: 'homing',
      hit,
      target: target.id,
      s: r.s + (target.s > r.s ? 20 : -20),
      lat: r.lat,
      life: 6,
      traveled: 0,
      emoji: m.emoji,
      name: m.name,
      ultimate: ult,
    })
    if (r.mine) st.events.push('shoot')
  }
  // まえの むし ぜんいん（いなければ うしろの むし ぜんいん）
  const allAhead = (range: number) => {
    const list = st.racers.filter((o) => o !== r && running(o) && o.s > r.s && o.s - r.s < range)
    if (list.length) return list
    const t = nextTarget(st, r)
    return t ? [t] : []
  }

  switch (m.effect) {
    case 'dash':
      dash(2.0 * k, DASH_POW)
      break
    case 'superDash':
      dash(2.6 * k, SUPER_DASH_POW)
      break
    case 'turbo':
      r.turboT = Math.max(r.turboT, 7 * k)
      if (r.mine) st.events.push('dash')
      break
    case 'shot':
      if (ult) for (const o of allAhead(700).slice(0, 3)) shoot('spin', o)
      else shoot('spin', nextTarget(st, r))
      break
    case 'slowShot':
      if (m.wide) for (const o of allAhead(900)) applyHit(st, o, 'slow', 3 * k, r, m.name)
      else shoot('slow', nextTarget(st, r))
      break
    case 'sleepShot':
      if (m.wide) for (const o of allAhead(900)) applyHit(st, o, 'sleep', 1.4 * k, r, m.name)
      else shoot('sleep', nextTarget(st, r))
      break
    case 'jam':
      for (const o of m.wide ? allAhead(1000) : [nextTarget(st, r)].filter((x): x is Racer => !!x))
        applyHit(st, o, 'jam', 4 * k, r, m.name)
      break
    case 'multiShot':
      for (let i = 0; i < m.count; i++) {
        st.shots.push({
          id: st.nextId++,
          owner: r.id,
          kind: 'straight',
          hit: 'spin',
          s: r.s + 26 + i * 18,
          lat: Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, r.lat + (i - (m.count - 1) / 2) * 26)),
          life: 4,
          traveled: 0,
          emoji: m.emoji,
          name: m.name,
          ultimate: ult,
        })
      }
      if (r.mine) st.events.push('shoot')
      break
    case 'wave': {
      const list = allAhead(ult ? 2000 : 900)
      st.fx.push({ kind: 'ring', racer: r.id, color: '#6fd3ff', t0: st.clock, dur: 0.8 })
      for (const o of list) applyHit(st, o, 'slow', 2.6 * k, r, m.name)
      break
    }
    case 'star':
      st.stars.push({ owner: r.id, at: st.clock + 1.2, name: m.name, ultimate: ult })
      if (r.mine) say(st, '🌠 1いの むしを ねらって いるよ…', true)
      break
    case 'poisonTrap': {
      const lats = m.wide || ult ? [-30, 0, 30] : [r.lat]
      for (const lat of lats)
        st.traps.push({ id: st.nextId++, owner: r.id, s: wrapS(st.track, r.s - 40), lat, born: st.clock, emoji: m.emoji, name: m.name })
      break
    }
    case 'refill':
      r.stamina = Math.min(r.tank, r.stamina + r.tank * (ult ? 1 : 0.65))
      popText(st, r, 'げんき もりもり！', '#ffd23f')
      if (r.mine) st.events.push('refill')
      break
    case 'endless':
      r.endlessT = Math.max(r.endlessT, 6 * k)
      r.stamina = Math.min(r.tank, r.stamina + r.tank * 0.3)
      popText(st, r, 'たいりょく むげん！', '#ffd23f')
      if (r.mine) st.events.push('refill')
      break
    case 'steal': {
      const t = nextTarget(st, r)
      if (t && t.shieldT > 0) {
        applyHit(st, t, 'slow', 0, r, m.name) // バリアが ふせぐ
      } else if (t) {
        const got = t.stamina * (ult ? 0.8 : 0.5)
        t.stamina -= got
        r.stamina = Math.min(r.tank, r.stamina + got + r.tank * 0.2)
        popText(st, t, 'すいとられた〜', '#ff9ec4')
        if (t.mine) {
          say(st, `🧲 ${r.name}の「${m.name}」で たいりょくを すいとられた！`, true)
          st.events.push('hitMe')
        }
      }
      dash(1.2 * k, DASH_POW)
      break
    }
    case 'shield':
      r.shieldT = Math.max(r.shieldT, 9 * k)
      r.slowT = 0
      r.jamT = 0
      if (r.mine) st.events.push('shield')
      break
    case 'swap': {
      const t = st.racers
        .filter((o) => o !== r && running(o) && o.s > r.s && o.s - r.s < (ult ? 2000 : 800))
        .sort((a, b) => a.s - b.s)[0]
      if (!t) {
        dash(2 * k, DASH_POW)
        break
      }
      if (t.shieldT > 0) {
        applyHit(st, t, 'slow', 0, r, m.name)
        break
      }
      st.fx.push({ kind: 'swap', racer: r.id, t0: st.clock, dur: 0.7 })
      st.fx.push({ kind: 'swap', racer: t.id, t0: st.clock, dur: 0.7 })
      ;[r.s, t.s] = [t.s, r.s]
      ;[r.lat, t.lat] = [t.lat, r.lat]
      if (t.mine) {
        say(st, `🔄 ${r.name}の「${m.name}」で いれかえられた！`, true)
        st.events.push('hitMe')
      } else if (r.mine) say(st, `🔄 ${t.name}と いれかわった！`, true)
      break
    }
  }
}

// ── AI：🎁の わざを いつ つかうか ─────────────────────────────
function aiWantsToUse(st: RaceState, r: Racer, rank: number): boolean {
  const m = r.item
  if (!m || st.clock < r.aiUseAt) return false
  switch (m.effect) {
    case 'refill':
      return r.stamina < r.tank * 0.35
    case 'shield':
      return true
    case 'swap':
      return rank > 1
    default:
      return true
  }
}

// ── 🎁から でる わざ（うしろの むしほど つよい わざが でやすい） ─────────
function rollItem(st: RaceState, r: Racer, rank: number): RaceMove | null {
  if (!r.moves.length) return null
  const n = st.racers.length
  const behind = n > 1 ? (rank - 1) / (n - 1) : 0 // 0=1い 1=さいご
  const catchUp = new Set(['swap', 'star', 'superDash', 'wave', 'turbo'])
  const weights = r.moves.map((m) => {
    let w = 1
    if (m.ultimate) w *= 0.6 + behind * 3
    if (catchUp.has(m.effect)) w *= 0.7 + behind * 1.6
    if (m.effect === 'shield' || m.effect === 'poisonTrap') w *= 1.6 - behind
    return w
  })
  let x = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]
    if (x <= 0) return r.moves[i]
  }
  return r.moves[r.moves.length - 1]
}

// ── 1コマ すすめる ─────────────────────────────
export function stepRace(st: RaceState, dt: number, input: { accel: boolean; use: boolean }) {
  st.clock += dt
  const tr = st.track
  if (st.countdown > 0) {
    const before = Math.ceil(st.countdown)
    st.countdown -= dt
    const after = Math.ceil(st.countdown)
    if (after !== before) st.events.push(after > 0 ? 'count' : 'go')
    return
  }
  st.t += dt
  const total = tr.L * st.laps
  const ranked = standings(st)
  const rankOf = new Map(ranked.map((r, i) => [r.id, i + 1]))
  const me = st.racers.find((r) => r.mine)

  for (const r of st.racers) {
    const rank = rankOf.get(r.id) ?? 1
    // ── タイマー
    for (const key of ['dashT', 'turboT', 'spinT', 'sleepT', 'slowT', 'jamT', 'endlessT', 'shieldT'] as const)
      if (r[key] > 0) r[key] = Math.max(0, r[key] - dt)
    if (r.rollT > 0) {
      r.rollT -= dt
      if (r.rollT <= 0) {
        r.rollT = 0
        r.aiUseAt = st.clock + rand(0.6, 3.5)
      }
    }

    // ── アクセルを おすか
    if (!running(r)) r.pressing = false
    else if (r.mine) r.pressing = input.accel
    else {
      const lastStretch = r.s > total - tr.L * 0.3
      if (r.aiHolding && r.stamina <= r.aiLo * r.tank) r.aiHolding = false
      if (!r.aiHolding && r.stamina >= r.aiHi * r.tank) r.aiHolding = true
      r.pressing = lastStretch ? r.stamina > 0.05 : r.aiHolding
      if (aiWantsToUse(st, r, rank)) useMove(st, r)
    }
    if (r.mine && input.use) useMove(st, r)

    const stunned = r.spinT > 0 || r.sleepT > 0
    r.accelOn = r.pressing && r.stamina > 0 && r.jamT <= 0 && !stunned
    // たいりょく：ふんでいると へる／はなすと もどる（もどる はやさは みんな おなじ）
    if (r.accelOn) {
      if (r.endlessT <= 0) r.stamina = Math.max(0, r.stamina - dt)
    } else if (!r.pressing) r.stamina = Math.min(r.tank, r.stamina + REGEN * dt)

    // ── はやさ
    const c = Math.min(1, Math.abs(curvAt(tr, r.s + 30)) * 150) // 0=まっすぐ 1=きつい カーブ
    let target = r.cruise * (r.turboT > 0 ? 1.22 : 1) * (1 - 0.1 * c)
    if (r.accelOn) target += BOOST * (1 - 0.45 * c)
    if (r.dashT > 0) target += r.dashPow
    if (r.slowT > 0) target *= 0.5
    // すこしだけ まえと うしろの さを ちぢめる（ちいさい子でも たのしめる ように）
    if (!r.mine && me && running(r) && running(me)) {
      const gap = r.s - me.s
      if (gap > 350) target *= 0.95
      else if (gap < -500) target *= 1.04
    }
    if (!running(r)) target = r.cruise * 0.8
    if (r.spinT > 0) target = 18
    if (r.sleepT > 0) target = 0
    const up = r.dashT > 0 ? 320 : 130
    r.speed += Math.max(-260 * dt, Math.min(up * dt, target - r.speed))

    // ── よこの うごき（じどうで ハンドル）
    const ck = curvAt(tr, r.s + 70)
    let want = Math.max(-1, Math.min(1, ck * 220)) * 30 + r.laneBias // カーブの うちがわを はしる
    let blocker: Racer | null = null
    for (const o of st.racers) {
      if (o === r) continue
      const ds = trackDiff(st, o.s, r.s)
      if (ds > 0 && ds < 64 && Math.abs(o.lat - r.lat) < 30 && (!blocker || ds < trackDiff(st, blocker.s, r.s))) blocker = o
    }
    if (blocker && r.speed > blocker.speed - 4) {
      // おいこす：あいている ほうへ よける
      const left = blocker.lat - 34
      const right = blocker.lat + 34
      const canL = left >= -LANE_LIMIT
      const canR = right <= LANE_LIMIT
      if (canL && canR) want = Math.abs(left - want) < Math.abs(right - want) ? left : right
      else want = canL ? left : right
      const ds = trackDiff(st, blocker.s, r.s)
      if (ds < 28 && Math.abs(blocker.lat - r.lat) < 24) r.speed = Math.min(r.speed, blocker.speed)
    }
    r.targetLat = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, want))
    let latAcc = (r.targetLat - r.lat) * 6 - r.latV * 4
    // となりに いる むしとは かさならない ように おしあう
    for (const o of st.racers) {
      if (o === r) continue
      const ds = trackDiff(st, o.s, r.s)
      const dl = r.lat - o.lat
      if (Math.abs(ds) < 34 && Math.abs(dl) < 32) {
        const side = dl !== 0 ? Math.sign(dl) : r.id < o.id ? -1 : 1
        latAcc += side * (32 - Math.abs(dl)) * 26
        // まうしろに くっついたら すこし さがる
        if (ds > 0 && ds < 26 && Math.abs(dl) < 22) r.s -= (26 - ds) * 0.25
      }
    }
    r.latV += latAcc * dt
    r.latV = Math.max(-110, Math.min(110, r.latV))
    r.lat = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, r.lat + r.latV * dt))

    // ── すすむ
    const before = r.s
    r.s += r.speed * dt
    r.travel += r.speed * dt
    if (r.spinT > 0) r.spinAngle += dt * 14
    else r.spinAngle *= 0.8

    if (r.mine && running(r)) {
      const lap = Math.min(st.laps, Math.floor(Math.max(0, r.s) / tr.L) + 1)
      if (lap > st.myLap) {
        st.myLap = lap
        st.events.push('lap')
        say(st, lap === st.laps ? '🔔 さいごの 1しゅう！' : `🏁 ${lap}しゅうめ！`, true)
      }
    }
    if (running(r) && before < total && r.s >= total) {
      r.finishTime = st.t
      r.pressing = false
      if (r.mine) {
        st.myFinishAt = st.clock
        st.events.push('finish')
      }
    }

    // ── 🎁を ひろう
    if (running(r) && !r.item && r.rollT <= 0 && r.s > 0) {
      for (const b of st.boxes) {
        if (b.readyAt > st.clock) continue
        if (Math.abs(trackDiff(st, r.s, b.s)) < 18 && Math.abs(r.lat - b.lat) < 24) {
          b.readyAt = st.clock + BOX_RESPAWN
          const m = rollItem(st, r, rank)
          if (m) {
            r.item = m
            r.rollT = ROLL_SEC
            if (r.mine) st.events.push('pickup')
          }
          break
        }
      }
    }
  }

  // ── とんでいる わざ
  for (const sh of st.shots) {
    sh.life -= dt
    const owner = st.racers.find((r) => r.id === sh.owner)
    if (sh.kind === 'homing') {
      const tgt = st.racers.find((r) => r.id === sh.target)
      if (!tgt || !running(tgt)) {
        sh.life = 0
        continue
      }
      const d = trackDiff(st, tgt.s, sh.s)
      const dir = d >= 0 ? 1 : -1
      const mv = Math.min(Math.abs(d), (SHOT_SPEED + tgt.speed * 0.2) * dt)
      sh.s += dir * mv
      sh.lat += (tgt.lat - sh.lat) * Math.min(1, dt * 6)
      if (Math.abs(trackDiff(st, tgt.s, sh.s)) < 12) {
        sh.life = 0
        const sec = sh.hit === 'sleep' ? 1.8 : sh.hit === 'slow' ? 3 : 1.4
        if (owner) applyHit(st, tgt, sh.hit, sec * (sh.ultimate ? 1.4 : 1), owner, sh.name)
      }
    } else {
      sh.s += STRAIGHT_SPEED * dt
      sh.traveled += STRAIGHT_SPEED * dt
      if (sh.traveled > 1400) sh.life = 0
      for (const r of st.racers) {
        if (!running(r) || (r.id === sh.owner && sh.traveled < 300)) continue
        if (Math.abs(trackDiff(st, r.s, sh.s)) < 14 && Math.abs(r.lat - sh.lat) < 24) {
          sh.life = 0
          if (owner) applyHit(st, r, 'spin', sh.ultimate ? 1.8 : 1.3, owner, sh.name)
          break
        }
      }
    }
  }
  st.shots = st.shots.filter((s) => s.life > 0)

  // ── どくだまり
  st.traps = st.traps.filter((tp) => {
    if (st.clock - tp.born > 20) return false
    for (const r of st.racers) {
      if (!running(r) || (r.id === tp.owner && st.clock - tp.born < 1.5)) continue
      if (Math.abs(trackDiff(st, r.s, tp.s)) < 14 && Math.abs(r.lat - tp.lat) < 22) {
        const owner = st.racers.find((x) => x.id === tp.owner) ?? r
        applyHit(st, r, 'slow', 2.4, owner, tp.name)
        return false
      }
    }
    return true
  })

  // ── ながれぼし
  st.stars = st.stars.filter((sr) => {
    if (st.clock < sr.at) return true
    const owner = st.racers.find((r) => r.id === sr.owner)
    const order = standings(st).filter(running)
    const tgt = order.find((r) => r.id !== sr.owner)
    if (tgt && owner) {
      st.fx.push({ kind: 'star', racer: tgt.id, t0: st.clock, dur: 0.6 })
      applyHit(st, tgt, 'spin', sr.ultimate ? 2.4 : 1.8, owner, sr.name)
    }
    return false
  })

  st.fx = st.fx.filter((f) => st.clock - f.t0 < f.dur)
  st.messages = st.messages.filter((m) => st.clock - m.t < 3.2)

  // ── おわり（じぶんが ゴールして すこし たったら）
  const allDone = st.racers.every((r) => !running(r))
  if (allDone || (st.myFinishAt !== null && st.clock - st.myFinishAt > 7) || st.t > 900) {
    if (!st.over) {
      // まだ ゴールしていない むしは、いまの じゅんばんで ゴールした ことにする
      let tt = st.t
      for (const r of standings(st)) if (r.finishTime === null) r.finishTime = tt += 0.5
      st.over = true
    }
  }
}
