// =============================================================
//  むしレースの うごき（けいさんだけ。絵は RaceTrack 側）
// -------------------------------------------------------------
//  ・ハンドルと ブレーキは じどう。じぶんで おすのは アクセルだけ
//  ・アクセルを おさなくても ゆっくり すすむ（すばやさで はやさが かわる）
//  ・アクセルは たいりょくゲージを つかう（ゲージの おおきさ＝たいりょく）。
//    ゼロに なると ふめない。はなすと みんな おなじ はやさで もどる
//  ・もっている わざを すきな ときに つかえる（かいすうは もとの わざの かいすう）
//  ・ひとが うごかす むし（human）は なんびき いても いい（つうしんレース）。
//    メッセージと おとは「だれあて か（to）」を つけて だし、がめん側で じぶんの ぶんだけ ひろう
// =============================================================
import { curvAt, LANE_LIMIT, wrapS, type Track } from './raceCourse'
import type { RaceMove } from './raceMoves'

// ── はやさの きまり ─────────────────────────────
export const BOOST = 92 // アクセルで ふえる はやさ（みんな おなじ）
export const REGEN = 0.6 // たいりょくの もどる はやさ（1びょうに ゲージ何びょうぶん。みんな おなじ）
const DASH_POW = 120
const SUPER_DASH_POW = 175
const SHOT_SPEED = 440
const STRAIGHT_SPEED = 400
const MOVE_CD = 1.2 // わざを つかったら つぎまで まつ じかん（れんだ ぼうし）

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
  human: boolean // ひとが アクセルを おす（false なら CPU）
  skill: number // CPUの うまさ 0〜1（human なら つかわない）
  tag?: string // むしの したに だす 名前（つうしんの プレイヤー名 など）
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
  spinAngle: number
  travel: number // あしの うごき用
  lap: number
  dashT: number
  dashPow: number
  turboT: number
  spinT: number
  sleepT: number
  slowT: number
  jamT: number
  endlessT: number
  shieldT: number
  usesLeft: number[] // わざごとの のこり かいすう
  moveCd: number
  aiThinkAt: number // CPUが つぎに わざを かんがえる じこく
  aiHi: number
  aiLo: number
  aiHolding: boolean
  aiStubborn: number // へとへとでも おしつづける のこり じかん（へたな CPU）
  aiIdleUntil: number // ぼんやりして アクセルを わすれている あいだ
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

export interface Fx {
  kind: 'text' | 'ring' | 'star' | 'swap' | 'puff'
  racer: string
  text?: string
  color?: string
  t0: number
  dur: number
}

export type RaceEventKind =
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

export interface RaceEvent {
  seq: number
  ev: RaceEventKind
  to: string // '*' なら みんな
  t: number
}

export interface RaceMessage {
  text: string
  t: number
  to: string
}

export interface RaceInput {
  accel: boolean
  move: number | null // つかう わざの ばんごう
}

