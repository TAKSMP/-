// =============================================================
//  ちょうむしカードゲーム（アプリばん）
// -------------------------------------------------------------
//  ・図鑑の 虫が カードに なる。ストーリーモードで レベル30／40／50 に
//    そだてると R／SR／UR カードが ふえる
//  ・デッキ 4まいを つくって、コンピューター か ともだち（つうしん）と たたかう
//  ・ルールは 紙の カードゲームと おなじ
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { loadStory } from '../lib/story'
import { mainPhoto } from '../lib/storage'
import { compressImage } from '../lib/image'
import { sfx } from '../lib/sound'
import {
  availableCards,
  buildCard,
  canAdd,
  DECK_SIZE,
  deckProblem,
  TIER_INFO,
  TIERS,
  type Card,
  type Tier,
} from '../lib/cardGame/cards'
import { actorNeedsChoice, createGame, currentActor, stepTurn, type CCommand, type CState } from '../lib/cardGame/engine'
import { cpuCommands, cpuDeck, CPU_LEVELS, type CpuLevel } from '../lib/cardGame/cpu'
import {
  createCardRoom,
  joinCardRoom,
  leaveCardRoom,
  hostAdvance,
  sendCommand,
  watchCardRoom,
  type CardRole,
  type CardRoom,
} from '../lib/cardGame/net'
import { normalizeRoomCode, ROOM_CODE_MIN } from '../lib/roomWords'
import { RoomWordCard, RoomWordInput } from '../components/RoomWord'
import { PaperCard, usePress } from '../components/PaperCard'
import { CardBattleStage } from '../components/CardBattleStage'
import './CardGamePage.css'

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

const DECK_KEY = 'chomushi.cardgame.deck.v1'
const NAME_KEY = 'chomushi.netbattle.name' // つうしんバトルと おなじ なまえを つかう

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v))
  } catch {
    // ほぞん できなくても あそべる
  }
}
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

type Phase = 'menu' | 'deck' | 'zukan' | 'rules' | 'cpuPick' | 'cpu' | 'netName' | 'netMenu' | 'netWait' | 'netJoin' | 'net'

// つよそうな じゅんに ならべる（おまかせ デッキ よう）
const power = (c: Card) => c.hp + c.basic * 1.5 + c.speed + c.moves.reduce((a, m) => a + (Number(m.big) || 15), 0) * 0.5

// ちいさい 紙の カード（タップ／ながおし）
function Mini({
  card,
  photo,
  width,
  onTap,
  onLong,
  sel,
  dim,
  lock,
}: {
  card: Card
  photo?: string
  width: number
  onTap?: () => void
  onLong: () => void
  sel?: boolean
  dim?: boolean
  lock?: string
}) {
  const press = usePress(onLong, onTap ?? onLong)
  return (
    <div className={`pc-press cg-pmini${sel ? ' sel' : ''}${dim ? ' dim' : ''}${lock ? ' lock' : ''}`} {...press}>
      <PaperCard card={card} photo={photo} width={width}>
        {sel && <span className="cg-pmini-check">✔</span>}
        {lock && (
          <span className="cg-pmini-lock">
            🔒<small>{lock}</small>
          </span>
        )}
      </PaperCard>
    </div>
  )
}

