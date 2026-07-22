import type { BattleStats, CaptureInput, CaughtBug } from '../types'
import { findSpeciesByName, normalizeBugName } from '../data/bugs'

// 図鑑登録後に、各項目をなおすためのパッチ
export interface BugPatch {
  name?: string
  order?: string
  rarity?: number
  habitat?: string
  fact?: string
  mainPlace?: string // メイン写真の「みつけたばしょ」
  captureDate?: { id: string; caughtAt: number } // 写真1枚ごとの「みつけた日」
  battle?: BattleStats // バトル用ステータス
}

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
    place: input.place?.trim() || undefined,
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

// 図鑑登録後に、虫の各項目をなおす。
export function updateBug(bugId: string, patch: BugPatch): CaughtBug[] {
  const bugs = loadZukan().map((b) => {
    if (b.id !== bugId) return b
    const next: CaughtBug = { ...b }
    if (patch.name !== undefined) {
      next.name = patch.name.trim() || 'なぞの虫'
      next.speciesId = findSpeciesByName(next.name)?.id
    }
    if (patch.order !== undefined) next.order = patch.order.trim() || 'ふめい'
    if (patch.rarity !== undefined)
      next.rarity = Math.max(1, Math.min(5, patch.rarity))
    if (patch.habitat !== undefined)
      next.habitat = patch.habitat.trim() || 'ふめい'
    if (patch.fact !== undefined) next.fact = patch.fact.trim() || undefined
    if (patch.battle !== undefined) next.battle = patch.battle

    // 写真（captures）にかかわる変更をまとめて反映
    let captures = b.captures
    if (patch.mainPlace !== undefined) {
      const place = patch.mainPlace.trim() || undefined
      captures = captures.map((c) =>
        c.id === b.mainCaptureId ? { ...c, place } : c,
      )
    }
    if (patch.captureDate) {
      // 指定した写真1枚だけの日付をなおす（ほかの写真はそのまま）
      const { id, caughtAt } = patch.captureDate
      captures = captures.map((c) => (c.id === id ? { ...c, caughtAt } : c))
    }
    next.captures = captures

    next.corrected = true
    return next
  })
  saveZukan(bugs)
  return bugs
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

// これまでに入力した「みつけたばしょ」のいちらん（よくつかう順）。
// 検索ボックスの候補（datalist）に使う。
export function collectPlaces(bugs: CaughtBug[]): string[] {
  const counts = new Map<string, number>()
  for (const bug of bugs) {
    for (const c of bug.captures) {
      const p = c.place?.trim()
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
}

// メイン画像／最新の撮影日をとりだすヘルパ
export function mainPhoto(bug: CaughtBug): string {
  const c = bug.captures.find((x) => x.id === bug.mainCaptureId)
  return (c ?? bug.captures[0])?.photo ?? ''
}
export function latestCaughtAt(bug: CaughtBug): number {
  return bug.captures.reduce((m, c) => Math.max(m, c.caughtAt), 0)
}
