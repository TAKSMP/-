import { useEffect, useState } from 'react'

// 「はっけん！」のときにパーッとちらばる紙吹雪。
const PIECES = 40
const EMOJIS = ['🎉', '✨', '🌟', '🐛', '🦋', '🍃', '⭐']

interface Piece {
  id: number
  left: number
  delay: number
  duration: number
  emoji: string
  drift: number
}

export function Confetti({ show }: { show: boolean }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!show) {
      setPieces([])
      return
    }
    const next: Piece[] = Array.from({ length: PIECES }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.2,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      drift: (Math.random() - 0.5) * 120,
    }))
    setPieces(next)
    const t = setTimeout(() => setPieces([]), 3200)
    return () => clearTimeout(t)
  }, [show])

  if (pieces.length === 0) return null

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
