// =============================================================
//  バトルエンジン v2
// -------------------------------------------------------------
//  ・1体1 でも 2体2 でも おなじ しくみで うごく
//  ・すばやさで こうどうじゅんが きまる
//  ・どく / ねむり / まひ の じょうたいいじょう
//  ・のうりょくランク（-6〜+6）
//  ・ため / かくれる / ちえん / はんげき / きゅうしゅう など
//  UIから つかうのは resolveTurn() ひとつだけ。
// =============================================================
import type {
  BattleStatsV2,
  CaughtBug,
  SpecialMoveV2,
  StatKey,
  StatusKey,
} from '../types'
import { BASIC_ATTACK } from './moveLibrary'

// -------------------------------------------------------------
//  ていすう（バランス調整は ここを いじれば OK）
// -------------------------------------------------------------
export const HP_MIN = 20
export const HP_MAX = 60
export const STAT_MIN = 1
export const STAT_MAX = 10
export const RANK_MIN = -6
export const RANK_MAX = 6

export const POISON_RATIO = 1 / 8 // どくの まいターン ダメージ（さいだいHPひ）
// バトルの ながさの つまみ。ちいさくすると ダメージが へって ターンが のびる。
// へいきん 8〜12ターンに おさまるように きめている。
export const DAMAGE_SCALE = 0.72
export const SLEEP_MIN_TURNS = 2
export const SLEEP_MAX_TURNS = 4
export const PARALYSIS_FAIL_CHANCE = 0.125 // まひで うごけない かくりつ（8かいに 1かい）
export const PARALYSIS_SPEED_MUL = 0.5 // まひの すばやさ ていか
export const CRIT_MUL = 1.5
export const SPREAD_MUL = 0.75 // ぜんたいわざの いりょく ほせい
export const BASE_EVASION = 0 // かいひランクの しょきち

export type Side = 'me' | 'foe'

export interface StatusState {
  key: StatusKey
  turnsLeft: number // ねむり だけ つかう（どく・まひは 0のまま つづく）
}

export interface Fighter {
  uid: string // 'me0' 'me1' 'foe0' 'foe1'
  side: Side
  bug: CaughtBug
  name: string
  photo: string
  maxHp: number
  hp: number
  base: { attack: number; defense: number; speed: number }
  rank: Record<StatKey, number>
  status: StatusState | null
  moves: SpecialMoveV2[]
  usesLeft: number[]
  // いちじてきな じょうたい
  charging: { move: SpecialMoveV2; targetUid: string | null; hidden: boolean } | null
  recharge: number // >0 なら うごけない
  regen: { ratio: number; turnsLeft: number } | null
  leechedBy: { uid: string; ratio: number; turnsLeft: number } | null
  counterGuard: boolean // はんげきの かまえ
  damageTakenThisTurn: number
  actedIndex: number // このターン なんばんめに うごいたか（-1 = まだ）
  fainted: boolean
  faintReported: boolean // 「たおれた！」を ログに だしたか
}

export interface DelayedHit {
  fromUid: string
  fromName: string
  targetUid: string
  move: SpecialMoveV2
  attackSnapshot: number
  turnsLeft: number
}

// ログ1行ぶんの「そのときの すがた」。
// UIが「テキストを 1行 見せる → そのときの HPや じょうたいを うつす」を
// じゅんばんに できるように、ログと セットで のこしておく。
export interface TurnStep {
  line: string
  fighters: Fighter[]
}

export interface Field {
  fighters: Fighter[]
  turnCount: number
  pending: DelayedHit[]
  log: string[]
  steps: TurnStep[] // log と おなじ ながさ。1行ごとの スナップショット
  over: boolean
  winner: Side | null
}

// UIから わたす「このターン こうする」という めいれい
export interface Command {
  actorUid: string
  moveIndex: number // -1 = ふつうの こうげき、0〜2 = ひっさつわざ
  targetUid?: string | null
}

type Rng = () => number

