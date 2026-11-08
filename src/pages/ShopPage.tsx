// =============================================================
//  ちょうむしショップ
// -------------------------------------------------------------
//  昆虫検定で ためた 虫ポイントで こうかんする。
//  ・ふしぎなアメ … すきな虫の レベルを 1つ あげる（ストーリーと おなじ レベルアップ・わざの がめん）
//  ・チョウチョちゃんあめ／トンボあめ … もちものに はいり、つるせMAPで すきな ときに つかう
//  ・〇〇の巻物 … その しゅるいの わざを リストから えらんで（????も えらべる）すきな虫に おぼえさせる
// =============================================================
import { useMemo, useState } from 'react'
import type { CaughtBug, SpecialMoveV2 } from '../types'
import { mainPhoto } from '../lib/storage'
import { sfx } from '../lib/sound'
import { buyItem, spendPoints, usePoints, type ItemId } from '../lib/points'
import {
  addExp,
  addUltimate,
  addScrollUltimate,
  allMovesOf,
  expToNext,
  levelOf,
  loadStory,
  MAX_LEVEL,
  moveSlots,
  saveStory,
  setMoves,
  statsWithLevel,
  ULTIMATE_LEVELS,
  type StorySave,
} from '../lib/story'
import { celebrationsFor, moveLabel, type Celebration } from '../lib/celebrations'
import { CelebrationModal } from '../components/CelebrationModal'
import { DEX, loadDexSeen, markMovesSeen, patternLabel, type MoveGroup } from '../lib/moveDex'
import type { LibraryMove } from '../lib/moveLibrary'

interface ShopItem {
  id: string
  name: string
  emoji: string
  price: number
  desc: string
  item?: ItemId // もちものに はいる もの
  scroll?: MoveGroup // まきもの
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'fushigi', name: 'ふしぎなアメ', emoji: '🍬', price: 10, desc: 'すきな虫の レベルを 1つ あげる' },
  {
    id: 'butterfly',
    name: 'チョウチョちゃんあめ',
    emoji: '🦋',
    price: 2,
    desc: 'つるせMAPで つかうと ちょうちょに なって そらを とべる',
    item: 'butterflyCandy',
  },
  {
    id: 'dragonfly',
    name: 'トンボあめ',
    emoji: '🍭',
    price: 5,
    desc: 'つるせMAPで つかうと ギンヤンマか ウスバキトンボに なって とべる',
    item: 'dragonflyCandy',
  },
  { id: 'scroll-attack', name: 'こうげきの巻物', emoji: '📜', price: 30, desc: 'こうげきワザを 1つ おぼえさせる', scroll: 'attack' },
  { id: 'scroll-status', name: 'へんかの巻物', emoji: '📜', price: 30, desc: 'へんかワザを 1つ おぼえさせる', scroll: 'status' },
  { id: 'scroll-heal', name: 'かいふくの巻物', emoji: '📜', price: 30, desc: 'かいふくワザを 1つ おぼえさせる', scroll: 'heal' },
  { id: 'scroll-ultimate', name: 'さいきょうの巻物', emoji: '👑', price: 100, desc: 'さいきょうワザを 1つ おぼえさせる', scroll: 'ultimate' },
]

const SCROLL_CLASS: Record<MoveGroup, string> = {
  attack: 'attack',
  status: 'status',
  heal: 'heal',
  ultimate: 'ultimate',
}

// まきもので えらんだ わざを おぼえる ときの かたち（わざ道場で おぼえる ときと おなじ）
function learnable(m: LibraryMove): SpecialMoveV2 {
  return { ...m } as SpecialMoveV2
}

type Flow =
  | null
  | { kind: 'candy' }
  | { kind: 'scrollMove'; item: ShopItem }
  | { kind: 'scrollBug'; item: ShopItem; move: LibraryMove; mystery: boolean }
  | { kind: 'scrollSlot'; item: ShopItem; move: LibraryMove; mystery: boolean; bug: CaughtBug }
  | { kind: 'learned'; bug: CaughtBug; move: SpecialMoveV2; mystery: boolean; replaced?: string }