export interface RaceState {
  track: Track
  laps: number
  racers: Racer[]
  shots: Shot[]
  traps: Trap[]
  stars: { owner: string; at: number; name: string; ultimate: boolean }[]
  fx: Fx[]
  messages: RaceMessage[]
  events: RaceEvent[] // さいきん 2びょうぶん（がめん側は seq で よみおわりを おぼえる）
  seq: number
  clock: number // ずっと すすむ とけい（カウントダウンも ふくむ）
  t: number // スタートしてからの じかん
  countdown: number
  firstHumanFinishAt: number | null
  humansDoneAt: number | null
  over: boolean
  nextId: number
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
      spinAngle: 0,
      travel: 0,
      lap: 1,
      dashT: 0,
      dashPow: 0,
      turboT: 0,
      spinT: 0,
      sleepT: 0,
      slowT: 0,
      jamT: 0,
      endlessT: 0,
      shieldT: 0,
      usesLeft: r.moves.map((m) => m.uses),
      moveCd: 0,
      aiThinkAt: rand(2, 5),
      // うまい CPU ほど ゲージを たっぷり ためてから ふみ、ぎりぎりまで つかう
      aiHi: rand(0.45, 1) * (1 - r.skill * 0.3) + r.skill * 0.25,
      aiLo: rand(0, 0.3) * (1 - r.skill * 0.7),
      aiHolding: true,
      aiStubborn: 0,
      aiIdleUntil: 0,
      laneBias: rand(-10, 10),
      finishTime: null,
    }
  })
  return {
    track,
    laps,
    racers,
    shots: [],
    traps: [],
    stars: [],
    fx: [],
    messages: [],
    events: [],
    seq: 0,
    clock: 0,
    t: 0,
    countdown: 3.6,
    firstHumanFinishAt: null,
    humansDoneAt: null,
    over: false,
    nextId: 1,
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

// ひとが うごかしている むしにだけ とどける
function say(st: RaceState, r: Racer, text: string) {
  if (!r.human) return
  st.messages.push({ text, t: st.clock, to: r.id })
  if (st.messages.length > 12) st.messages.shift()
}
function emit(st: RaceState, to: Racer | '*', ev: RaceEventKind) {
  if (to !== '*' && !to.human) return
  st.events.push({ seq: ++st.seq, ev, to: to === '*' ? '*' : to.id, t: st.clock })
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
    say(st, target, `🛡️ バリアで「${moveName}」を ふせいだ！`)
    emit(st, target, 'shield')
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
  const what = { spin: 'ころんじゃった！', sleep: 'ねむっちゃった！', slow: 'おそく なっちゃった！', jam: 'アクセルが ふめない！' }[kind]
  say(st, target, `💥 ${by.name}の「${moveName}」で ${what}`)
  emit(st, target, 'hitMe')
  if (by !== target) {
    say(st, by, `🎯 「${moveName}」が ${target.name}に あたった！`)
    emit(st, by, 'hit')
  }
}

// ── わざを つかう ─────────────────────────────
export function useMove(st: RaceState, r: Racer, idx: number) {
  const m = r.moves[idx]
  if (!m || (r.usesLeft[idx] ?? 0) <= 0 || r.moveCd > 0 || !running(r) || st.countdown > 0) return
  r.usesLeft[idx] -= 1
  r.moveCd = MOVE_CD
  const ult = m.ultimate
  const k = ult ? 1.5 : 1
  st.fx.push({ kind: 'text', racer: r.id, text: `${m.emoji}${m.name}`, color: ult ? '#ffd23f' : '#fff', t0: st.clock, dur: 1.6 })
  say(st, r, `${m.emoji} 「${m.name}」！`)

  const dash = (sec: number, pow: number) => {
    r.dashPow = r.dashT > 0 ? Math.max(r.dashPow, pow) : pow
    r.dashT = Math.max(r.dashT, sec)
    r.spinT = 0
    r.sleepT = 0
    emit(st, r, 'dash')
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
    emit(st, r, 'shoot')
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
      emit(st, r, 'dash')
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
      emit(st, r, 'shoot')
      break
    case 'wave': {
      const list = allAhead(ult ? 2000 : 900)
      st.fx.push({ kind: 'ring', racer: r.id, color: '#6fd3ff', t0: st.clock, dur: 0.8 })
      for (const o of list) applyHit(st, o, 'slow', 2.6 * k, r, m.name)
      break
    }
    case 'star':
      st.stars.push({ owner: r.id, at: st.clock + 1.2, name: m.name, ultimate: ult })
      say(st, r, '🌠 1いの むしを ねらって いるよ…')
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
      emit(st, r, 'refill')
      break
    case 'endless':
      r.endlessT = Math.max(r.endlessT, 6 * k)
      r.stamina = Math.min(r.tank, r.stamina + r.tank * 0.3)
      popText(st, r, 'たいりょく むげん！', '#ffd23f')
      emit(st, r, 'refill')
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
        say(st, t, `🧲 ${r.name}の「${m.name}」で たいりょくを すいとられた！`)
        emit(st, t, 'hitMe')
      }
      dash(1.2 * k, DASH_POW)
      break
    }
    case 'shield':
      r.shieldT = Math.max(r.shieldT, 9 * k)
      r.slowT = 0
      r.jamT = 0
      emit(st, r, 'shield')
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
      say(st, t, `🔄 ${r.name}の「${m.name}」で いれかえられた！`)
      emit(st, t, 'hitMe')
      say(st, r, `🔄 ${t.name}と いれかわった！`)
      break
    }
  }
}