// -------------------------------------------------------------
//  ちいさな ヘルパー
// -------------------------------------------------------------
export function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(Number.isFinite(v) ? v : lo)
  return Math.max(lo, Math.min(hi, n))
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const emptyRank = (): Record<StatKey, number> => ({
  attack: 0,
  defense: 0,
  speed: 0,
  accuracy: 0,
  evasion: BASE_EVASION,
})

// のうりょくランク → ばいりつ
export function rankMul(stat: StatKey, rank: number): number {
  const r = clampInt(rank, RANK_MIN, RANK_MAX)
  if (stat === 'accuracy' || stat === 'evasion') {
    return r >= 0 ? (3 + r) / 3 : 3 / (3 - r)
  }
  return r >= 0 ? (2 + r) / 2 : 2 / (2 - r)
}

// じっさいの ステータス（ランク・じょうたいいじょう こみ）
export function effStat(f: Fighter, stat: 'attack' | 'defense' | 'speed'): number {
  let v = f.base[stat] * rankMul(stat, f.rank[stat])
  if (stat === 'speed' && f.status?.key === 'paralysis') v *= PARALYSIS_SPEED_MUL
  return Math.max(1, v)
}

export const statusLabel = (k: StatusKey): string =>
  k === 'poison' ? 'どく' : k === 'sleep' ? 'ねむり' : 'まひ'
export const statusEmoji = (k: StatusKey): string =>
  k === 'poison' ? '☠️' : k === 'sleep' ? '💤' : '⚡'
export const statLabel = (s: StatKey): string =>
  s === 'attack'
    ? 'こうげき'
    : s === 'defense'
      ? 'ぼうぎょ'
      : s === 'speed'
        ? 'すばやさ'
        : s === 'accuracy'
          ? 'めいちゅうりつ'
          : 'かいひりつ'

// -------------------------------------------------------------
//  ファイターを つくる
// -------------------------------------------------------------
export function makeFighter(
  bug: CaughtBug,
  stats: BattleStatsV2,
  uid: string,
  side: Side,
  photo: string,
): Fighter {
  const moves = stats.moves.slice(0, 3)
  return {
    uid,
    side,
    bug,
    name: bug.name,
    photo,
    maxHp: stats.hp,
    hp: stats.hp,
    base: {
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
    },
    rank: emptyRank(),
    status: null,
    moves,
    usesLeft: moves.map((m) => m.uses),
    charging: null,
    recharge: 0,
    regen: null,
    leechedBy: null,
    counterGuard: false,
    damageTakenThisTurn: 0,
    actedIndex: -1,
    fainted: false,
    faintReported: false,
  }
}

export function createField(fighters: Fighter[]): Field {
  return {
    fighters,
    turnCount: 1,
    pending: [],
    log: [],
    steps: [],
    over: false,
    winner: null,
  }
}

// いまの ファイターたちを まるごと 写しとる（あとで 書きかわっても かわらない）
function snapshotFighters(f: Field): Fighter[] {
  return f.fighters.map((x) => ({
    ...x,
    rank: { ...x.rank },
    status: x.status ? { ...x.status } : null,
    usesLeft: [...x.usesLeft],
    charging: x.charging ? { ...x.charging } : null,
  }))
}

// -------------------------------------------------------------
//  ターゲットを えらぶ
// -------------------------------------------------------------
function aliveOf(f: Field, side: Side): Fighter[] {
  return f.fighters.filter((x) => x.side === side && !x.fainted)
}

function byUid(f: Field, uid: string | null | undefined): Fighter | undefined {
  return uid ? f.fighters.find((x) => x.uid === uid) : undefined
}

function resolveTargets(
  field: Field,
  actor: Fighter,
  move: SpecialMoveV2,
  wantUid: string | null | undefined,
): Fighter[] {
  const foes = aliveOf(field, actor.side === 'me' ? 'foe' : 'me')
  const allies = aliveOf(field, actor.side).filter((x) => x.uid !== actor.uid)
  switch (move.target) {
    case 'self':
      return [actor]
    case 'ally': {
      const want = byUid(field, wantUid)
      if (want && !want.fainted && want.side === actor.side) return [want]
      return allies.length > 0 ? [allies[0]] : [actor]
    }
    case 'selfSide':
      return aliveOf(field, actor.side)
    case 'allFoes':
      return foes
    case 'allOthers':
      return [...foes, ...allies]
    case 'oneFoe':
    default: {
      const want = byUid(field, wantUid)
      if (want && !want.fainted && want.side !== actor.side) return [want]
      return foes.length > 0 ? [foes[0]] : []
    }
  }
}

