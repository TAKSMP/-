// =============================================================
//  むしとりチャレンジ：目（order）から うごきの パターンを きめる
// -------------------------------------------------------------
//  ・とんでるパターン：ふわふわ うろうろ とびまわる
//  ・はねるパターン：じめんで じっとして、ときどき ジャンプ
//  ・とまってるパターン：それ以外 ぜんぶ。木に とまって うごかない
//  あたらしい 目が ふえても、下の リストに 入れなければ
//  自動で「とまってる」パターンに なる（＝あとから 追加しやすい）。
// =============================================================
export type CatchPattern = 'flying' | 'hopping' | 'perched'

const FLYING_ORDERS = new Set(['チョウ目', 'トンボ目', 'ハエ目', 'ハチ目', 'アミメカゲロウ目'])
const HOPPING_ORDERS = new Set(['バッタ目'])

export function catchPatternForOrder(order: string): CatchPattern {
  if (FLYING_ORDERS.has(order)) return 'flying'
  if (HOPPING_ORDERS.has(order)) return 'hopping'
  return 'perched'
}
