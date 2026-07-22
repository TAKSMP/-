import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// アプリのどこかで エラーが おきても、まっしろ画面にしない。
// やさしいメッセージと「もういちど ひらく」ボタンを出す。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: unknown) {
    console.error('アプリのエラー:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
            fontFamily:
              "'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', system-ui, sans-serif",
            color: '#2f3a24',
          }}
        >
          <div style={{ fontSize: 54 }}>🐛💦</div>
          <h2 style={{ margin: 0 }}>アプリの ちょうしが わるいみたい…</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            いちど とじて、もういちど ひらいてみてね。
            <br />
            あつめた虫の きろくは きえないよ。
          </p>
          <button
            onClick={() => {
              location.reload()
            }}
            style={{
              marginTop: 8,
              border: 'none',
              background: '#7cc36a',
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
              padding: '12px 22px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            🔄 もういちど ひらく
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
