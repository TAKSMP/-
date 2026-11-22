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
import { orderEmoji } from '../data/orders'
import { availableCards, buildCard, TIERS } from '../lib/cardGame/cards'
import {
  applyAction,
    cpuAction,
  createPageOne,
  current,
  handSizeFor,
  MAX_PLAYERS,
  playableOf,
  topOf,
  type DrawMode,
  type PCard,
  type POEvent,
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
import './CardGamePage.css'
import './PageOnePage.css'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const NAME_KEY = 'chomushi.netbattle.name'
const MODE_KEY = 'chomushi.pageone.drawmode.v1'
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
  const toP = (c: { key: string; bugId: string; name: string; order: string; hp: number; tier: string }): PCard => ({
    key: c.key,
    bugId: c.bugId,
    name: c.name,
    order: c.order,
    hp: c.hp,
    tier: c.tier,
  })
  const out = availableCards(bugs, save).map(toP)
  if (out.length < need) {
    const have = new Set(out.map((c) => c.key))
    for (const b of bugs)
      for (const t of TIERS) {
        if (out.length >= need) break
        if (!have.has(`${b.id}:${t}`)) out.push(toP(buildCard(b, save, t)))
      }
  }
  return out
}
const deckNeed = (players: number) => players * handSizeFor(players) + 20

// -------------------------------------------------------------
//  カードの みため
// -------------------------------------------------------------
function POCard({
  c,
  photo,
  size = 'hand',
  ok,
  dim,
  onClick,
}: {
  c: PCard
  photo?: string
  size?: 'hand' | 'top'
  ok?: boolean
  dim?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`po-card ${size}${ok ? ' ok' : ''}${dim ? ' dim' : ''} t-${c.tier}`}
      style={{ ['--oc' as string]: orderColor(c.order) }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="po-card-order">
        {orderEmoji(c.order)}
        {c.order}
      </span>
      <span className="po-card-hp">
        <small>❤️</small>
        {c.hp}
      </span>
      <span className="po-card-photo">{photo ? <img src={photo} alt="" /> : orderEmoji(c.order)}</span>
      <span className="po-card-name">{c.name}</span>
      {c.tier !== 'N' && <span className={`po-card-tier t-${c.tier}`}>{c.tier}</span>}
    </button>
  )
}

