// =============================================================
//  バトルクイズ：もんだいの ばめんを バトルエンジンの Field に する
//  （がめんと けんさスクリプト scripts/checkBattleQuiz.ts の りょうほうで つかう）
// =============================================================
import type { CaughtBug, SpecialMoveV2, StatKey } from '../types'
import { createField, resolveTurn, type Command, type Field, type Fighter } from './battleEngine'
import { BASIC_ATTACK, findMove } from './moveLibrary'
import type { BattleQuizQuestion, BQFighter } from '../data/battleQuiz'

export interface Cast {
  name: string
  photo: string
  bug: CaughtBug
}

export function moveOf(id: string): SpecialMoveV2 {
  if (id === 'basic') return BASIC_ATTACK
  const m = findMove(id)
  if (!m) throw new Error(`battleQuiz: わざ ${id} が ない`)
  return m
}

const emptyRank = (): Record<StatKey, number> => ({
  attack: 0,
  defense: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
})

// もんだいの ばめんを エンジンの Field に する
export function buildField(
  q: BattleQuizQuestion,
  cast: { me: Cast[]; foe: Cast[] },
  myMoveId: string,
): Field {
  const make = (spec: BQFighter, side: 'me' | 'foe', i: number, c: Cast, moves: SpecialMoveV2[]): Fighter => {
    const maxHp = spec.maxHp ?? 50
    const hidingId = spec.hide ?? spec.charge
    return {
      uid: `${side}${i}`,
      side,
      bug: c.bug,
      name: c.name,
      photo: c.photo,
      maxHp,
      hp: spec.fainted ? 0 : Math.min(maxHp, spec.hp),
      base: {
        attack: spec.atk ?? 5,
        defense: spec.def ?? 5,
        speed: spec.spd ?? (side === 'me' ? 6 : 4),
      },
      rank: { ...emptyRank(), ...(spec.rank ?? {}) },
      statuses: (spec.status ?? []).map((key) => ({ key, turnsLeft: key === 'sleep' ? 3 : 0 })),
      moves,
      usesLeft: moves.map((m) => m.uses),
      charging: hidingId
        ? { move: moveOf(hidingId), targetUid: 'me0', hidden: !!spec.hide }
        : null,
      recharge: spec.recharge ? 1 : 0,
      regen: spec.regen ? { ratio: 0.12, turnsLeft: 4 } : null,
      leechedBy: null,
      counterGuard: false,
      damageTakenThisTurn: 0,
      actedIndex: -1,
      fainted: !!spec.fainted,
      faintReported: !!spec.fainted,
    }
  }

  const myMove = moveOf(myMoveId)
  const fighters: Fighter[] = []
  q.me.forEach((spec, i) => {
    fighters.push(make(spec, 'me', i, cast.me[i], i === 0 && myMoveId !== 'basic' ? [myMove] : []))
  })
  q.foe.forEach((spec, i) => {
    const act = q.foeMove?.[i]
    const ids = [...(spec.moves ?? [])]
    if (act && act !== 'basic' && !ids.includes(act)) ids.push(act)
    fighters.push(make(spec, 'foe', i, cast.foe[i], ids.map(moveOf)))
  })
  const field = createField(fighters)
  if (q.pending) {
    const from = fighters.find((x) => x.uid === q.pending!.from)
    field.pending.push({
      fromUid: q.pending.from,
      fromName: from?.name ?? '',
      targetUid: q.pending.to,
      move: moveOf(q.pending.move),
      attackSnapshot: from?.base.attack ?? 5,
      turnsLeft: q.pending.turnsLeft,
    })
  }
  return field
}

// この ターンの めいれい（じぶん＝えらんだ わざ、あいて＝もんだいの きまり）
export function buildCommands(q: BattleQuizQuestion, field: Field, myMoveId: string): Command[] {
  const cmds: Command[] = []
  const me = field.fighters.find((x) => x.uid === 'me0')!
  const myMove = moveOf(myMoveId)
  let target: string | null = q.target ?? null
  if (!target && myMove.target === 'oneFoe') target = 'foe0'
  cmds.push({
    actorUid: me.uid,
    moveIndex: myMoveId === 'basic' ? -1 : 0,
    targetUid: target,
    copyIndex: myMove.copyMove ? (q.copyIndex ?? 0) : undefined,
  })
  field.fighters
    .filter((x) => x.side === 'foe' && !x.fainted)
    .forEach((f, i) => {
      const act = q.foeMove?.[i]
      if (act === null) return
      if (f.charging || f.recharge > 0 || !act || act === 'basic') {
        cmds.push({ actorUid: f.uid, moveIndex: -1, targetUid: 'me0' })
        return
      }
      const idx = f.moves.findIndex((m) => m.id === act)
      cmds.push({ actorUid: f.uid, moveIndex: idx, targetUid: 'me0' })
    })
  return cmds
}

// きまった さいころで 1ターン うごかす（まいかい おなじ けっかに なる）。
// きほんの め 0.3：ふつうの めいちゅうりつなら あたる・きゅうしょは でない・ゆらぎは すこし
export function playQuizTurn(q: BattleQuizQuestion, cast: { me: Cast[]; foe: Cast[] }, myMoveId: string) {
  const f = buildField(q, cast, myMoveId)
  const roll = q.rng ?? 0.3
  return { before: f, after: resolveTurn(f, buildCommands(q, f, myMoveId), () => roll) }
}

