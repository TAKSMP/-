// =============================================================
//  つうしんバトル（Firebase Realtime Database ごしの 1たい1／2たい2）
// -------------------------------------------------------------
//  ・さいしょの field（フィールド）は、ホスト・ゲスト どちらも
//    おなじ チームデータ（team）から createField() で じぶんで つくる。
//    createField() 自体は 乱数を つかわない ので、2つの はしで
//    ズレなく おなじ ものが できる。
//  ・チームは 1〜2ひき。なかまを つれていくかは かた側だけで きめられる
//    （ホストと ゲストで にんずうが ちがっても、エンジンは そのまま たたかえる）。
//  ・2ターンめ いこう（resolveTurn は 乱数を つかう）は、
//    部屋を つくった がわ（ホスト）だけが けいさんして、
//    けっかを Realtime Database に 書きこむ。ゲストは それを うけとって 見るだけ。
//  ・しゃしん（データURL）は 部屋づくりの ときに 1回だけ やりとりし、
//    毎ターンの field には ふくめない（かるく する ため）。
// =============================================================
import { child, get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db, ensureSignedIn } from './firebase'
import {
  createField,
  makeFighter,
  resolveTurn,
  type Command,
  type Field,
  type Fighter,
} from './battleEngine'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { levelOf, movesOf, statsWithLevel, type StorySave } from './story'
import { mainPhoto } from './storage'

export interface BugSnapshot {
  name: string
  photo: string
  hp: number
  attack: number
  defense: number
  speed: number
  moves: SpecialMoveV2[]
}

// もっていく チーム（1〜2ひき）
export type Team = BugSnapshot[]

// ストーリーモードで そだてた 今のレベルの すがたを きりだす
export function buildSnapshot(bug: CaughtBug, save: StorySave): BugSnapshot {
  const level = levelOf(save, bug.id).level
  const s = statsWithLevel(bug, level)
  return {
    name: bug.name,
    photo: mainPhoto(bug),
    hp: s.hp,
    attack: s.attack,
    defense: s.defense,
    speed: s.speed,
    moves: movesOf(save, bug, level),
  }
}

// ネットに のせる ための、かるい Fighter（しゃしん・図鑑データは のぞく）
export type LiteFighter = Omit<Fighter, 'bug' | 'photo'>
export interface LiteField {
  fighters: LiteFighter[]
  turnCount: number
  over: boolean
  winner: Field['winner']
  log: string[] // その ターンの ログだけ（るいせきしない）
}

export type Role = 'host' | 'guest'

export interface RoomSide {
  uid: string
  name: string
  team: Team
}

