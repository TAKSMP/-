// viewer.js（つるせ などの 大きい マップの エンジン）の かたち
export interface WorldMapData {
  schemaVersion: number
  id: string
  name?: string
  width: number
  height: number
  speed: number // 1びょうに あるく きょり（元画像の ピクセル）
  spawn: { x: number; y: number; facing?: string }
  images: { game: string; reference?: string }
  roadRuns: [number, number][]
}

// drawPlayer に わたってくる いまの じょうたい（x,y は がめんの ざひょう）
export interface WorldPlayerState {
  x: number
  y: number
  facing: string
  travel: number // あるいた きょり（元画像の ピクセル）
  moving: boolean
  zoom: number
}

export interface WorldHandle {
  getPosition(): { x: number; y: number }
  setPaused(value: boolean): void
  destroy(): void
}

export function mountWorld(
  host: HTMLElement,
  options: {
    map: WorldMapData
    gameUrl: string
    referenceUrl?: string
    signal?: AbortSignal
    onPosition?: (p: { x: number; y: number }) => void
    drawPlayer?: ((ctx: CanvasRenderingContext2D, s: WorldPlayerState) => void) | null
    startWalking?: boolean
  },
): Promise<WorldHandle>
