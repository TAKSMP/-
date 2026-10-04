// =============================================================
//  つうしんレース（Firebase Realtime Database ごし、さいだい6にん）
// -------------------------------------------------------------
//  ・へやは つうしんバトルと おなじ rooms/{コード} に つくる
//    （データベースの ルールで 書きこめるのが ここだけ）。kind: 'race' で みわける
//  ・へやを つくった ひと（ホスト）だけが レースを けいさんして、
//    0.1びょうごとに いまの すがた（snap）を 書きこむ。ほかの ひとは
//    アクセルと わざの かいすう（input）を 書きこむだけ
//  ・しゃしんは スタートの ときに 1かいだけ（race.racers）。snap には いれない
// =============================================================
import { child, get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db, ensureSignedIn } from './firebase'
import type { RacerInit, RaceSnap } from './raceEngine'
import type { CpuSlot } from './raceSetup'

export const BUILD_ID: string = __BUILD_ID__

// へやに もっていく じぶんの むし（id・いろ などは スタートの ときに ホストが きめる）
export type NetRacer = Omit<RacerInit, 'id' | 'color' | 'human' | 'skill' | 'tag'>

export interface RacePlayer {
  name: string
  joinedAt: number
  racer: NetRacer
  build?: string
}

export interface RaceRoomSetup {
  count: number
  laps: number
  stage: string
  slots: CpuSlot[]
}

export interface RaceRoomRace {
  no: number // なんかいめの レースか（もういちど の たびに ふえる）
  laps: number
  stage: string
  racers: RacerInit[]
  uids: Record<string, string> // むしの id → ひとの uid
}

export interface RaceInputDoc {
  a: number // アクセル 1/0
  u: number // わざボタンを おした かいすう
  m: number // さいごに おした わざの ばんごう
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomRoomCode(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const roomRef = (code: string) => ref(db, `rooms/${code.toUpperCase()}`)

// Firebase は undefined を きらうので、JSON往復で きれいに する
function sanitize<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export async function createRaceRoom(name: string, racer: NetRacer, setup: RaceRoomSetup): Promise<{ code: string; uid: string }> {
  const user = await ensureSignedIn()
  let code = randomRoomCode()
  for (let i = 0; i < 5; i++) {
    const existing = await get(child(roomRef(code), 'status'))
    if (!existing.exists()) break
    code = randomRoomCode()
  }
  const player: RacePlayer = { name, joinedAt: Date.now(), racer, build: BUILD_ID }
  await set(
    roomRef(code),
    sanitize({
      kind: 'race',
      createdAt: Date.now(),
      status: 'waiting',
      host: { uid: user.uid, name },
      setup,
      players: { [user.uid]: player },
    }),
  )
  onDisconnect(roomRef(code)).remove()
  return { code, uid: user.uid }
}

export async function joinRaceRoom(code: string, name: string, racer: NetRacer): Promise<string> {
  const user = await ensureSignedIn()
  const snap = await get(roomRef(code))
  if (!snap.exists()) throw new Error('その コードの へやが 見つかりません。')
  const room = snap.val() as { kind?: string; status?: string; players?: Record<string, RacePlayer> }
  if (room.kind !== 'race') throw new Error('それは つうしんバトルの へやです。「つうしんバトル」から はいってね。')
  if (room.status !== 'waiting') throw new Error('その へやは もう レース ちゅうです。おわるまで まってね。')
  const players = room.players ?? {}
  if (!players[user.uid] && Object.keys(players).length >= 6) throw new Error('その へやは もう 6にん そろっています。')
  const player: RacePlayer = { name, joinedAt: Date.now(), racer, build: BUILD_ID }
  await set(child(roomRef(code), `players/${user.uid}`), sanitize(player))
  onDisconnect(child(roomRef(code), `players/${user.uid}`)).remove()
  onDisconnect(child(roomRef(code), `input/${user.uid}`)).remove()
  return user.uid
}

// へやの 一部を かんしする（へや ぜんぶを みると しゃしんまで まいかい よみなおすので わける）
export function watchRacePart<T>(code: string, part: string, cb: (v: T | null) => void): () => void {
  return onValue(child(roomRef(code), part), (s) => cb(s.exists() ? (s.val() as T) : null))
}

export function setRaceSetup(code: string, setup: RaceRoomSetup): void {
  set(child(roomRef(code), 'setup'), sanitize(setup)).catch((e) => console.warn('つうしんレース：せっていを 送れませんでした', e))
}

export async function startNetRace(code: string, race: RaceRoomRace): Promise<void> {
  await update(roomRef(code), sanitize({ race, status: 'racing', snap: null, input: null }))
}

export function backToLobby(code: string): void {
  update(roomRef(code), { status: 'waiting', race: null, snap: null, input: null }).catch(() => {})
}

export function publishSnap(code: string, snap: RaceSnap): void {
  set(child(roomRef(code), 'snap'), sanitize(snap)).catch((e) => console.warn('つうしんレース：snap', e))
}

export function sendRaceInput(code: string, uid: string, accel: boolean, useCount: number, move: number): void {
  const doc: RaceInputDoc = { a: accel ? 1 : 0, u: useCount, m: move }
  set(child(roomRef(code), `input/${uid}`), doc).catch(() => {})
}

export async function leaveRaceRoom(code: string, uid: string, isHost: boolean): Promise<void> {
  try {
    if (isHost) await remove(roomRef(code))
    else {
      await remove(child(roomRef(code), `players/${uid}`))
      await remove(child(roomRef(code), `input/${uid}`))
    }
  } catch {
    // すでに 消えていても きにしない
  }
}
