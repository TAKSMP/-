// =============================================================
//  ちょうむしページワン（カードバトルの カードで あそぶ ページワン）
// -------------------------------------------------------------
//  ・コンピューター（1〜3人）と／つうしんで 2〜6人
//  ・ルールへんこう：だせない ときに「1まい ひく」か「だせるまで ひく」
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { loadStory } from '../lib/story'
import { mainPhoto } from '../lib/storage'
import { compressImage } from '../lib/image'
import { sfx } from '../lib/sound'
import { availableCards, buildCard, TIERS } from '../lib/cardGame/cards'
import {
  applyAction,
    cpuAction,
  createPageOne,
  current,
  HAND_DEFAULT,
  HAND_MAX,
  HAND_MIN,
  MAX_PLAYERS,
  topOf,
  type DrawMode,
  type PCard,
  type POAction,
  type POEvent,
  CALL_WORD,
  MISS_MAX,
  type POPlayer,
  type POState,
} from '../lib/pageOne/engine'
import {
  createPORoom,
  hostStep,
  joinPORoom,
  leavePORoom,
  memberList,
  myUid,
  sendPOAct,
  startPORoom,
  watchPORoom,
  type PORoom,
} from '../lib/pageOne/net'
import { normalizeRoomCode, ROOM_CODE_MIN } from '../lib/roomWords'
import { RoomWordCard, RoomWordInput } from '../components/RoomWord'
import { CardBack } from '../components/CardView'
import { PaperCard, PressCard, usePress, CardZoom } from '../components/PaperCard'
import './CardGamePage.css'
import './PageOnePage.css'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const NAME_KEY = 'chomushi.netbattle.name'
const MODE_KEY = 'chomushi.pageone.drawmode.v1'
const HAND_KEY = 'chomushi.pageone.hand.v1'
const ME = 'me'

function loadStr(key: string, fb: string): string {
  try {
    return localStorage.getItem(key) ?? fb
  } catch {
    return fb
  }
}
function saveStr(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // ほぞん できなくても あそべる
  }
}

