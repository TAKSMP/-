import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CaughtBug } from '../types'
import {
  closeGiftRoom,
  createGiftRoom,
  joinTrade,
  receiveGift,
  watchGiftRoom,
  type GiftBug,
} from '../lib/gift'
import { addGiftBug, mainPhoto } from '../lib/storage'
import { normalizeRoomCode, ROOM_CODE_MIN } from '../lib/roomWords'
import { RoomWordCard, RoomWordInput } from './RoomWord'
import { Confetti } from './Confetti'
import { sfx } from '../lib/sound'

// 「ともだちと やりとり」の ウインドウ。
//  send   … この 虫を おくる（へやを つくって、あいことばを ともだちに つたえる）
//  receive… ともだちから もらう（あいことばを いれる）
//  trade  … この 虫と ともだちの 虫を こうかん する
export type GiftMode = 'send' | 'receive' | 'trade'

interface Props {
  mode: GiftMode
  bug?: CaughtBug // おくる 虫（send・trade）。receive では いらない
  onClose: () => void
  onReceived: (bugs: CaughtBug[], received: CaughtBug) => void
  // true … ウインドウでは なく ページの なかに ひょうじする（「ともだちに おくる」ページ）
  inline?: boolean
  onExit?: () => void // inline の とき、さいしょの がめんで「もどる」を おした
}

// うえの「もどる」ボタンから よぶ。ひとつ まえの だんかいに もどれたら true
export interface GiftModalHandle {
  back: () => boolean
}

// つうしんバトルと おなじ なまえを つかう
const NAME_KEY = 'chomushi.netbattle.name'
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // ほぞん できなくても きにしない
  }
}

type Step = 'intro' | 'join' | 'waiting' | 'anim' | 'done'
type AnimKind = 'send' | 'receive' | 'trade'

const TITLE: Record<GiftMode, string> = {
  send: '🎁 ともだちに おくる',
  receive: '📬 ともだちから もらう',
  trade: '🔄 ともだちと こうかん',
}

