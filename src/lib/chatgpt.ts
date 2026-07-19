// =============================================================
//  ChatGPT 取り込み
// -------------------------------------------------------------
//  ChatGPT Plus（有料版）を手作業でつかって虫を同定し、
//  その答えをアプリに取り込むための道具。
//  ・buildPrompt(): ChatGPTにわたす決まった形式の質問文
//  ・parseBugAnswer(): ChatGPTの答え(テキスト)を4項目に読み取る
//  ・shareToChatGPT(): 写真＋質問文をChatGPTに共有（スマホ）
// =============================================================
import { INSECT_ORDERS, canonicalOrder } from '../data/orders'

// AIチャットにおくる質問文。決まった形式で答えさせて、取り込みやすくする。
export function buildPrompt(): string {
  return `あなたは日本の昆虫にとてもくわしい先生です。
この写真の虫を、できるだけ「種」レベルの正確な和名で同定してください。
「カマキリ」ではなく「オオカマキリ」、「トンボ」ではなく「ギンヤンマ」のように、
具体的な種名で答えてください。

「生息地」と「説明」は、小さな子どもが読めるように、漢字をつかわず
ひらがなとカタカナだけで書いてください。よみやすいように、文節のくぎりに
半角スペースを入れてください。（「名前」はカタカナでOKです）

「目」は、かならず次の30分類のどれか1つで答えてください（この言葉をそのまま使う）:
${INSECT_ORDERS.join('、')}
（昆虫でない場合は 内顎類・甲殻類・多足類・クモガタ綱 のいずれか）

答えは、下の5行だけを ` +
    '```' +
    ` （コードブロック）で囲んで出力してください。
こうするとコピーボタンで全文をコピーできます。コードブロックの外には何も書かないでください。

` +
    '```' +
    `
名前: （種名・カタカナ）
目: （◯◯目）
レア度: （1〜5の数字。5がとてもめずらしい）
生息地: （かなだけ・みじかく。れい: くさはら）
説明: （その種ならではの特徴を40〜80字で。かなだけ・半角スペース区切り）
` +
    '```'
}

// 生息地だけをきく質問文（コピー＆貼り付け用）
export function buildHabitatPrompt(name: string): string {
  return `日本の昆虫「${name}」が おもに 見られる 生息地を、10文字ていどの みじかい ことばで おしえてください。
漢字はつかわず、ひらがなと カタカナだけで書いてください（れい: ぞうきばやし、いけや かわの ほとり）。
生息地の ことばだけを 返し、ほかの文は 書かないでください。`
}

// 説明文だけをきく質問文（コピー＆貼り付け用）
export function buildDescribePrompt(name: string): string {
  return `日本の昆虫「${name}」の、その虫ならではの とくちょうを、子ども向けに 40〜80字で せつめいしてください。
漢字はつかわず、ひらがなと カタカナだけで書き、よみやすいように 文節の くぎりに 半角スペースを 入れてください。
せつめいの 文だけを 返し、名前や 見出しは 書かないでください。`
}

// テキストをクリップボードにコピーするだけ（ひらかない）。
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// あたらしいタブで ChatGPT をひらくだけ（クリップボードは さわらない）。
export function openChatGPT(): void {
  window.open('https://chatgpt.com/', '_blank', 'noopener')
}

// 質問文をクリップボードにコピーして、AIチャット（ChatGPT）をひらく。
export async function askChatGPTText(prompt: string): Promise<boolean> {
  let copied = false
  try {
    await navigator.clipboard.writeText(prompt)
    copied = true
  } catch {
    /* コピーできなくても続行 */
  }
  window.open('https://chatgpt.com/', '_blank', 'noopener')
  return copied
}

export interface ParsedAnswer {
  name?: string
  order?: string
  rarity?: number
  habitat?: string
  fact?: string
}

// ラベル（例: 名前）の後ろの値をとりだす
function pickLine(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `^\\s*[*\\-・]?\\s*${label}\\s*[:：]\\s*(.+)$`,
      'm',
    )
    const m = text.match(re)
    if (m && m[1].trim()) return m[1].trim()
  }
  return undefined
}

// ChatGPTの答え（テキスト）を4項目＋説明に読み取る
export function parseBugAnswer(text: string): ParsedAnswer {
  const result: ParsedAnswer = {}

  const rawName = pickLine(text, ['名前', '和名', 'なまえ', '名称', '種名'])
  if (rawName) {
    // 「オオカマキリ（学名…）」などのカッコ以降をおとす
    result.name = rawName.replace(/[（(【].*$/, '').replace(/[。\s]+$/, '').trim()
  }

  const rawOrder = pickLine(text, ['目', 'もく', '分類'])
  if (rawOrder) {
    const m = rawOrder.match(/[ぁ-んァ-ヶ一-龠ー]+目/)
    const raw = m ? m[0] : rawOrder.trim()
    result.order = canonicalOrder(raw) ?? raw
  }

  const rawRarity = pickLine(text, ['レア度', 'レアド', 'めずらしさ', '珍しさ'])
  if (rawRarity) {
    const stars = (rawRarity.match(/[★⭐]/g) || []).length
    if (stars >= 1 && stars <= 5) result.rarity = stars
    else {
      const d = rawRarity.match(/[1-5]/)
      if (d) result.rarity = Number(d[0])
    }
  }

  const rawHabitat = pickLine(text, ['生息地', 'せいそくち', 'すみか', '場所'])
  if (rawHabitat) {
    result.habitat = rawHabitat.replace(/[。\s]+$/, '').trim()
  }

  const rawFact = pickLine(text, ['説明', 'せつめい', '特徴', '豆ちしき', 'メモ'])
  if (rawFact) {
    result.fact = rawFact.trim()
  }

  return result
}

// 読み取れた項目のかず（取り込みメッセージ用）
export function countParsed(p: ParsedAnswer): number {
  return [p.name, p.order, p.rarity, p.habitat].filter(
    (v) => v !== undefined && v !== '',
  ).length
}

// 写真＋質問文をChatGPTに共有する（スマホのシェア機能）。
// できないときは false をかえす（→呼び出し側でコピー＆ChatGPTを開く）。
export async function shareToChatGPT(
  photoDataUrl: string,
  prompt: string,
): Promise<boolean> {
  try {
    const blob = await (await fetch(photoDataUrl)).blob()
    const file = new File([blob], 'mushi.jpg', {
      type: blob.type || 'image/jpeg',
    })
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean
    }
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text: prompt })
      return true
    }
  } catch {
    // ユーザーがキャンセルした/未対応 → false
  }
  return false
}
