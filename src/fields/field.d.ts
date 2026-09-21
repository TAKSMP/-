// field.js（ChatGPT作の 歩行フィールド エンジン）の かたち を TypeScript に つたえる。
// 中身は さわらず、そのまま つかう。
export interface FieldMapData {
  schemaVersion: number
  id: string
  name: string
  width: number
  height: number
  background: string
  spawn: { x: number; y: number; facing?: string }
  player: { radius: number; speed: number }
  camera: { mode: string; zoom: number; clampToMap: boolean }
  walkable: unknown
  obstacles: unknown[]
  zones: { id: string; name: string; type: string; x: number; y: number; width?: number; height?: number }[]
  notes?: string[]
}

export interface FieldZone {
  id: string
  name: string
  [key: string]: unknown
}

// drawPlayer に わたってくる いまの じょうたい
export interface FieldPlayerState {
  x: number
  y: number
  facing?: string
  travel: number // あるいた きょり（ピクセル）
  moving: boolean
}

export interface FieldHandle {
  getPosition(): { x: number; y: number; facing?: string }
  setPaused(value: boolean): void
  setDebug(value: boolean): void
  destroy(): void
}

export function createField(
  host: HTMLElement,
  options: {
    map: FieldMapData
    imageUrl?: string
    onZoneEnter?: (zone: FieldZone, position: { x: number; y: number }) => void
    drawPlayer?: ((ctx: CanvasRenderingContext2D, state: FieldPlayerState) => void) | null
    signal?: AbortSignal | null
  },
): Promise<FieldHandle>

export function canStand(map: FieldMapData, x: number, y: number, radius?: number): boolean
