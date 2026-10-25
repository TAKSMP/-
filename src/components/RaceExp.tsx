// =============================================================
//  レースで もらった けいけんちを 見せる パネル
// -------------------------------------------------------------
//  3いまでの ときだけ でる。レベルが あがったら おおきく しらせる。
// =============================================================
import type { BugLevel } from '../lib/story'
import { expToNext, MAX_LEVEL } from '../lib/story'

export interface RaceExpInfo {
  name: string
  rank?: number // じゅんい（1〜3）
  gain: number
  before: BugLevel
  after: BugLevel
  levelUps: number
}

export function RaceExpPanel({ info }: { info: RaceExpInfo }) {
  const { after } = info
  const maxed = after.level >= MAX_LEVEL
  const need = expToNext(after.level)
  const pct = maxed ? 100 : Math.min(100, Math.round((after.exp / need) * 100))
  return (
    <div className={'race-exp' + (info.levelUps > 0 ? ' up' : '')}>
      <p className="race-exp-gain">
        ✨ {info.rank ? `${info.rank}いの ごほうび！ ` : ''}{info.name}は けいけんち <b>{info.gain}</b> を もらった！
      </p>
      {info.levelUps > 0 && (
        <p className="race-exp-up">
          🎉 レベルが {info.levelUps > 1 && <b>{info.levelUps}つ </b>}あがった！ Lv{info.before.level} →{' '}
          <b>Lv{after.level}</b>
        </p>
      )}
      <div className="race-exp-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="race-exp-sub">
        {maxed ? 'レベルは もう さいだい！' : `Lv${after.level}　つぎの レベルまで あと ${need - after.exp}`}
      </p>
    </div>
  )
}
