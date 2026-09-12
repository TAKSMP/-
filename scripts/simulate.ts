// 2体2バトルを 100かい まわして、エンジンが ちゃんと おわるか たしかめる
import type { CaughtBug } from '../src/types'
import { battleStatsV2 } from '../src/lib/battleSetup'
import {
  chooseCpuCommand,
  createField,
  makeFighter,
  resolveTurn,
  type Command,
  type Field,
} from '../src/lib/battleEngine'

function bug(name: string, order: string, rarity: number, fact: string): CaughtBug {
  return {
    id: 'id-' + name,
    name,
    order,
    rarity,
    habitat: 'くさむら',
    fact,
    captures: [],
    mainCaptureId: '',
    corrected: false,
  }
}

const roster = [
  bug('オオカマキリ', 'カマキリ目', 4, 'するどい かまで えものを つかまえる。'),
  bug('カブトムシ', 'コウチュウ目', 5, 'おおきな つのが じまん。じゅえきを すう。'),
  bug('オオスズメバチ', 'ハチ目', 5, 'つよい どくばりを もつ。'),
  bug('アゲハチョウ', 'チョウ目', 2, 'りんぷんの ある はねで とぶ。'),
  bug('ミイデラゴミムシ', 'コウチュウ目', 4, '100どの ガスを ふきだす。'),
  bug('ナナフシ', 'ナナフシ目', 3, 'えだに ぎたい して かくれる。'),
]

function build(bugs: CaughtBug[], side: 'me' | 'foe') {
  return bugs.map((b, i) =>
    makeFighter(b, battleStatsV2(b), `${side}${i}`, side, ''),
  )
}

let turnsTotal = 0
let meWins = 0
let maxTurns = 0
const RUNS = 200

for (let n = 0; n < RUNS; n++) {
  const pick = [...roster].sort(() => Math.random() - 0.5)
  let field: Field = createField([
    ...build(pick.slice(0, 2), 'me'),
    ...build(pick.slice(2, 4), 'foe'),
  ])
  let guard = 0
  while (!field.over && guard++ < 200) {
    const cmds: Command[] = field.fighters
      .filter((x) => !x.fainted)
      .map((x) => chooseCpuCommand(field, x))
    field = resolveTurn(field, cmds)
  }
  turnsTotal += field.turnCount
  maxTurns = Math.max(maxTurns, field.turnCount)
  if (field.winner === 'me') meWins++
  if (guard >= 200) console.log('⚠️ おわらなかった！')
}

console.log(`${RUNS}かい たいせん`)
console.log(`へいきん ターンすう: ${(turnsTotal / RUNS).toFixed(1)}`)
console.log(`さいだい ターンすう: ${maxTurns}`)
console.log(`me がわの しょうりつ: ${((meWins / RUNS) * 100).toFixed(1)}%`)

// 1かいぶん ログを 見る
const pick = [...roster].sort(() => Math.random() - 0.5)
let f: Field = createField([
  ...build(pick.slice(0, 2), 'me'),
  ...build(pick.slice(2, 4), 'foe'),
])
console.log('\n--- サンプル ---')
for (const x of f.fighters) {
  console.log(
    `${x.uid} ${x.name} HP${x.maxHp} こ${x.base.attack} ぼ${x.base.defense} す${x.base.speed} / ${x.moves.map((m) => m.name).join('・')}`,
  )
}
let g = 0
while (!f.over && g++ < 40) {
  const cmds: Command[] = f.fighters
    .filter((x) => !x.fainted)
    .map((x) => chooseCpuCommand(f, x))
  f = resolveTurn(f, cmds)
  console.log(`\n[ターン ${f.turnCount - 1}]`)
  for (const l of f.log) console.log('  ' + l)
}
console.log(`\nかち: ${f.winner}`)
