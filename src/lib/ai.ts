import type { AiResult, BugSpecies } from '../types'
import { BUG_SPECIES } from '../data/bugs'

// =============================================================
//  ちょうむしAI
// -------------------------------------------------------------
//  写真をうけとって「なまえ・目・レア度・生息地」を判定します。
//
//  2つのモードがあります。
//   1) デモモード（そのまま遊べる）:
//      写真の色を解析して、いちばん近い虫を図鑑からえらびます。
//      緑っぽい写真ならバッタ、赤っぽければテントウムシ…という具合。
//   2) 本物AIモード（任意）:
//      Claude の画像認識APIをつかって、より本格的に判定します。
//      くわしくは README を見てね。
// =============================================================

// --- 写真から代表的な色（へいきん色）をとりだす --------------------
async function getAverageColor(
  dataUrl: string,
): Promise<{ r: number; g: number; b: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = 32 // 小さくして高速に解析
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve({ r: 128, g: 128, b: 128 })
        return
      }
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        // ほぼ白（背景）はむしして、虫の色をひろいやすくする
        const alpha = data[i + 3]
        if (alpha < 10) continue
        const isNearWhite =
          data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235
        if (isNearWhite) continue
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
        count++
      }
      if (count === 0) {
        resolve({ r: 128, g: 128, b: 128 })
        return
      }
      resolve({
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
      })
    }
    img.onerror = () => resolve({ r: 128, g: 128, b: 128 })
    img.src = dataUrl
  })
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2,
  )
}

// --- デモモード: 色から虫をえらぶ ------------------------------
async function analyzeWithDemo(dataUrl: string): Promise<AiResult> {
  const avg = await getAverageColor(dataUrl)

  // それぞれの虫と色の近さを計算し、近いものほど「候補」になりやすくする
  const scored = BUG_SPECIES.map((sp) => {
    const dist = colorDistance(avg, hexToRgb(sp.color))
    return { sp, dist }
  }).sort((a, b) => a.dist - b.dist)

  // いちばん近い3ひきから、すこしランダムにえらぶ（毎回おなじだとつまらない）
  const topN = scored.slice(0, 3)
  const pick = topN[Math.floor(Math.random() * topN.length)]
  const best = pick.sp

  // 自信度は色の近さから（近いほど高い）ざっくり計算
  const confidence = Math.max(
    0.55,
    Math.min(0.98, 1 - pick.dist / 300),
  )

  return {
    name: best.name,
    order: best.order,
    rarity: best.rarity,
    habitat: best.habitat,
    matchedSpeciesId: best.id,
    confidence,
  }
}

// --- 本物AIモード: Claude の画像認識をつかう -------------------
// APIキーがせっていされているときだけ動きます（README参照）。
// ブラウザからちょくせつよぶ場合、APIキーが見えてしまうので
// あくまで自分のパソコンで遊ぶ用です。
function getApiKey(): string | undefined {
  // .env の VITE_ANTHROPIC_API_KEY、または設定画面で入れたキー
  const fromEnv = import.meta.env.VITE_ANTHROPIC_API_KEY as
    | string
    | undefined
  const fromLocal =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('chomushi.apikey') || undefined
      : undefined
  return fromLocal || fromEnv
}

export function hasRealAi(): boolean {
  return Boolean(getApiKey())
}

async function analyzeWithClaude(dataUrl: string): Promise<AiResult> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('APIキーがありません')

  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new Error('画像のかたちがちがいます')
  const mediaType = match[1]
  const base64 = match[2]

  const orderList = Array.from(new Set(BUG_SPECIES.map((b) => b.order)))
  const habitatList = Array.from(
    new Set(BUG_SPECIES.map((b) => b.habitat)),
  )

  const prompt = `あなたは子ども向けの昆虫図鑑AIです。写真の虫を判定して、次のJSONだけを返してください。
{"name": "虫の名前(カタカナ)", "order": "目", "rarity": 1から5の整数, "habitat": "生息地", "confidence": 0から1の小数}
目は次から選ぶ: ${orderList.join(', ')}
生息地は次から選ぶ: ${habitatList.join(', ')}
JSON以外は書かないこと。`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!res.ok) throw new Error('AIのつうしんにしっぱいしました')
  const json = await res.json()
  const text: string = json?.content?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIのこたえがよめませんでした')
  const parsed = JSON.parse(jsonMatch[0])

  // 名前が図鑑にあれば ID をむすびつける
  const matched: BugSpecies | undefined = BUG_SPECIES.find(
    (b) => b.name === parsed.name,
  )

  return {
    name: String(parsed.name ?? 'なぞの虫'),
    order: String(parsed.order ?? 'ふめい'),
    rarity: Math.max(1, Math.min(5, Number(parsed.rarity) || 1)),
    habitat: String(parsed.habitat ?? 'ふめい'),
    matchedSpeciesId: matched?.id,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
  }
}

