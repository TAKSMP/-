// バトルクイズ 100もんを ぜんぶ エンジンで うごかして けんさ する
//   npx esbuild scripts/checkBattleQuiz.ts --bundle --platform=node --format=esm --outfile=/tmp/bq.mjs && node /tmp/bq.mjs
import { BATTLE_QUIZ } from '../src/data/battleQuiz'
import { moveOf, playQuizTurn, type Cast } from '../src/lib/battleQuiz'

const castOf = (n: string): Cast => ({ name: n, photo: '', bug: { id: n, name: n, order: '', rarity: 1, habitat: '', captures: [], mainCaptureId: '', corrected: false } })
const cast = { me: [castOf('ミー'), castOf('ミー2')], foe: [castOf('テキ'), castOf('テキ2')] }
const verbose = process.argv.includes('-v')
const only = process.argv.find((a) => /^\d+$/.test(a))
let errors = 0
const ids = new Set<number>()
for (const q of BATTLE_QUIZ) {
  if (only && q.id !== Number(only)) continue
  const err = (m: string) => { errors++; console.log(`❌ Q${q.id}: ${m}`) }
  if (ids.has(q.id)) err('id かぶり')
  ids.add(q.id)
  if (q.options.length !== 4) err('せんたくしが 4つ じゃない')
  if (new Set(q.options).size !== q.options.length) err('せんたくし かぶり')
  if (!q.options.includes(q.answer)) err('こたえが せんたくしに ない')
  for (const id of q.options) {
    try { moveOf(id) } catch { err(`わざ ${id} が ない`); continue }
    try {
      const n = playQuizTurn(q, cast, id).after
      const st = n.fighters.map((x) => `${x.name}${x.fainted ? '💫' : ''}${x.hp}/${x.maxHp}`).join(' ')
      const mark = id === q.answer ? '⭕' : '  '
      if (verbose || only) {
        console.log(`Q${q.id} ${mark} ${moveOf(id).name}  →  ${st}`)
        for (const l of n.log) console.log('      ' + l)
      } else {
        console.log(`Q${q.id} ${mark} ${moveOf(id).name.padEnd(12, '　')} ${st}`)
      }
    } catch (e) { err(`${id} で エラー: ${(e as Error).message}`) }
  }
}
console.log(errors === 0 ? `✅ ${ids.size}もん OK` : `❌ ${errors}こ の もんだい`)