// -------------------------------------------------------------
//  ダメージ計算
// -------------------------------------------------------------
function critChance(stage: number): number {
  if (stage >= 9) return 1
  if (stage >= 2) return 0.25
  if (stage === 1) return 0.125
  return 1 / 16
}

interface HitOpts {
  spread: boolean
  late: boolean
}

function calcDamage(
  att: Fighter,
  def: Fighter,
  move: SpecialMoveV2,
  opts: HitOpts,
  rng: Rng,
): { dmg: number; crit: boolean } {
  if (move.fixedDamage && move.fixedDamage > 0) {
    return { dmg: move.fixedDamage, crit: false }
  }
  const a = effStat(att, 'attack')
  const d = effStat(def, 'defense')
  let power = move.power

  if (opts.late && move.boostIfLate) power *= move.boostIfLate
  if (move.boostIfFoeStatus && def.status) power *= move.boostIfFoeStatus
  if (move.boostIfSelfStatus && att.status) power *= move.boostIfSelfStatus

  const crit = rng() < critChance(move.critStage ?? 0)
  let dmg = (((power / 10) * (a + 2)) / (d / 2 + 3)) * DAMAGE_SCALE + 1
  if (crit) dmg *= CRIT_MUL
  if (opts.spread) dmg *= SPREAD_MUL
  dmg *= 0.9 + rng() * 0.2 // すこしだけ ゆらす
  return { dmg: Math.max(1, Math.round(dmg)), crit }
}

// めいちゅう はんてい
function hitCheck(
  att: Fighter,
  def: Fighter,
  move: SpecialMoveV2,
  rng: Rng,
): boolean {
  if (move.accuracy === null) return true
  if (def.charging?.hidden) return false
  const acc =
    (move.accuracy / 100) *
    rankMul('accuracy', att.rank.accuracy) *
    (1 / rankMul('evasion', def.rank.evasion))
  return rng() < Math.min(1, acc)
}

// -------------------------------------------------------------
//  ダメージを あたえる（はんげき・きゅうしゅうも ここで）
// -------------------------------------------------------------
function applyDamage(
  att: Fighter,
  def: Fighter,
  raw: number,
  log: string[],
): number {
  const dmg = Math.min(def.hp, Math.max(0, raw))
  def.hp -= dmg
  def.damageTakenThisTurn += dmg
  if (def.hp <= 0) {
    def.hp = 0
    def.fainted = true
    def.charging = null
  } else if (def.counterGuard && !att.fainted && att.uid !== def.uid) {
    // とげの よろい：うけた ダメージの はんぶんを かえす
    const back = Math.max(1, Math.round(dmg * 0.5))
    att.hp = Math.max(0, att.hp - back)
    att.damageTakenThisTurn += back
    log.push(`🦔 ${def.name}の とげが ささった！ ${att.name}に ${back}の ダメージ！`)
    if (att.hp <= 0) {
      att.fainted = true
      att.charging = null
    }
  }
  return dmg
}

// たおれた 虫を まとめて ログに だす（ダメージの あとに よぶ）
function reportFaints(f: Field, log: string[]): void {
  for (const x of f.fighters) {
    if (x.fainted && !x.faintReported) {
      x.faintReported = true
      log.push(`💫 ${x.name}は たおれた！`)
    }
  }
}

// じょうたいいじょうを つける
function inflictStatus(
  target: Fighter,
  key: StatusKey,
  log: string[],
  rng: Rng,
): void {
  if (target.fainted) return
  if (target.status) {
    log.push(`…${target.name}は すでに ${statusLabel(target.status.key)}だ。`)
    return
  }
  const turns =
    key === 'sleep'
      ? SLEEP_MIN_TURNS +
        Math.floor(rng() * (SLEEP_MAX_TURNS - SLEEP_MIN_TURNS + 1))
      : 0
  target.status = { key, turnsLeft: turns }
  log.push(`${statusEmoji(key)} ${target.name}は ${statusLabel(key)}に なった！`)
  // まひは 目に 見えにくいので、なにが おきるかを ことばで つたえる
  if (key === 'paralysis') log.push(`🐢 ${target.name}の すばやさが はんぶんに なった！`)
}

