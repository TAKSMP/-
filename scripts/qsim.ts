// 30ステージの むずかしさを じっそく：プレイヤーの かちりつと ターンすう
import {
  buildQuestStage, statsWithLevel, movesOf, bugPower, QUEST_MAPS, MAX_LEVEL,
  type StorySave,
} from '../src/lib/story'
import {
  makeFighter, createField, resolveTurn, chooseCpuCommand,
  type Fighter, type Field, type Command,
} from '../src/lib/battleEngine'
import type { CaughtBug } from '../src/types'
import { readFileSync } from 'node:fs'

// ほんものの ずかんデータ（バックアップ）で ためす
const BACKUP = process.env.ZUKAN ?? ''
if (!BACKUP) throw new Error('ZUKAN=<バックアップJSONのパス> を してい してください')
const raw = JSON.parse(readFileSync(BACKUP, 'utf8'))
const bugs: CaughtBug[] = (raw.data?.zukan ?? []).map((b: CaughtBug) => ({
  ...b,
  captures: [], // しゃしんは おもいので すてる
}))
const save: StorySave = { levels: {}, cleared: {}, goal: {}, seen: {}, moves: {}, cage: [] }
const statsFor = (b: CaughtBug, lv: number) => ({ ...statsWithLevel(b, lv), moves: movesOf(save, b, lv) })

// つかう虫で かちりつが 14%〜98% も かわるので、
// じょうい12ひきから 6くみを えらんで へいきんを とる。
const byPower = [...bugs].sort((a, b) => bugPower(b) - bugPower(a))
const TEAMS = [0, 2, 4, 6, 8, 10].map((i) => [byPower[i], byPower[i + 1]] as const)
const RUNS = 40 // 1くみ あたり（6くみ ぶん）
console.log(`ほんものの ずかん: ${bugs.length}ひき / ${TEAMS.length}くみの へいきん`)
console.log('ステージ  プレイヤーLv  てきLv      かちりつ(さいてい〜さいこう) ターン  てき')
for (let i = 0; i < QUEST_MAPS; i++) {
  const st = buildQuestStage(bugs, i)
  const boss = st.cells.filter((c) => c.kind === 'battle').pop()!
  // レベルは ふつうに すすめた ときの めやす（ステージ+2、さいだい20）
  const myLv = Math.min(MAX_LEVEL, i + 3)
  let wins = 0, turns = 0, n = 0
  const perTeam: number[] = []
  for (const [hero, buddy] of TEAMS) {
   let tw = 0
   for (let k = 0; k < RUNS; k++) {
    n++
    const mine: Fighter[] = [
      makeFighter(hero, statsFor(hero, myLv), 'me0', 'me', ''),
      makeFighter(buddy, statsFor(buddy, myLv), 'me1', 'me', ''),
    ]
    const e = bugs.find((b) => b.id === boss.bugId)!
    const foes: Fighter[] = [makeFighter(e, statsFor(e, boss.level ?? 1), 'foe0', 'foe', '')]
    const ea = boss.allyBugId ? bugs.find((b) => b.id === boss.allyBugId) : null
    if (ea) foes.push(makeFighter(ea, statsFor(ea, boss.allyLevel ?? 1), 'foe1', 'foe', ''))
    let f: Field = createField([...mine, ...foes])
    let g = 0
    while (!f.over && g++ < 200) {
      const cmds: Command[] = f.fighters.filter((x) => !x.fainted).map((x) => chooseCpuCommand(f, x))
      f = resolveTurn(f, cmds)
    }
    if (f.winner === 'me') { wins++; tw++ }
    turns += f.turnCount - 1
   }
   perTeam.push(Math.round((tw / RUNS) * 100))
  }
  console.log(
    `S${String(i + 1).padStart(2)}       Lv${String(myLv).padStart(2)}        Lv${String(boss.level).padStart(2)}${boss.allyBugId ? '+なかま' : '      '}   ` +
    `${String(Math.round((wins / n) * 100)).padStart(3)}%(${String(Math.min(...perTeam)).padStart(3)}〜${String(Math.max(...perTeam)).padStart(3)})  ${(turns / n).toFixed(1).padStart(4)}   ${bugs.find((b) => b.id === boss.bugId)?.name ?? '?'}`)
}
