interface Props {
  value: number
  editable?: boolean
  onChange?: (v: number) => void
  size?: number
  max?: number // 星のかず（レア度は5、こうげき・ぼうぎょは10）
}

// 星（⭐）ひょうか。editable のときはタップでかえられる。
// max で星のかず（だんかい）をかえられる。
export function StarRating({
  value,
  editable,
  onChange,
  size = 28,
  max = 5,
}: Props) {
  return (
    <div className="stars" style={{ fontSize: size }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={'star' + (n <= value ? ' on' : '')}
          disabled={!editable}
          aria-label={`${n}`}
          onClick={() => editable && onChange?.(n)}
        >
          {n <= value ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  )
}