// のうりょくランクを うごかす
function changeRank(
  target: Fighter,
  stat: StatKey,
  stage: number,
  log: string[],
): void {
  if (target.fainted) return
  const before = target.rank[stat]
  const after = clampInt(before + stage, RANK_MIN, RANK_MAX)
  target.rank[stat] = after
  if (after === before) {
    log.push(
      `…${target.name}の ${statLabel(stat)}は もう ${stage > 0 ? 'あがらない' : 'さがらない'}。`,
    )
    return
  }
  const diff = Math.abs(after - before)
  const word = stage > 0 ? 'あがった' : 'さがった'
  const mark = stage > 0 ? '🔺' : '🔻'
  log.push(
    `${mark} ${target.name}の ${statLabel(stat)}が ${diff >= 2 ? 'ぐーんと ' : ''}${word}！`,
  )
}

// -------------------------------------------------------------
//  わざを 1つ じっこうする
// -------------------------------------------------------------
function executeMove(
  field: Field,
  actor: Fighter,
  move: SpecialMoveV2,
  wantUid: string | null | undefined,
  isLate: boolean,
  log: string[],
  rng: Rng,
): void {
  // ── ちえんわざ：よこくして このターンは おわり
  if (move.delayTurns && move.delayTurns > 0) {
    const t = resolveTargets(field, actor, move, wantUid)[0]
    if (!t) return
    field.pending.push({
      fromUid: actor.uid,
      fromName: actor.name,
      targetUid: t.uid,
      move,
      attackSnapshot: effStat(actor, 'attack'),
      turnsLeft: move.delayTurns,
    })
    log.push(`🕰️ ${actor.name}は ${move.delayTurns}ターンごの こうげきを しかけた！`)
    return
  }

  // ── ためわざ：1ターンめは ためるだけ
  if (move.chargeTurns && move.chargeTurns > 0 && !actor.charging) {
    actor.charging = {
      move,
      targetUid: wantUid ?? null,
      hidden: !!move.hideWhileCharging,
    }
    log.push(
      move.hideWhileCharging
        ? `🫥 ${actor.name}は すがたを かくした！`
        : `⏳ ${actor.name}は ちからを ためている！`,
    )
    return
  }

  // ── HPを はらう わざ
  if (move.hpCostRatio) {
    const cost = Math.max(1, Math.round(actor.maxHp * move.hpCostRatio))
    actor.hp = Math.max(0, actor.hp - cost)
    log.push(`💔 ${actor.name}は じぶんの HPを ${cost} けずった！`)
    if (actor.hp <= 0) {
      actor.fainted = true
      actor.faintReported = true
      log.push(`💫 ${actor.name}は たおれた！`)
      return
    }
  }

  // ── ばいがえし
  if (move.counterRatio) {
    const back = Math.round(actor.damageTakenThisTurn * move.counterRatio)
    const t = resolveTargets(field, actor, move, wantUid)[0]
    if (back <= 0 || !t) {
      log.push('…しかし うまく きまらなかった！')
      return
    }
    applyDamage(actor, t, back, log)
    log.push(`↩️ ${t.name}に ${back}の ばいがえし ダメージ！`)
    reportFaints(field, log)
    return
  }

  // ── はんげきの かまえ
  if (move.counterGuard) {
    actor.counterGuard = true
    log.push(`🦔 ${actor.name}は はんげきの かまえを とった！`)
    return
  }

  const targets = resolveTargets(field, actor, move, wantUid)
  if (targets.length === 0) {
    log.push('…しかし あいてが いない！')
    return
  }
  const spread =
    (move.target === 'allFoes' || move.target === 'allOthers') &&
    targets.length > 1

  let totalDealt = 0

  for (const target of targets) {
    if (target.fainted) continue

    // ── こうげきわざ
    if (move.kind === 'attack' && (move.power > 0 || move.fixedDamage)) {
      if (!hitCheck(actor, target, move, rng)) {
        log.push(`💨 ${target.name}は ヒラリと よけた！`)
        continue
      }
      const [lo, hi] = move.hits ?? [1, 1]
      const times = lo === hi ? lo : lo + Math.floor(rng() * (hi - lo + 1))
      let dealt = 0
      let critAny = false
      for (let i = 0; i < times; i++) {
        if (target.fainted || actor.fainted) break
        const { dmg, crit } = calcDamage(actor, target, move, { spread, late: isLate }, rng)
        dealt += applyDamage(actor, target, dmg, log)
        critAny = critAny || crit
      }
      totalDealt += dealt
      if (times > 1) log.push(`⚡ ${times}かい あたった！ あわせて ${dealt}の ダメージ！`)
      else log.push(`${target.name}に ${dealt}の ダメージ！`)
      if (critAny) log.push('🎯 きゅうしょに あたった！')
      reportFaints(field, log)
    }

    // ── じょうたいいじょう
    if (move.inflict && !target.fainted) {
      const ok = move.kind === 'attack' ? rng() < move.inflict.chance : true
      if (ok) inflictStatus(target, move.inflict.status, log, rng)
    }

    // ── のうりょく変化
    if (move.statChanges) {
      for (const sc of move.statChanges) {
        if (sc.chance !== undefined && rng() >= sc.chance) continue
        const to = sc.to === 'self' ? actor : target
        changeRank(to, sc.stat, sc.stage, log)
      }
    }

    // ── かいふく
    if (move.healRatio) {
      const heal = Math.max(1, Math.round(target.maxHp * move.healRatio))
      const before = target.hp
      target.hp = Math.min(target.maxHp, target.hp + heal)
      log.push(
        target.hp > before
          ? `💚 ${target.name}の HPが ${target.hp - before} かいふく！`
          : `…${target.name}の HPは もう まんタンだ！`,
      )
    }

    // ── じょうたいいじょうを なおす（なんでも）
    if (move.cureStatus) {
      if (target.status) {
        log.push(`✨ ${target.name}の ${statusLabel(target.status.key)}が なおった！`)
        target.status = null
      } else {
        log.push(`…${target.name}は げんきだ。`)
      }
    }

    // ── とくてい の じょうたいいじょうだけ なおす（ねむり／どく／まひ）
    if (move.cureStatusKey) {
      if (target.status?.key === move.cureStatusKey) {
        log.push(`✨ ${target.name}の ${statusLabel(target.status.key)}が なおった！`)
        target.status = null
      } else if (target.status) {
        log.push(`…${target.name}の ${statusLabel(target.status.key)}には きかなかった。`)
      } else {
        log.push(`…${target.name}は げんきだ。`)
      }
    }

    // ── ねむって ぜんかいふく
    if (move.restSleep) {
      target.hp = target.maxHp
      target.status = { key: 'sleep', turnsLeft: 2 }
      log.push(`🛌 ${target.name}は ねむって HPが ぜんかい！`)
    }

    // ── まいターン かいふく
    if (move.regen) {
      target.regen = { ratio: move.regen.ratio, turnsLeft: move.regen.turns }
      log.push(`🌱 ${target.name}は すこしずつ かいふく するように なった！`)
    }

    // ── まいターン すいとる
    if (move.leech && !target.fainted) {
      target.leechedBy = {
        uid: actor.uid,
        ratio: move.leech.ratio,
        turnsLeft: move.leech.turns,
      }
      log.push(`🩸 ${actor.name}は ${target.name}に すいついた！`)
    }

    // ── のうりょくを うばう
    if (move.stealStats && !target.fainted) {
      let stolen = 0
      for (const k of Object.keys(target.rank) as StatKey[]) {
        if (target.rank[k] > 0) {
          actor.rank[k] = clampInt(actor.rank[k] + target.rank[k], RANK_MIN, RANK_MAX)
          stolen += target.rank[k]
          target.rank[k] = 0
        }
      }
      log.push(
        stolen > 0
          ? `🫳 ${actor.name}は ${target.name}の ちからを うばった！`
          : '…しかし うばう ものが なかった！',
      )
    }

    // ── のうりょくを いれかえる
    if (move.swapStats && !target.fainted) {
      const tmp = { ...actor.rank }
      actor.rank = { ...target.rank }
      target.rank = tmp
      log.push(`🔄 ${actor.name}と ${target.name}の のうりょくが いれかわった！`)
    }
  }

  // ── きゅうしゅう
  if (move.drainRatio && totalDealt > 0 && !actor.fainted) {
    const heal = Math.max(1, Math.round(totalDealt * move.drainRatio))
    const before = actor.hp
    actor.hp = Math.min(actor.maxHp, actor.hp + heal)
    log.push(`💚 ${actor.name}は ${actor.hp - before} きゅうしゅうした！`)
  }

  // ── はんどう
  if (move.recoilRatio && totalDealt > 0 && !actor.fainted) {
    const back = Math.max(1, Math.round(totalDealt * move.recoilRatio))
    actor.hp = Math.max(0, actor.hp - back)
    log.push(`💥 ${actor.name}は はんどうで ${back}の ダメージ！`)
    if (actor.hp <= 0) {
      actor.fainted = true
      actor.faintReported = true
      log.push(`💫 ${actor.name}は たおれた！`)
    }
  }

  // ── つかったあと うごけない
  if (move.rechargeTurns && !actor.fainted) {
    actor.recharge = move.rechargeTurns
  }
}

