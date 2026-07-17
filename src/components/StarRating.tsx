interface Props {
  value: number // 1〜5
  editable?: boolean
  onChange?: (v: number) => void
  size?: number
}

// レア度をあらわす星（⭐）。editable のときはタップでかえられる。
export function StarRating({ value, editable, onChange, size = 28 }: Props) {
  return (
    <div className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={'star' + (n <= value ? ' on' : '')}
          disabled={!editable}
          aria-label={`レア度 ${n}`}
          onClick={() => editable && onChange?.(n)}
        >
          {n <= value ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  )
}