interface Props {
  bugs: CaughtBug[]
  onGoCapture: () => void
}

export function ShopPage({ bugs, onGoCapture }: Props) {
  const wallet = usePoints()
  const [save, setSave] = useState<StorySave>(() => loadStory())
  const [flow, setFlow] = useState<Flow>(null)
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [toast, setToast] = useState<string | null>(null)
  // まきものの わざリストで ひらいている わざ
  const [openMove, setOpenMove] = useState<string | null>(null)
  const seen = useMemo(() => loadDexSeen(), [flow])

  function commit(next: StorySave) {
    setSave(next)
    saveStory(next)
  }

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }

  function tapItem(it: ShopItem) {
    if (wallet.points < it.price) {
      sfx.error()
      return
    }
    sfx.tap()
    if (it.item) {
      if (buyItem(it.item, it.price)) {
        sfx.discover()
        showToast(`${it.emoji} ${it.name}を もちものに いれたよ！ つるせMAPで つかえるよ`)
      }
      return
    }
    if (bugs.length === 0) {
      showToast('まだ 虫が いないよ。さきに 虫を しらべてね')
      return
    }
    if (it.id === 'fushigi') setFlow({ kind: 'candy' })
    else if (it.scroll) {
      setOpenMove(null)
      setFlow({ kind: 'scrollMove', item: it })
    }
  }

  // ---- ふしぎなアメ：ストーリーの あめと おなじ（けいけんちバー1本ぶん → レベルアップ・わざ） ----
  function giveCandy(b: CaughtBug) {
    const before = levelOf(save, b.id)
    if (before.level >= MAX_LEVEL) return
    if (!spendPoints(10)) {
      sfx.error()
      return
    }
    const gained = Math.max(1, expToNext(before.level) - before.exp)
    const res = addExp(save, b.id, gained)
    commit(res.save)
    setFlow(null)
    sfx.badge()
    setCelebrations(celebrationsFor(b, res, res.save, false))
  }

  const head = celebrations[0]
  const pop = () => setCelebrations((q) => q.slice(1))

  function swapMove(index: number) {
    if (!head || head.kind !== 'learn') return
    const who = bugs.find((b) => b.id === head.info.bugId)
    if (!who) {
      pop()
      return
    }
    sfx.special('attackUp')
    const moves = [...allMovesOf(save, who)]
    if (index < moves.length) moves[index] = head.info.move
    else moves.push(head.info.move)
    commit(setMoves(save, who.id, moves))
    markMovesSeen([head.info.move.id])
    pop()
  }

  function learnUltimate() {
    if (!head || head.kind !== 'learn') return
    sfx.special('attackUp')
    commit(addUltimate(save, head.info.bugId, head.info.move))
    markMovesSeen([head.info.move.id])
    pop()
  }

  // ---- まきもの ----
  function knows(b: CaughtBug, m: LibraryMove): boolean {
    if (m.ultimate) return (save.ultimates?.[b.id] ?? []).some((x) => x.id === m.id)
    return allMovesOf(save, b).some((x) => x.id === m.id || x.name === m.name)
  }

  // いま つかえる ふつうの わざ（レベルぶんの わく）
  function usableMoves(b: CaughtBug): SpecialMoveV2[] {
    return allMovesOf(save, b).slice(0, moveSlots(levelOf(save, b.id).level))
  }

  // わざ道場と おなじ きまり：
  //  ・ふつうの わざ … わくが あいて いれば ついか、いっぱいなら えらんだ わざと とりかえ
  //  ・さいきょうわざ … 3つまで。いっぱいなら もっている 3つの うち えらんだ 1つと とりかえ（しゅるいは とわない）
  function learnScroll(
    item: ShopItem,
    move: LibraryMove,
    mystery: boolean,
    bug: CaughtBug,
    slot: number | null,
    replaceUlt?: SpecialMoveV2,
  ) {
    if (!spendPoints(item.price)) {
      sfx.error()
      return
    }
    const nm = learnable(move)
    let replaced: string | undefined
    if (nm.ultimate) {
      replaced = replaceUlt?.name
      commit(addScrollUltimate(save, bug.id, nm, replaceUlt?.id))
    } else {
      const moves = [...allMovesOf(save, bug)]
      if (slot === null) {
        moves.push(nm)
      } else {
        replaced = moves[slot]?.name
        if (slot < moves.length) moves[slot] = nm
        else moves.push(nm)
      }
      commit(setMoves(save, bug.id, moves))
    }
    markMovesSeen([nm.id])
    sfx.special('attackUp')
    setFlow({ kind: 'learned', bug, move: nm, mystery, replaced })
  }

  function pickScrollBug(item: ShopItem, move: LibraryMove, mystery: boolean, bug: CaughtBug) {
    sfx.tap()
    setFlow({ kind: 'scrollSlot', item, move, mystery, bug })
  }

  const close = () => {
    sfx.tap()
    setFlow(null)
  }

  return (
    <div className="page shop">
      <header className="page-head">
        <h1>🏪 ちょうむしショップ</h1>
        <p className="sub">昆虫検定で ためた 虫ポイントで こうかんしよう！</p>
      </header>

      <div className="shop-wallet">
        <span className="shop-wallet-label">もっている 虫ポイント</span>
        <span className="shop-wallet-pts">
          <span className="points-coin">P</span>
          {wallet.points}
        </span>
        <span className="shop-wallet-items">
          🦋 チョウチョちゃんあめ ×{wallet.items.butterflyCandy}　🍭 トンボあめ ×
          {wallet.items.dragonflyCandy}
        </span>
      </div>

      <ul className="shop-list">
        {SHOP_ITEMS.map((it) => {
          const short = wallet.points < it.price
          return (
            <li key={it.id} className={'shop-item' + (it.scroll ? ' scroll ' + SCROLL_CLASS[it.scroll] : '')}>
              <span className="shop-item-emoji">{it.emoji}</span>
              <span className="shop-item-body">
                <span className="shop-item-name">{it.name}</span>
                <span className="shop-item-desc">{it.desc}</span>
              </span>
              <button
                className={'shop-buy' + (short ? ' short' : '')}
                onClick={() => tapItem(it)}
                aria-disabled={short}
              >
                <b>{it.price}P</b>
                <small>{short ? 'たりない' : 'こうかん'}</small>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="shop-note">
        虫ポイントは「あそぶ → 昆虫検定」で せいかいすると たまるよ（初級 1もん 1P・中級 1もん 3P）。
      </p>

      {toast && <div className="shop-toast">{toast}</div>}

      {/* ---- ふしぎなアメ：どの虫？ ---- */}
      {flow?.kind === 'candy' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal story-cage" onClick={(e) => e.stopPropagation()}>
            <h3>🍬 ふしぎなアメ</h3>
            <p className="story-recruit-sub">どの虫の レベルを 1つ あげる？（10P）</p>
            <BugRows
              bugs={bugs}
              save={save}
              render={(b) =>
                levelOf(save, b.id).level >= MAX_LEVEL ? (
                  <span className="story-cage-free story-cage-max">MAX</span>
                ) : (
                  <button className="story-cage-free story-candy-give" onClick={() => giveCandy(b)}>
                    ＋1 レベル
                  </button>
                )
              }
            />
            <button className="btn btn-big" onClick={close}>
              やめる
            </button>
          </div>
        </div>
      )}

      {/* ---- まきもの：どの わざ？ ---- */}
      {flow?.kind === 'scrollMove' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal movedex shop-scroll" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={close} aria-label="とじる">
              ✕
            </button>
            <h2 className="modal-name">
              {flow.item.emoji} {flow.item.name}
            </h2>
            <p className="movedex-hint">
              おぼえさせる わざを えらんでね。<b>????</b> も えらべるよ（なにが でるかは おたのしみ！）
            </p>
            <ul className="movedex-list">
              {DEX.filter((d) => d.group === flow.item.scroll).map((d) => {
                const found = seen.has(d.move.id)
                const isOpen = found && openMove === d.move.id
                return (
                  <li key={d.move.id} className={found ? 'found' : 'unknown'}>
                    <div className="shop-move-row">
                      <button
                        className="movedex-row"
                        disabled={!found}
                        onClick={() => {
                          sfx.tap()
                          setOpenMove(isOpen ? null : d.move.id)
                        }}
                      >
                        <span className="movedex-no">No.{d.no}</span>
                        <span className="movedex-emoji">{found ? (d.move.emoji ?? '✨') : '❔'}</span>
                        <span className="movedex-name">{found ? d.move.name : '????'}</span>
                        {found && <span className="movedex-arrow">{isOpen ? '▲' : '▼'}</span>}
                      </button>
                      <button
                        className="shop-move-pick"
                        onClick={() => {
                          sfx.tap()
                          setFlow({ kind: 'scrollBug', item: flow.item, move: d.move, mystery: !found })
                        }}
                      >
                        これ！
                      </button>
                    </div>
                    {isOpen && (
                      <div className="movedex-detail">
                        <p className="movedex-desc">{d.move.desc}</p>
                        <p className="shop-move-spec">
                          {patternLabel(d.move)}／{moveLabel(d.move)}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ---- まきもの：どの虫に？ ---- */}
      {flow?.kind === 'scrollBug' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal story-cage" onClick={(e) => e.stopPropagation()}>
            <h3>
              {flow.item.emoji} 「{flow.mystery ? '????' : flow.move.name}」を
              <br />
              どの虫に おぼえさせる？
            </h3>
            <BugRows
              bugs={bugs}
              save={save}
              render={(b) =>
                knows(b, flow.move) ? (
                  <span className="story-cage-free story-cage-max">もう おぼえてる</span>
                ) : (
                  <button
                    className="story-cage-free story-candy-give"
                    onClick={() => pickScrollBug(flow.item, flow.move, flow.mystery, b)}
                  >
                    この虫に
                  </button>
                )
              }
            />
            <button
              className="btn btn-big"
              onClick={() => {
                sfx.tap()
                setFlow({ kind: 'scrollMove', item: flow.item })
              }}
            >
              ← わざを えらびなおす
            </button>
          </div>
        </div>
      )}

      {/* ---- まきもの：どの わざと とりかえる？／さいきょうわざの かくにん ---- */}
      {flow?.kind === 'scrollSlot' &&
        (() => {
          const { item, move, mystery, bug } = flow
          const name = mystery ? '????' : move.name
          const back = () => {
            sfx.tap()
            setFlow({ kind: 'scrollBug', item, move, mystery })
          }
          if (move.ultimate) {
            const owned = save.ultimates?.[bug.id] ?? []
            const full = owned.length >= ULTIMATE_LEVELS.length
            return (
              <div className="modal-backdrop" onClick={back}>
                <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
                  <div className="story-levelup-emoji">👑</div>
                  <h3>
                    {bug.name}に 「{name}」を
                    <br />
                    おぼえさせる（{item.price}P）
                  </h3>
                  <p className="story-learn-q">
                    {full
                      ? 'さいきょうわざは 3つまで。どの さいきょうわざと とりかえる？'
                      : 'さいきょうわざは いまの わざ とは べつに ふえるよ！'}
                    <br />
                    まきもので おぼえた わざは レベルに かかわらず すぐ つかえるよ。
                  </p>
                  {full ? (
                    <div className="story-learn-list">
                      {owned.map((m) => (
                        <button
                          key={m.id}
                          className="story-learn-old"
                          onClick={() => learnScroll(item, move, mystery, bug, null, m)}
                        >
                          <span className="story-learn-old-name">
                            👑 {m.emoji ?? '✨'} {m.name}
                          </span>
                          <span className="story-learn-old-sub">
                            {moveLabel(m)}／{m.uses}かい
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      className="btn btn-big btn-primary"
                      onClick={() => learnScroll(item, move, mystery, bug, null)}
                    >
                      おぼえさせる 👑
                    </button>
                  )}
                  <button className="btn btn-big" onClick={back}>
                    やめる
                  </button>
                </div>
              </div>
            )
          }
          const current = usableMoves(bug)
          const lv = levelOf(save, bug.id).level
          const hasRoom = allMovesOf(save, bug).length < moveSlots(lv)
          if (hasRoom) {
            return (
              <div className="modal-backdrop" onClick={back}>
                <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
                  <div className="story-levelup-emoji">📜</div>
                  <h3>
                    {bug.name}に 「{name}」を おぼえさせる？（{item.price}P）
                  </h3>
                  <button
                    className="btn btn-big btn-primary"
                    onClick={() => learnScroll(item, move, mystery, bug, null)}
                  >
                    おぼえさせる 📜
                  </button>
                  <button className="btn btn-big" onClick={back}>
                    やめる
                  </button>
                </div>
              </div>
            )
          }
          return (
            <div className="modal-backdrop" onClick={back}>
              <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
                <div className="story-levelup-emoji">📜</div>
                <h3>
                  {bug.name}に 「{name}」を おぼえさせる（{item.price}P）
                </h3>
                <p className="story-learn-q">どの わざと とりかえる？</p>
                <div className="story-learn-list">
                  {current.map((m, i) => (
                    <button
                      key={m.id + i}
                      className="story-learn-old"
                      onClick={() => learnScroll(item, move, mystery, bug, i)}
                    >
                      <span className="story-learn-old-name">
                        {m.emoji ?? '✨'} {m.name}
                      </span>
                      <span className="story-learn-old-sub">
                        {moveLabel(m)}／{m.uses}かい
                      </span>
                    </button>
                  ))}
                </div>
                <button className="btn btn-big" onClick={back}>
                  やめる
                </button>
              </div>
            </div>
          )
        })()}

      {/* ---- まきもの：おぼえた！ ---- */}
      {flow?.kind === 'learned' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
            <div className="story-levelup-emoji">{flow.move.ultimate ? '👑' : '✨'}</div>
            {flow.mystery && <p className="shop-reveal">????の しょうたいは…</p>}
            <h3>
              {flow.bug.name}は
              <br />
              「{flow.move.name}」を おぼえた！
            </h3>
            <div className={'story-learn-new' + (flow.move.ultimate ? ' ultimate' : '')}>
              <span className="story-learn-emoji">{flow.move.emoji ?? '✨'}</span>
              <span className="story-learn-name">{flow.move.name}</span>
              <span className="story-learn-sub">
                {moveLabel(flow.move)}／{flow.move.uses}かい つかえる
              </span>
              <p className="story-learn-desc">{flow.move.desc}</p>
            </div>
            {flow.replaced && (
              <p className="story-learn-q">（「{flow.replaced}」と とりかえたよ）</p>
            )}
            <button className="btn btn-big btn-primary" onClick={close}>
              やった！ 💪
            </button>
          </div>
        </div>
      )}

      {/* ---- ふしぎなアメの レベルアップ・わざ（ストーリーと おなじ がめん） ---- */}
      {head && (
        <CelebrationModal
          head={head}
          onNext={pop}
          onSwap={swapMove}
          onLearnUltimate={learnUltimate}
          onSkip={() => {
            sfx.tap()
            pop()
          }}
        />
      )}

      {bugs.length === 0 && (
        <p className="shop-note">
          ふしぎなアメ・まきものは 虫が いると つかえるよ。{' '}
          <button className="btn btn-ghost" onClick={onGoCapture}>
            むしを しらべる 🔎
          </button>
        </p>
      )}
    </div>
  )
}

// 虫の いちらん（ストーリーの あめと おなじ みため）
function BugRows({
  bugs,
  save,
  render,
}: {
  bugs: CaughtBug[]
  save: StorySave
  render: (b: CaughtBug) => React.ReactNode
}) {
  return (
    <ul className="story-cage-list">
      {bugs.map((b) => {
        const lv = levelOf(save, b.id).level
        const s = statsWithLevel(b, lv)
        return (
          <li key={b.id}>
            <img src={mainPhoto(b)} alt={b.name} />
            <span className="story-cage-name">
              {b.name}
              <b>Lv {lv}</b>
              <small className="shop-bug-stats">
                ❤️{s.hp} ⚔️{s.attack} 🛡️{s.defense} ⚡{s.speed}
              </small>
            </span>
            {render(b)}
          </li>
        )
      })}
    </ul>
  )
}