// -------------------------------------------------------------
//  1ターンぶんを かいけつする（UIから よぶのは これ）
// -------------------------------------------------------------
export function resolveTurn(
  field: Field,
  commands: Command[],
  rng: Rng = Math.random,
): Field {
  const f: Field = {
    ...field,
    fighters: field.fighters.map((x) => ({
      ...x,
      rank: { ...x.rank },
      status: x.status ? { ...x.status } : null,
      usesLeft: [...x.usesLeft],
      damageTakenThisTurn: 0,
      actedIndex: -1,
    })),
    pending: field.pending.map((p) => ({ ...p })),
    log: [],
    steps: [],
  }

  // ログの push に わりこんで、1行ごとの すがたを steps に のこす。
  // （こうしておくと、せんとうの しょりは これまでと まったく おなじまま、
  //   UI側が「1行ずつ 見せる」ことが できる）
  const log = f.log
  const basePush = Array.prototype.push.bind(log) as (
    ...items: string[]
  ) => number
  log.push = (...lines: string[]): number => {
    const n = basePush(...lines)
    for (const line of lines) f.steps.push({ line, fighters: snapshotFighters(f) })
    return n
  }

  // --- こうどうじゅん を きめる ---
  interface Entry {
    fighter: Fighter
    move: SpecialMoveV2
    moveIndex: number
    targetUid: string | null
    priority: number
    speed: number
    tie: number
  }
  const entries: Entry[] = []
  for (const c of commands) {
    const actor = f.fighters.find((x) => x.uid === c.actorUid)
    if (!actor || actor.fainted) continue
    // ためている とちゅう / うごけない ときは、その しょりを ゆうせん
    const move =
      actor.charging?.move ??
      (c.moveIndex >= 0 ? actor.moves[c.moveIndex] : BASIC_ATTACK)
    if (!move) continue
    entries.push({
      fighter: actor,
      move,
      moveIndex: actor.charging ? -2 : c.moveIndex,
      targetUid: actor.charging?.targetUid ?? c.targetUid ?? null,
      priority: move.priority ?? 0,
      speed: effStat(actor, 'speed'),
      tie: rng(),
    })
  }
  entries.sort(
    (a, b) => b.priority - a.priority || b.speed - a.speed || a.tie - b.tie,
  )

  // --- じゅんばんに こうどう ---
  let order = 0
  for (const e of entries) {
    const actor = e.fighter
    if (actor.fainted || f.over) continue
    actor.actedIndex = order++

    // うごけない（大わざの あと）
    if (actor.recharge > 0) {
      actor.recharge--
      log.push(`😵 ${actor.name}は うごけない！`)
      continue
    }

    // ねむり
    if (actor.status?.key === 'sleep') {
      if (actor.status.turnsLeft > 0) {
        actor.status.turnsLeft--
        log.push(`💤 ${actor.name}は ぐっすり ねむっている…`)
        continue
      }
      log.push(`☀️ ${actor.name}は めを さました！`)
      actor.status = null
    }

    // まひ
    if (actor.status?.key === 'paralysis' && rng() < PARALYSIS_FAIL_CHANCE) {
      log.push(`⚡ ${actor.name}は しびれて うごけない！`)
      continue
    }

    // ためわざの かいほう
    if (actor.charging) {
      const charged = actor.charging
      actor.charging = null
      log.push(`✨ ${actor.name}の「${charged.move.name}」！`)
      const late = entries.some(
        (o) => o.fighter.side !== actor.side && o.fighter.actedIndex >= 0 && o.fighter.actedIndex < actor.actedIndex,
      )
      executeMove(f, actor, { ...charged.move, chargeTurns: 0 }, charged.targetUid, late, log, rng)
      checkOver(f)
      continue
    }

    // わざの のこり回数
    if (e.moveIndex >= 0) {
      if (actor.usesLeft[e.moveIndex] <= 0) {
        log.push(`…「${e.move.name}」は もう つかえない！`)
        continue
      }
      actor.usesLeft[e.moveIndex]--
      log.push(`✨ ${actor.name}の「${e.move.name}」！`)
    } else {
      log.push(`${actor.name}の こうげき！`)
    }

    const late = entries.some(
      (o) =>
        o.fighter.side !== actor.side &&
        o.fighter.actedIndex >= 0 &&
        o.fighter.actedIndex < actor.actedIndex,
    )
    executeMove(f, actor, e.move, e.targetUid, late, log, rng)
    checkOver(f)
    if (f.over) break
  }

  if (!f.over) endOfTurn(f, log, rng)
  checkOver(f)
  f.turnCount++
  return f
}

