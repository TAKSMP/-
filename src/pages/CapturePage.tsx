import { useRef, useState } from 'react'
import type { AiResult, CaughtBug } from '../types'
import type { LookupField } from '../lib/ai'
import { analyzePhoto, hasRealAi, lookupField } from '../lib/ai'
import { ALL_HABITATS, ALL_ORDERS, findSpeciesByName } from '../data/bugs'
import { StarRating } from '../components/StarRating'
import { Confetti } from '../components/Confetti'
import { CameraCapture } from '../components/CameraCapture'
import { sfx } from '../lib/sound'

type Phase = 'empty' | 'analyzing' | 'result' | 'error'

interface Props {
  onSaved: (bug: CaughtBug) => void
  onOpenSettings: () => void
}

// 写真をよみこんで、AIが虫を判定するメインのページ。
export function CapturePage({ onSaved, onOpenSettings }: Props) {
  const [phase, setPhase] = useState<Phase>('empty')
  const [photo, setPhoto] = useState<string>('')
  const [result, setResult] = useState<AiResult | null>(null)
  const [editing, setEditing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // へんしゅう中の4項目
  const [name, setName] = useState('')
  const [order, setOrder] = useState('')
  const [rarity, setRarity] = useState(3)
  const [habitat, setHabitat] = useState('')
  // 「AIに調べさせる」中の項目と、みつからなかった項目
  const [lookingUp, setLookingUp] = useState<LookupField | null>(null)
  const [notFound, setNotFound] = useState<LookupField | null>(null)

  function reset() {
    setPhase('empty')
    setPhoto('')
    setResult(null)
    setEditing(false)
    setSaved(false)
    setLookingUp(null)
    setNotFound(null)
    setErrorMsg('')
  }

  // 写真（dataURL）をうけとってAIにしらべてもらう。
  // ファイル読み込みでもカメラ撮影でも、ここにながれてくる。
  async function analyzeDataUrl(dataUrl: string) {
    setPhoto(dataUrl)
    setPhase('analyzing')
    try {
      const r = await analyzePhoto(dataUrl)
      setResult(r)
      setName(r.name)
      setOrder(r.order)
      setRarity(r.rarity)
      setHabitat(r.habitat)
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

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      sfx.error()
      alert('虫の写真をえらんでね📷')
      return
    }
    sfx.shutter()
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
    const bug: CaughtBug = {
      id: `bug_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      // 名前が図鑑になければ undefined（まちがった説明文が出ないように）
      speciesId: matched?.id,
      name: name.trim() || 'なぞの虫',
      order: order.trim() || 'ふめい',
      rarity,
      habitat: habitat.trim() || 'ふめい',
      // AIが名前を変えずに判定した種の説明があれば、それを保存して優先表示する
      fact:
        result && !editing && result.name === name.trim()
          ? result.fact
          : undefined,
      photo,
      caughtAt: Date.now(),
      corrected: editing,
    }
    onSaved(bug)
    sfx.discover()
    setConfetti(true)
    setSaved(true)
    setTimeout(() => setConfetti(false), 200)
  }

  // なまえをもとに、1つの項目（目 / レア度 / 生息地）をAIに調べさせて自動入力する
  async function handleLookup(field: LookupField) {
    if (!name.trim()) {
      sfx.error()
      alert('さきに「なまえ」を入れてね🐛')
      return
    }
    sfx.tap()
    setNotFound(null)
    setLookingUp(field)
    const res = await lookupField(name, field)
    setLookingUp(null)
    if (!res) {
      setNotFound(field)
      sfx.error()
      return
    }
    if (field === 'order') setOrder(String(res.value))
    else if (field === 'habitat') setHabitat(String(res.value))
    else setRarity(Number(res.value))
    sfx.discover()
  }

  // 各項目についている「AIに調べさせる」ボタン
  function lookupButton(field: LookupField) {
    const busy = lookingUp === field
    return (
      <button
        type="button"
        className="lookup-btn"
        disabled={lookingUp !== null}
        onClick={() => handleLookup(field)}
        title="なまえをもとにAIが調べて自動で入れるよ"
      >
        {busy ? (
          <>
            <span className="spinner">🔎</span> しらべ中…
          </>
        ) : (
          <>🤖 AIに調べさせる</>
        )}
      </button>
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
          {hasRealAi() ? (
            <p className="hint mode-on">
              ✨ 本物AIモード：Claudeが種名まで判定するよ
            </p>
          ) : (
            <button className="mode-warn" onClick={onOpenSettings}>
              ⚠️ いまはデモモード（色から推理するだけ）です。
              <br />
              <b>正確に判定するには、ここをタップしてAIキーを設定 ⚙️</b>
            </button>
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
                    <div className="field-edit">
                      <input
                        list="orders"
                        value={order}
                        onChange={(e) => setOrder(e.target.value)}
                      />
                      {lookupButton('order')}
                      {notFound === 'order' && (
                        <span className="lookup-miss">
                          わからなかった…なまえを見なおしてね
                        </span>
                      )}
                    </div>
                  ) : (
                    order
                  )}
                </dd>
              </div>

              <div className="field">
                <dt>レア度</dt>
                <dd>
                  {editing ? (
                    <div className="field-edit">
                      <StarRating
                        value={rarity}
                        editable={editing}
                        onChange={setRarity}
                        size={24}
                      />
                      {lookupButton('rarity')}
                      {notFound === 'rarity' && (
                        <span className="lookup-miss">
                          わからなかった…なまえを見なおしてね
                        </span>
                      )}
                    </div>
                  ) : (
                    <StarRating value={rarity} size={24} />
                  )}
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
                      {lookupButton('habitat')}
                      {notFound === 'habitat' && (
                        <span className="lookup-miss">
                          わからなかった…なまえを見なおしてね
                        </span>
                      )}
                    </div>
                  ) : (
                    habitat
                  )}
                </dd>
              </div>
            </dl>

            <datalist id="orders">
              {ALL_ORDERS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            <datalist id="habitats">
              {ALL_HABITATS.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>

            {!saved && (
              <div className="result-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    sfx.tap()
                    setNotFound(null)
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
                <p>「{name}」を図鑑にきろくしたよ！</p>
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
