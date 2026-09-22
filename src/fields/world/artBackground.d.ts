// artBackground.js（イラスト背景の 区画ローダー）の かたち。
// MAP/tsuruse-illustrated-v3/background.js を むかいへん なく そのまま つかう。
export interface ArtManifest {
  width: number
  height: number
  baseImage: string
  tiles: {
    id: string
    x: number
    y: number
    width: number
    height: number
    file?: string
    sourceRect?: [number, number, number, number]
  }[]
}

export interface ArtBackground {
  manifest: ArtManifest
  draw(
    ctx: CanvasRenderingContext2D,
    opts: {
      cx: number
      cy: number
      zoom: number
      width: number
      height: number
      dpr?: number
      originalOnly?: boolean
      boundaries?: boolean
    },
  ): void
  status(): { ready: boolean; loading: number; failed: number }
  destroy(): void
}

export function loadIllustratedMap(options: {
  baseUrl?: string
  manifest?: ArtManifest
  resolve?: (path: string) => string
  onChange?: () => void
}): Promise<ArtBackground>