// -------------------------------------------------------------
//  ターンの おわりの しょり
// -------------------------------------------------------------
function endOfTurn(f: Field, log: string[], rng: Rng): void {
  // ちえんわざ（すうターンご に あたる）
  const stillPending: DelayedHit[] = []
  for (const p of f.pending) {
    p.turnsLeft--
    if (p.turnsLeft > 0) {
      stillPending.push(p)
      continue
    }
    const target = f.fighters.find((x) => x.uid === p.targetUid)
    if (!target || target.fainted) continue
    const dummy = {
      ...target,
      base: { attack: p.attackSnapshot, defense: 0, speed: 0 },
      rank: emptyRank(),
      name: p.fromName,
      uid: p.fromUid,
    } as Fighter
    const { dmg } = calcDamage(dummy, target, p.move, { spread: false, late: false }, rng)
    log.push(`💫 ${p.fromName}の しかけた こうげきが はつどう！`)
    applyDamage(dummy, target, dmg, log)
    log.push(`${target.name}に ${dmg}の ダメージ！`)
    reportFaints(f, log)
  }
  f.pending = stillPending

  for (const x of f.fighters) {
    if (x.fainted) continue

    // どく
    if (x.status?.key === 'poison') {
      const dmg = Math.max(1, Math.round(x.maxHp * POISON_RATIO))
      x.hp = Math.max(0, x.hp - dmg)
      log.push(`☠️ ${x.name}は どくで ${dmg}の ダメージ！`)
      if (x.hp <= 0) {
        x.fainted = true
        x.faintReported = true
        log.push(`💫 ${x.name}は たおれた！`)
        continue
      }
    }

    // まいターン かいふく
    if (x.regen) {
      const heal = Math.max(1, Math.round(x.maxHp * x.regen.ratio))
      const before = x.hp
      x.hp = Math.min(x.maxHp, x.hp + heal)
      if (x.hp > before) log.push(`🌱 ${x.name}の HPが ${x.hp - before} かいふく！`)
      x.regen.turnsLeft--
      if (x.regen.turnsLeft <= 0) x.regen = null
    }

    // すいとられ
    if (x.leechedBy) {
      const owner = f.fighters.find((o) => o.uid === x.leechedBy!.uid)
      const dmg = Math.max(1, Math.round(x.maxHp * x.leechedBy.ratio))
      x.hp = Math.max(0, x.hp - dmg)
      log.push(`🩸 ${x.name}は HPを ${dmg} すいとられた！`)
      if (owner && !owner.fainted) {
        const before = owner.hp
        owner.hp = Math.min(owner.maxHp, owner.hp + dmg)
        if (owner.hp > before) log.push(`💚 ${owner.name}の HPが ${owner.hp - before} かいふく！`)
      }
      if (x.hp <= 0) {
        x.fainted = true
        x.faintReported = true
        log.push(`💫 ${x.name}は たおれた！`)
        continue
      }
      x.leechedBy.turnsLeft--
      if (x.leechedBy.turnsLeft <= 0 || !owner || owner.fainted) x.leechedBy = null
    }

    // はんげきの かまえは 1ターンで きれる
    x.counterGuard = false
  }
}

