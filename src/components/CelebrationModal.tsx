// =============================================================
//  レベルアップ／あたらしい わざ の がめん（ショップ用）
// -------------------------------------------------------------
//  ストーリーモード（StoryPage の levelUpModal / learnModal）と おなじ みため・ながれ。
//  ・レベルアップ：ステータスの かわりかたを 見せる
//  ・わざ：わくが あいて いれば そのまま おぼえる／いっぱいなら どれと とりかえるか えらぶ
//  ・さいきょうわざ：べつわくに おぼえる
// =============================================================
import type { Celebration } from '../lib/celebrations'
import { moveLabel } from '../lib/celebrations'

interface Props {
  head: Celebration
  onNext: () => void // レベルアップの がめんを とじる
  onSwap: (index: number) => void // この ばんごうの わざと とりかえる（わくが あいて いれば ついか）
  onLearnUltimate: () => void
  onSkip: () => void // おぼえない
}

export function CelebrationModal({ head, onNext, onSwap, onLearnUltimate, onSkip }: Props) {
  if (head.kind === 'level') {
    const levelUp = head.info
    return (
      <div className="modal-backdrop" onClick={onNext}>
        <div className="modal story-levelup" onClick={(e) => e.stopPropagation()}>
          <div className="story-levelup-emoji">⭐</div>
          <h3>レベルアップ！</h3>
          <div className="story-levelup-head">
            <img src={levelUp.photo} alt={levelUp.name} />
            <span>
              <b>{levelUp.name}</b>
              <br />
              Lv {levelUp.fromLv} <span className="story-arrow">▶</span>{' '}
              <b className="story-levelup-new">Lv {levelUp.toLv}</b>
            </span>
          </div>
          <ul className="story-statlist">
            {levelUp.rows.map((r) => {
              const up = r.to - r.from
              return (
                <li key={r.label} className={up > 0 ? 'up' : ''}>
                  <span className="story-stat-name">
                    {r.emoji} {r.label}
                  </span>
                  <span className="story-stat-val">
                    {r.from} <span className="story-arrow">▶</span> <b>{r.to}</b>
                    {up > 0 ? (
                      <em className="story-stat-up">+{up}</em>
                    ) : (
                      <em className="story-stat-same">かわらず</em>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <button className="btn btn-big btn-primary" onClick={onNext}>
            つよくなった！ 💪
          </button>
        </div>
      </div>
    )
  }

  const learn = head.info
  return (
    <div className="modal-backdrop">
      <div className="modal story-learn" onClick={(e) => e.stopPropagation()}>
        <div className="story-levelup-emoji">{learn.move.ultimate ? '👑' : '✨'}</div>
        <h3>
          {learn.name}は
          <br />
          {learn.move.ultimate
            ? 'さいきょう ひっさつわざを おぼえた！'
            : learn.forcedIndex !== null
              ? 'あたらしい わざを おぼえた！'
              : 'あたらしい わざを おぼえられる！'}
        </h3>
        <div className={'story-learn-new' + (learn.move.ultimate ? ' ultimate' : '')}>
          <span className="story-learn-emoji">{learn.move.emoji ?? '✨'}</span>
          <span className="story-learn-name">{learn.move.name}</span>
          <span className="story-learn-sub">
            {moveLabel(learn.move)}／{learn.move.uses}かい つかえる
          </span>
          <p className="story-learn-desc">{learn.move.desc}</p>
        </div>
        {learn.move.ultimate ? (
          <>
            <p className="story-learn-q">さいきょうわざは いまの わざ とは べつに ふえるよ！</p>
            <button className="btn btn-big btn-primary" onClick={onLearnUltimate}>
              やった！ 👑
            </button>
          </>
        ) : learn.forcedIndex !== null ? (
          <button
            className="btn btn-big btn-primary"
            onClick={() => onSwap(learn.forcedIndex as number)}
          >
            やった！ 💪
          </button>
        ) : (
          <>
            <p className="story-learn-q">どの わざと とりかえる？</p>
            <div className="story-learn-list">
              {learn.current.map((m, i) => (
                <button key={m.id + i} className="story-learn-old" onClick={() => onSwap(i)}>
                  <span className="story-learn-old-name">
                    {m.emoji ?? '✨'} {m.name}
                  </span>
                  <span className="story-learn-old-sub">
                    {moveLabel(m)}／{m.uses}かい
                  </span>
                </button>
              ))}
            </div>
            <button className="btn btn-big" onClick={onSkip}>
              おぼえない
            </button>
          </>
        )}
      </div>
    </div>
  )
}
