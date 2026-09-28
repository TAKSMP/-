import type { BattleStats, CaptureInput, CaughtBug } from '../types'
import { findSpeciesByName, normalizeBugName } from '../data/bugs'
import { SAVE_KEY as STORY_KEY } from './story'
import { loadDexSeen, MOVEDEX_KEY } from './moveDex'
import { loadFieldBugs, FIELDBUGS_KEY, type FieldBugs } from './fieldBugs'

// 図鑑登録後に、各項目をなおすためのパッチ
export interface BugPatch {
  name?: string
  order?: string
  rarity?: number
  habitat?: string
  fact?: string
  mainPlace?: string // メイン写真の「みつけたばしょ」
  captureDate?: { id: string; caughtAt: number } // 写真1枚ごとの「みつけた日」
  capturePhoto?: { id: string; photo: string } // 写真1枚ごとの 画像（きりとり）
  battle?: BattleStats // バトル用ステータス
}

// 図鑑（つかまえた虫の記録）はブラウザの localStorage に保存します。
// これでページをとじても、あつめた虫がきえません。
const STORAGE_KEY = 'chomushi.zukan.v1'
// 獲得ずみのバッジ（ミッションID）は べつのキーにほぞん。
// いちど とったバッジは、あとで虫をけしても きえないようにする。
// v2: ミッションを「いまの図鑑からの差分」ではんていする方式に変えたので新キー。
const BADGE_KEY = 'chomushi.badges.v2'
// ミッションの「きじゅん（baseline）」。はじめてページを開いたときの図鑑の状態。
const BASELINE_KEY = 'chomushi.mission-base.v1'

const BACKUP_FORMAT = 'chomushi-backup'
// v1：図鑑・バッジ・ミッションのみ。v2：それに くわえて「あそぶ」の蓄積データ
// （ストーリーの レベル・クリア状況・むしかご・わざ／わざ図鑑／マップの 出現虫せってい）も。
// ふるい v1 バックアップも、そのまま 復元できる（無い分は さわらない）。
const BACKUP_VERSION = 2

interface BackupDataV2 {
  zukan: CaughtBug[]
  badges: string[]
  missionBaseline: unknown | null
  story: unknown | null // ストーリーモードの ほぞんデータ（StorySave）をそのまま
  movedex: string[] // 見た／つかった わざの id いちらん
  fieldBugs: FieldBugs // マップごとに 出す むしの せってい
}

interface BackupFileV2 {
  format: typeof BACKUP_FORMAT
  version: number // 1 か 2
  createdAt: string
  data: Partial<BackupDataV2> & { zukan: unknown; badges: unknown }
}

export function loadClaimedBadges(): string[] {
  try {
    const raw = localStorage.getItem(BADGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveClaimedBadges(ids: string[]): void {
  try {
    localStorage.setItem(BADGE_KEY, JSON.stringify(ids))
  } catch (e) {
    console.warn('バッジの保存に失敗しました', e)
  }
}

// ミッションの きじゅん（なければ null）
export function loadMissionBaseline(): unknown | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveMissionBaseline(base: unknown): void {
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(base))
  } catch (e) {
    console.warn('ミッション基準の保存に失敗しました', e)
  }
}

// ミッションを「いまの図鑑」から やりなおす（きじゅんを 今にリセットし、バッジも消す）
export function resetMissions(): void {
  try {
    localStorage.removeItem(BASELINE_KEY)
    localStorage.removeItem(BADGE_KEY)
  } catch (e) {
    console.warn('ミッションのリセットに失敗しました', e)
  }
}

// 図鑑・写真・バッジ・ミッションと、「あそぶ」の蓄積データ（ストーリーの
// レベル・クリア状況・むしかご・わざ／わざ図鑑／マップの出現虫せってい）を、
// ほかのブラウザへ 持っていくための バックアップファイルを作る。
// APIキーと、つるせマップの「いま おちている あめ」の ばしょ（すぐ 作り直せる）は 含めない。
export function createBackupJson(): string {
  const backup: BackupFileV2 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      zukan: loadZukan(),
      badges: loadClaimedBadges(),
      missionBaseline: loadMissionBaseline(),
      story: (() => {
        try {
          const raw = localStorage.getItem(STORY_KEY)
          return raw ? JSON.parse(raw) : null
        } catch {
          return null
        }
      })(),
      movedex: [...loadDexSeen()],
      fieldBugs: loadFieldBugs(),
    },
  }
  return JSON.stringify(backup)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidBug(bug: CaughtBug): boolean {
  return (
    typeof bug.id === 'string' &&
    typeof bug.name === 'string' &&
    typeof bug.order === 'string' &&
    typeof bug.rarity === 'number' &&
    Number.isFinite(bug.rarity) &&
    typeof bug.habitat === 'string' &&
    typeof bug.mainCaptureId === 'string' &&
    typeof bug.corrected === 'boolean' &&
    Array.isArray(bug.captures) &&
    bug.captures.length > 0 &&
    bug.captures.every(
      (capture) =>
        Boolean(capture) &&
        typeof capture.id === 'string' &&
        typeof capture.photo === 'string' &&
        typeof capture.caughtAt === 'number' &&
        Number.isFinite(capture.caughtAt) &&
        (capture.place === undefined || typeof capture.place === 'string'),
    )
  )
}

