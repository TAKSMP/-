import type { CaptureInput, CaughtBug } from '../types'
import { normalizeBugName } from '../data/bugs'

// 図鑑（つかまえた虫の記録）はブラウザの localStorage に保存します。
// これでページをとじても、あつめた虫がきえません。
const STORAGE_KEY = 'chomushi.zukan.v1'

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// 古い形式（写真1枚だけの記録）を、新しい形式（撮影履歴つき）に変換する。
function migrate(raw: unknown): CaughtBug | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  // すでに新形式
  if (Array.isArray(r.captures) && r.captures.length > 0) {
    const mainId =
      typeof r.mainCaptureId === 'string'
        ? r.mainCaptureId
        : (r.captures[0] as { id: string }).id
    return { ...(r as unknown as CaughtBug), mainCaptureId: mainId }
  }

  // 旧形式（photo / caughtAt をもつ）
  if (typeof r.photo === 'string') {
    const capId = `${String(r.id ?? 'c')}_0`
    return {
      id: String(r.id ?? uid('bug')),
      speciesId: typeof r.speciesId === 'string' ? r.speciesId : undefined,
      name: String(r.name ?? 'なぞの虫'),
      order: String(r.order ?? 'ふめい'),
      rarity: Number(r.rarity) || 1,
      habitat: String(r.habitat ?? 'ふめい'),
      fact: typeof r.fact === 'string' ? r.fact : undefined,
      captures: [
        {
          id: capId,
          photo: r.photo,
          caughtAt: Number(r.caughtAt) || Date.now(),
        },
      ],
      mainCaptureId: capId,
      corrected: Boolean(r.corrected),
    }
  }
  return null
}

export function loadZukan(): CaughtBug[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const migrated = data
      .map(migrate)
      .filter((b): b is CaughtBug => b !== null)
    // 形が変わっていたら保存しなおす
    if (JSON.stringify(migrated) !== raw) saveZukan(migrated)
    return migrated
  } catch {
    return []
  }
}

export function saveZukan(bugs: CaughtBug[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bugs))
  } catch (e) {
    // 容量オーバーなどで保存できなくても、ポップアップは出さない（静かにログだけ）
    console.warn('図鑑の保存に失敗しました', e)
  }
}

// 1回ぶんの撮影を記録する。
// おなじ名前の虫がすでにいれば、その虫の履歴に写真をついかする（merged）。
// いなければ、あたらしい虫として作る。
export function recordCapture(input: CaptureInput): {
  bugs: CaughtBug[]
  merged: boolean
  bugId: string
} {
  const list = loadZukan()
  const cap = {
    id: uid('cap'),
    photo: input.photo,
    caughtAt: input.caughtAt,
  }
  const key = normalizeBugName(input.name)
  const idx = key
    ? list.findIndex((b) => normalizeBugName(b.name) === key)
    : -1

  if (idx >= 0) {
    const existing = list[idx]
    const updated: CaughtBug = {
      ...existing,
      // 足りていなかった情報だけ、あたらしい判定でおぎなう
      order: existing.order && existing.order !== 'ふめい' ? existing.order : input.order,
      habitat:
        existing.habitat && existing.habitat !== 'ふめい'
          ? existing.habitat
          : input.habitat,
      fact: existing.fact || input.fact,
      captures: [cap, ...existing.captures], // あたらしい順
      corrected: existing.corrected || input.corrected,
    }
    const bugs = [updated, ...list.filter((_, i) => i !== idx)]
    saveZukan(bugs)
    return { bugs, merged: true, bugId: updated.id }
  }

  const bug: CaughtBug = {
    id: uid('bug'),
    speciesId: input.speciesId,
    name: input.name,
    order: input.order,
    rarity: input.rarity,
    habitat: input.habitat,
    fact: input.fact,
    captures: [cap],
    mainCaptureId: cap.id,
    corrected: input.corrected,
  }
  const bugs = [bug, ...list]
  saveZukan(bugs)
  return { bugs, merged: false, bugId: bug.id }
}

// メイン画像につかう撮影をえらぶ
export function setMainCapture(
  bugId: string,
  captureId: string,
): CaughtBug[] {
  const bugs = loadZukan().map((b) =>
    b.id === bugId ? { ...b, mainCaptureId: captureId } : b,
  )
  saveZukan(bugs)
  return bugs
}

// 撮影を1枚だけけす（履歴から1枚）。最後の1枚なら虫ごとけす。
export function removeCapture(bugId: string, captureId: string): CaughtBug[] {
  const list = loadZukan()
  const bug = list.find((b) => b.id === bugId)
  if (!bug) return list
  const remaining = bug.captures.filter((c) => c.id !== captureId)
  let bugs: CaughtBug[]
  if (remaining.length === 0) {
    bugs = list.filter((b) => b.id !== bugId)
  } else {
    const mainId = remaining.some((c) => c.id === bug.mainCaptureId)
      ? bug.mainCaptureId
      : remaining[0].id
    bugs = list.map((b) =>
      b.id === bugId ? { ...b, captures: remaining, mainCaptureId: mainId } : b,
    )
  }
  saveZukan(bugs)
  return bugs
}

export function removeFromZukan(id: string): CaughtBug[] {
  const next = loadZukan().filter((b) => b.id !== id)
  saveZukan(next)
  return next
}

export function clearZukan(): CaughtBug[] {
  saveZukan([])
  return []
}

// メイン画像／最新の撮影日をとりだすヘルパ
export function mainPhoto(bug: CaughtBug): string {
  const c = bug.captures.find((x) => x.id === bug.mainCaptureId)
  return (c ?? bug.captures[0])?.photo ?? ''
}
export function latestCaughtAt(bug: CaughtBug): number {
  return bug.captures.reduce((m, c) => Math.max(m, c.caughtAt), 0)
}
