// =============================================================
//  マップに 出る むしを えらぶ（せってい）
// -------------------------------------------------------------
//  どの マップで どの虫に であうかを、図鑑から えらべる。
//  なにも えらばなければ、その ばしょで みつけた虫が 出る。
// =============================================================
import { useState } from 'react'
import { FIELDS } from '../data/fields'
import { loadZukan, mainPhoto } from '../lib/storage'
import {
  defaultBugsOfField,
  loadFieldBugs,
  setFieldBugs,
  type FieldBugs,
} from '../lib/fieldBugs'
import { sfx } from '../lib/sound'

export function FieldBugsModal({ onClose }: { onClose: () => void }) {
  const bugs = loadZukan()
  const [fieldId, setFieldId] = useState(FIELDS[0]?.id ?? '')
  const [sel, setSel] = useState<FieldBugs>(() => loadFieldBugs())

  const field = FIELDS.find((f) => f.id === fieldId)
  const chosen = sel[fieldId]
  const defaults = field ? defaultBugsOfField(field, bugs) : []
  const active = chosen ?? defaults.map((b) => b.id)

  function toggle(bugId: string) {
    sfx.tap()
    const next = active.includes(bugId)
      ? active.filter((id) => id !== bugId)
      : [...active, bugId]
    setSel(setFieldBugs(fieldId, next))
  }

  function useDefault() {
    sfx.tap()
    setSel(setFieldBugs(fieldId, defaults.map((b) => b.id)))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fieldbugs" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="とじる">
          ✕
        </button>
        <h2 className="modal-name">🗺️ マップに 出る むし</h2>

        {FIELDS.length > 1 && (
          <div className="foe-mode">
            {FIELDS.map((f) => (
              <button
                key={f.id}
                className={'chip' + (fieldId === f.id ? ' on' : '')}
                onClick={() => {
                  sfx.tap()
                  setFieldId(f.id)
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        <p className="fieldbugs-lead">
          <b>{field?.name}</b> で であう むしを えらんでね。
          <br />
          いま <b>{active.length}</b>ひき えらんでいます。
        </p>

        {bugs.length === 0 ? (
          <p className="story-recruit-sub">
            まだ 図鑑に むしが いないよ。「しらべる」で ふやしてね。
          </p>
        ) : (
          <div className="fieldbugs-grid">
            {bugs.map((b) => {
              const on = active.includes(b.id)
              return (
                <button
                  key={b.id}
                  className={'fieldbugs-item' + (on ? ' on' : '')}
                  onClick={() => toggle(b.id)}
                >
                  <img src={mainPhoto(b)} alt="" />
                  <span className="fieldbugs-name">{b.name}</span>
                  <span className="fieldbugs-check">{on ? '✅' : '➕'}</span>
                </button>
              )
            })}
          </div>
        )}

        <button className="btn btn-ghost fieldbugs-reset" onClick={useDefault}>
          🔄 {field?.place ? 'その ばしょで みつけた むし' : 'ずかんの むし ぜんぶ'}に もどす（
          {defaults.length}ひき）
        </button>
        <button className="btn btn-big btn-primary" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  )
}