export interface RoomState {
  createdAt: number
  status: 'waiting' | 'battling'
  host: RoomSide
  guest?: RoomSide
  field?: LiteField
  // それぞれの がわが、じぶんの 生きている虫ぜんいんぶんの めいれいを
  // そろえてから 1かいだけ 書きこむ（にんずうぶん の はいれつ）
  commands?: { host?: Command[]; guest?: Command[] }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // まぎらわしい 0/O 1/I は のぞく

function randomRoomCode(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

function roomRef(code: string) {
  return ref(db, `rooms/${code.toUpperCase()}`)
}

// Firebase は undefined を もつ値を きらうので、JSON往復で きれいに する
function sanitize<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function toLiteField(f: Field): LiteField {
  return sanitize({
    fighters: f.fighters.map((x) => {
      const { bug: _bug, photo: _photo, ...rest } = x
      return rest
    }),
    turnCount: f.turnCount,
    over: f.over,
    winner: f.winner,
    log: f.log,
  })
}

// ダミーの CaughtBug（Fighter.bug の 型を みたす だけ。中身は つかわない）
function dummyBug(name: string): CaughtBug {
  return {
    id: 'net',
    name,
    order: 'ふめい',
    rarity: 1,
    habitat: 'ふめい',
    captures: [],
    mainCaptureId: '',
    corrected: false,
  }
}

// uid（'me0'／'foe1' など）から、チームの なんばんめかを よみとる
function teamPhoto(uid: string, hostTeam: Team, guestTeam: Team): string {
  const m = uid.match(/^(me|foe)(\d+)$/)
  if (!m) return ''
  const team = m[1] === 'me' ? hostTeam : guestTeam
  return team[Number(m[2])]?.photo ?? ''
}

// ホスト・ゲスト どちらの はしでも おなじ ものが できる、さいしょの field
export function buildInitialField(hostTeam: Team, guestTeam: Team): Field {
  const hostFighters = hostTeam.map((s, i) => makeFighter(dummyBug(s.name), s, `me${i}`, 'me', s.photo))
  const guestFighters = guestTeam.map((s, i) =>
    makeFighter(dummyBug(s.name), s, `foe${i}`, 'foe', s.photo),
  )
  return createField([...hostFighters, ...guestFighters])
}

// 同期された LiteField から、ホストが つづきの resolveTurn を よべる ように
// 本物の Field を くみたてなおす（ページの さいよみこみ 直後など）。
// pending（ちえんわざの よやく）だけは のらない ため、まれに その わざの
// とちゅうだった ばあいは きえてしまうが、それ以外の じょうたいは そのまま もどる。
export function hydrateField(lite: LiteField, hostTeam: Team, guestTeam: Team): Field {
  return {
    // Realtime Database は からの配列（[]）を おとして undefined に する ので、
    // もどす ときに かならず 配列に なるように しておく（さもないと resolveTurn が こわれる）
    fighters: lite.fighters.map((f) => ({
      ...f,
      photo: teamPhoto(f.uid, hostTeam, guestTeam),
      bug: dummyBug(f.name),
      statuses: f.statuses ?? [],
      moves: f.moves ?? [],
      usesLeft: f.usesLeft ?? [],
    })),
    turnCount: lite.turnCount,
    pending: [],
    log: [],
    steps: [],
    over: lite.over,
    winner: lite.winner,
  }
}

// 部屋を つくる（じぶんが ホスト）。へやコードを かえす。
export async function createRoom(name: string, team: Team): Promise<string> {
  const user = await ensureSignedIn()
  let code = randomRoomCode()
  // ものすごく まれに かぶったら つくりなおす（さいだい5かい）
  for (let i = 0; i < 5; i++) {
    const existing = await get(child(roomRef(code), 'status'))
    if (!existing.exists()) break
    code = randomRoomCode()
  }
  const state: RoomState = {
    createdAt: Date.now(),
    status: 'waiting',
    host: { uid: user.uid, name, team },
  }
  await set(roomRef(code), state)
  onDisconnect(roomRef(code)).remove()
  return code
}

// コードを 入れて 部屋に 入る（じぶんが ゲスト）
export async function joinRoom(code: string, name: string, team: Team): Promise<void> {
  const user = await ensureSignedIn()
  const snap = await get(roomRef(code))
  if (!snap.exists()) throw new Error('その コードの 部屋が 見つかりません。')
  const state = snap.val() as RoomState
  if (state.guest) throw new Error('その 部屋には もう 2人 そろっています。')
  const guest: RoomSide = { uid: user.uid, name, team }
  // さいしょの field は 乱数を つかわない ので、ここで つくって そのまま 書きこんで OK
  const initialField = toLiteField(buildInitialField(state.host.team, team))
  await update(roomRef(code), { guest, status: 'battling', field: initialField })
  onDisconnect(child(roomRef(code), 'guest')).remove()
}

// 部屋の じょうたいを かんしする
export function watchRoom(code: string, cb: (state: RoomState | null) => void): () => void {
  return onValue(roomRef(code), (snap) => cb(snap.exists() ? (snap.val() as RoomState) : null))
}

// じぶんの てを だす（生きている虫 ぜんいんぶん、そろえてから 1かいだけ よぶ）
export async function submitCommands(code: string, role: Role, commands: Command[]): Promise<void> {
  await update(child(roomRef(code), 'commands'), { [role]: sanitize(commands) }).catch((e) => {
    console.warn('つうしんバトル：てを 送れませんでした', e)
  })
}

// ホストだけが よぶ：両方の てが そろっていたら 1ターン すすめて 書きこむ。
// すすんだ あとの Field（ホストが つぎの ターンの けいさんに つかう）を かえす。
export function resolveIfReady(
  code: string,
  hostField: Field,
  commands: { host?: Command[]; guest?: Command[] } | undefined,
): Field | null {
  if (!commands?.host || !commands.guest) return null
  const next = resolveTurn(hostField, [...commands.host, ...commands.guest])
  update(roomRef(code), { field: toLiteField(next), commands: null }).catch((e) =>
    console.warn('つうしんバトル：field の 書きこみに しっぱい', e),
  )
  return next
}

// 部屋を 出る（のこっている ほうが こまらない ように、へやごと けす）
export async function leaveRoom(code: string): Promise<void> {
  try {
    await remove(roomRef(code))
  } catch {
    // すでに 消えていても きにしない
  }
}
