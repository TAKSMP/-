// =============================================================
//  あるける マップで むしに であうまでの じかん
// -------------------------------------------------------------
//  びょうで きめて、マップの あるく はやさ（speed）を かけて きょりにする。
//  ゆうゆう／アンビシャスは 94px/びょう、つるせは 12px/びょう と
//  はやさが ちがっても、であうまでの じかんは おなじに なる。
// =============================================================

// ふつうの であい（びょう）
export const ENCOUNTER_SEC: [number, number] = [6.6, 16]
// マップに 入った ちょくごは すこし ながく あるいてから
export const FIRST_ENCOUNTER_SEC: [number, number] = [9.6, 19]

const rand = ([min, max]: [number, number]) => min + Math.random() * (max - min)

// つぎに であうまでに あるく きょり（マップの ピクセル）
export function encounterDistance(speed: number, first = false): number {
  return rand(first ? FIRST_ENCOUNTER_SEC : ENCOUNTER_SEC) * speed
}
