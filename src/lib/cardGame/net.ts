// =============================================================
//  ちょうむしカードゲーム：つうしんバトル
// -------------------------------------------------------------
//  ・へやは ほかの つうしんと おなじ rooms/{あいことば}。kind: 'card' で みわける
//  ・へやを つくった ひと（ホスト）が がわ 'a'、はいった ひと（ゲスト）が がわ 'b'
//  ・おたがいに その ラウンドの わざを 書きこむ → ホストだけが けいさんして
//    あたらしい じょうたい（state）を 書きこむ
//  ・しゃしんは はじめに 1かいだけ（ちいさく して）おくる
// =============================================================
import { child, get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db, ensureSignedIn } from '../firebase'
import { pickFreeRoomCode, ROOM_STALE_MS } from '../roomWords'
import { BUILD_ID } from '../netBattle'
import type { Card } from './cards'
import { actorNeedsChoice, createGame, currentActor, hydrate, stepTurn, type CCommand, type CState } from './engine'

export type CardRole = 'host' | 'guest'

export interface CardSide {
  uid: string
  name: string
  deck: Card[]
  photos: string[]
  build?: string
}

export interface CardCmds {
  r: number // どの 1て（state.seq）の めいれいか
  cmd?: CCommand
}

export interface CardRoom {
  kind: 'card'
  createdAt: number
  status: 'waiting' | 'battling'
  host: CardSide
  guest?: CardSide
  state?: CState
  cmds?: { host?: CardCmds; guest?: CardCmds }
}

const roomRef = (code: string) => ref(db, `rooms/${code.toUpperCase()}`)
const sanitize = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

async function roomTaken(code: string): Promise<boolean> {
  const snap = await get(child(roomRef(code), 'createdAt'))
  return snap.exists() && Date.now() - Number(snap.val()) < ROOM_STALE_MS
}

export function normalizeRoom(raw: CardRoom): CardRoom {
  const side = (s?: CardSide) =>
    s && { ...s, deck: (s.deck ?? []).map((c) => ({ ...c, moves: c.moves ?? [] })), photos: s.photos ?? [] }
  return {
    ...raw,
    host: side(raw.host)!,
    guest: side(raw.guest),
    state: raw.state ? hydrate(raw.state) : undefined,
  }
}

export async function createCardRoom(name: string, deck: Card[], photos: string[]): Promise<string> {
  const user = await ensureSignedIn()
  const code = await pickFreeRoomCode(roomTaken)
  const room: CardRoom = {
    kind: 'card',
    createdAt: Date.now(),
    status: 'waiting',
    host: { uid: user.uid, name, deck, photos, build: BUILD_ID },
  }
  await set(roomRef(code), sanitize(room))
  onDisconnect(roomRef(code)).remove()
  return code
}

export async function joinCardRoom(code: string, name: string, deck: Card[], photos: string[]): Promise<void> {
  const user = await ensureSignedIn()
  const snap = await get(roomRef(code))
  if (!snap.exists()) throw new Error('その あいことばの へやが 見つかりません。つづりを たしかめてね。')
  const room = snap.val() as { kind?: string } & Omit<Partial<CardRoom>, 'kind'>
  if (room.kind === 'gift' || room.kind === 'trade') throw new Error('それは 虫を おくる へやです。「ともだちに おくる」から はいってね。')
  if (room.kind === 'pageone') throw new Error('それは ページワンの へやです。「ページワン」から はいってね。')
  if (room.kind === 'race') throw new Error('それは レースの へやです。「レース」から はいってね。')
  if (room.kind !== 'card') throw new Error('それは つうしんバトルの へやです。「バトル」の「つうしんバトル」から はいってね。')
  if (room.host?.uid === user.uid) throw new Error('それは じぶんが つくった へやだよ。ともだちの あいことばを いれてね。')
  if (room.guest || room.status !== 'waiting') throw new Error('その へやには もう 2人 そろっています。')
  const host = normalizeRoom(room as CardRoom).host
  const guest: CardSide = { uid: user.uid, name, deck, photos, build: BUILD_ID }
  // さいしょの じょうたいは ゲストが つくって いっしょに 書きこむ
  const state = createGame(host.deck, deck)
  await update(roomRef(code), sanitize({ guest, status: 'battling', state, cmds: null }))
  onDisconnect(child(roomRef(code), 'guest')).remove()
}

export function watchCardRoom(code: string, cb: (room: CardRoom | null) => void): () => void {
  return onValue(roomRef(code), (snap) => cb(snap.exists() ? normalizeRoom(snap.val() as CardRoom) : null))
}

export async function sendCommand(code: string, role: CardRole, seq: number, cmd: CCommand): Promise<void> {
  await update(child(roomRef(code), 'cmds'), sanitize({ [role]: { r: seq, cmd } })).catch((e) =>
    console.warn('カードゲーム：わざを おくれませんでした', e),
  )
}

// ホストだけ：いまの 虫の わざが とどいたら（えらばない 虫は すぐ）1て すすめて 書きこむ
export function hostAdvance(code: string, room: CardRoom): boolean {
  const st = room.state
  if (!st || st.over) return false
  const f = currentActor(st)
  if (!f) return false
  let next: CState
  if (!actorNeedsChoice(st)) next = stepTurn(st)
  else {
    const c = room.cmds?.[f.side === 'a' ? 'host' : 'guest']
    if (!c || c.r !== st.seq || !c.cmd || c.cmd.uid !== f.uid) return false
    next = stepTurn(st, c.cmd)
  }
  update(roomRef(code), sanitize({ state: next })).catch((e) => console.warn('カードゲーム：書きこみに しっぱい', e))
  return true
}

export async function leaveCardRoom(code: string): Promise<void> {
  try {
    await remove(roomRef(code))
  } catch {
    // すでに ない
  }
}