// ── CPU：わざを いつ つかうか ─────────────────────────────
//  うまい CPU ほど つかいどき（まえに むしが いる・ゲージが すくない など）を まつ。
//  のこりの かいすうは レースの のこりに ちらして つかう
function aiGoodTime(st: RaceState, r: Racer, m: RaceMove, rank: number, corner: number): boolean {
  const t = nextTarget(st, r)
  const aheadNear = !!t && t.s > r.s && t.s - r.s < 650
  switch (m.effect) {
    case 'refill':
      return r.stamina < r.tank * 0.35
    case 'endless':
      return r.stamina > r.tank * 0.4
    case 'swap':
      return rank > 1 && !!t && t.s > r.s && t.s - r.s < 800
    case 'shot':
    case 'slowShot':
    case 'sleepShot':
    case 'jam':
    case 'steal':
      return aheadNear
    case 'wave':
      return st.racers.some((o) => o !== r && running(o) && o.s > r.s && o.s - r.s < 900)
    case 'poisonTrap':
      return st.racers.some((o) => o !== r && running(o) && o.s < r.s && r.s - o.s < 400)
    case 'dash':
    case 'superDash':
    case 'turbo':
      return corner < 0.4
    case 'star':
      return rank > 1
    default:
      return true
  }
}

function aiThink(st: RaceState, r: Racer, rank: number, corner: number) {
  if (st.clock < r.aiThinkAt || r.moveCd > 0) return
  r.aiThinkAt = st.clock + rand(1.2, 3.5) * (1.6 - r.skill)
  const avail = r.moves.map((_, i) => i).filter((i) => r.usesLeft[i] > 0)
  if (!avail.length) return
  const total = st.track.L * st.laps
  const left = avail.reduce((a, i) => a + r.usesLeft[i], 0)
  // のこりの みちのりで かんがえる かいすう → いま つかう かくりつ
  const thinksLeft = Math.max(1, (total - r.s) / (r.cruise * 2.4 * (1.6 - r.skill)))
  if (Math.random() > Math.min(1, (left / thinksLeft) * 1.4)) return
  const good = r.skill < 0.35 ? avail : avail.filter((i) => aiGoodTime(st, r, r.moves[i], rank, corner))
  if (!good.length) return
  useMove(st, r, good[Math.floor(Math.random() * good.length)])
}

// ── CPU：アクセルを おすか ─────────────────────────────
function aiPress(st: RaceState, r: Racer, dt: number, corner: number): boolean {
  const total = st.track.L * st.laps
  const sk = r.skill
  // さいごの ひとふんばり（うまい CPU ほど のこりを ぜんぶ つかう）
  if (r.s > total - st.track.L * (0.1 + sk * 0.25)) return r.stamina > 0.05
  // ぼんやり（へたな CPU は ときどき アクセルを わすれる）
  if (st.clock < r.aiIdleUntil) return false
  if (Math.random() < (1 - sk) * 0.25 * dt) r.aiIdleUntil = st.clock + rand(0.8, 2.5)
  // へとへとでも しばらく おしつづけて しまう（そのあいだ ゲージは もどらない）
  if (r.stamina <= 0.01) {
    if (r.aiHolding && r.aiStubborn <= 0) r.aiStubborn = (1 - sk) * 2.6
    if (r.aiStubborn > 0) {
      r.aiStubborn -= dt
      if (r.aiStubborn > 0) return true
    }
    r.aiHolding = false
  }
  if (r.aiHolding && r.stamina <= r.aiLo * r.tank) r.aiHolding = false
  if (!r.aiHolding && r.stamina >= r.aiHi * r.tank) r.aiHolding = true
  // うまい CPU は きつい カーブでは ふまない（カーブでは アクセルが ききにくい）
  if (sk >= 0.5 && corner > 0.65) return false
  return r.aiHolding
}