export const GiftModal = forwardRef<GiftModalHandle, Props>(function GiftModal(
  { mode, bug, onClose, onReceived, inline = false, onExit },
  handle,
) {
  const [step, setStep] = useState<Step>('intro')
  const [name, setName] = useState(loadName)
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [anim, setAnim] = useState<AnimKind>('send')
  const [friend, setFriend] = useState('')
  const [got, setGot] = useState<GiftBug | null>(null)
  const myPhoto = bug ? mainPhoto(bug) : ''
  const finished = useRef(false)
  const onReceivedRef = useRef(onReceived)
  onReceivedRef.current = onReceived

  // へやを つくった がわ：あいてが きたら アニメーションへ
  useEffect(() => {
    if (!code || step !== 'waiting') return
    const off = watchGiftRoom(code, (room) => {
      if (!room || finished.current) return
      if (room.status !== 'done' || !room.guest) return
      if (mode === 'trade' && !room.guest.bug) return
      finished.current = true
      setFriend(room.guest.name)
      if (mode === 'trade' && room.guest.bug) {
        const r = addGiftBug(room.guest.bug, room.guest.name)
        setGot(room.guest.bug)
        onReceivedRef.current(r.bugs, r.bug)
        setAnim('trade')
      } else {
        setAnim('send')
      }
      setStep('anim')
      void closeGiftRoom(code)
    })
    return off
  }, [code, step, mode])

  // とちゅうで とじたら へやを かたづける
  useEffect(() => {
    return () => {
      if (code && !finished.current) void closeGiftRoom(code)
    }
  }, [code])

  function needName(): boolean {
    if (!name.trim()) {
      setError('なまえを いれてね')
      sfx.error()
      return true
    }
    saveName(name.trim())
    return false
  }

  async function doCreate() {
    if (needName() || !bug) return
    sfx.tap()
    setBusy(true)
    setError('')
    try {
      const c = await createGiftRoom(mode === 'trade' ? 'trade' : 'gift', name.trim(), bug)
      setCode(c)
      setStep('waiting')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'つうしん できなかったよ。もういちど ためしてね。')
      sfx.error()
    } finally {
      setBusy(false)
    }
  }

  async function doJoin() {
    if (needName()) return
    const c = normalizeRoomCode(codeInput)
    if (c.length < ROOM_CODE_MIN) {
      setError('あいことばを いれてね')
      sfx.error()
      return
    }
    sfx.tap()
    setBusy(true)
    setError('')
    try {
      const res =
        mode === 'trade' && bug ? await joinTrade(c, name.trim(), bug) : await receiveGift(c, name.trim())
      finished.current = true
      const r = addGiftBug(res.bug, res.from)
      setGot(res.bug)
      setFriend(res.from)
      onReceived(r.bugs, r.bug)
      setAnim(mode === 'trade' ? 'trade' : 'receive')
      setStep('anim')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'つうしん できなかったよ。もういちど ためしてね。')
      sfx.error()
    } finally {
      setBusy(false)
    }
  }

  // アニメーションが おわったら けっかへ
  useEffect(() => {
    if (step !== 'anim') return
    sfx.gift()
    const t1 = window.setTimeout(() => sfx.discover(), 1500)
    const t2 = window.setTimeout(() => {
      setStep('done')
      sfx.badge()
    }, 2900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [step])

  // ひとつ まえへ（アニメーション中は なにも しない）
  useImperativeHandle(handle, () => ({
    back() {
      if (step === 'anim') return true
      if (step === 'join') {
        sfx.tap()
        setError('')
        setStep('intro')
        return true
      }
      if (step === 'waiting') {
        sfx.tap()
        if (code) void closeGiftRoom(code)
        setCode(null)
        setStep('intro')
        return true
      }
      return false // intro・done は ページの ほうで もどる
    },
  }))

  const nameField = (
    <label className="gift-name">
      <span>あなたの なまえ</span>
      <input
        className="net-battle-input"
        value={name}
        maxLength={10}
        placeholder="なまえ（10もじまで）"
        onChange={(e) => setName(e.target.value)}
      />
    </label>
  )

  const bugChip = (photo: string, label: string) => (
    <div className="gift-chip">
      <img src={photo} alt={label} />
      <b>{label}</b>
    </div>
  )

  let body: ReactNode = null

  if (step === 'intro') {
    body = (
      <>
        {bug && bugChip(myPhoto, bug.name)}
        <p className="gift-lead">
          {mode === 'send' && (
            <>
              この 虫を ともだちに おくるよ。<br />
              あなたの 図鑑にも のこるよ。
            </>
          )}
          {mode === 'receive' && (
            <>
              ともだちが「おくる」で だした
              <br />
              えいごの あいことばを いれてね。
            </>
          )}
          {mode === 'trade' && (
            <>
              この 虫と ともだちの 虫を こうかん するよ。
              <br />
              どちらかが へやを つくってね。
            </>
          )}
        </p>
        <p className="gift-note">もらった 虫は レベル1・さいしょの わざから はじまるよ。</p>
        {nameField}
        {mode === 'receive' && <RoomWordInput value={codeInput} onChange={setCodeInput} />}
        {error && <p className="story-notice">{error}</p>}
        <div className="gift-actions">
          {mode === 'send' && (
            <button className="btn btn-big btn-primary" disabled={busy} onClick={doCreate}>
              🎁 おくる
            </button>
          )}
          {mode === 'receive' && (
            <button className="btn btn-big btn-primary" disabled={busy} onClick={doJoin}>
              📬 うけとる
            </button>
          )}
          {mode === 'trade' && (
            <>
              <button className="btn btn-big btn-primary" disabled={busy} onClick={doCreate}>
                🆕 へやを つくる
              </button>
              <button
                className="btn btn-big"
                disabled={busy}
                onClick={() => {
                  if (needName()) return
                  sfx.tap()
                  setError('')
                  setStep('join')
                }}
              >
                🔑 あいことばで はいる
              </button>
            </>
          )}
          {inline && onExit && (
            <button className="btn btn-ghost" onClick={onExit}>
              ← もどる
            </button>
          )}
        </div>
      </>
    )
  } else if (step === 'join') {
    body = (
      <>
        {bug && bugChip(myPhoto, bug.name)}
        <p className="gift-lead">ともだちの がめんに 出ている あいことばを いれてね。</p>
        <RoomWordInput value={codeInput} onChange={setCodeInput} />
        {error && <p className="story-notice">{error}</p>}
        <div className="gift-actions">
          <button className="btn btn-big btn-primary" disabled={busy} onClick={doJoin}>
            🔄 こうかん する
          </button>
          <button className="btn btn-ghost" onClick={() => setStep('intro')}>
            ← もどる
          </button>
        </div>
      </>
    )
  } else if (step === 'waiting' && code) {
    body = (
      <>
        {bug && bugChip(myPhoto, bug.name)}
        <p className="gift-lead">ともだちを まっているよ…</p>
        <RoomWordCard
          code={code}
          note={
            mode === 'trade'
              ? 'ともだちは「ともだちに おくる」→「こうかん」で 虫を えらんで、「あいことばで はいる」から この ことばを いれてね。'
              : 'ともだちは「ともだちに おくる」→「もらう」から、この ことばを いれてね。'
          }
        />
        <div className="gift-wait-dots" aria-hidden>
          <span>●</span>
          <span>●</span>
          <span>●</span>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            sfx.tap()
            void closeGiftRoom(code)
            setCode(null)
            setStep('intro')
          }}
        >
          ← やめる
        </button>
      </>
    )
  } else if (step === 'anim') {
    body = <GiftAnim kind={anim} mine={myPhoto} theirs={got?.photo ?? ''} />
  } else if (step === 'done') {
    body = (
      <>
        <Confetti show={anim !== 'send'} />
        {anim === 'send' && (
          <>
            {bug && bugChip(myPhoto, bug.name)}
            <p className="gift-result">🎉 {friend}さんに とどいたよ！</p>
          </>
        )}
        {anim !== 'send' && got && (
          <>
            {bugChip(got.photo, got.name)}
            <p className="gift-result">
              🎉 {friend}さんから「{got.name}」が とどいたよ！
            </p>
            <p className="gift-note">図鑑に ふえたよ。レベル1から そだてよう！</p>
          </>
        )}
        <div className="gift-actions">
          <button className="btn btn-big btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </>
    )
  }

  if (inline) {
    return (
      <div className="gift-inline">
        <h2 className="gift-title">{TITLE[mode]}</h2>
        {body}
      </div>
    )
  }

  return (
    <div className="modal-backdrop gift-backdrop" onClick={step === 'anim' ? undefined : onClose}>
      <div className="modal gift-modal" onClick={(e) => e.stopPropagation()}>
        {step !== 'anim' && (
          <button className="modal-close" onClick={onClose} aria-label="とじる">
            ✕
          </button>
        )}
        <h2 className="gift-title">{TITLE[mode]}</h2>
        {body}
      </div>
    </div>
  )
})

// おくる／もらう／こうかん の アニメーション（やく 2.9びょう）
function GiftAnim({ kind, mine, theirs }: { kind: AnimKind; mine: string; theirs: string }) {
  return (
    <div className={'gift-anim gift-anim-' + kind} aria-live="polite">
      <div className="gift-anim-stars" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties}>
            ✨
          </span>
        ))}
      </div>
      {kind === 'send' && (
        <>
          <img className="gift-anim-bug fly-out" src={mine} alt="" />
          <span className="gift-anim-box send">🎁</span>
          <p className="gift-anim-text">ひゅ〜ん！ おくっているよ…</p>
        </>
      )}
      {kind === 'receive' && (
        <>
          <span className="gift-anim-box receive">🎁</span>
          <img className="gift-anim-bug pop-in" src={theirs} alt="" />
          <p className="gift-anim-text">なにか とどいたよ…！</p>
        </>
      )}
      {kind === 'trade' && (
        <>
          <img className="gift-anim-bug swap-left" src={mine} alt="" />
          <img className="gift-anim-bug swap-right" src={theirs} alt="" />
          <span className="gift-anim-swap">🔄</span>
          <p className="gift-anim-text">こうかん ちゅう…！</p>
        </>
      )}
    </div>
  )
}