// 目（もく）ごとの いろ（おなじ 目が ひと目で わかる ように）
const ORDER_COLOR: Record<string, string> = {
  チョウ目: '#ef9a2d',
  コウチュウ目: '#8a5a32',
  トンボ目: '#3a8ed6',
  バッタ目: '#55a84a',
  カメムシ目: '#cf4b3c',
  ハエ目: '#7d8790',
  ハチ目: '#d9b000',
  アミメカゲロウ目: '#2fa59a',
  カマキリ目: '#8bb83a',
  ナナフシ目: '#9a7b62',
  カゲロウ目: '#8c8fd8',
  ゴキブリ目: '#6b4a3a',
  ハサミムシ目: '#a0522d',
}
export function orderColor(order: string): string {
  if (ORDER_COLOR[order]) return ORDER_COLOR[order]
  let h = 0
  for (const ch of order) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 55% 45%)`
}

// てもちの カードから ページワンの 山を つくる（たりなければ まだ もっていない レア度も つかう）
function buildDeck(bugs: CaughtBug[], need: number): PCard[] {
  const save = loadStory()
  const out: PCard[] = availableCards(bugs, save)
  if (out.length < need) {
    const have = new Set(out.map((c) => c.key))
    for (const b of bugs)
      for (const t of TIERS) {
        if (out.length >= need) break
        if (!have.has(`${b.id}:${t}`)) out.push(buildCard(b, save, t))
      }
  }
  return out
}
const deckNeed = (players: number, hand: number) => players * hand + 20

// -------------------------------------------------------------
//  カードの みため
// -------------------------------------------------------------
// 場の いちばん うえの カード（タップ／ながおしで 大きく）
function TopCard({ c, photo }: { c: PCard; photo?: string }) {
  const [open, setOpen] = useState(false)
  const press = usePress(() => setOpen(true), () => setOpen(true))
  return (
    <>
      <div className="pc-press po-topcard" {...press}>
        <PaperCard card={c} photo={photo} width={150} />
      </div>
      {open && <CardZoom card={c} photo={photo} onClose={() => setOpen(false)} />}
    </>
  )
}

// おてつきの わけ
export function missReason(e: POEvent, cards: PCard[]): string {
  const top = e.top !== undefined ? cards[e.top] : undefined
  const tops = top ? `ばの カードは ${top.order}・❤️${top.hp}` : ''
  if (e.t === 'forgotOne') {
    return `「${CALL_WORD}」を いわずに さいごの 1まいを だしたよ。山から 1まい ひく`
  }
  if (e.t === 'miss') {
    const c = e.card !== undefined ? cards[e.card] : undefined
    if (!c) return 'その カードは だせないよ'
    return `${c.name}は ${c.order}・❤️${c.hp}。${tops}。目も たいりょくも ちがうから だせないよ`
  }
  const ok = e.ok !== undefined ? cards[e.ok] : undefined
  const why = ok && top ? (ok.order === top.order ? `おなじ ${ok.order}` : `おなじ ❤️${ok.hp}`) : ''
  return `だせる カード（${ok?.name ?? ''}${why ? '：' + why : ''}）が あるのに 山から ひいたよ`
}

export function eventText(e: POEvent, name: (pid?: string) => string, cards: PCard[]): string {
  const c = e.card !== undefined ? cards[e.card] : undefined
  switch (e.t) {
    case 'start':
      return `はじまり！ さいしょは ${name(e.pid)} の ばん`
    case 'play':
      return `${name(e.pid)}が ${c?.name ?? ''}（${c?.order} ❤️${c?.hp}）を だした${e.n ? '（ひいた カード）' : ''}`
    case 'draw':
      return `${name(e.pid)}が 山から ${e.n}まい ひいた`
    case 'keep':
      return `だせなかったので てふだに いれた`
    case 'pass':
      return `${name(e.pid)}は だせなかった…`
    case 'pageone':
      return `${name(e.pid)}は のこり 1まい！ なんて いうんだっけ…？`
    case 'win':
      return `🏆 ${name(e.pid)}の かち！`
    case 'reshuffle':
      return '山が なくなったので、ばの カードを まぜて 山に した'
    case 'leave':
      return `${name(e.pid)}が ぬけた`
    case 'call':
      return `📣 ${name(e.pid)}「${CALL_WORD}」`
    case 'forgot':
      return `😱 ${name(e.pid)}は「${CALL_WORD}」を いいわすれた… まけ！`
    case 'miss':
    case 'forgotOne':
    case 'missDraw':
      return `😵 ${name(e.pid)}は おてつき（${e.n}/${MISS_MAX}）：${missReason(e, cards)}`
    case 'out3':
      return `😢 ${name(e.pid)}は おてつき ${MISS_MAX}かいで まけ…`
  }
  return ''
}

// -------------------------------------------------------------
//  ゲームの がめん（CPU・つうしん きょうつう）
// -------------------------------------------------------------
function Table({
  st,
  cards,
  photoOf,
  me,
  onAct,
  onQuit,
  onAgain,
}: {
  st: POState
  cards: PCard[]
  photoOf: (c: PCard) => string | undefined
  me: string
  onAct: (a: POAction) => void
  onQuit: () => void
  onAgain?: () => void
}) {
  const [shout, setShout] = useState<string | null>(null)
  const [missMsg, setMissMsg] = useState<string | null>(null)
  const seqRef = useRef(0)
  const name = (pid?: string) =>
    pid === me ? 'あなた' : ([...st.players, ...(st.out ?? [])].find((p) => p.id === pid)?.name ?? '？')

  useEffect(() => {
    if (seqRef.current === st.seq) return
    seqRef.current = st.seq
    // じぶんが つぎに うごいたら おてつきの せつめいを けす
    if (st.log.some((e) => e.pid === me && e.t !== 'miss' && e.t !== 'missDraw')) setMissMsg(null)
    const call = st.log.find((e) => e.t === 'call')
    const forgot = st.log.find((e) => e.t === 'forgot')
    const miss = st.log.find((e) => e.t === 'miss' || e.t === 'missDraw' || e.t === 'forgotOne')
    const out3 = st.log.find((e) => e.t === 'out3')
    if (st.log.some((e) => e.t === 'win') && !forgot && !out3) {
      st.winner === me ? sfx.win() : sfx.lose()
    } else if (out3) {
      setShout(`${name(out3.pid)}\nおてつき ${MISS_MAX}かい… まけ！`)
      out3.pid === me ? sfx.lose() : sfx.dodge()
      setTimeout(() => setShout(null), 1800)
    } else if (miss) {
      if (miss.pid === me) setMissMsg(missReason(miss, cards))
      setShout(`おてつき😵\n${miss.n}/${MISS_MAX}`)
      sfx.dodge()
      setTimeout(() => setShout(null), 1200)
    } else if (forgot) {
      setShout(`${name(forgot.pid)}\nいいわすれ… まけ！`)
      forgot.pid === me ? sfx.lose() : sfx.special('powerStrike')
      setTimeout(() => setShout(null), 1800)
    } else if (call) {
      setShout(`${name(call.pid)}\n${CALL_WORD}`)
      sfx.special('powerStrike')
      setTimeout(() => setShout(null), 1300)
    } else if (st.log.some((e) => e.t === 'play')) sfx.hit()
    else if (st.log.some((e) => e.t === 'draw')) sfx.tap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.seq])

  const handRef = useRef<HTMLDivElement>(null)
  const myTurnNow = !st.winner && current(st)?.id === me
  useEffect(() => {
    if (myTurnNow) handRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [myTurnNow, st.seq])

  const top = topOf(st)
  const topCard = top !== undefined ? cards[top] : undefined
  const myTurn = !st.winner && current(st)?.id === me
  // あたらしい カードが いちばん ひだりうえ
  const hand = [...(st.hands[me] ?? [])].reverse()
  const drawnMine = st.drawn?.pid === me ? st.drawn.card : undefined
  const newCard = st.log.some((e) => e.t === 'draw' && e.pid === me) ? (st.hands[me] ?? [])[(st.hands[me] ?? []).length - 1] : undefined
  const handW = Math.floor(Math.min(420, window.innerWidth - 24) / 3) - 8
  const ranking = st.winner
    ? [...st.players].sort((a, b) => (st.hands[a.id]?.length ?? 0) - (st.hands[b.id]?.length ?? 0))
    : []
  const iAmOut = (st.out ?? []).some((p) => p.id === me)
  // のこり 1まいで まだ いっていない ときだけ ボタンを だす（ばんに かんけいなく）
  const canCall = !st.winner && (st.hands[me]?.length ?? 0) === 1 && !(st.called ?? []).includes(me)
  const saidCall = (st.hands[me]?.length ?? 0) === 1 && (st.called ?? []).includes(me)
  const waitCall = false
  const myMiss = st.miss?.[me] ?? 0

  return (
    <div className="po-table">
      <div className="po-others">
        {st.players
          .filter((p) => p.id !== me)
          .map((p) => (
            <div key={p.id} className={`po-other${current(st)?.id === p.id && !st.winner ? ' turn' : ''}`}>
              <span className="po-other-name">
                {p.cpu ? '🤖' : '👤'} {p.name}
              </span>
              <span className="po-other-cards">
                <CardBack width={18} />×{st.hands[p.id]?.length ?? 0}
              </span>
              {(st.called ?? []).includes(p.id) && <span className="po-other-miss">📣 いった！</span>}
              {(st.miss?.[p.id] ?? 0) > 0 && <span className="po-other-miss">{'😵'.repeat(st.miss?.[p.id] ?? 0)}</span>}
            </div>
          ))}
      </div>

      <div className="po-center">
        <div className="po-pile">
          <button
            type="button"
            className="po-back"
            disabled={!myTurn || waitCall || drawnMine !== undefined}
            onClick={() => onAct({ type: 'draw' })}
          >
            <CardBack width={92} />
            <b className="po-pile-count">{st.pile.length}まい</b>
          </button>
          <small>{st.drawMode === 'one' ? '1まい ひく' : 'だせるまで ひく'}</small>
        </div>
        <div className="po-top">{topCard && <TopCard key={top} c={topCard} photo={photoOf(topCard)} />}</div>
      </div>
      {topCard && !st.winner && (
        <p className="po-hint">
          <b style={{ color: orderColor(topCard.order) }}>{topCard.order}</b> か <b>❤️{topCard.hp}</b> の カードが だせるよ
        </p>
      )}


      {!st.winner && (
        <p className={`po-turn${myTurn ? ' mine' : ''}`}>
          {drawnMine !== undefined
              ? '✨ ひいた カードが そのまま だせるよ！'
            : myTurn
              ? '✨ あなたの ばん！ だせる カードを タップ。なければ 山から ひこう'
              : `⏳ ${name(current(st)?.id)}の ばん`}
        </p>
      )}

      {drawnMine !== undefined && (
        <button type="button" className="po-call po-playnow" onClick={() => onAct({ type: 'play', card: drawnMine })}>
          ▶ このまま だせる！
        </button>
      )}
      {canCall && (
        <button type="button" className="po-call" onClick={() => onAct({ type: 'call' })}>
          📣 {CALL_WORD}
        </button>
      )}
      {saidCall && <p className="po-said">📣 {CALL_WORD} いった！</p>}
      {missMsg && (
        <div className="po-missmsg" onClick={() => setMissMsg(null)}>
          <b>😵 おてつき！</b>
          <span>{missMsg}</span>
        </div>
      )}
      {myMiss > 0 && !st.winner && (
        <p className="po-miss">
          おてつき {'😵'.repeat(myMiss)}
          {'⚪'.repeat(Math.max(0, MISS_MAX - myMiss))}（{MISS_MAX}かいで まけ）
        </p>
      )}
      {iAmOut && !st.winner && <p className="po-turn">😢 まけ… みんなの ゲームを 見ていよう</p>}

      <div className="po-hand" ref={handRef}>
        {hand.map((c) => (
          <PressCard
            key={c}
            card={cards[c]}
            photo={photoOf(cards[c])}
            width={handW}
            className={`po-hcard${c === drawnMine ? ' glow' : ''}${c === newCard ? ' new' : ''}`}
            onTap={myTurn && !waitCall && (drawnMine === undefined || c === drawnMine) ? () => onAct({ type: 'play', card: c }) : undefined}
            zoomExtra={
              myTurn && !waitCall && (drawnMine === undefined || c === drawnMine)
                ? (close) => (
                    <button
                      className="btn btn-big btn-primary"
                      onClick={() => {
                        close()
                        onAct({ type: 'play', card: c })
                      }}
                    >
                      この カードを だす
                    </button>
                  )
                : undefined
            }
          />
        ))}
      </div>
      <p className="po-count">てふだ {hand.length}まい（カードを ながおし すると 大きく 見られるよ）</p>

      {st.winner && (
        <div className={`po-result ${st.winner === me ? 'win' : 'lose'}`}>
          <b>{st.winner === me ? '🏆 あなたの かち！' : `${name(st.winner)}の かち！`}</b>
          <ol>
            {ranking.map((p) => (
              <li key={p.id}>
                {p.id === me ? 'あなた' : p.name}：のこり {st.hands[p.id]?.length ?? 0}まい
              </li>
            ))}
            {[...(st.out ?? [])].reverse().map((p) => (
              <li key={p.id}>
                {p.id === me ? 'あなた' : p.name}：{p.why === 'miss' ? 'おてつき 3かい' : 'いいわすれ'}
              </li>
            ))}
          </ol>
          <div className="po-result-btns">
            {onAgain && (
              <button className="btn btn-big btn-primary" onClick={onAgain}>
                🔁 もういちど
              </button>
            )}
            <button className="btn btn-big" onClick={onQuit}>
              おわる
            </button>
          </div>
        </div>
      )}
      {!st.winner && (
        <button className="btn btn-ghost po-quit" onClick={onQuit}>
          🏳️ やめる
        </button>
      )}
      {shout && <div className="po-shout">{shout}</div>}
    </div>
  )
}

// -------------------------------------------------------------
type Phase = 'menu' | 'rules' | 'cpu' | 'netName' | 'netMenu' | 'netJoin' | 'netRoom' | 'net'

export function PageOnePage({ bugs, onGoCapture }: Props) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [drawMode, setDrawMode] = useState<DrawMode>(() => (loadStr(MODE_KEY, 'one') === 'until' ? 'until' : 'one'))
  const [cpuCount, setCpuCount] = useState(2)
  const [handSize, setHandSize] = useState(() => {
    const n = Number(loadStr(HAND_KEY, String(HAND_DEFAULT)))
    return n >= HAND_MIN && n <= HAND_MAX ? n : HAND_DEFAULT
  })
  const [notice, setNotice] = useState<string | null>(null)
  const photoByBug = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of bugs) m.set(b.id, mainPhoto(b))
    return m
  }, [bugs])

  function go(p: Phase) {
    sfx.tap()
    setNotice(null)
    setPhase(p)
  }
  function setMode(m: DrawMode) {
    setDrawMode(m)
    saveStr(MODE_KEY, m)
    sfx.tap()
  }

  // ---------- コンピューター ----------
  const [cards, setCards] = useState<PCard[]>([])
  const [st, setSt] = useState<POState | null>(null)
  const [gameNo, setGameNo] = useState(0)

  function startCpu() {
    const players: POPlayer[] = [
      { id: ME, name: 'あなた' },
      ...['てんとう', 'かぶと', 'とんぼ'].slice(0, cpuCount).map((n, i) => ({ id: `cpu${i}`, name: `CPU ${n}`, cpu: 'normal' as const })),
    ]
    const deck = buildDeck(bugs, deckNeed(players.length, handSize))
    setCards(deck)
    setSt(createPageOne(deck.length, players, drawMode, handSize))
    setGameNo((n) => n + 1)
    sfx.battleStart()
    setPhase('cpu')
  }
  // コンピューターの ばんは すこし まって うごく
  useEffect(() => {
    if (phase !== 'cpu' || !st || st.winner) return
    const p = current(st)
    if (!p?.cpu) return
    const act = cpuAction(st, cards, p.id, p.cpu)
    if (!act) return
    const t = setTimeout(() => setSt((s) => (s ? applyAction(s, cards, p.id, act) : s)), act.type === 'call' ? 1200 : 2400)
    return () => clearTimeout(t)
  }, [phase, st, cards])

  // ---------- つうしん ----------
  const [name, setName] = useState(() => loadStr(NAME_KEY, ''))
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [uid, setUid] = useState<string>('')
  const [room, setRoom] = useState<PORoom | null>(null)
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  const unsub = useRef<(() => void) | null>(null)
  const seen = useRef(new Map<string, number>())
  useEffect(() => () => unsub.current?.(), [])

  function watch(c: string, me: string) {
    unsub.current?.()
    seen.current = new Map()
    setGone(false)
    unsub.current = watchPORoom(c, (rm) => {
      if (!rm || (rm.status === 'playing' && !rm.members[rm.host])) {
        setGone(true)
        return
      }
      setRoom(rm)
      if (rm.status === 'playing') setPhase('net')
      if (rm.host === me) {
        hostStep(c, rm, seen.current)
      }
    })
  }
  async function doCreate() {
    setBusy(true)
    setNotice(null)
    try {
      const me = await myUid()
      const c = await createPORoom(name.trim(), drawMode, handSize)
      setUid(me)
      setCode(c)
      setPhase('netRoom')
      watch(c, me)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'へやを つくれませんでした。')
    } finally {
      setBusy(false)
    }
  }
  async function doJoin() {
    const c = normalizeRoomCode(codeInput)
    if (c.length < ROOM_CODE_MIN) return setNotice('あいことば（えいごの ことば）を 入れてね。')
    setBusy(true)
    setNotice(null)
    try {
      const me = await myUid()
      await joinPORoom(c, name.trim())
      setUid(me)
      setCode(c)
      setPhase('netRoom')
      watch(c, me)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'はいれませんでした。')
    } finally {
      setBusy(false)
    }
  }
  async function doStart() {
    if (!room || !code) return
    const members = memberList(room)
    if (members.length < 2) return setNotice('あと 1人 いじょう まってね。')
    setBusy(true)
    try {
      const hs = room.handSize ?? HAND_DEFAULT
      const deck = buildDeck(bugs, deckNeed(members.length, hs))
      // しゃしんは 虫ごとに 1まい、ちいさく して いっしょに おくる
      const ids = [...new Set(deck.map((c) => c.bugId))]
      const photos = await Promise.all(ids.map((id) => compressImage(photoByBug.get(id) ?? '', 96, 5000).catch(() => '')))
      const withP = deck.map((c) => ({ ...c, p: ids.indexOf(c.bugId) }))
      const state = createPageOne(withP.length, members, room.drawMode, hs)
      await startPORoom(code, withP, photos, state)
      sfx.battleStart()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'はじめられませんでした。')
    } finally {
      setBusy(false)
    }
  }
  function leaveNet() {
    if (code && uid) leavePORoom(code, uid, room?.host === uid)
    unsub.current?.()
    unsub.current = null
    setCode(null)
    setRoom(null)
    setPhase('menu')
  }

  // ===================== がめん =====================
  if (bugs.length < 4) {
    return (
      <div className="po-page">
        <p className="po-lead">ページワンは 虫が 4ひき いると あそべるよ。いまは {bugs.length}ひき。</p>
        <button className="btn btn-big btn-primary" onClick={onGoCapture}>
          📷 虫を しらべに いく
        </button>
      </div>
    )
  }

  if (phase === 'cpu' && st) {
    return (
      <Table
        key={gameNo}
        st={st}
        cards={cards}
        photoOf={(c) => photoByBug.get(c.bugId)}
        me={ME}
        onAct={(a) => setSt((s) => (s ? applyAction(s, cards, ME, a) : s))}
        onQuit={() => {
          setSt(null)
          setPhase('menu')
        }}
        onAgain={startCpu}
      />
    )
  }

  if (phase === 'net' && room?.state && uid) {
    const rc = room.cards ?? []
    return (
      <>
        {gone && !room.state.winner && <p className="po-notice">へやが なくなりました…</p>}
        <Table
          key={room.createdAt}
          st={room.state}
          cards={rc}
          photoOf={(c) => (c.p !== undefined ? room.photos?.[c.p] : undefined) || photoByBug.get(c.bugId)}
          me={uid}
          onAct={(a) => code && sendPOAct(code, uid, a)}
          onQuit={leaveNet}
        />
      </>
    )
  }

  const modePicker = (
    <>
    <div className="po-mode">
      <span className="po-mode-title">はじめの てふだ</span>
      <div className="po-mode-btns four">
        {Array.from({ length: HAND_MAX - HAND_MIN + 1 }, (_, i) => HAND_MIN + i).map((n) => (
          <button
            key={n}
            type="button"
            className={handSize === n ? 'on' : ''}
            onClick={() => {
              setHandSize(n)
              saveStr(HAND_KEY, String(n))
              sfx.tap()
            }}
          >
            {n}まい
          </button>
        ))}
      </div>
    </div>
    <div className="po-mode">
      <span className="po-mode-title">だせない ときの ルール</span>
      <div className="po-mode-btns">
        <button type="button" className={drawMode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>
          🃏 1まい ひく
          <small>だせなければ つぎの ひと</small>
        </button>
        <button type="button" className={drawMode === 'until' ? 'on' : ''} onClick={() => setMode('until')}>
          🃏🃏🃏 だせるまで ひく
          <small>だせる カードが でるまで</small>
        </button>
      </div>
    </div>
    </>
  )

  if (phase === 'rules') {
    return (
      <div className="po-page po-rules">
        <h2 className="po-h2">📖 ページワンの あそびかた</h2>
        <ol>
          <li>みんなに カードを 4まい くばる（さいしょの せっていで 7まいまで ふやせる）。のこりは 山に する。</li>
          <li>
            ばの いちばん うえの カードと <b>おなじ 目（もく）</b>、または <b>おなじ たいりょく（❤️）</b>の カードを 1まい だせる。
          </li>
          <li>だせる カードが ない ときは 山から 1まい ひく。だせたら そのまま だす。だせなければ てふだに いれて つぎの ひとの ばん。</li>
          <li>ルールへんこうで「だせるまで ひく」にも できる。</li>
          <li>
            のこり 1まいに なったら「📣 {CALL_WORD}」ボタンを おす。いわずに さいごの 1まいを だすと おてつきで、山から 1まい ひく（また いいわすれたら また おてつき）。
          </li>
          <li>だせない カードを だそうと したり、だせる カードが あるのに 山から ひいたら「おてつき😵」。{MISS_MAX}かい おてつき したら まけ。</li>
          <li>カードを ながおし すると 大きく 見られる。</li>
          <li>さいしょに カードが 0まいに なった ひとの かち！</li>
        </ol>
        <button className="btn btn-ghost po-back" onClick={() => go('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netName') {
    return (
      <div className="po-page net-battle-menu">
        <h2 className="po-h2">📡 あなたの なまえ</h2>
        <input
          className="net-battle-input"
          value={name}
          maxLength={10}
          placeholder="なまえ（10もじまで）"
          onChange={(e) => {
            setName(e.target.value)
            saveStr(NAME_KEY, e.target.value)
          }}
        />
        {notice && <p className="story-notice">{notice}</p>}
        <button className="btn btn-big btn-primary" onClick={() => (name.trim() ? go('netMenu') : setNotice('なまえを 入れてね。'))}>
          つぎへ 👉
        </button>
        <button className="btn btn-ghost po-back" onClick={() => go('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netMenu') {
    return (
      <div className="po-page net-battle-menu">
        <h2 className="po-h2">📡 へやを つくる？ はいる？</h2>
        {modePicker}
        <div className="net-battle-menu-actions">
          <button className="btn btn-big btn-primary" disabled={busy} onClick={doCreate}>
            🆕 じぶんで つくる
          </button>
          <button className="btn btn-big" disabled={busy} onClick={() => go('netJoin')}>
            🔑 つくってもらう
          </button>
        </div>
        <p className="po-small">ルールは へやを つくった ひとの ものに なるよ。</p>
        {notice && <p className="story-notice">{notice}</p>}
        <button className="btn btn-ghost po-back" onClick={() => go('netName')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netJoin') {
    return (
      <div className="po-page net-battle-menu">
        <h2 className="po-h2">あいことばを 入れてね</h2>
        <RoomWordInput value={codeInput} onChange={setCodeInput} />
        {notice && <p className="story-notice">{notice}</p>}
        <button className="btn btn-big btn-primary" disabled={busy} onClick={doJoin}>
          {busy ? 'じゅんびちゅう…' : 'はいる 🚪'}
        </button>
        <button className="btn btn-ghost po-back" onClick={() => go('netMenu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if ((phase === 'netRoom' || phase === 'net') && code) {
    const members = room ? memberList(room) : []
    const isHost = room?.host === uid
    return (
      <div className="po-page net-battle-menu">
        <h2 className="po-h2">あつまっています（{members.length}/{MAX_PLAYERS}人）</h2>
        <RoomWordCard code={code} note="この ことばを みんなに つたえてね。「カードゲーム」→「ページワン」→「つうしん」から はいるよ。" />
        <ul className="po-members">
          {members.map((m) => (
            <li key={m.id}>
              {m.id === room?.host ? '👑' : '👤'} {m.name}
              {m.id === uid ? '（あなた）' : ''}
            </li>
          ))}
        </ul>
        {room && (
          <p className="po-small">
            ルール：てふだ {room.handSize ?? HAND_DEFAULT}まい／{room.drawMode === 'one' ? '1まい ひく' : 'だせるまで ひく'}
          </p>
        )}
        {gone && <p className="story-notice">へやが なくなりました。</p>}
        {notice && <p className="story-notice">{notice}</p>}
        {isHost ? (
          <button className="btn btn-big btn-primary" disabled={busy || members.length < 2} onClick={doStart}>
            {busy ? 'じゅんびちゅう…' : members.length < 2 ? 'ともだちを まっています…' : `▶ ${members.length}人で はじめる`}
          </button>
        ) : (
          <p className="po-small">へやを つくった ひとが はじめるのを まってね</p>
        )}
        <button className="btn btn-ghost po-back" onClick={leaveNet}>
          ← やめる
        </button>
      </div>
    )
  }

  // ---------- メニュー ----------
  return (
    <div className="po-page">
      {modePicker}
      <div className="po-mode">
        <span className="po-mode-title">コンピューターの 人数</span>
        <div className="po-mode-btns three">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" className={cpuCount === n ? 'on' : ''} onClick={() => (setCpuCount(n), sfx.tap())}>
              {'🤖'.repeat(n)}
              <small>{n}人</small>
            </button>
          ))}
        </div>
      </div>
      <div className="game-menu">
        <button className="game-card battle" onClick={startCpu}>
          <span className="game-emoji">🤖</span>
          <span className="game-title">コンピューターと あそぶ</span>
          <span className="game-desc">あなた ＋ コンピューター {cpuCount}人</span>
        </button>
        <button className="game-card battle" onClick={() => go('netName')}>
          <span className="game-emoji">📡</span>
          <span className="game-title">つうしんで あそぶ</span>
          <span className="game-desc">2〜{MAX_PLAYERS}人。あいことばで みんなで</span>
        </button>
        <button className="game-card story" onClick={() => go('rules')}>
          <span className="game-emoji">📖</span>
          <span className="game-title">あそびかた</span>
          <span className="game-desc">おなじ 目 か おなじ たいりょく なら だせる！ のこり1まいで「{CALL_WORD}」</span>
        </button>
      </div>
    </div>
  )
}