// --- メインの入口 ---------------------------------------------
export async function analyzePhoto(dataUrl: string): Promise<AiResult> {
  // 「かんがえてるフリ」の間（子どもがワクワクする演出用）
  const thinking = new Promise((r) => setTimeout(r, 1400))

  let result: AiResult
  if (hasRealAi()) {
    try {
      result = await analyzeWithClaude(dataUrl)
    } catch (e) {
      console.warn('本物AIがつかえないのでデモモードにきりかえます', e)
      result = await analyzeWithDemo(dataUrl)
    }
  } else {
    result = await analyzeWithDemo(dataUrl)
  }

  await thinking
  return result
}

// =============================================================
//  項目ごとの「AIに調べさせる」機能
// -------------------------------------------------------------
//  名前を訂正したあと、「目・レア度・生息地」のわからない所を
//  AIに調べさせて自動入力するためのもの。
//  まず図鑑データから名前で照合し、見つからなければ（本物AIモードなら）
//  Claudeに問い合わせます。
// =============================================================

export type LookupField = 'order' | 'rarity' | 'habitat'

export interface LookupResult {
  value: string | number
  // どうやって分かったか（表示用）
  source: 'zukan' | 'ai'
}

// ひらがな→カタカナに変換して、名前を照合しやすくする
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  )
}
function normalizeName(s: string): string {
  return toKatakana(s.trim().replace(/\s+/g, ''))
}

// 名前から図鑑データをさがす（完全一致→部分一致）
function findSpeciesByName(name: string): BugSpecies | undefined {
  const q = normalizeName(name)
  if (!q) return undefined
  const exact = BUG_SPECIES.find((b) => normalizeName(b.name) === q)
  if (exact) return exact
  return BUG_SPECIES.find((b) => {
    const n = normalizeName(b.name)
    return n.includes(q) || q.includes(n)
  })
}

async function lookupFieldWithClaude(
  name: string,
  field: LookupField,
): Promise<LookupResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const orderList = Array.from(new Set(BUG_SPECIES.map((b) => b.order)))
  const habitatList = Array.from(new Set(BUG_SPECIES.map((b) => b.habitat)))

  const question =
    field === 'order'
      ? `「${name}」という虫は なに目（もく）ですか。次のどれかから1つだけ選んで、目の名前だけを答えてください: ${orderList.join('、')}`
      : field === 'habitat'
        ? `「${name}」という虫は おもにどこにいますか。次のどれかから1つだけ選んで、生息地の名前だけを答えてください: ${habitatList.join('、')}`
        : `「${name}」という虫の めずらしさ（レア度）を1〜5の整数であらわすと いくつですか。数字だけを答えてください。`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 30,
      messages: [{ role: 'user', content: question }],
    }),
  })
  if (!res.ok) throw new Error('AIのつうしんにしっぱいしました')
  const json = await res.json()
  const text: string = (json?.content?.[0]?.text ?? '').trim()
  if (!text) return null

  if (field === 'rarity') {
    const m = text.match(/[1-5]/)
    if (!m) return null
    return { value: Number(m[0]), source: 'ai' }
  }
  // order / habitat: 候補リストに近いものへ寄せる
  const list = field === 'order' ? orderList : habitatList
  const hit = list.find((x) => text.includes(x)) ?? text
  return { value: hit, source: 'ai' }
}

// 名前をもとに、1つの項目（目 / レア度 / 生息地）を調べる。
// 見つからなければ null をかえす。
export async function lookupField(
  name: string,
  field: LookupField,
): Promise<LookupResult | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  // 演出用のちょっとした「かんがえてる」間
  const thinking = new Promise((r) => setTimeout(r, 700))

  // 1) まず図鑑データから照合
  const sp = findSpeciesByName(trimmed)
  let result: LookupResult | null = null
  if (sp) {
    const value =
      field === 'order'
        ? sp.order
        : field === 'habitat'
          ? sp.habitat
          : sp.rarity
    result = { value, source: 'zukan' }
  } else if (hasRealAi()) {
    // 2) 図鑑になければ、本物AIモードのときだけ問い合わせる
    try {
      result = await lookupFieldWithClaude(trimmed, field)
    } catch (e) {
      console.warn('AIの項目しらべにしっぱいしました', e)
      result = null
    }
  }

  await thinking
  return result
}
