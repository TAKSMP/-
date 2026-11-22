// =============================================================
//  ちょうむしカード の みため（紙の カードと おなじ デザイン）
//  ・CardFace … カード 1まい ぜんぶ（わざの せつめい つき）
//  ・CardMini … デッキえらびの ちいさい カード
// =============================================================
import type { Card, CardMove } from '../lib/cardGame/cards'
import { TIER_INFO } from '../lib/cardGame/cards'
import { orderEmoji } from '../data/orders'

const KIND_LABEL: Record<CardMove['kind'], string> = { attack: 'こうげき', status: 'じょうたい', heal: 'かいふく', power: 'パワー' }

export function UsesDots({ total, left }: { total: number; left?: number }) {
  const l = left ?? total
  return (
    <span className="cg-dots" aria-label={`のこり ${l}かい`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < l ? 'on' : 'off'} />
      ))}
    </span>
  )
}

export function MoveBox({ m, left, compact }: { m: CardMove; left?: number; compact?: boolean }) {
  return (
    <div className={`cg-move k-${m.kind}${m.ultimate ? ' ult' : ''}${left === 0 ? ' used' : ''}`}>
      <span className="cg-move-ic">
        <b>{m.emoji}</b>
        {!compact && <small>{m.ultimate ? 'さいきょう' : KIND_LABEL[m.kind]}</small>}
      </span>
      <span className="cg-move-body">
        <span className="cg-move-head">
          <b className="cg-move-name">
            {m.ultimate && '👑'}
            {m.name}
          </b>
          <UsesDots total={m.uses} left={left} />
        </span>
        <span className="cg-move-text">{m.text}</span>
      </span>
      <span className={`cg-move-big${m.big.length > 3 ? ' small' : ''}`}>
        {m.big}
        {m.bigUnit && <small>{m.bigUnit}</small>}
      </span>
    </div>
  )
}

export function TierBadge({ tier }: { tier: Card['tier'] }) {
  return <span className={`cg-tier t-${tier}`}>{tier}</span>
}

export function CardFace({ card, photo, usesLeft }: { card: Card; photo?: string; usesLeft?: number[] }) {
  const lv = TIER_INFO[card.tier].level
  return (
    <div className={`cg-card t-${card.tier}`}>
      <div className="cg-card-in">
        <div className="cg-card-head">
          <TierBadge tier={card.tier} />
          <b className={`cg-card-name${card.name.length > 9 ? ' long' : ''}`}>{card.name}</b>
          {card.tier !== 'N' && <span className="cg-card-lv">レベル{lv}</span>}
          <span className="cg-card-hp">
            <small>たいりょく</small>
            {card.hp}
          </span>
        </div>
        <div className="cg-card-photo">
          {photo ? <img src={photo} alt={card.name} /> : <span className="cg-card-nophoto">{orderEmoji(card.order)}</span>}
          <span className="cg-card-order">
            {orderEmoji(card.order)} {card.order}
          </span>
        </div>
        <div className="cg-card-stats">
          <span>💨すばやさ <b>{card.speed}</b></span>
          <span>⚔️こうげき <b>{card.basic}</b></span>
        </div>
        <div className="cg-card-moves">
          {card.moves.map((m, i) => (
            <MoveBox key={m.id + i} m={m} left={usesLeft?.[i]} />
          ))}
        </div>
        <div className="cg-card-foot">
          <span>ちょうむしカード</span>
          <span>{TIER_INFO[card.tier].label}</span>
        </div>
      </div>
    </div>
  )
}

export function CardMini({
  card,
  photo,
  selected,
  disabled,
  onClick,
  badge,
}: {
  card: Card
  photo?: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  badge?: string
}) {
  return (
    <button
      type="button"
      className={`cg-mini t-${card.tier}${selected ? ' sel' : ''}${disabled ? ' dis' : ''}`}
      onClick={onClick}
    >
      <span className="cg-mini-photo">
        {photo ? <img src={photo} alt="" /> : orderEmoji(card.order)}
        <TierBadge tier={card.tier} />
        {badge && <span className="cg-mini-badge">{badge}</span>}
      </span>
      <span className="cg-mini-name">{card.name}</span>
      <span className="cg-mini-stat">
        ❤️{card.hp} 💨{card.speed}
      </span>
    </button>
  )
}
