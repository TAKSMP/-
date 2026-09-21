// どの虫を つかうかで かちりつが どれだけ かわるか
import { buildQuestStage, statsWithLevel, movesOf, bugPower, type StorySave } from '../src/lib/story'
import { makeFighter, createField, resolveTurn, chooseCpuCommand, type Fighter, type Field, type Command } from '../src/lib/battleEngine'
import type { CaughtBug } from '../src/types'
import { readFileSync } from 'node:fs'
const BACKUP = process.env.ZUKAN ?? ''
if (!BACKUP) throw new Error('ZUKAN=<バックアップJSONのパス> を してい してください')
const raw = JSON.parse(readFileSync(BACKUP, 'utf8'))
const bugs: CaughtBug[] = (raw.data?.zukan ?? []).map((b: CaughtBug) => ({ ...b, captures: [] }))
const save: StorySave = { levels:{}, cleared:{}, goal:{}, seen:{}, moves:{}, cage:[] }
const sf = (b: CaughtBug, lv: number) => ({ ...statsWithLevel(b, lv), moves: movesOf(save, b, lv) })
const STAGE = Number(process.env.STAGE ?? 19) // 0はじまり
const st = buildQuestStage(bugs, STAGE)
const boss = st.cells.filter(c => c.kind === 'battle').pop()!
const e = bugs.find(b => b.id === boss.bugId)!
const ea = boss.allyBugId ? bugs.find(b => b.id === boss.allyBugId)! : null
const byPower = [...bugs].sort((a,b) => bugPower(b) - bugPower(a))
function rate(hero: CaughtBug, mate: CaughtBug, lv: number, runs = 80) {
  let w = 0
  for (let k = 0; k < runs; k++) {
    const mine: Fighter[] = [makeFighter(hero, sf(hero, lv), 'me0','me',''), makeFighter(mate, sf(mate, lv), 'me1','me','')]
    const foes: Fighter[] = [makeFighter(e, sf(e, boss.level ?? 1), 'foe0','foe','')]
    if (ea) foes.push(makeFighter(ea, sf(ea, boss.allyLevel ?? 1), 'foe1','foe',''))
    let f: Field = createField([...mine, ...foes]); let g = 0
    while (!f.over && g++ < 200) f = resolveTurn(f, f.fighters.filter(x=>!x.fainted).map(x=>chooseCpuCommand(f,x)) as Command[])
    if (f.winner === 'me') w++
  }
  return Math.round(w / runs * 100)
}
console.log(`ステージ${STAGE+1} てき: ${e.name} Lv${boss.level}${ea?` ＋ ${ea.name} Lv${boss.allyLevel}`:''}`)
console.log('つかう虫（つよさ順 上位12）を Lv20で ためす:')
const rows = byPower.slice(0, 12).map(h => ({ n: h.name, r: rate(h, byPower.find(x=>x.id!==h.id)!, 20) }))
rows.sort((a,b)=>b.r-a.r)
for (const r of rows) console.log(`  ${String(r.r).padStart(3)}%  ${r.n}`)
console.log(`いちばん よい くみあわせ: ${rows[0].r}% / いちばん わるい: ${rows[rows.length-1].r}%`)
