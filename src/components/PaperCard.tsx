// =============================================================
//  紙の ちょうむしカード（印刷した カードと おなじ デザイン）
// -------------------------------------------------------------
//  ・中身は 63×88mm の 紙の カードを そのまま つくって、width に あわせて ちぢめる
//  ・ながい なまえや せつめいは、紙と おなじく 字を ちいさく して わくに おさめる
//  ・ながおし（usePressCard）で 大きく 見られる
// =============================================================
import type React from 'react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Card } from '../lib/cardGame/cards'
import './PaperCard.css'

const MM = 96 / 25.4 // 1mm = 3.78px
const CARD_W = 63 * MM
const CARD_H = 88 * MM

const KIND: Record<string, [string, string]> = {
  attack: ['#e2513b', 'こうげき'],
  status: ['#8a54c8', 'じょうたい'],
  heal: ['#2f9e5b', 'かいふく'],
  power: ['#2f7fd0', 'のうりょく'],
}
const TIER_LABEL: Record<string, string> = { N: '', R: 'R レア', SR: 'SR スーパーレア', UR: 'UR ウルトラレア' }
const TIER_LEVEL: Record<string, number> = { R: 30, SR: 40, UR: 50 }
const N_COLOR = ['#6fae7a', '#e8f4ea']

// 紙と おなじ「字を ちいさく して おさめる」
function fit(root: HTMLElement) {
  const over = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 0.5
  const name = root.querySelector<HTMLElement>('.pc-name')
  if (name && !name.classList.contains('two')) {
    let s = 4.6
    while (name.scrollWidth > name.clientWidth && s > 2.6) {
      s -= 0.1
      name.style.fontSize = s + 'mm'
    }
    if (name.scrollWidth > name.clientWidth) {
      name.classList.add('two')
      name.style.fontSize = '3.4mm'
    }
  }
  for (const n of root.querySelectorAll<HTMLElement>('.pc-mn')) {
    let t = 3.0
    while (n.scrollWidth > n.clientWidth && t > 1.9) {
      t -= 0.1
      n.style.fontSize = t + 'mm'
    }
  }
  const mvs = [...root.querySelectorAll<HTMLElement>('.pc-mv')]
  const fitText = (mv: HTMLElement, min: number) => {
    const tx = mv.querySelector<HTMLElement>('.pc-tx')
    if (!tx) return
    let s = parseFloat(tx.style.fontSize) || 2.15
    while (over(mv) && s > min) {
      s -= 0.05
      tx.style.fontSize = s + 'mm'
    }
  }
  mvs.forEach((mv) => fitText(mv, 1.95))
  const ph = root.querySelector<HTMLElement>('.pc-photo')
  let h = 30
  while (ph && mvs.some(over) && h > 20) {
    h -= 1
    ph.style.height = h + 'mm'
    mvs.forEach((mv) => fitText(mv, 1.95))
  }
  mvs.forEach((mv) => fitText(mv, 1.6))
}

export interface PaperCardProps {
  card: Card
  photo?: string
  width: number // ひょうじ する はば（px）
  usesLeft?: number[]
  footNo?: string
  className?: string
  children?: ReactNode
}

