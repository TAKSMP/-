// =============================================================
//  レース画面の パーツ（ひとりで／つうしん どちらでも つかう）
// =============================================================
import type { CaughtBug } from '../types'
import { mainPhoto } from '../lib/storage'
import { cageOf, levelOf, statsWithLevel, type StorySave } from '../lib/story'
import { cruiseOf, tankOf, type RacerInit } from '../lib/raceEngine'
import { EFFECT_INFO, raceMoveDesc } from '../lib/raceMoves'
import type { RaceResult } from './RaceTrack'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣']

// ゲージの ながさ（0〜1）
const cruiseBar = (c: number) => Math.max(0.06, Math.min(1, (c - cruiseOf(1)) / (cruiseOf(50) - cruiseOf(1))))
const tankBar = (t: number) => Math.max(0.06, Math.min(1, (t - 4) / 10))

// そだてた虫（レベルが たかい・むしかご）を さきに ならべる
export function sortForRace(bugs: CaughtBug[], save: StorySave): CaughtBug[] {
  const cage = new Set(cageOf(save))
  return [...bugs].sort(
    (a, b) =>
      levelOf(save, b.id).level - levelOf(save, a.id).level || Number(cage.has(b.id)) - Number(cage.has(a.id)),
  )
}

export function MyBugGrid({ bugs, save, onPick }: { bugs: CaughtBug[]; save: StorySave; onPick: (b: CaughtBug) => void }) {
  return (
    <div className="race-pick-grid">
      {sortForRace(bugs, save).map((b) => {
        const lv = levelOf(save, b.id).level
        const s = statsWithLevel(b, lv)
        return (
          <button key={b.id} className="race-pick" onClick={() => onPick(b)}>
            <img src={mainPhoto(b)} alt={b.name} loading="lazy" />
            <span className="race-pick-lv">Lv {lv}</span>
            <span className="race-pick-name">{b.name}</span>
            <span className="race-pick-stats">
              💨{s.speed} ❤️{s.hp}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function MyRacerCard({ me, compact }: { me: RacerInit; compact?: boolean }) {
  return (
    <div className="race-me-card">
      <div className="race-me-head">
        <img src={me.photo} alt={me.name} />
        <div>
          <div className="race-me-name">⭐ {me.name}</div>
          <div className="race-me-lv">Lv {me.level}</div>
        </div>
      </div>
      <div className="race-stat">
        <span>💨 ゆっくり スピード</span>
        <div className="race-stat-bar">
          <div style={{ width: cruiseBar(cruiseOf(me.speedStat)) * 100 + '%' }} />
        </div>
        <small>すばやさ {me.speedStat}</small>
      </div>
      <div className="race-stat">
        <span>🔥 アクセル ゲージ</span>
        <div className="race-stat-bar gauge">
          <div style={{ width: tankBar(tankOf(me.hpStat)) * 100 + '%' }} />
        </div>
        <small>たいりょく {me.hpStat}</small>
      </div>
      {!compact && (
        <div className="race-moves">
          <div className="race-moves-title">🎁を とると つかえる わざ</div>
          {me.moves.map((m) => (
            <div key={m.id} className={'race-move' + (m.ultimate ? ' ult' : '')}>
              <span className="race-move-emoji">{m.emoji}</span>
              <span className="race-move-body">
                <b>{m.name}</b>
                <span className="race-move-kind">
                  {EFFECT_INFO[m.effect].emoji} {EFFECT_INFO[m.effect].label}
                </span>
                <small>{raceMoveDesc(m)}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RaceHowto() {
  return (
    <div className="race-howto">
      <p>
        🔥 <b>アクセル</b>を おしている あいだ はやく なるよ。でも たいりょくが へるよ。
      </p>
      <p>✋ はなすと たいりょくが もどるよ。おさなくても ゆっくり すすむよ。</p>
      <p>
        🎁 <b>？</b>の はこを とると わざが つかえるよ。
      </p>
    </div>
  )
}

export function LapPicker({ laps, onLaps }: { laps: number; onLaps?: (n: number) => void }) {
  return (
    <div className="race-laps">
      <span>なんしゅう？</span>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          className={'race-lap-btn' + (laps === n ? ' on' : '')}
          disabled={!onLaps}
          onClick={() => onLaps?.(n)}
        >
          {n}しゅう
        </button>
      ))}
    </div>
  )
}

export function RaceResults({
  results,
  racers,
  viewerId,
}: {
  results: RaceResult[]
  racers: RacerInit[]
  viewerId: string
}) {
  const byId = new Map(racers.map((r) => [r.id, r]))
  const mine = results.find((r) => r.id === viewerId)
  const me = byId.get(viewerId)
  const top = byId.get(results[0]?.id ?? '')
  return (
    <>
      {mine?.rank === 1 ? (
        <p className="race-result-msg win">🎉 きみの「{me?.name}」が 1い！</p>
      ) : (
        <p className="race-result-msg">
          1いは「{top?.name}」{top?.tag && !top.tag.startsWith('CPU') ? `（${top.tag}）` : ''}！ きみの虫は {mine?.rank}い だったよ
        </p>
      )}
      <div className="race-rank-list">
        {results.map((r, i) => {
          const info = byId.get(r.id)
          if (!info) return null
          return (
            <div key={r.id} className={'race-rank-item' + (r.id === viewerId ? ' mine' : '')}>
              <span className="race-rank-medal">{MEDALS[i] ?? i + 1 + 'い'}</span>
              <img src={info.photo} alt={info.name} />
              <span className="race-rank-name">
                {info.name} <small>Lv{info.level}</small>
                {info.tag && <span className="race-rank-tag">{r.id === viewerId ? 'きみ' : info.tag}</span>}
              </span>
              <span className="race-rank-time">{r.time.toFixed(1)}びょう</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
