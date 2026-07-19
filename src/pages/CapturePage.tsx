import { useRef, useState } from 'react'
import type { AiResult, CaptureInput } from '../types'
import { analyzePhoto, hasRealAi } from '../lib/ai'
import {
  askChatGPTText,
  buildDescribePrompt,
  buildHabitatPrompt,
  buildPrompt,
  countParsed,
  parseBugAnswer,
} from '../lib/chatgpt'
import { compressImage } from '../lib/image'
import { readPhotoDate } from '../lib/exif'
import { dateInputToMs, msToDateInput, todayDateInput } from '../lib/format'
import { ALL_HABITATS, findSpeciesByName } from '../data/bugs'
import { INSECT_ORDERS } from '../data/orders'
import { StarRating } from '../components/StarRating'
import { Confetti } from '../components/Confetti'
import { CameraCapture } from '../components/CameraCapture'
import { sfx } from '../lib/sound'

type Phase = 'empty' | 'analyzing' | 'result' | 'error'

interface Props {
  // 保存して、すでにいる虫なら true（履歴に足した）をかえす
  onSaved: (input: CaptureInput) => boolean
  pastPlaces: string[] // これまで入力した「みつけたばしょ」の候補
  onOpenSettings: () => void
}

// 写真をよみこんで、AIが虫を判定するメインのページ。
export function CapturePage({ onSaved, pastPlaces, onOpenSettings }: Props) {
  const [phase, setPhase] = useState<Phase>('empty')
  const [photo, setPhoto] = useState<string>('')
  const [result, setResult] = useState<AiResult | null>(null)
  const [editing, setEditing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [saved, setSaved] = useState(false)
  const [merged, setMerged] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // へんしゅう中の4項目
  const [name, setName] = useState('')
  const [order, setOrder] = useState('')
  const [rarity, setRarity] = useState(3)
  const [habitat, setHabitat] = useState('')
  const [place, setPlace] = useState('') // みつけたばしょ
  const [foundDate, setFoundDate] = useState(todayDateInput()) // みつけた日
  // ChatGPT取り込み用
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [askMsg, setAskMsg] = useState('')
  // せつめい（説明文）。ChatGPT／手入力でつくる。
  const [fact, setFact] = useState('')
  const [descNote, setDescNote] = useState('') // 説明のコピー案内
  const [habNote, setHabNote] = useState('') // 生息地のコピー案内

  function reset() {
    setPhase('empty')
    setPhoto('')
    setResult(null)
    setEditing(false)
    setSaved(false)
    setMerged(false)
    setPlace('')
    setFoundDate(todayDateInput())
    setErrorMsg('')
    setImportText('')
    setImportMsg('')
    setAskMsg('')
    setFact('')
    setDescNote('')
    setHabNote('')
  }

  // 写真（dataURL）をうけとってAIにしらべてもらう。
  // ファイル読み込みでもカメラ撮影でも、ここにながれてくる。
  async function analyzeDataUrl(dataUrl: string) {
    // 保存・送信まえに小さく圧縮（容量オーバー防止）
    const small = await compressImage(dataUrl)
    setPhoto(small)
    setPhase('analyzing')
    try {
      const r = await analyzePhoto(small)
      setResult(r)
      setName(r.name)
      setOrder(r.order)
      setRarity(r.rarity)
      setHabitat(r.habitat)
      setFact(r.fact ?? '')
      setPhase('result')
      sfx.discover()
      setConfetti(true)
      setTimeout(() => setConfetti(false), 200)
    } catch (e) {
      // 本物AIモードで失敗したとき（キーちがい・通信エラーなど）は
      // 当てずっぽうを見せずに、エラーとして知らせる。
      console.warn('AI判定にしっぱい', e)
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setPhase('error')
      sfx.error()
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      sfx.error()
      alert('虫の写真をえらんでね📷')
      return
    }
    sfx.shutter()
    // 写真にうめこまれた撮影日(EXIF)があれば「みつけた日」に反映
    const shotMs = await readPhotoDate(file)
    setFoundDate(shotMs ? msToDateInput(shotMs) : todayDateInput())
    const reader = new FileReader()
    reader.onload = () => analyzeDataUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  function handleCameraCapture(dataUrl: string) {
    setCameraOpen(false)
    analyzeDataUrl(dataUrl)
  }

  function handleSave() {
    if (!photo) return
    // 訂正後の名前をもとに、図鑑データを引き直す。
    // これで説明文（豆ちしき）が「最初にAIが判定した虫」ではなく
    // 「訂正した虫」のものになる。名前が図鑑にないときは undefined。
    const matched = findSpeciesByName(name)
    const input: CaptureInput = {
      // 名前が図鑑になければ undefined（まちがった説明文が出ないように）
      speciesId: matched?.id,
      name: name.trim() || 'なぞの虫',
      order: order.trim() || 'ふめい',
      rarity,
      habitat: habitat.trim() || 'ふめい',
      // せつめい（AI／ChatGPT／手入力）。あれば保存して優先表示。
      fact: fact.trim() || undefined,
      photo,
      caughtAt: dateInputToMs(foundDate) ?? Date.now(),
      place: place.trim() || undefined,
      corrected: editing,
    }
    const wasMerged = onSaved(input)
    setMerged(wasMerged)
    sfx.discover()
    setConfetti(true)
    setSaved(true)
    setTimeout(() => setConfetti(false), 200)
  }

  // ① 質問文をコピーして、あたらしいタブでAIチャットをひらく
  //    （生息地・せつめいと同じやり方。写真は自分でつけてもらう）
  async function handleAskChatGPT() {
    sfx.tap()
    await askChatGPTText(buildPrompt())
    setAskMsg(
      '📋 しつもんをコピーしたよ。ひらいたAIチャット（ChatGPT / Claude など）に、この虫の写真をつけて、しつもんを はりつけて送ってね。答えは黒いわく（コードブロック）で出るので、そのコピーボタンでコピーして、下に はりつけ。',
    )
  }

  // ③ ChatGPTの答えを取り込んで、各項目に自動入力
  function handleImportAnswer() {
    const parsed = parseBugAnswer(importText)
    const n = countParsed(parsed)
    if (n === 0) {
      sfx.error()
      setImportMsg('うまく読み取れなかった…決まった形（名前: …）で答えてもらってね。')
      return
    }
    setEditing(true)
    if (parsed.name) setName(parsed.name)
    if (parsed.order) setOrder(parsed.order)
    if (parsed.rarity) setRarity(parsed.rarity)
    if (parsed.habitat) setHabitat(parsed.habitat)
    if (parsed.fact) setFact(parsed.fact)
    sfx.discover()
    setImportMsg(`✅ ${n}こうもくを取り込んだよ！ないようをたしかめて記録してね。`)
  }

  // 説明文の質問をコピーしてAIチャットをひらく（答えは せつめい欄にはりつけ）
  async function handleAskDescribe() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    await askChatGPTText(buildDescribePrompt(name))
    setDescNote(
      '📋 しつもんをコピーしたよ。AIチャットに はりつけて、こたえを ここに はりつけてね。',
    )
  }

  // 生息地の質問をコピーしてAIチャットをひらく（答えは 生息地欄にはりつけ）
  async function handleAskHabitat() {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    await askChatGPTText(buildHabitatPrompt(name))
    setHabNote(
      '📋 しつもんをコピーしたよ。AIチャットに はりつけて、こたえを 生息地に はりつけてね。',
    )
  }

  return (
    <div className="page capture">
      <Confetti show={confetti} />

      <header className="page-head">
        <h1>🔎 むしを しらべる</h1>
        <p className="sub">
          つかまえた虫の写真をよみこむと、AIがなまえをあててくれるよ！
        </p>
      </header>

      {/* --- 写真をえらぶ前 --- */}
      {phase === 'empty' && (
        <div className="dropzone">
          <div className="dropzone-emoji">📷</div>
          <p>カメラでとるか、写真をよみこんでね</p>
          <div className="capture-buttons">
            <button
              className="btn btn-big btn-camera"
              onClick={() => {
                sfx.tap()
                setCameraOpen(true)
              }}
            >
              📸 カメラでとる
            </button>
            <button
              className="btn btn-big btn-ghost"
              onClick={() => {
                sfx.tap()
                fileRef.current?.click()
              }}
            >
              🖼️ 写真をえらぶ
            </button>
          </div>
          {hasRealAi() && (
            <p className="hint mode-on">
              ✨ 本物AIモード：Claudeが種名まで判定するよ
            </p>
          )}
        </div>
      )}

      {/* --- 解析中 --- */}
      {phase === 'analyzing' && (
        <div className="analyzing">
          <img className="analyzing-photo" src={photo} alt="しらべ中の虫" />
          <div className="scanline" />
          <div className="analyzing-text">
            <span className="spinner">🔬</span> AIがしらべているよ…
          </div>
        </div>
      )}

      {/* --- エラー（本物AIモードで失敗） --- */}
      {phase === 'error' && (
        <div className="error-card">
          <div className="error-emoji">😵</div>
          <h2>AIがしらべられませんでした</h2>
          <p className="error-detail">{errorMsg}</p>
          <p className="error-hint">
            APIキーがまちがっているか、通信のちょうしがわるいのかも。
          </p>
          <div className="error-actions">
            <button className="btn btn-ghost" onClick={onOpenSettings}>
              ⚙️ AIせっていをひらく
            </button>
            <button className="btn btn-primary" onClick={reset}>
              もういちど
            </button>
          </div>
        </div>
      )}

      {/* --- けっか --- */}
      {phase === 'result' && result && (
        <div className="result">
          <div className="result-photo">
            <img src={photo} alt={name} />
            {result.demo ? (
              <button className="confidence demo" onClick={onOpenSettings}>
                デモ判定（色から推理）⚙️
              </button>
            ) : (
              <div className="confidence" title="AIの自信度">
                じしん {Math.round(result.confidence * 100)}%
              </div>
            )}
          </div>

          <div className="result-card">
            <div className="result-title">
              {editing ? (
                <input
                  className="name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="なまえ"
                />
              ) : (
                <h2>{name}</h2>
              )}
            </div>

            <dl className="fields">
              <div className="field">
                <dt>なまえ</dt>
                <dd>
                  {editing ? (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  ) : (
                    name
                  )}
                </dd>
              </div>

              <div className="field">
                <dt>目（もく）</dt>
                <dd>
                  {editing ? (
                    <select
                      className="order-select"
                      value={INSECT_ORDERS.includes(order) ? order : ''}
                      onChange={(e) => setOrder(e.target.value)}
                    >
                      <option value="" disabled>
                        えらんでね
                      </option>
                      {INSECT_ORDERS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    order
                  )}
                </dd>
              </div>

              <div className="field">
                <dt>レア度</dt>
                <dd>
                  <StarRating
                    value={rarity}
                    editable={editing}
                    onChange={setRarity}
                    size={24}
                  />
                </dd>
              </div>

              <div className="field">
                <dt>生息地</dt>
                <dd>
                  {editing ? (
                    <div className="field-edit">
                      <input
                        list="habitats"
                        value={habitat}
                        onChange={(e) => setHabitat(e.target.value)}
                      />
                      <button
                        type="button"
                        className="lookup-btn"
                        onClick={handleAskHabitat}
                      >
                        🤖 AIにきく（コピー）
                      </button>
                      {habNote && (
                        <span className="lookup-note">{habNote}</span>
                      )}
                    </div>
                  ) : (
                    habitat
                  )}
                </dd>
              </div>
            </dl>

            <datalist id="habitats">
              {ALL_HABITATS.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>

            {/* せつめい（訂正中は、AIにきく質問をコピーできる） */}
            {!saved && (
              <div className="desc-field">
                <div className="desc-head">
                  <label htmlFor="desc-input">📝 せつめい</label>
                  {editing && (
                    <button
                      type="button"
                      className="desc-btn"
                      onClick={handleAskDescribe}
                    >
                      🤖 AIにきく（コピー）
                    </button>
                  )}
                </div>
                {editing ? (
                  <textarea
                    id="desc-input"
                    className="desc-textarea"
                    value={fact}
                    onChange={(e) => setFact(e.target.value)}
                    rows={3}
                    placeholder="この虫の せつめい"
                  />
                ) : fact ? (
                  <p className="desc-text">{fact}</p>
                ) : (
                  <p className="desc-none">（せつめいは まだ ないよ）</p>
                )}
                {editing && descNote && <p className="desc-note">{descNote}</p>}
              </div>
            )}

            {/* みつけた日・みつけたばしょ */}
            {!saved && (
              <div className="place-field">
                <label htmlFor="found-date">📅 みつけた日</label>
                <input
                  id="found-date"
                  type="date"
                  className="date-input"
                  value={foundDate}
                  onChange={(e) => setFoundDate(e.target.value)}
                />
                <label htmlFor="place-input" className="place-label2">
                  📍 みつけたばしょ
                </label>
                <input
                  id="place-input"
                  list="places"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="れい: こうえん、にわ、がっこう"
                />
                <datalist id="places">
                  {pastPlaces.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            )}

            {/* AIチャットで正確にしらべて取り込む */}
            {!saved && (
              <details className="chatgpt-box">
                <summary>🤖 AIチャットでもっと正確にしらべる</summary>
                <p className="chatgpt-lead">
                  お手もちのAIチャット（ChatGPT / Claude など）でこの虫を同定して、
                  答えをここに取り込めます。答えはコピーボタン付きで出るようにしてあります。
                </p>
                <button className="btn btn-camera chatgpt-ask" onClick={handleAskChatGPT}>
                  ① 写真と質問をAIチャットへ 📤
                </button>
                {askMsg && <p className="chatgpt-note">{askMsg}</p>}
                <p className="chatgpt-step">
                  ② 答えの黒いわくのコピーボタンでコピーして、下に貼り付け👇
                </p>
                <textarea
                  className="chatgpt-textarea"
                  placeholder={'名前: オオカマキリ\n目: カマキリ目\nレア度: 3\n生息地: 草はら\n説明: …'}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={5}
                />
                <button
                  className="btn btn-primary chatgpt-import"
                  onClick={handleImportAnswer}
                  disabled={!importText.trim()}
                >
                  ③ 取り込む ⬇️
                </button>
                {importMsg && <p className="chatgpt-note">{importMsg}</p>}
              </details>
            )}

            {!saved && (
              <div className="result-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    sfx.tap()
                    setEditing((e) => !e)
                  }}
                >
                  {editing ? '✅ なおしおわり' : '✏️ まちがいをなおす'}
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  📖 図鑑にきろく！
                </button>
              </div>
            )}

            {saved && (
              <div className="saved-banner">
                <div className="saved-emoji">🎉</div>
                {merged ? (
                  <p>
                    「{name}」は もう図鑑にいたよ！
                    <br />
                    きょうの写真を きろくに ついかしたよ 📸
                  </p>
                ) : (
                  <p>「{name}」を図鑑にきろくしたよ！</p>
                )}
                <button className="btn btn-big" onClick={reset}>
                  つぎの虫をしらべる 🔎
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}
