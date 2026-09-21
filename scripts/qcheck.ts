import { buildQuestStage, QUEST_MAPS, QUEST_PER_MAP } from '../src/lib/story'
import { parkName } from '../src/components/ParkScene'
import type { CaughtBug } from '../src/types'
const NAMES = ['アリ','ダンゴムシ','ナナホシテントウ','モンシロチョウ','アキアカネ','ショウリョウバッタ','アブラゼミ','コクワガタ','クロアゲハ','オオカマキリ','ノコギリクワガタ','カブトムシ','オニヤンマ','オオスズメバチ','ミヤマクワガタ','ゲンジボタル','スズムシ','キリギリス','トノサマバッタ','ミンミンゼミ','ルリタテハ','アカタテハ','オオムラサキ','ギンヤンマ','タガメ','ナナフシ','ハンミョウ','カナブン','タマムシ','ヒグラシ','ツクツクボウシ','エンマコオロギ','ジョロウグモ','オオゴマダラ','アオスジアゲハ','キアゲハ','クマバチ','ミツバチ','アメンボ','ゲンゴロウ','マイマイカブリ','オサムシ','ヒメアカタテハ','ツマグロヒョウモン','クロオオアリ','シオカラトンボ','ハグロトンボ','カワトンボ','コミスジ','イチモンジチョウ','セスジスズメ','オオミズアオ','ヤママユ','カイコガ','キリギリスモドキ','コガネムシ']
const bugs: CaughtBug[] = NAMES.map((name, i) => ({
  id: 'b' + i, name, order: 'コウチュウ目', rarity: (i % 5) + 1,
  habitat: '', emoji: '🐛', memo: '', captures: [], createdAt: 0,
} as unknown as CaughtBug))
console.log(`虫 ${bugs.length}ひき / ステージ ${QUEST_MAPS}`)
const seen = new Set<number>()
for (let i = 0; i < QUEST_MAPS; i++) {
  const st = buildQuestStage(bugs, i)
  const fights = st.cells.filter((c) => c.kind === 'battle')
  const lv = fights.map((c) => c.level ?? 0)
  const allies = fights.filter((c) => c.allyBugId).length
  const names = fights.map((c) => bugs.find((b) => b.id === c.bugId)?.name ?? '?')
  seen.add(st.sceneIndex)
  const uniq = new Set(names).size
  console.log(
    `S${String(i + 1).padStart(2)} Lv${String(Math.min(...lv)).padStart(2)}〜${String(Math.max(...lv)).padStart(2)} ` +
    `2ひき${allies}/${QUEST_PER_MAP} 絵${String(st.sceneIndex).padStart(2)}=${parkName(st.sceneIndex)} ` +
    `ちがう虫${uniq}/${QUEST_PER_MAP} ${names.join('・')}`)
}
console.log(`つかった 絵の しゅるい: ${seen.size}`)