export function PaperCard({ card, photo, width, usesLeft, footNo, className, children }: PaperCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) fit(ref.current)
  }, [card.key, card.moves.length])
  const t = card.tier
  const [oc, ol] = N_COLOR
  const scale = width / CARD_W
  const rarity = Math.max(0, Math.min(5, card.rarity ?? 0))
  return (
    <div className={`pc-wrap ${className ?? ''}`} style={{ width, height: CARD_H * scale }}>
      <div
        ref={ref}
        className={`pc-card ${t}`}
        style={{ transform: `scale(${scale})`, ['--oc' as string]: oc, ['--ol' as string]: ol }}
      >
        <div className="pc-inner">
          {t !== 'N' && <div className={`pc-badge ${t}`}>{TIER_LABEL[t]}</div>}
          <div className="pc-stars">
            {'★'.repeat(rarity)}
            <span style={{ color: '#e3d9c8' }}>{'★'.repeat(5 - rarity)}</span>
          </div>
          <div className="pc-top">
            <div className={`pc-name${card.name.length > 12 ? ' two' : ''}`}>
              {card.name}
              {t !== 'N' && <span className="pc-lv">レベル{TIER_LEVEL[t]}</span>}
            </div>
            <div className="pc-hp">
              <small>たいりょく</small>
              <b>{card.hp}</b>
            </div>
          </div>
          <div className="pc-photo">
            {photo ? <img src={photo} alt="" draggable={false} /> : null}
            <span className="pc-tag l">{card.order}</span>
            {card.habitat && <span className="pc-tag r">📍{card.habitat}</span>}
          </div>
          <div className="pc-stats">
            <div className="pc-st">
              💨すばやさ <b>{card.speed}</b>
            </div>
            <div className="pc-st">
              ⚔️こうげき <b>{card.basic}</b>
            </div>
          </div>
          <div className="pc-moves">
            {card.moves.map((m, i) => {
              const [kc, kl0] = KIND[m.kind] ?? KIND.power
              const kl = m.ultimate ? 'さいきょう' : kl0
              const left = usesLeft?.[i] ?? m.uses
              const big = String(m.big)
              const sym = [...big].some((ch) => ch.charCodeAt(0) > 0x2000) && big.length > 2
              const bigStyle = sym
                ? { fontSize: '3.2mm', letterSpacing: '-.3mm' }
                : big.length <= 2 || (big.startsWith('+') && big.length <= 3)
                  ? undefined
                  : { fontSize: '3.6mm' }
              return (
                <div key={i} className={`pc-mv${m.ultimate ? ' ult' : ''}${left <= 0 ? ' used' : ''}`} style={{ ['--kc' as string]: kc }}>
                  <div className="pc-ic">
                    <i>{m.emoji}</i>
                    <em>{kl}</em>
                  </div>
                  <div className="pc-body">
                    <div className="pc-mh">
                      <div className="pc-mn">{m.name}</div>
                      <span className="pc-uses">
                        {'●'.repeat(Math.max(0, left))}
                        <span className="off">{'●'.repeat(Math.max(0, m.uses - left))}</span>
                      </span>
                    </div>
                    <div className="pc-tx">{m.text}</div>
                  </div>
                  <div className="pc-big">
                    <span style={bigStyle}>{big}</span>
                    {m.bigUnit && <small>{m.bigUnit}</small>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="pc-foot">
            <span>
              <b>ちょうむしカード</b>
            </span>
            <span>
              <span className="pc-code">{t}</span>
              {footNo ?? ''}
            </span>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

// -------------------------------------------------------------
//  ながおしで 大きく 見る
// -------------------------------------------------------------
export function usePress(onLong: () => void, onTap?: () => void) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLong()
      }, 450)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
        return
      }
      onTap?.()
    },
  }
}

export function CardZoom({
  card,
  photo,
  usesLeft,
  footNo,
  onClose,
  children,
}: {
  card: Card
  photo?: string
  usesLeft?: number[]
  footNo?: string
  onClose: () => void
  children?: ReactNode
}) {
  const [w] = useState(() => Math.min(window.innerWidth - 48, 380))
  return (
    <div className="modal-backdrop pc-zoom" onClick={onClose}>
      <div className="pc-zoom-in" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>
        <PaperCard card={card} photo={photo} width={w} usesLeft={usesLeft} footNo={footNo} />
        {children}
      </div>
    </div>
  )
}

// ながおしで 大きく なる ちいさい カード
export function PressCard({
  card,
  photo,
  width,
  usesLeft,
  footNo,
  className,
  onTap,
  children,
  zoomExtra,
}: PaperCardProps & { onTap?: () => void; zoomExtra?: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const press = usePress(() => setOpen(true), onTap)
  return (
    <>
      <div className={`pc-press ${className ?? ''}`} {...press} role="button" tabIndex={0}>
        <PaperCard card={card} photo={photo} width={width} usesLeft={usesLeft} footNo={footNo}>
          {children}
        </PaperCard>
      </div>
      {open && (
        <CardZoom card={card} photo={photo} usesLeft={usesLeft} footNo={footNo} onClose={() => setOpen(false)}>
          {zoomExtra?.(() => setOpen(false))}
        </CardZoom>
      )}
    </>
  )
}
