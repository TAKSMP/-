import type { AiResult } from '../types'
import { BUG_SPECIES, findSpeciesByName } from '../data/bugs'
import { INSECT_ORDERS, canonicalOrder } from '../data/orders'

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

  // デモは「色からの当てずっぽう」なので自信度は低めに固定する
  return {
    name: best.name,
    order: best.order,
    rarity: best.rarity,
    habitat: best.habitat,
    fact: best.fact,
    matchedSpeciesId: best.id,
    confidence: 0.3,
    demo: true,
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

  const prompt = `あなたは日本の昆虫学にくわしい、プロの昆虫同定AIです。
この写真にうつっている虫を、できるだけ「種」レベルまで正確に同定してください。
このアプリのユーザーは昆虫にとてもくわしい子どもなので、こどもだましは禁物です。

大事なルール:
- 名前は「カマキリ」「トンボ」のような大きな総称ではなく、
  「オオカマキリ」「チョウセンカマキリ」「ギンヤンマ」「アキアカネ」のような
  具体的な和名（種名）で答えること。近縁で区別がむずかしい場合は、
  最も可能性が高い種名を答え、confidenceを下げること。
- 目（もく）は、かならず次の30分類のどれか1つで答えること（この中の言葉をそのまま使う）:
  ${INSECT_ORDERS.join('、')}
  （昆虫でない場合は、内顎類・甲殻類・多足類・クモガタ綱 のいずれかを使う）
- rarity は日本での見つけやすさを1(ふつう)〜5(とてもめずらしい)で。
- habitat と fact は、小さな子どもが読めるように「ひらがな」と「カタカナ」だけで書くこと。
  漢字は絶対につかわない。よみやすいように、文節の くぎりに 半角スペースを いれること。
  （例: habitat →「くさはら」「ぞうきばやし」「いけや かわの ほとり」）
- fact は、その「種」に合った正確で楽しい説明を、40〜80字で。
  一般論ではなく、その種ならではの特徴を書くこと（もちろん漢字なし・半角スペース区切り）。
- name はカタカナの種名、order は「◯◯目」でよい（この2つは漢字OK）。
- わからない場合は name を "不明" にし、confidence を低くすること。推測ででっちあげない。

次のJSONだけを返す。JSON以外の文字は一切書かない:
{"name":"種名(カタカナ)","order":"◯◯目","rarity":1,"habitat":"せいそくち(かなのみ)","fact":"せつめい(かなのみ)","confidence":0.0}`

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
      max_tokens: 500,
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

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AIのつうしんにしっぱいしました (${res.status}) ${detail}`)
  }
  const json = await res.json()
  const text: string = json?.content?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AIのこたえがよめませんでした')
  const parsed = JSON.parse(jsonMatch[0])

  // AIの種名が図鑑データにあれば ID をむすびつける（説明や生息地の参考に）
  const matched = findSpeciesByName(String(parsed.name ?? ''))

  return {
    name: String(parsed.name ?? '不明'),
    // 30分類のどれかに寄せる（余計な文字がついていても正規化）
    order: canonicalOrder(String(parsed.order ?? '')) ?? String(parsed.order ?? 'ふめい'),
    rarity: Math.max(1, Math.min(5, Math.round(Number(parsed.rarity)) || 1)),
    habitat: String(parsed.habitat ?? 'ふめい'),
    fact: parsed.fact ? String(parsed.fact) : undefined,
    matchedSpeciesId: matched?.id,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
  }
}

// --- メインの入口 ---------------------------------------------
export async function analyzePhoto(dataUrl: string): Promise<AiResult> {
  // 「かんがえてるフリ」の間（子どもがワクワクする演出用）
  const thinking = new Promise((r) => setTimeout(r, 1000))

  // 本物AIモードのときは、失敗してもデモに「すりかえ」ない。
  // まちがった当てずっぽうを正解のように見せないため、エラーはそのまま投げる。
  if (hasRealAi()) {
    const result = await analyzeWithClaude(dataUrl)
    await thinking
    return result
  }

  const result = await analyzeWithDemo(dataUrl)
  await thinking
  return result
}

// --- APIキーの管理（設定画面からつかう） ----------------------
export function getApiKeyMasked(): string | null {
  const key = getApiKey()
  if (!key) return null
  if (key.length <= 12) return '••••'
  return key.slice(0, 8) + '••••' + key.slice(-4)
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) localStorage.setItem('chomushi.apikey', trimmed)
  else localStorage.removeItem('chomushi.apikey')
}

export function clearApiKey(): void {
  localStorage.removeItem('chomushi.apikey')
}

// =============================================================
//  説明文だけをAIに書かせる（名前にあわせて）
// -------------------------------------------------------------
//  訂正した名前をもとに、その虫の説明文（せつめい）を自動生成する。
//  本物AIモードならClaudeが書き、そうでなければ図鑑データの説明でおぎなう。
// =============================================================
async function describeWithClaude(name: string): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const question = `日本の昆虫「${name}」について、その種ならではの特徴を、子ども向けに40〜80字で説明してください。
漢字はつかわず、ひらがなとカタカナだけで書き、よみやすいように文節のくぎりに半角スペースを入れてください。
一般論ではなく、その虫らしい特徴を書くこと。説明の文だけを返し、名前や「説明:」などの見出しは書かないでください。`

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
      max_tokens: 200,
      messages: [{ role: 'user', content: question }],
    }),
  })
  if (!res.ok) throw new Error('AIのつうしんにしっぱいしました')
  const json = await res.json()
  const text: string = (json?.content?.[0]?.text ?? '').trim()
  // 前後のカギカッコなどを軽くそうじ
  return text.replace(/^[「『]|[」』]$/g, '').trim() || null
}

async function suggestHabitatWithClaude(name: string): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  const question = `日本の昆虫「${name}」が主に見られる生息地を、10文字ていどの短い言葉だけで答えてください。
漢字はつかわず、ひらがなとカタカナだけで書くこと（例: ぞうきばやし、いけや かわの ほとり）。
生息地の言葉だけを返し、見出しやほかの文字は書かないでください。`
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
      max_tokens: 40,
      messages: [{ role: 'user', content: question }],
    }),
  })
  if (!res.ok) throw new Error('AIのつうしんにしっぱいしました')
  const json = await res.json()
  const text: string = (json?.content?.[0]?.text ?? '').trim()
  return text.replace(/[。「」\n]/g, '').trim() || null
}

// 名前から生息地を提案する。わからなければ null。
export async function suggestHabitat(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const thinking = new Promise((r) => setTimeout(r, 700))
  let result: string | null = null
  if (hasRealAi()) {
    try {
      result = await suggestHabitatWithClaude(trimmed)
    } catch (e) {
      console.warn('AIの生息地しらべにしっぱいしました', e)
      result = null
    }
  }
  if (!result) {
    result = findSpeciesByName(trimmed)?.habitat ?? null
  }
  await thinking
  return result
}

// 名前から説明文をつくる。かけなければ null。
export async function describeBug(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const thinking = new Promise((r) => setTimeout(r, 700))
  let result: string | null = null

  // 1) 本物AIモードなら、Claudeに書かせる
  if (hasRealAi()) {
    try {
      result = await describeWithClaude(trimmed)
    } catch (e) {
      console.warn('AIの説明づくりにしっぱいしました', e)
      result = null
    }
  }

  // 2) だめなら図鑑データの説明でおぎなう
  if (!result) {
    const sp = findSpeciesByName(trimmed)
    result = sp?.fact ?? null
  }

  await thinking
  return result
}
