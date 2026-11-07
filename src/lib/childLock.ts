// =============================================================
//  チャイルドロック（保護者向け）
// -------------------------------------------------------------
//  ・ロックする項目（ずかん・ゲームのそれぞれ）を選ぶ
//  ・1日に あそべる 時間／1週間に あそべる 日数 を決められる
//  ・1週間は 月曜日はじまり〜日曜日
//  ・設定は この端末のブラウザに保存される
// =============================================================

import { sha256Hex } from './sha256'
// パスワードは コードに そのまま 書かず、ハッシュ（SHA-256）だけ もつ
const PASSWORD_HASH = 'f440c61bcfdf77c27ab0b6b4f8aa4e425840b7f4e5709f4bd7980ab100d28958'
export function checkLockPassword(input: string): boolean {
  return sha256Hex('chomushi-lock:v1:' + input) === PASSWORD_HASH
}

const CFG_KEY = 'chomushi.childlock.v1'
const USE_KEY = 'chomushi.childlock.usage.v1'
export const LOCK_CHANGED_EVENT = 'chomushi-lock-changed'
export const LOCK_BLOCKED_EVENT = 'chomushi-lock-blocked'

// この秒数いじょう あそんだ日を「あそんだ日」と数える（まちがって ひらいただけの日は数えない）
export const DAY_COUNT_SECONDS = 60

export interface LockConfig {
  enabled: boolean
  items: string[] // ロックする項目のキー
  dailyMinutes: number | null // 1日に あそべる 分（null = 制限なし）
  weekDays: number | null // 1週間に あそべる 日数（null = 制限なし）
}

export const DEFAULT_LOCK: LockConfig = { enabled: false, items: [], dailyMinutes: null, weekDays: null }

// ロックできる項目（ずかん・ゲーム）
export interface LockLeaf { key: string; label: string }
export interface LockGroup { label: string; leaves: LockLeaf[] }
export const LOCK_TREE: { label: string; groups: LockGroup[] }[] = [
  {
    label: '図鑑まわり',
    groups: [
      {
        label: '',
        leaves: [
          { key: 'capture', label: 'しらべる' },
          { key: 'zukan', label: 'ずかん' },
          { key: 'mission', label: 'ミッション' },
          { key: 'search', label: 'けんさく' },
        ],
      },
    ],
  },
  {
    label: 'ゲーム',
    groups: [
      { label: 'クイズ', leaves: [{ key: 'quiz', label: 'むしクイズ' }, { key: 'battleQuiz', label: 'バトルクイズ' }] },
      {
        label: 'ストーリー',
        leaves: [
          { key: 'story', label: 'ストーリーモード' },
          { key: 'dojo', label: 'わざ道場' },
          { key: 'dojoAdult', label: 'わざ道場（おとな）' },
        ],
      },
      {
        label: 'バトル',
        leaves: [
          { key: 'battle', label: 'むしバトル（1〜4ひき）' },
          { key: 'net', label: 'つうしんバトル' },
          { key: 'battleOld', label: 'まえのばん' },
        ],
      },
      { label: 'レース', leaves: [{ key: 'race', label: 'こうえんレース' }, { key: 'raceOld', label: 'まえのばん' }] },
    ],
  },
]
export const ALL_LOCK_KEYS: string[] = LOCK_TREE.flatMap((s) => s.groups.flatMap((g) => g.leaves.map((l) => l.key)))

// ---------- 日づけ（日本の ローカル時間・週は 月曜はじまり） ----------
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
// 月曜日(0)〜日曜日(6)
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}
// その週の 月〜日 の 7日
export function weekDates(now: Date): Date[] {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekdayIndex(now))
  return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i))
}