// ── 1コマ すすめる ─────────────────────────────
export function stepRace(st: RaceState, dt: number, inputs: Record<string, RaceInput>) {
  st.clock += dt
  const tr = st.track
  if (st.countdown > 0) {
    const before = Math.ceil(st.countdown)
    st.countdown -= dt
    const after = Math.ceil(st.countdown)
    if (after !== before) emit(st, '*', after > 0 ? 'count' : 'go')
    return
  }
  st.t += dt
  const total = tr.L * st.laps
  const ranked = standings(st)
  const rankOf = new Map(ranked.map((r, i) => [r.id, i + 1]))
  const humans = st.racers.filter((r) => r.human && running(r))
  const humanMax = humans.length ? Math.max(...humans.map((h) => h.s)) : null
  const humanMin = humans.length ? Math.min(...humans.map((h) => h.s)) : null

  for (const r of st.racers) {
    const rank = rankOf.get(r.id) ?? 1
    // ── タイマー
    for (const key of ['dashT', 'turboT', 'spinT', 'sleepT', 'slowT', 'jamT', 'endlessT', 'shieldT', 'moveCd'] as const)
      if (r[key] > 0) r[key] = Math.max(0, r[key] - dt)

    const c = Math.min(1, Math.abs(curvAt(tr, r.s + 30)) * 150) // 0=まっすぐ 1=きつい カーブ
    // ── アクセルを おすか
    const input = inputs[r.id]
    if (!running(r)) r.pressing = false
    else if (r.human) r.pressing = !!input?.accel
    else {
      r.pressing = aiPress(st, r, dt, c)
      aiThink(st, r, rank, c)
    }
    if (r.human && input?.move != null) useMove(st, r, input.move)

    const stunned = r.spinT > 0 || r.sleepT > 0
    r.accelOn = r.pressing && r.stamina > 0 && r.jamT <= 0 && !stunned
    // たいりょく：ふんでいると へる／はなすと もどる（もどる はやさは みんな おなじ）
    if (r.accelOn) {
      if (r.endlessT <= 0) r.stamina = Math.max(0, r.stamina - dt)
    } else if (!r.pressing) r.stamina = Math.min(r.tank, r.stamina + REGEN * dt)

    // ── はやさ
    let target = r.cruise * (r.turboT > 0 ? 1.22 : 1) * (1 - 0.1 * c)
    if (r.accelOn) target += BOOST * (1 - 0.45 * c)
    if (r.dashT > 0) target += r.dashPow
    if (r.slowT > 0) target *= 0.5
    // CPUが ひとから はなれすぎない ように すこしだけ ちぢめる（へたな CPU ほど つよく）
    if (!r.human && running(r) && humanMax !== null && humanMin !== null) {
      const ease = 1 - r.skill
      if (r.s - humanMax > 350) target *= 1 - 0.02 - 0.05 * ease
      else if (humanMin - r.s > 500) target *= 1 + 0.01 + 0.03 * ease
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

    if (running(r)) {
      const lap = Math.min(st.laps, Math.floor(Math.max(0, r.s) / tr.L) + 1)
      if (lap > r.lap) {
        r.lap = lap
        emit(st, r, 'lap')
        say(st, r, lap === st.laps ? '🔔 さいごの 1しゅう！' : `🏁 ${lap}しゅうめ！`)
      }
    }
    if (running(r) && before < total && r.s >= total) {
      r.finishTime = st.t
      r.pressing = false
      if (r.human) {
        if (st.firstHumanFinishAt === null) st.firstHumanFinishAt = st.clock
        emit(st, r, 'finish')
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
  st.events = st.events.filter((e) => st.clock - e.t < 2)

  // ── おわり
  //  ・みんな ゴールした
  //  ・ひと ぜんいんが ゴールして 7びょう（のこりの CPU は いまの じゅんばんで ゴール あつかい）
  //  ・さいしょの ひとが ゴールして 60びょう（つうしんで うごかなくなった ひとが いても おわる）
  if (st.humansDoneAt === null && st.racers.some((r) => r.human) && st.racers.every((r) => !r.human || !running(r)))
    st.humansDoneAt = st.clock
  const allDone = st.racers.every((r) => !running(r))
  const timeUp =
    (st.humansDoneAt !== null && st.clock - st.humansDoneAt > 7) ||
    (st.firstHumanFinishAt !== null && st.clock - st.firstHumanFinishAt > 60) ||
    st.t > 900
  if ((allDone || timeUp) && !st.over) {
    // まだ ゴールしていない むしは、いまの じゅんばんで ゴールした ことにする
    let tt = st.t
    for (const r of standings(st)) if (r.finishTime === null) r.finishTime = tt += 0.5
    st.over = true
  }
}

// ── ゲストの がめん用：ホストから とどいた すがたを うつす ─────────────
//  ホストだけが stepRace で けいさんし、ゲストは この スナップショットを
//  うけとって、つぎが とどくまで はやさぶん すすめて なめらかに 見せる。
export interface RaceSnap {
  c: number // clock
  t: number
  cd: number // countdown
  ov: boolean
  // [s, lat, latV, speed, stamina, accelOn, pressing, dashT, turboT, spinT, sleepT, slowT, jamT, endlessT, shieldT, moveCd, finishTime, lap]
  r: number[][]
  u: string[] // わざの のこり かいすう（'321' の ように 1けたずつ）
  sh: [number, number, number, string, number, number][] // [id, s, lat, emoji, ultimate, すすむ むき]
  tp: [number, number, number, string][] // [id, s, lat, emoji]
  fx: Fx[]
  m: RaceMessage[]
  e: RaceEvent[]
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

export function encodeSnap(st: RaceState): RaceSnap {
  return {
    c: r2(st.clock),
    t: r2(st.t),
    cd: r2(st.countdown),
    ov: st.over,
    r: st.racers.map((r) => [
      r1(r.s),
      r1(r.lat),
      r1(r.latV),
      r1(r.speed),
      r2(r.stamina),
      r.accelOn ? 1 : 0,
      r.pressing ? 1 : 0,
      r2(r.dashT),
      r2(r.turboT),
      r2(r.spinT),
      r2(r.sleepT),
      r2(r.slowT),
      r2(r.jamT),
      r2(r.endlessT),
      r2(r.shieldT),
      r2(r.moveCd),
      r.finishTime === null ? -1 : r1(r.finishTime),
      r.lap,
    ]),
    u: st.racers.map((r) => r.usesLeft.map((n) => Math.min(9, n)).join('')),
    sh: st.shots.map((s) => {
      const tgt = s.kind === 'homing' ? st.racers.find((r) => r.id === s.target) : null
      const dir = tgt && trackDiff(st, tgt.s, s.s) < 0 ? -1 : 1
      return [s.id, r1(s.s), r1(s.lat), s.emoji, s.ultimate ? 1 : 0, dir]
    }),
    tp: st.traps.map((p) => [p.id, r1(p.s), r1(p.lat), p.emoji]),
    fx: st.fx,
    m: st.messages,
    e: st.events,
  }
}

// うけとった ときの いちを おぼえて おき、まいコマ そこへ ちかづける
export interface GuestSync {
  at: number // うけとった ときの performance.now()
  snap: RaceSnap
}

export function applySnap(st: RaceState, g: GuestSync, now: number, dt: number) {
  const sn = g.snap
  const age = Math.min(0.5, (now - g.at) / 1000) // とどいてからの じかん（ながく とまったら のばさない）
  st.clock = sn.c + age
  st.t = sn.t + (sn.cd > 0 ? 0 : age)
  st.countdown = sn.cd > 0 ? Math.max(0, sn.cd - age) : 0
  st.over = sn.ov
  sn.r.forEach((a, i) => {
    const r = st.racers[i]
    if (!r) return
    const moving = sn.cd <= 0
    const wantS = a[0] + (moving ? a[3] * age : 0)
    const err = wantS - r.s
    r.s = Math.abs(err) > 120 ? wantS : r.s + err * Math.min(1, dt * 10)
    r.lat += (a[1] + a[2] * age - r.lat) * Math.min(1, dt * 10)
    r.latV = a[2]
    r.speed = a[3]
    r.stamina = a[4]
    r.accelOn = a[5] === 1
    r.pressing = a[6] === 1
    r.dashT = a[7]
    r.turboT = a[8]
    r.spinT = a[9]
    r.sleepT = a[10]
    r.slowT = a[11]
    r.jamT = a[12]
    r.endlessT = a[13]
    r.shieldT = a[14]
    r.moveCd = Math.max(0, a[15] - age)
    r.finishTime = a[16] >= 0 ? a[16] : null
    r.lap = a[17]
    const u = sn.u?.[i]
    if (u) r.usesLeft = r.moves.map((_, k) => Number(u[k] ?? 0))
    r.travel += r.speed * dt
    if (r.spinT > 0) r.spinAngle += dt * 14
    else r.spinAngle *= 0.8
  })
  st.shots = (sn.sh ?? []).map(([id, s, lat, emoji, ult, dir]) => ({
    id,
    owner: '',
    kind: 'homing' as const,
    hit: 'spin' as const,
    s: s + (dir ?? 1) * SHOT_SPEED * age,
    lat,
    life: 1,
    traveled: 0,
    emoji,
    name: '',
    ultimate: ult === 1,
  }))
  st.traps = (sn.tp ?? []).map(([id, s, lat, emoji]) => ({ id, owner: '', s, lat, born: 0, emoji, name: '' }))
  st.fx = sn.fx ?? []
  st.messages = sn.m ?? []
  st.events = sn.e ?? []
}
