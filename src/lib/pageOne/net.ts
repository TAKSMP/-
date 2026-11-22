// =============================================================
//  ちょうむしページワン：つうしん（2〜6人）
// -------------------------------------------------------------
//  ・へやは rooms/{あいことば}。kind: 'pageone' で みわける
//  ・つくった ひと（ホスト）が カード・しゃしんを よういして「はじめる」
//  ・みんなは じぶんの て（だす／ひく）を acts/{uid} に 書きこむ
//    → ホストだけが じゅんばんを たしかめて state を すすめる
// =============================================================
import { child, get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db, ensureSignedIn } from '../firebase'
import { pickFreeRoomCode, ROOM_STALE_MS } from '../roomWords'
import { BUILD_ID } from '../netBattle'
import { applyAction, hydratePO, MAX_PLAYERS, removePlayer, type DrawMode, type PCard, type POAction, type POState } from './engine'

export interface POMember {
  name: string
  at: number
  build?: string
}
export interface POAct {
  n: number // おなじ てを 2かい つかわない ための ばんごう
  type: POAction['type']
  card?: number
}
export interface PORoom {
  kind: 'pageone'
  createdAt: number
  status: 'waiting' | 'playing'
  host: string
  drawMode: DrawMode
  handSize?: number
  members: Record<string, POMember>
  cards?: PCard[]
  photos?: string[]
  state?: POState
  acts?: Record<string, POAct>
}

const roomRef = (code: string) => ref(db, `rooms/${code.toUpperCase()}`)
const sanitize = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

async function roomTaken(code: string): Promise<boolean> {
  const snap = await get(child(roomRef(code), 'createdAt'))
  return snap.exists() && Date.now() - Number(snap.val()) < ROOM_STALE_MS
}

export function normalizePO(raw: PORoom): PORoom {
  return {
    ...raw,
    members: raw.members ?? {},
    cards: (raw.cards ?? []).map((c) => ({ ...c, moves: c.moves ?? [] })),
    photos: raw.photos ?? [],
    acts: raw.acts ?? {},
    state: raw.state ? hydratePO(raw.state) : undefined,
  }
}

export const memberList = (room: PORoom): { id: string; name: string }[] =>
  Object.entries(room.members)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id, m]) => ({ id, name: m.name }))

export async function myUid(): Promise<string> {
  return (await ensureSignedIn()).uid
}

export async function createPORoom(name: string, drawMode: DrawMode, handSize: number): Promise<string> {
  const user = await ensureSignedIn()
  const code = await pickFreeRoomCode(roomTaken)
  const room: PORoom = {
    kind: 'pageone',
    createdAt: Date.now(),
    status: 'waiting',
    host: user.uid,
    drawMode,
    handSize,
    members: { [user.uid]: { name, at: Date.now(), build: BUILD_ID } },
  }
  await set(roomRef(code), sanitize(room))
  onDisconnect(roomRef(code)).remove()
  return code
}

export async function joinPORoom(code: string, name: string): Promise<void> {
  const user = await ensureSignedIn()
  const snap = await get(roomRef(code))
  if (!snap.exists()) throw new Error('その あいことばの へやが 見つかりません。つづりを たしかめてね。')
  const room = snap.val() as { kind?: string; status?: string; members?: Record<string, POMember> }
  if (room.kind !== 'pageone') throw new Error('それは ページワンの へやでは ありません。')
  if (room.status !== 'waiting') throw new Error('その へやは もう はじまっています。')
  const n = Object.keys(room.members ?? {}).length
  if (n >= MAX_PLAYERS && !room.members?.[user.uid]) throw new Error(`その へやは もう ${MAX_PLAYERS}人 いっぱいです。`)
  await set(child(roomRef(code), `members/${user.uid}`), { name, at: Date.now(), build: BUILD_ID })
  onDisconnect(child(roomRef(code), `members/${user.uid}`)).remove()
}

export function watchPORoom(code: string, cb: (room: PORoom | null) => void): () => void {
  return onValue(roomRef(code), (snap) => cb(snap.exists() ? normalizePO(snap.val() as PORoom) : null))
}

export async function startPORoom(code: string, cards: PCard[], photos: string[], state: POState): Promise<void> {
  await update(roomRef(code), sanitize({ cards, photos, state, status: 'playing', acts: null }))
}

let lastN = 0
export async function sendPOAct(code: string, uid: string, act: POAction): Promise<void> {
  const a: POAct = { n: Date.now(), type: act.type, ...(act.type === 'play' ? { card: act.card } : {}) }
  // おなじ ミリびょうに 2かい おしても かさならない ように
  if (a.n <= lastN) a.n = lastN + 1
  lastN = a.n
  await set(child(roomRef(code), `acts/${uid}`), a).catch((e) => console.warn('ページワン：おくれませんでした', e))
}

// ホストだけ：とどいた てと、ぬけた ひとを state に はんえい する
export function hostStep(code: string, room: PORoom, seen: Map<string, number>): void {
  let st = room.state
  if (!st || room.status !== 'playing') return
  let changed = false
  for (const p of st.players) {
    if (!room.members[p.id]) {
      st = removePlayer(st, p.id)
      changed = true
    }
  }
  for (const [uid, a] of Object.entries(room.acts ?? {})) {
    if ((seen.get(uid) ?? 0) >= a.n) continue
    seen.set(uid, a.n)
    const act: POAction | null = a.type === 'play' ? { type: 'play', card: a.card ?? -1 } : a.type === 'call' ? { type: 'call' } : a.type === 'draw' ? { type: 'draw' } : null
    if (!act) continue
    const next = applyAction(st, room.cards ?? [], uid, act)
    if (next !== st) {
      st = next
      changed = true
    }
  }
  if (changed) update(roomRef(code), sanitize({ state: st })).catch((e) => console.warn('ページワン：書きこみに しっぱい', e))
}

export async function leavePORoom(code: string, uid: string, isHost: boolean): Promise<void> {
  try {
    if (isHost) await remove(roomRef(code))
    else await remove(child(roomRef(code), `members/${uid}`))
  } catch {
    // すでに ない
  }
}