function eventText(e: POEvent, name: (pid?: string) => string, cards: PCard[]): string {
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
      return `📣 ${name(e.pid)}「ページワン！」 のこり 1まい！`
    case 'win':
      return `🏆 ${name(e.pid)}の かち！`
    case 'reshuffle':
      return '山が なくなったので、ばの カードを まぜて 山に した'
    case 'leave':
      return `${name(e.pid)}が ぬけた`
  }
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
  onAct: (a: { type: 'play'; card: number } | { type: 'draw' }) => void
  onQuit: () => void
  onAgain?: () => void
}) {
  const [lines, setLines] = useState<string[]>([])
  const [shout, setShout] = useState<string | null>(null)
  const seqRef = useRef(0)
  const name = (pid?: string) => (pid === me ? 'あなた' : st.players.find((p) => p.id === pid)?.name ?? '？')

  useEffect(() => {
    if (seqRef.current === st.seq) return
    seqRef.current = st.seq
    const add = st.log.map((e) => eventText(e, name, cards))
    setLines((l) => [...l, ...add].slice(-30))
    const po = st.log.find((e) => e.t === 'pageone')
    if (st.log.some((e) => e.t === 'win')) {
      st.winner === me ? sfx.win() : sfx.lose()
    } else if (po) {
      setShout(`${name(po.pid)}\nページワン！`)
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
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines])

  const top = topOf(st)
  const topCard = top !== undefined ? cards[top] : undefined
  const myTurn = !st.winner && current(st)?.id === me
  const hand = [...(st.hands[me] ?? [])].sort((a, b) =>
    cards[a].order === cards[b].order ? cards[a].hp - cards[b].hp : cards[a].order.localeCompare(cards[b].order),
  )
  const ok = myTurn ? playableOf(st, cards, me) : []
  const ranking = st.winner
    ? [...st.players].sort((a, b) => (st.hands[a.id]?.length ?? 0) - (st.hands[b.id]?.length ?? 0))
    : []

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
            </div>
          ))}
      </div>

      <div className="po-center">
        <div className="po-pile">
          <button
            type="button"
            className={`po-back${myTurn && !ok.length ? ' can' : ''}`}
            disabled={!myTurn || ok.length > 0}
            onClick={() => onAct({ type: 'draw' })}
          >
            <CardBack width={92} />
            <b className="po-pile-count">{st.pile.length}まい</b>
          </button>
          <small>{st.drawMode === 'one' ? '1まい ひく' : 'だせるまで ひく'}</small>
        </div>
        <div className="po-top">{topCard && <POCard c={topCard} photo={photoOf(topCard)} size="top" />}</div>
      </div>
      {topCard && !st.winner && (
        <p className="po-hint">
          <b style={{ color: orderColor(topCard.order) }}>{topCard.order}</b> か <b>❤️{topCard.hp}</b> の カードが だせるよ
        </p>
      )}

      <div className="po-log" ref={logRef}>
        {lines.map((l, i) => (
          <p key={i} className={i === lines.length - 1 ? 'now' : ''}>
            {l}
          </p>
        ))}
      </div>

      {!st.winner && (
        <p className={`po-turn${myTurn ? ' mine' : ''}`}>
          {myTurn
            ? ok.length
              ? '✨ あなたの ばん！ ひかっている カードを タップ'
              : '🃏 だせる カードが ない… 山を タップして ひこう'
            : `⏳ ${name(current(st)?.id)}の ばん`}
        </p>
      )}

      <div className="po-hand" ref={handRef}>
        {hand.map((c) => (
          <POCard
            key={c}
            c={cards[c]}
            photo={photoOf(cards[c])}
            ok={ok.includes(c)}
            dim={myTurn && !ok.includes(c)}
            onClick={myTurn && ok.includes(c) ? () => onAct({ type: 'play', card: c }) : undefined}
          />
        ))}
      </div>
      <p className="po-count">てふだ {hand.length}まい</p>

      {st.winner && (
        <div className={`po-result ${st.winner === me ? 'win' : 'lose'}`}>
          <b>{st.winner === me ? '🏆 あなたの かち！' : `${name(st.winner)}の かち！`}</b>
          <ol>
            {ranking.map((p) => (
              <li key={p.id}>
                {p.id === me ? 'あなた' : p.name}：のこり {st.hands[p.id]?.length ?? 0}まい
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
    const deck = buildDeck(bugs, deckNeed(players.length))
    setCards(deck)
    setSt(createPageOne(deck.length, players, drawMode))
    setGameNo((n) => n + 1)
    sfx.battleStart()
    setPhase('cpu')
  }
  // コンピューターの ばんは すこし まって うごく
  useEffect(() => {
    if (phase !== 'cpu' || !st || st.winner) return
    const p = current(st)
    if (!p?.cpu) return
    const t = setTimeout(() => setSt((s) => (s ? applyAction(s, cards, p.id, cpuAction(s, cards, p.id, p.cpu)) : s)), 1100)
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
      if (rm.host === me) hostStep(c, rm, seen.current)
    })
  }
  async function doCreate() {
    setBusy(true)
    setNotice(null)
    try {
      const me = await myUid()
      const c = await createPORoom(name.trim(), drawMode)
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
      const deck = buildDeck(bugs, deckNeed(members.length))
      // しゃしんは 虫ごとに 1まい、ちいさく して いっしょに おくる
      const ids = [...new Set(deck.map((c) => c.bugId))]
      const photos = await Promise.all(ids.map((id) => compressImage(photoByBug.get(id) ?? '', 96, 5000).catch(() => '')))
      const withP = deck.map((c) => ({ ...c, p: ids.indexOf(c.bugId) }))
      const state = createPageOne(withP.length, members, room.drawMode)
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
  )

  if (phase === 'rules') {
    return (
      <div className="po-page po-rules">
        <h2 className="po-h2">📖 ページワンの あそびかた</h2>
        <ol>
          <li>みんなに カードを 7まい（5人いじょうは 5まい）くばる。のこりは 山に する。</li>
          <li>
            ばの いちばん うえの カードと <b>おなじ 目（もく）</b>、または <b>おなじ たいりょく（❤️）</b>の カードを 1まい だせる。
          </li>
          <li>だせる カードが ない ときは 山から 1まい ひく。だせたら そのまま だす。だせなければ てふだに いれて つぎの ひとの ばん。</li>
          <li>ルールへんこうで「だせるまで ひく」にも できる。</li>
          <li>のこり 1まいに なったら「ページワン！」。</li>
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
        {room && <p className="po-small">ルール：{room.drawMode === 'one' ? '1まい ひく' : 'だせるまで ひく'}</p>}
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
          <span className="game-desc">おなじ 目 か おなじ たいりょく なら だせる！</span>
        </button>
      </div>
    </div>
  )
}
