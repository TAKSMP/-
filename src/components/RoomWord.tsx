// =============================================================
//  つうしんの「あいことば」の ひょうじ と にゅうりょく
// -------------------------------------------------------------
//  ・へやを つくった がわ：おおきく ことばを 見せる（いみ・よみかた・つづりも きける）
//  ・はいる がわ：つづりを うつ。あっていたら いみが 出る（えいごの れんしゅう）
//  つうしんバトルと つうしんレースの どちらでも つかう。
// =============================================================
import { normalizeRoomCode, ROOM_CODE_MAX, roomWordInfo, speakRoomWord } from '../lib/roomWords'
import { sfx } from '../lib/sound'

export function RoomWordCard({ code, note }: { code: string; note?: string }) {
  const info = roomWordInfo(code)
  return (
    <div className="room-word">
      <span className="room-word-label">へやの あいことば{info ? '（えいご）' : ''}</span>
      <b className={'room-word-big' + (code.length > 6 ? ' long' : '')}>{code}</b>
      {info && (
        <>
          <span className="room-word-mean">
            {info.emoji} {code.toLowerCase()} ＝ {info.ja}
          </span>
          <div className="room-word-btns">
            <button
              type="button"
              onClick={() => {
                sfx.tap()
                speakRoomWord(code)
              }}
            >
              🔊 よみかた
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.tap()
                speakRoomWord(code, true)
              }}
            >
              🔤 つづり
            </button>
          </div>
        </>
      )}
      {note && <small>{note}</small>}
    </div>
  )
}

export function RoomWordInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const info = roomWordInfo(value)
  return (
    <div className="room-word-entry">
      <input
        className="room-word-input"
        value={value}
        maxLength={ROOM_CODE_MAX}
        placeholder="APPLE"
        lang="en"
        inputMode="text"
        enterKeyHint="go"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
      />
      {info ? (
        <p className="room-word-ok">
          {info.emoji} {info.ja} だね！
        </p>
      ) : (
        <p className="room-word-hint">ともだちの がめんに 出ている えいごの ことばを うってね</p>
      )}
    </div>
  )
}