function checkOver(f: Field): void {
  const meAlive = aliveOf(f, 'me').length
  const foeAlive = aliveOf(f, 'foe').length
  if (meAlive === 0 || foeAlive === 0) {
    f.over = true
    f.winner = foeAlive === 0 ? 'me' : meAlive === 0 ? 'foe' : null
  }
}

// -------------------------------------------------------------
//  あいて（CPU）の こうどうを きめる
// -------------------------------------------------------------
export function chooseCpuCommand(f: Field, actor: Fighter, rng: Rng = Math.random): Command {
  const foes = aliveOf(f, actor.side === 'me' ? 'foe' : 'me')
  if (foes.length === 0) return { actorUid: actor.uid, moveIndex: -1 }
  // いちばん HPが すくない あいてを ねらう
  const target = [...foes].sort((a, b) => a.hp - b.hp)[0]

  const usable = actor.moves
    .map((m, i) => ({ m, i }))
    .filter((x) => actor.usesLeft[x.i] > 0)

  // HPが すくないときは かいふくを ゆうせん
  const healer = usable.find((x) => x.m.healRatio || x.m.restSleep)
  if (healer && actor.hp <= actor.maxHp * 0.35) {
    return { actorUid: actor.uid, moveIndex: healer.i, targetUid: actor.uid }
  }
  // とどめが させそうな わざが あれば つかう
  const finisher = usable.find(
    (x) => x.m.kind === 'attack' && x.m.power >= 80 && target.hp <= target.maxHp * 0.35,
  )
  if (finisher) {
    return { actorUid: actor.uid, moveIndex: finisher.i, targetUid: target.uid }
  }
  const pool =
    actor.hp > actor.maxHp * 0.7
      ? usable.filter((x) => !x.m.healRatio && !x.m.restSleep)
      : usable
  if (pool.length > 0 && rng() < 0.6) {
    const pick = pool[Math.floor(rng() * pool.length)]
    const t =
      pick.m.target === 'self' || pick.m.target === 'ally' ? actor.uid : target.uid
    return { actorUid: actor.uid, moveIndex: pick.i, targetUid: t }
  }
  return { actorUid: actor.uid, moveIndex: -1, targetUid: target.uid }
}

// -------------------------------------------------------------
//  すばやさを ふくむ ステータスの じどう生成 ＋ ふるいデータの ひきつぎ
// -------------------------------------------------------------
export function migrateSpeed(bug: CaughtBug): number {
  // ふるいデータには すばやさが ない。レア度と 名前から きめて いつも おなじ値に。
  const seed = hashStr('spd' + bug.name + (bug.id ?? ''))
  const r = clampInt(bug.rarity, 1, 5)
  return clampInt(3 + r + ((seed >>> 2) % 3) - 1, STAT_MIN, STAT_MAX)
}

export function migrateHp(oldHp: number): number {
  // ふるい HP（1〜20）を あたらしい はば（20〜60）へ
  return clampInt(HP_MIN + ((oldHp - 1) / 19) * (HP_MAX - HP_MIN), HP_MIN, HP_MAX)
}