export function CardGamePage({ bugs, onGoCapture }: Props) {
  const [save] = useState(() => loadStory())
  const cards = useMemo(() => availableCards(bugs, save), [bugs, save])
  const photoOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of bugs) m.set(b.id, mainPhoto(b))
    return m
  }, [bugs])
  const [deckKeys, setDeckKeys] = useState<string[]>(() => loadJson<string[]>(DECK_KEY, []))
  const deck = useMemo(
    () => deckKeys.map((k) => cards.find((c) => c.key === k)).filter((c): c is Card => !!c).slice(0, DECK_SIZE),
    [deckKeys, cards],
  )
  const [phase, setPhase] = useState<Phase>('menu')
  const [view, setView] = useState<{ card: Card; locked?: boolean } | null>(null)
  const [filter, setFilter] = useState<Tier | 'all'>('all')
  const [notice, setNotice] = useState<string | null>(null)

  function setDeck(next: Card[]) {
    const keys = next.map((c) => c.key)
    setDeckKeys(keys)
    saveJson(DECK_KEY, keys)
  }
  function go(p: Phase) {
    sfx.tap()
    setNotice(null)
    setPhase(p)
  }

  function autoDeck() {
    const sorted = [...cards].sort((a, b) => power(b) - power(a))
    const out: Card[] = []
    for (const c of sorted) if (!canAdd(out, c)) out.push(c)
    setDeck(out.slice(0, DECK_SIZE))
    sfx.discover()
  }

  // ---------- CPU ----------
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>('easy')
  const [game, setGame] = useState<CState | null>(null)
  const [cpuPhotos, setCpuPhotos] = useState<Record<string, string>>({})
  const [gameNo, setGameNo] = useState(0)

  function startCpu(level: CpuLevel) {
    const foe = cpuDeck(bugs, save, level, deck.map((c) => c.bugId))
    const ph: Record<string, string> = {}
    deck.forEach((c, i) => (ph[`a${i}`] = photoOf.get(c.bugId) ?? ''))
    foe.forEach((c, i) => (ph[`b${i}`] = photoOf.get(c.bugId) ?? ''))
    setCpuLevel(level)
    setCpuPhotos(ph)
    setGame(createGame(deck, foe))
    setGameNo((n) => n + 1)
    sfx.battleStart()
    setPhase('cpu')
  }
  function cpuCommand(cmd: CCommand) {
    setGame((g) => (g ? stepTurn(g, cmd) : g))
  }
  // あいての 虫・じぶんで えらばない 虫を 1て すすめる
  function cpuAdvance() {
    setGame((g) => {
      if (!g) return g
      const f = currentActor(g)
      if (!f) return stepTurn(g)
      if (f.side === 'b' && actorNeedsChoice(g)) return stepTurn(g, cpuCommands(g, 'b', cpuLevel).find((c) => c.uid === f.uid))
      return actorNeedsChoice(g) ? g : stepTurn(g)
    })
  }

  // ---------- つうしん ----------
  const [name, setName] = useState(loadName)
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [role, setRole] = useState<CardRole | null>(null)
  const [room, setRoom] = useState<CardRoom | null>(null)
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  const unsub = useRef<(() => void) | null>(null)

  useEffect(() => () => unsub.current?.(), [])

  async function smallPhotos(): Promise<string[]> {
    return Promise.all(deck.map((c) => compressImage(photoOf.get(c.bugId) ?? '', 200, 12000).catch(() => '')))
  }

  function watch(c: string, r: CardRole) {
    unsub.current?.()
    setGone(false)
    unsub.current = watchCardRoom(c, (rm) => {
      if (!rm || (r === 'host' && rm.status === 'battling' && !rm.guest)) {
        setGone(true)
        return
      }
      setRoom(rm)
      if (rm.status === 'battling') setPhase('net')
      if (r === 'host') hostAdvance(c, rm)
    })
  }

  async function doCreate() {
    setBusy(true)
    setNotice(null)
    try {
      const c = await createCardRoom(name.trim(), deck, await smallPhotos())
      setCode(c)
      setRole('host')
      setPhase('netWait')
      watch(c, 'host')
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
      await joinCardRoom(c, name.trim(), deck, await smallPhotos())
      setCode(c)
      setRole('guest')
      watch(c, 'guest')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'はいれませんでした。')
    } finally {
      setBusy(false)
    }
  }
  function leaveNet() {
    if (code) leaveCardRoom(code)
    unsub.current?.()
    unsub.current = null
    setCode(null)
    setRole(null)
    setRoom(null)
    setPhase('menu')
  }

  // ===================== がめん =====================
  if (bugs.length < DECK_SIZE) {
    return (
      <div className="cg-page">
        <p className="cg-lead">カードゲームは 虫が {DECK_SIZE}ひき いると あそべるよ。いまは {bugs.length}ひき。</p>
        <button className="btn btn-big btn-primary" onClick={onGoCapture}>
          📷 虫を しらべに いく
        </button>
      </div>
    )
  }

  const cardModal = view && (
    <div className="modal-backdrop" onClick={() => setView(null)}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setView(null)} aria-label="とじる">
          ✕
        </button>
        <PaperCard card={view.card} photo={photoOf.get(view.card.bugId)} width={Math.min(window.innerWidth - 48, 360)} />
        {view.locked ? (
          <p className="cg-modal-note">
            🔒 ストーリーモードで <b>レベル{TIER_INFO[view.card.tier].level}</b> に そだてると つかえるよ
          </p>
        ) : phase === 'deck' ? (
          deck.some((d) => d.key === view.card.key) ? (
            <button
              className="btn btn-big"
              onClick={() => {
                setDeck(deck.filter((d) => d.key !== view.card.key))
                setView(null)
              }}
            >
              デッキから はずす
            </button>
          ) : (
            (() => {
              const why = canAdd(deck, view.card)
              return (
                <>
                  <button
                    className="btn btn-big btn-primary"
                    disabled={!!why}
                    onClick={() => {
                      sfx.tap()
                      setDeck([...deck, view.card])
                      setView(null)
                    }}
                  >
                    ＋ デッキに いれる
                  </button>
                  {why && <p className="cg-modal-note">{why}</p>}
                </>
              )
            })()
          )
        ) : null}
      </div>
    </div>
  )

  if (phase === 'cpu' && game) {
    return (
      <CardBattleStage
        key={gameNo}
        state={game}
        me="a"
        photos={cpuPhotos}
        myName="じぶん"
        foeName={`コンピューター（${CPU_LEVELS.find((l) => l.key === cpuLevel)?.label}）`}
        onCommand={cpuCommand}
        onAdvance={cpuAdvance}
        onQuit={() => {
          setGame(null)
          setPhase('menu')
        }}
        onAgain={() => startCpu(cpuLevel)}
      />
    )
  }

  if (phase === 'net' && room?.state && role) {
    const me = role === 'host' ? 'a' : 'b'
    const ph: Record<string, string> = {}
    room.host.photos.forEach((p, i) => (ph[`a${i}`] = p))
    room.guest?.photos.forEach((p, i) => (ph[`b${i}`] = p))
    const mine = role === 'host' ? room.host : room.guest
    const theirs = role === 'host' ? room.guest : room.host
    return (
      <>
        {gone && !room.state.over && <p className="cg-notice">あいてが いなくなりました…</p>}
        <CardBattleStage
          key={room.createdAt}
          state={room.state}
          me={me}
          photos={ph}
          myName={mine?.name ?? 'じぶん'}
          foeName={theirs?.name ?? 'あいて'}
          onCommand={(cmd) => code && sendCommand(code, role, room.state!.seq, cmd)}
          onQuit={leaveNet}
        />
      </>
    )
  }

  const deckProb = deckProblem(deck)
  const pageW = Math.min(560, window.innerWidth) - 32
  const gridW = Math.floor(pageW / 3) - 8
  const slotW = Math.floor(pageW / 4) - 8

  if (phase === 'deck') {
    const list = cards.filter((c) => filter === 'all' || c.tier === filter)
    return (
      <div className="cg-page">
        <h2 className="cg-h2">🃏 デッキを つくる</h2>
        <p className="cg-lead">4まい えらぼう。1・2ばんめが さいしょに たたかう。3・4ばんめは ひかえ。</p>
        <div className="cg-deck">
          {Array.from({ length: DECK_SIZE }, (_, i) => {
            const c = deck[i]
            return c ? (
              <div key={c.key} className="cg-slot">
                <span className="cg-slot-no">{i < 2 ? `まえ ${i + 1}` : `ひかえ ${i - 1}`}</span>
                <Mini card={c} photo={photoOf.get(c.bugId)} width={slotW} onLong={() => setView({ card: c })} />
                <span className="cg-slot-btns">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const n = [...deck]
                      ;[n[i - 1], n[i]] = [n[i], n[i - 1]]
                      setDeck(n)
                    }}
                  >
                    ◀
                  </button>
                  <button type="button" onClick={() => setDeck(deck.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                  <button
                    type="button"
                    disabled={i >= deck.length - 1}
                    onClick={() => {
                      const n = [...deck]
                      ;[n[i + 1], n[i]] = [n[i], n[i + 1]]
                      setDeck(n)
                    }}
                  >
                    ▶
                  </button>
                </span>
              </div>
            ) : (
              <div key={i} className="cg-slot empty">
                <span className="cg-slot-no">{i < 2 ? `まえ ${i + 1}` : `ひかえ ${i - 1}`}</span>
                <span className="cg-slot-plus">＋</span>
              </div>
            )
          })}
        </div>
        {notice && <p className="story-notice">{notice}</p>}
        <p className="cg-rule-small">カードを タップで いれる／はずす。ながおしで 大きく 見られるよ。</p>
        <p className={`cg-rule ${deckProb ? '' : 'ok'}`}>{deckProb ?? '✅ このデッキで たたかえるよ！'}</p>
        <p className="cg-rule-small">きまり：おなじ 虫は 1まい／R・SR・UR は あわせて 2まいまで／UR は 1まいまで</p>
        <div className="cg-row-btns">
          <button className="btn" onClick={autoDeck}>
            🎲 おまかせ
          </button>
          <button className="btn btn-primary" onClick={() => go('menu')}>
            できた！
          </button>
        </div>
        <div className="cg-tabs">
          {(['all', ...TIERS] as const).map((t) => (
            <button key={t} type="button" className={filter === t ? 'on' : ''} onClick={() => setFilter(t)}>
              {t === 'all' ? 'ぜんぶ' : t}
            </button>
          ))}
        </div>
        <div className="cg-pgrid">
          {list.map((c) => {
            const inDeck = deck.some((d) => d.key === c.key)
            return (
              <Mini
                key={c.key}
                card={c}
                photo={photoOf.get(c.bugId)}
                width={gridW}
                sel={inDeck}
                dim={!inDeck && !!canAdd(deck, c)}
                onLong={() => setView({ card: c })}
                onTap={() => {
                  if (inDeck) {
                    sfx.tap()
                    setDeck(deck.filter((d) => d.key !== c.key))
                    return
                  }
                  const why = canAdd(deck, c)
                  if (why) {
                    setNotice(why)
                    return
                  }
                  sfx.tap()
                  setNotice(null)
                  setDeck([...deck, c])
                }}
              />
            )
          })}
        </div>
        {cardModal}
      </div>
    )
  }

  if (phase === 'zukan') {
    const all = bugs.flatMap((b) => TIERS.map((t) => ({ b, t })))
    const have = new Set(cards.map((c) => c.key))
    return (
      <div className="cg-page">
        <h2 className="cg-h2">📚 カードずかん</h2>
        <p className="cg-lead">
          あつめた カード <b>{cards.length}</b> / {all.length}まい。ストーリーモードで そだてると レアカードが ふえるよ。カードを タップすると 大きく 見られる。
        </p>
        <div className="cg-tabs">
          {(['all', ...TIERS] as const).map((t) => (
            <button key={t} type="button" className={filter === t ? 'on' : ''} onClick={() => setFilter(t)}>
              {t === 'all' ? 'ぜんぶ' : t}
            </button>
          ))}
        </div>
        <div className="cg-pgrid">
          {all
            .filter((x) => filter === 'all' || x.t === filter)
            .map(({ b, t }) => {
              const key = `${b.id}:${t}`
              const got = have.has(key)
              const card = got ? cards.find((c) => c.key === key)! : null
              return got && card ? (
                <Mini key={key} card={card} photo={photoOf.get(b.id)} width={gridW} onLong={() => setView({ card })} />
              ) : (
                (() => {
                  const lc = buildCard(b, save, t)
                  return (
                    <Mini
                      key={key}
                      card={lc}
                      photo={photoOf.get(b.id)}
                      width={gridW}
                      lock={`レベル${TIER_INFO[t].level}で ゲット`}
                      onLong={() => setView({ card: lc, locked: true })}
                    />
                  )
                })()
              )
            })}
        </div>
        <button className="btn btn-ghost cg-back" onClick={() => go('menu')}>
          ← もどる
        </button>
        {cardModal}
      </div>
    )
  }

  if (phase === 'rules') {
    return (
      <div className="cg-page cg-rules">
        <h2 className="cg-h2">📖 あそびかた</h2>
        <ol>
          <li>
            <b>デッキ</b>：カードを 4まい えらぶ。1・2ばんめが まえで たたかい、3・4ばんめは ひかえ。
          </li>
          <li>
            <b>わざを えらぶ</b>：まえの 虫 1ぴきずつ、わざ か ⚔️こうげき を えらぶ。わざの ● は つかえる かいすう。⚔️こうげきは なんかいでも つかえる。
          </li>
          <li>
            <b>じゅんばん</b>：💨すばやさが 大きい 虫から うごく。⚡さきに うごく わざは いちばん さき。
          </li>
          <li>
            <b>ダメージ</b>：わざの かず ＋ じぶんの 🔺×5 － あいての 🛡️×5（さいてい 5）。🔻💔 は ぎゃくに はたらく。
          </li>
          <li>
            <b>たおれる</b>：たいりょくが 0に なったら たおれる。ラウンドの おわりに ひかえが でてくる。
          </li>
          <li>
            <b>かち</b>：あいての 虫を 4ひき ぜんぶ たおしたら かち！
          </li>
        </ol>
        <h3>🎲 サイコロ と マーク</h3>
        <ul>
          <li>☠️どく：ラウンドの おわりに 10ダメージ。</li>
          <li>💤ねむり：うごく ときに 🎲4〜6で おきる。それいがいは うごけない。</li>
          <li>⚡まひ：すばやさ はんぶん。🎲1 だと うごけない。</li>
          <li>【ためる】【かくれる】：つぎの ラウンドに こうげき。かくれている あいだは こうげきが あたらない。</li>
          <li>【やすみ】：つぎの ラウンドは うごけない。⏳：すこし あとで あたる（🛡️むし）。</li>
          <li>☀️：ラウンドの おわりに かいふく。🩸：ラウンドの おわりに すいとられる。</li>
          <li>🔺🛡️💨 は 3こまで。🔻💔🐢 は へる チップ。</li>
        </ul>
        <h3>⭐ レアカード</h3>
        <p>ストーリーモードで 虫を そだてると、レベル30で R、40で SR、50で UR カードが つかえる。さいきょうわざが はいって つよくなる！</p>
        <button className="btn btn-ghost cg-back" onClick={() => go('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'cpuPick') {
    return (
      <div className="cg-page">
        <h2 className="cg-h2">🤖 コンピューターの つよさ</h2>
        <div className="game-menu">
          {CPU_LEVELS.map((l) => (
            <button key={l.key} className="game-card battle" onClick={() => startCpu(l.key)}>
              <span className="game-emoji">{l.emoji}</span>
              <span className="game-title">{l.label}</span>
              <span className="game-desc">{l.desc}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost cg-back" onClick={() => go('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netName') {
    return (
      <div className="cg-page net-battle-menu">
        <h2 className="cg-h2">📡 あなたの なまえ</h2>
        <input
          className="net-battle-input"
          value={name}
          maxLength={10}
          placeholder="なまえ（10もじまで）"
          onChange={(e) => {
            setName(e.target.value)
            saveJson(NAME_KEY, e.target.value)
          }}
        />
        {notice && <p className="story-notice">{notice}</p>}
        <button
          className="btn btn-big btn-primary"
          onClick={() => (name.trim() ? go('netMenu') : setNotice('なまえを 入れてね。'))}
        >
          つぎへ 👉
        </button>
        <button className="btn btn-ghost cg-back" onClick={() => go('menu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netMenu') {
    return (
      <div className="cg-page net-battle-menu">
        <h2 className="cg-h2">📡 たたかいばを つくる</h2>
        <div className="net-battle-menu-actions">
          <button className="btn btn-big btn-primary" disabled={busy} onClick={doCreate}>
            🆕 じぶんで つくる
          </button>
          <button className="btn btn-big" disabled={busy} onClick={() => go('netJoin')}>
            🔑 つくってもらう
          </button>
        </div>
        {notice && <p className="story-notice">{notice}</p>}
        <button className="btn btn-ghost cg-back" onClick={() => go('netName')}>
          ← もどる
        </button>
      </div>
    )
  }

  if (phase === 'netJoin') {
    return (
      <div className="cg-page net-battle-menu">
        <h2 className="cg-h2">あいことばを 入れてね</h2>
        <RoomWordInput value={codeInput} onChange={setCodeInput} />
        {notice && <p className="story-notice">{notice}</p>}
        <button className="btn btn-big btn-primary" disabled={busy} onClick={doJoin}>
          {busy ? 'じゅんびちゅう…' : 'はいる 🚪'}
        </button>
        <button className="btn btn-ghost cg-back" onClick={() => go('netMenu')}>
          ← もどる
        </button>
      </div>
    )
  }

  if ((phase === 'netWait' || phase === 'net') && code) {
    return (
      <div className="cg-page net-battle-menu">
        <h2 className="cg-h2">あいてを まっています…</h2>
        <RoomWordCard code={code} note="この ことばを あいてに つたえてね。あいても「カードゲーム」→「カードバトル」の「つうしん」から はいるよ。" />
        {gone && <p className="story-notice">へやが なくなりました。</p>}
        <button className="btn btn-ghost cg-back" onClick={leaveNet}>
          ← やめる
        </button>
      </div>
    )
  }

  // ---------- メニュー ----------
  return (
    <div className="cg-page">
      <div className="cg-menu-deck" onClick={() => go('deck')}>
        <span className="cg-menu-deck-title">🃏 いまの デッキ</span>
        <div className="cg-menu-deck-cards">
          {Array.from({ length: DECK_SIZE }, (_, i) =>
            deck[i] ? (
              <PaperCard key={deck[i].key} card={deck[i]} photo={photoOf.get(deck[i].bugId)} width={slotW} />
            ) : (
              <span key={i} className="cg-slot empty">
                <span className="cg-slot-plus">＋</span>
              </span>
            ),
          )}
        </div>
        <span className="cg-menu-deck-edit">{deckProb ? `✏️ ${deckProb}` : '✏️ デッキを かえる'}</span>
      </div>
      {notice && <p className="story-notice">{notice}</p>}
      <div className="game-menu">
        <button
          className="game-card battle"
          onClick={() => (deckProb ? (setNotice('さきに デッキを 4まい つくってね'), go('deck')) : go('cpuPick'))}
        >
          <span className="game-emoji">🤖</span>
          <span className="game-title">コンピューターと たたかう</span>
          <span className="game-desc">よわい・ふつう・つよい から えらべる</span>
        </button>
        <button
          className="game-card battle"
          onClick={() => (deckProb ? (setNotice('さきに デッキを 4まい つくってね'), go('deck')) : go('netName'))}
        >
          <span className="game-emoji">📡</span>
          <span className="game-title">つうしんで たたかう</span>
          <span className="game-desc">ともだちと あいことばで たいせん</span>
        </button>
        <button className="game-card quiz" onClick={() => go('zukan')}>
          <span className="game-emoji">📚</span>
          <span className="game-title">カードずかん</span>
          <span className="game-desc">
            あつめた カード {cards.length}まい
          </span>
        </button>
        <button className="game-card story" onClick={() => go('rules')}>
          <span className="game-emoji">📖</span>
          <span className="game-title">あそびかた</span>
          <span className="game-desc">サイコロ・チップ・レアカードの ひみつ</span>
        </button>
      </div>
    </div>
  )
}
