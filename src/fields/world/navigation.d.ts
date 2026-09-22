import type { WorldMapData } from './viewer'
export function decodeRoads(map: WorldMapData): Uint8Array
export function isRoad(map: WorldMapData, mask: Uint8Array, x: number, y: number): boolean
