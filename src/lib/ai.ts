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