function normalizeBackupZukan(value: unknown): CaughtBug[] {
  if (!Array.isArray(value)) {
    throw new Error('図鑑データが入っていないファイルです。')
  }

  const bugs = value.map(migrate)
  if (bugs.some((bug) => bug === null)) {
    throw new Error('図鑑データの形式がこわれています。')
  }

  const validBugs = bugs as CaughtBug[]
  if (!validBugs.every(isValidBug)) {
    throw new Error('図鑑データの内容を確認できませんでした。')
  }
  return validBugs
}

function restoreStorageValue(key: string, value: string | null): void {
  if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, value)
}

// バックアップファイルを検査してから、保存領域をまとめて復元する。
// 書き込みに失敗したときは、復元前のデータへ戻す。
// v1（図鑑・バッジ・ミッションのみ）も、そのまま 復元できる（v2で ふえた分は さわらない）。
export function restoreBackupJson(text: string): CaughtBug[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('このファイルは読みこめませんでした。JSON形式を選んでください。')
  }

  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('ちょうむしのバックアップファイルではありません。')
  }
  if (parsed.version !== 1 && parsed.version !== BACKUP_VERSION) {
    throw new Error('このバックアップには、今のアプリでは対応していません。')
  }
  if (!isObject(parsed.data)) {
    throw new Error('バックアップの中身が見つかりません。')
  }

  const bugs = normalizeBackupZukan(parsed.data.zukan)
  const badges = parsed.data.badges
  if (!Array.isArray(badges) || !badges.every((id) => typeof id === 'string')) {
    throw new Error('バッジデータの形式を確認できませんでした。')
  }
  const missionBaseline = Object.prototype.hasOwnProperty.call(
    parsed.data,
    'missionBaseline',
  )
    ? parsed.data.missionBaseline
    : null

  // v2で ふえた分は、ふるい(v1)バックアップには 無いので undefined のまま（＝さわらない）
  const hasStory = Object.prototype.hasOwnProperty.call(parsed.data, 'story')
  const story = hasStory ? parsed.data.story : undefined
  const hasMovedex = Array.isArray(parsed.data.movedex)
  const movedex = hasMovedex ? (parsed.data.movedex as unknown[]).filter((x) => typeof x === 'string') : undefined
  const hasFieldBugs = isObject(parsed.data.fieldBugs)
  const fieldBugs = hasFieldBugs ? parsed.data.fieldBugs : undefined

  const previous = {
    zukan: localStorage.getItem(STORAGE_KEY),
    badges: localStorage.getItem(BADGE_KEY),
    missionBaseline: localStorage.getItem(BASELINE_KEY),
    story: localStorage.getItem(STORY_KEY),
    movedex: localStorage.getItem(MOVEDEX_KEY),
    fieldBugs: localStorage.getItem(FIELDBUGS_KEY),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bugs))
    localStorage.setItem(BADGE_KEY, JSON.stringify(badges))
    if (missionBaseline === null) localStorage.removeItem(BASELINE_KEY)
    else localStorage.setItem(BASELINE_KEY, JSON.stringify(missionBaseline))
    if (hasStory) {
      if (story === null) localStorage.removeItem(STORY_KEY)
      else localStorage.setItem(STORY_KEY, JSON.stringify(story))
    }
    if (hasMovedex) localStorage.setItem(MOVEDEX_KEY, JSON.stringify(movedex))
    if (hasFieldBugs) localStorage.setItem(FIELDBUGS_KEY, JSON.stringify(fieldBugs))
  } catch (error) {
    try {
      restoreStorageValue(STORAGE_KEY, previous.zukan)
      restoreStorageValue(BADGE_KEY, previous.badges)
      restoreStorageValue(BASELINE_KEY, previous.missionBaseline)
      restoreStorageValue(STORY_KEY, previous.story)
      restoreStorageValue(MOVEDEX_KEY, previous.movedex)
      restoreStorageValue(FIELDBUGS_KEY, previous.fieldBugs)
    } catch {
      console.warn('復元前のデータに戻せませんでした')
    }
    console.warn('バックアップの復元に失敗しました', error)
    throw new Error('保存容量が足りず、復元できませんでした。')
  }

  return bugs
}

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
    if (patch.capturePhoto) {
      // 指定した写真1枚だけを きりとった画像に さしかえる
      const { id, photo } = patch.capturePhoto
      captures = captures.map((c) => (c.id === id ? { ...c, photo } : c))
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
