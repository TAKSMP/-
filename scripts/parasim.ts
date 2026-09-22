// まひが ほんとうに きいているかを じっそく
import { makeFighter, createField, resolveTurn, effStat, type Fighter, type Field, type Command } from '../src/lib/battleEngine'
import { MOVE_LIBRARY } from '../src/lib/moveLibrary'
import type { CaughtBug } from '../src/types'

const shibire = MOVE_LIBRARY.find((m) => m.name === 'しびれのこな')!
const tackle = MOVE_LIBRARY.find((m) => m.kind === 'attack' && m.power >= 40 && !m.inflict && !m.chargeTurns && !m.hits)!
const bug = (id: string, name: string) => ({ id, name, order: 'コウチュウ目', rarity: 3, captures: [] } as unknown as CaughtBug)
const mk = (b: CaughtBug, side: 'me' | 'foe', uid: string, spd: number, moves: typeof tackle[]) =>
  makeFighter(b, { hp: 200, attack: 5, defense: 5, speed: spd, moves }, uid, side, '')

let applied = 0, fail = 0, acts = 0, orderFlip = 0, orderN = 0, cured = 0
const RUNS = 400
for (let r = 0; r < RUNS; r++) {
  // あいて（foe）は すばやさ 8、こちらは 6。まひで あいては 4 に なるはず
  let f: Field = createField([
    mk(bug('a', 'しびれ役'), 'me', 'me0', 6, [shibire, tackle]),
    mk(bug('b', 'あいて'), 'foe', 'foe0', 8, [tackle]),
  ])
  // 1ターンめ：しびれのこな
  f = resolveTurn(f, [
    { actorUid: 'me0', moveIndex: 0, targetUid: 'foe0' },
    { actorUid: 'foe0', moveIndex: 0, targetUid: 'me0' },
  ] as Command[])
  const foe = f.fighters.find((x) => x.uid === 'foe0')!
  if (foe.status?.key !== 'paralysis') continue
  applied++
  // 2〜9ターンめ：おたがい こうげき
  for (let t = 0; t < 8 && !f.over; t++) {
    const before = f.log.length
    f = resolveTurn(f, [
      { actorUid: 'me0', moveIndex: 1, targetUid: 'foe0' },
      { actorUid: 'foe0', moveIndex: 0, targetUid: 'me0' },
    ] as Command[])
    const lines = f.log.slice(0)
    const foeNow = f.fighters.find((x) => x.uid === 'foe0')!
    acts++
    if (lines.some((l) => l.includes('しびれて うごけない'))) fail++
    // じゅんばん：こちら（6）が さきに うごけば まひで あいてが おそく なっている
    const iMe = lines.findIndex((l) => l.startsWith('✨ しびれ役の「'))
    const iFoe = lines.findIndex((l) => l.startsWith('✨ あいての「') || l.includes('あいては しびれて'))
    if (iMe >= 0 && iFoe >= 0 && iMe < iFoe) orderFlip++
    if (iMe >= 0 && iFoe >= 0) orderN++
    if (!foeNow.status) cured++
    void before
  }
}
console.log(`しびれのこな で まひに なった: ${applied}/${RUNS}（めいちゅう90%）`)
console.log(`まひ中に うごけなかった: ${fail}/${acts} = ${(fail / acts * 100).toFixed(1)}%`)
console.log(`すばやさ 6 の こちらが さきに うごけた: ${orderFlip}/${orderN} = ${(orderFlip / orderN * 100).toFixed(1)}%（まひで あいて 8→4 なら 100%）`)
console.log(`しぜんに なおった: ${cured}/${acts}`)
const probe = makeFighter(bug('c','ためし'), { hp: 50, attack: 5, defense: 5, speed: 8, moves: [tackle] }, 'x', 'foe', '')
const s0 = effStat(probe as Fighter, 'speed'); probe.status = { key: 'paralysis', turnsLeft: 0 }
console.log(`effStat すばやさ: まひ前 ${s0} → まひ後 ${effStat(probe as Fighter, 'speed')}`)