// ---------- 保存 ----------
export function loadLock(): LockConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_LOCK }
    return {
      enabled: !!raw.enabled,
      // まえの「1たい1」「2たい2」は「むしバトル」に まとめた
      items: Array.isArray(raw.items)
        ? [...new Set((raw.items as unknown[]).map((k) => (k === 'battle1' || k === 'battle2' ? 'battle' : k)))].filter(
            (k): k is string => ALL_LOCK_KEYS.includes(k as string),
          )
        : [],
      dailyMinutes: typeof raw.dailyMinutes === 'number' && raw.dailyMinutes > 0 ? raw.dailyMinutes : null,
      weekDays: typeof raw.weekDays === 'number' && raw.weekDays > 0 ? Math.min(7, raw.weekDays) : null,
    }
  } catch {
    return { ...DEFAULT_LOCK }
  }
}
export function saveLock(cfg: LockConfig): void {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(LOCK_CHANGED_EVENT))
}

export type LockUsage = Record<string, number> // 'YYYY-MM-DD' → 秒
export function loadUsage(): LockUsage {
  try {
    const raw = JSON.parse(localStorage.getItem(USE_KEY) ?? '{}')
    const out: LockUsage = {}
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && v > 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}
function saveUsage(u: LockUsage): void {
  // 古い きろくは 70日で すてる
  const keys = Object.keys(u).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - 70))) delete u[k]
  try { localStorage.setItem(USE_KEY, JSON.stringify(u)) } catch { /* storage unavailable */ }
}
export function addUsage(seconds: number, now = new Date()): LockUsage {
  const u = loadUsage()
  const k = dayKey(now)
  u[k] = (u[k] ?? 0) + seconds
  saveUsage(u)
  return u
}
export function resetUsage(): void {
  try { localStorage.removeItem(USE_KEY) } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(LOCK_CHANGED_EVENT))
}

// ---------- 判定 ----------
export interface LockState {
  active: boolean // ロックが ONで 項目が1つ以上あり、制限もある
  todaySeconds: number
  secondsLeft: number | null // きょう あと何秒（制限なしは null）
  usedDates: boolean[] // 月〜日 それぞれ あそんだか
  todayIndex: number
  daysUsed: number
  daysLeft: number | null // 今週 あと何日（制限なしは null）
  blocked: 'day' | 'week' | null // いま 制限に達しているか
}

export function lockState(cfg: LockConfig, usage: LockUsage, now = new Date()): LockState {
  const dates = weekDates(now)
  const todayIndex = weekdayIndex(now)
  const usedDates = dates.map((d) => (usage[dayKey(d)] ?? 0) >= DAY_COUNT_SECONDS)
  const today = usage[dayKey(now)] ?? 0
  const daysUsed = usedDates.filter(Boolean).length
  const usedBeforeToday = daysUsed - (usedDates[todayIndex] ? 1 : 0)
  const active = cfg.enabled && cfg.items.length > 0 && (cfg.dailyMinutes != null || cfg.weekDays != null)
  const secondsLeft = cfg.dailyMinutes != null ? Math.max(0, cfg.dailyMinutes * 60 - today) : null
  const daysLeft = cfg.weekDays != null ? Math.max(0, cfg.weekDays - daysUsed) : null
  let blocked: LockState['blocked'] = null
  if (active) {
    if (cfg.weekDays != null && usedBeforeToday >= cfg.weekDays) blocked = 'week'
    else if (secondsLeft != null && secondsLeft <= 0) blocked = 'day'
  }
  return { active, todaySeconds: today, secondsLeft, usedDates, todayIndex, daysUsed, daysLeft, blocked }
}

// この項目は いま ロック中か？（ロック対象でなければ null）
export function lockReasonFor(key: string | null | undefined): 'day' | 'week' | null {
  if (!key) return null
  const cfg = loadLock()
  if (!cfg.enabled || !cfg.items.includes(key)) return null
  return lockState(cfg, loadUsage()).blocked
}

// ひらこうとした ときの チェック。ロック中なら ポップアップを だして false
export function guardLock(key: string | null | undefined): boolean {
  const reason = lockReasonFor(key)
  if (!reason) return true
  window.dispatchEvent(new CustomEvent(LOCK_BLOCKED_EVENT, { detail: reason }))
  return false
}
