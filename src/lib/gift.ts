// =============================================================
//  ともだちに おくる（虫の おくる／もらう／こうかん）
// -------------------------------------------------------------
//  ・つうしんバトル・レースと おなじ rooms/{あいことば} を つかう
//    （データベースの ルールで 書きこめるのが ここだけ）。kind で みわける
//      kind: 'gift'  … おくる ひと（ホスト）が へやを つくり、もらう ひと（ゲスト）が うけとる
//      kind: 'trade' … ホストが へやを つくり、ゲストが じぶんの 虫を いれる。おたがいに うけとる
//  ・おくるのは メインの しゃしん 1まい と 図鑑の じょうほう だけ。
//    レベル・おぼえた わざ・きたえた ぶんは おくらない（もらった がわでは さいしょから）
//  ・おくった 虫は じぶんの 図鑑にも のこる（コピーを おくる）
// =============================================================
import { child, get, onDisconnect, onValue, ref, remove, set, update } from 'firebase/database'
import { db, ensureSignedIn } from './firebase'
import { mainPhoto } from './storage'
import { pickFreeRoomCode, ROOM_STALE_MS } from './roomWords'
import type { BattleStats, CaughtBug } from '../types'

export type GiftKind = 'gift' | 'trade'

// おくる 虫の なかみ（図鑑の じょうほう ＋ メインの しゃしん）
export interface GiftBug {
  speciesId?: string
  name: string
  order: string
  rarity: number
  habitat: string
  fact?: string
  battle?: BattleStats
  photo: string
}

export interface GiftSide {
  uid: string
  name: string
  bug?: GiftBug
}

export interface GiftRoom {
  kind: GiftKind
  createdAt: number
  status: 'waiting' | 'done'
  host: GiftSide
  guest?: GiftSide
}

function roomRef(code: string) {
  return ref(db, `rooms/${code.toUpperCase()}`)
}

// Firebase は undefined を もつ値を おくれないので、JSON往復で きれいに する
function sanitize<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

async function roomTaken(code: string): Promise<boolean> {
  const snap = await get(child(roomRef(code), 'createdAt'))
  return snap.exists() && Date.now() - Number(snap.val()) < ROOM_STALE_MS
}

export function toGiftBug(bug: CaughtBug): GiftBug {
  return sanitize({
    speciesId: bug.speciesId,
    name: bug.name,
    order: bug.order,
    rarity: bug.rarity,
    habitat: bug.habitat,
    fact: bug.fact,
    battle: bug.battle,
    photo: mainPhoto(bug),
  })
}

// へやを つくる（おくる ひと／こうかんを よびかける ひと）。あいことばを かえす
export async function createGiftRoom(kind: GiftKind, name: string, bug: CaughtBug): Promise<string> {
  const user = await ensureSignedIn()
  const code = await pickFreeRoomCode(roomTaken)
  const room: GiftRoom = {
    kind,
    createdAt: Date.now(),
    status: 'waiting',
    host: { uid: user.uid, name, bug: toGiftBug(bug) },
  }
  await set(roomRef(code), sanitize(room))
  onDisconnect(roomRef(code)).remove()
  return code
}

// あいことばの へやを しらべる（ゲスト）。おかしければ こどもに わかる ことばで エラーに する
async function openRoom(code: string, want: GiftKind): Promise<GiftRoom> {
  const user = await ensureSignedIn()
  const snap = await get(roomRef(code))
  if (!snap.exists()) throw new Error('その あいことばの へやが 見つからないよ。つづりを たしかめてね。')
  const room = snap.val() as GiftRoom & { kind?: string }
  if (room.kind !== 'gift' && room.kind !== 'trade') {
    throw new Error(
      room.kind === 'race'
        ? 'それは レースの へやだよ。'
        : room.kind === 'card' || room.kind === 'pageone'
        ? 'それは カードゲームの へやだよ。'
        : 'それは つうしんバトルの へやだよ。',
    )
  }
  if (room.kind !== want) {
    throw new Error(
      room.kind === 'gift'
        ? 'それは「おくる」へやだよ。「もらう」から はいってね。'
        : 'それは「こうかん」の へやだよ。「こうかん」から はいってね。',
    )
  }
  if (room.host.uid === user.uid) throw new Error('それは じぶんが つくった へやだよ。ともだちの あいことばを いれてね。')
  if (room.status !== 'waiting' || room.guest) throw new Error('その へやは もう おわっているよ。')
  return room
}

// もらう：おくられた 虫を うけとって、おくった ひとに「とどいた」と しらせる
export async function receiveGift(code: string, myName: string): Promise<{ bug: GiftBug; from: string }> {
  const user = await ensureSignedIn()
  const room = await openRoom(code, 'gift')
  if (!room.host.bug) throw new Error('へやに 虫が いなかったよ。')
  await update(roomRef(code), sanitize({ guest: { uid: user.uid, name: myName }, status: 'done' }))
  return { bug: room.host.bug, from: room.host.name }
}

// こうかん（ゲスト）：じぶんの 虫を いれて、あいての 虫を うけとる
export async function joinTrade(
  code: string,
  myName: string,
  myBug: CaughtBug,
): Promise<{ bug: GiftBug; from: string }> {
  const user = await ensureSignedIn()
  const room = await openRoom(code, 'trade')
  if (!room.host.bug) throw new Error('へやに 虫が いなかったよ。')
  await update(
    roomRef(code),
    sanitize({ guest: { uid: user.uid, name: myName, bug: toGiftBug(myBug) }, status: 'done' }),
  )
  return { bug: room.host.bug, from: room.host.name }
}

// へやを みはる（ホスト）
export function watchGiftRoom(code: string, cb: (room: GiftRoom | null) => void): () => void {
  return onValue(roomRef(code), (snap) => cb(snap.exists() ? (snap.val() as GiftRoom) : null))
}

// へやを かたづける
export async function closeGiftRoom(code: string): Promise<void> {
  try {
    await remove(roomRef(code))
  } catch {
    // すでに 消えていても きにしない
  }
}
