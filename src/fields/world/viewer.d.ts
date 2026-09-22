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

// 区画（タイル）の いちらん：tiles.json
export interface TileManifest {
  version: number
  tileSize: number // 1区画の 大きさ（元画像の ピクセル）
  pixelsPerSourceUnit: number
  width: number
  height: number
  columns: number
  rows: number
  background?: string
  tiles: { x: number; y: number; file: string; width: number; height: number }[]
}

export interface TileStatus {
  cached: number
  loading: number
  failed: number
  ready: boolean // いま 見えている 区画が ぜんぶ そろったか
}

export interface WorldHandle {
  getPosition(): { x: number; y: number }
  getTileStatus(): TileStatus
  getMode(): 'overview' | 'walk'
  // true：全体地図（赤い てんめつマーカーで いまの いちを しめす）／false：あるく がめんに もどる
  setOverview(value: boolean): void
  setPaused(value: boolean): void
  destroy(): void
}

export function mountWorld(
  host: HTMLElement,
  options: {
    map: WorldMapData
    gameUrl: string
    referenceUrl?: string
    tileManifest: TileManifest
    tileBaseUrl?: string
    resolveTile?: (file: string) => string
    loadTile?: (url: string, signal: AbortSignal) => Promise<CanvasImageSource & { close?: () => void }>
    // イラスト背景（loadIllustratedMap の けっか）。artScale は
    // イラストざひょう ÷ もとの map座標 の ひりつ（例：1307/2048）
    artBg?: ArtBackground | null
    artScale?: number
    walkZoom?: number
    signal?: AbortSignal
    onPosition?: (p: { x: number; y: number }) => void
    drawPlayer?: ((ctx: CanvasRenderingContext2D, s: WorldPlayerState) => void) | null
    startWalking?: boolean
  },
): Promise<WorldHandle>
