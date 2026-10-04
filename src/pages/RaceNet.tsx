// =============================================================
//  つうしんレース（ともだちと さいだい 6にん）
// -------------------------------------------------------------
//  ・ストーリーで そだてた 虫を 1ぴき えらんで へやに はいる
//  ・へやを つくった ひと（ホスト）が なんびき・なんしゅう・CPUの つよさを きめて スタート
//  ・たりない わくは ホストの 図鑑の 虫が CPUで はしる
//  ・けいさんは ホストだけ。ほかの ひとは アクセルを おくって、すがたを うけとる
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaughtBug } from '../types'
import { loadStory } from '../lib/story'
import type { RacerInit } from '../lib/raceEngine'
import {
  cpuRacerInits,
  loadRaceSetup,
  MAX_RACERS,
  myRacerInit,
  RACE_COLORS,
  saveRaceSetup,
  shuffle,
  type RaceSetup,
} from '../lib/raceSetup'
import {
  backToLobby,
  createRaceRoom,
  joinRaceRoom,
  leaveRaceRoom,
  publishSnap,
  sendRaceInput,
  setRaceSetup,
  startNetRace,
  watchRacePart,
  type NetRacer,
  type RaceInputDoc,
  type RacePlayer,
  type RaceRoomRace,
  type RaceRoomSetup,
} from '../lib/netRace'
import { RaceTrack, type RaceNetLink, type RaceResult } from '../components/RaceTrack'
import { RaceSlots, type FixedRacer } from '../components/RaceSlots'
import { LapPicker, MyBugGrid, MyRacerCard, RaceHowto, RaceResults } from '../components/RaceParts'
import { Confetti } from '../components/Confetti'
import { sfx } from '../lib/sound'

// つうしんバトルと おなじ なまえを つかう（毎回 入れなおさなくて いいように）
const NAME_KEY = 'chomushi.netbattle.name'
function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // ほぞんできなくても きにしない
  }
}

type Phase = 'pick' | 'name' | 'menu' | 'joinEnter' | 'lobby' | 'racing' | 'result'

export function RaceNet({ bugs, onBack }: { bugs: CaughtBug[]; onBack: () => void }) {
  const save = useMemo(() => loadStory(), [])
  const [phase, setPhase] = useState<Phase>('pick')
  const [myBug, setMyBug] = useState<CaughtBug | null>(null)
  const [name, setName] = useState(loadSavedName)
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [uid, setUid] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [roomSetup, setRoomSetup] = useState<RaceRoomSetup | null>(null)
  const [players, setPlayers] = useState<Record<string, RacePlayer>>({})
  const [race, setRace] = useState<RaceRoomRace | null>(null)
  const [playedNo, setPlayedNo] = useState<number | null>(null)
  const [results, setResults] = useState<RaceResult[]>([])
  const [confetti, setConfetti] = useState(false)
  const [hostSetup, setHostSetupState] = useState<RaceSetup>(loadRaceSetup)
  const inputsRef = useRef<Record<string, RaceInputDoc>>({})
  const lastUseRef = useRef<Record<string, number>>({})
  const leaveRef = useRef<(() => void) | null>(null)

  const setHostSetup = (s: RaceSetup) => {
    setHostSetupState(s)
    saveRaceSetup(s)
  }

  // さんかしている ひと（はいった じゅん。ホストが さいしょ）
  const playerList = Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt)
  const baseLv = playerList.length
    ? Math.round(playerList.reduce((a, [, p]) => a + p.racer.level, 0) / playerList.length)
    : 1
  const setup: RaceRoomSetup = isHost ? hostSetup : (roomSetup ?? { count: 2, laps: 1, slots: [] })

  // ── へやを みはる
  useEffect(() => {
    if (!code) return
    let seen = false
    const offs = [
      watchRacePart<string>(code, 'status', (v) => {
        if (v) seen = true
        else if (seen) {
          // へやが なくなった（ホストが でた など）
          setError('へやが なくなりました。ホストが でたのかも しれません。')
          leaveRef.current = null
          setCode(null)
          setStatus(null)
          setPlayers({})
          setRace(null)
          setPhase('menu')
          return
        }
        setStatus(v)
      }),
      watchRacePart<RaceRoomSetup>(code, 'setup', setRoomSetup),
      watchRacePart<Record<string, RacePlayer>>(code, 'players', (v) => setPlayers(v ?? {})),
      watchRacePart<RaceRoomRace>(code, 'race', setRace),
    ]
    if (isHost) offs.push(watchRacePart<Record<string, RaceInputDoc>>(code, 'input', (v) => (inputsRef.current = v ?? {})))
    return () => offs.forEach((off) => off())
  }, [code, isHost])

  // ── ホスト：せっていを へやに のせる／ひとが ふえたら わくも ふやす
  useEffect(() => {
    if (code && isHost) setRaceSetup(code, { count: hostSetup.count, laps: hostSetup.laps, slots: hostSetup.slots })
  }, [code, isHost, hostSetup])
  useEffect(() => {
    if (isHost && playerList.length > hostSetup.count) setHostSetup({ ...hostSetup, count: playerList.length })
  }, [isHost, playerList.length])

  // ── スタート／へやに もどる に あわせて がめんを かえる
  const myRacerId = race ? Object.entries(race.uids ?? {}).find(([, u]) => u === uid)?.[0] : undefined
  useEffect(() => {
    if (status === 'racing' && race && race.no !== playedNo && myRacerId && (phase === 'lobby' || phase === 'result')) {
      lastUseRef.current = {}
      inputsRef.current = {}
      setPlayedNo(race.no)
      setPhase('racing')
    }
    if (status === 'waiting' && (phase === 'racing' || phase === 'result')) setPhase('lobby')
  }, [status, race, playedNo, myRacerId, phase])

  // ── でる とき（がめんを とじた ときも）
  useEffect(() => () => leaveRef.current?.(), [])

  function myNetRacer(bug: CaughtBug): NetRacer {
    const { id: _id, color: _c, human: _h, skill: _s, tag: _t, ...rest } = myRacerInit(bug, save, 'x', RACE_COLORS[0])
    return rest
  }

  async function create() {
    if (!myBug) return
    setBusy(true)
    setError('')
    try {
      const r = await createRaceRoom(name, myNetRacer(myBug), {
        count: hostSetup.count,
        laps: hostSetup.laps,
        slots: hostSetup.slots,
      })
      setIsHost(true)
      setUid(r.uid)
      setCode(r.code)
      leaveRef.current = () => leaveRaceRoom(r.code, r.uid, true)
      setPhase('lobby')
    } catch (e) {
      setError('へやを つくれませんでした：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    if (!myBug) return
    const c = codeInput.trim().toUpperCase()
    if (c.length !== 4) {
      setError('コードは 4もじ だよ')
      return
    }
    setBusy(true)
    setError('')
    try {
      const u = await joinRaceRoom(c, name, myNetRacer(myBug))
      setIsHost(false)
      setUid(u)
      setCode(c)
      leaveRef.current = () => leaveRaceRoom(c, u, false)
      setPhase('lobby')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function leave() {
    sfx.tap()
    leaveRef.current?.()
    leaveRef.current = null
    setCode(null)
    setStatus(null)
    setPlayers({})
    setRace(null)
    setPlayedNo(null)
    setPhase('menu')
  }

  async function hostStart() {
    if (!code) return
    sfx.tap()
    const colors = shuffle(RACE_COLORS)
    const humans: RacerInit[] = playerList.map(([, p], i) => ({
      ...p.racer,
      moves: p.racer.moves ?? [],
      id: `p${i}`,
      color: colors[i],
      human: true,
      skill: 0.5,
      tag: p.name,
    }))
    const uids = Object.fromEntries(playerList.map(([u], i) => [`p${i}`, u]))
    const cpus = cpuRacerInits(hostSetup.slots.slice(0, Math.max(0, hostSetup.count - humans.length)), bugs, save, {
      baseLv,
      usedBugIds: myBug ? [myBug.id] : [],
      firstIndex: humans.length,
      colors,
    })
    try {
      await startNetRace(code, { no: Date.now(), laps: hostSetup.laps, racers: shuffle([...humans, ...cpus]), uids })
    } catch (e) {
      setError('スタート できませんでした：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // ── レースの つなぎ（ホスト：けいさんして くばる／ゲスト：うけとる）
  const link = useMemo<RaceNetLink | undefined>(() => {
    if (!code || !race) return undefined
    if (isHost)
      return {
        role: 'host',
        remoteInputs: () => {
          const out: Record<string, { accel: boolean; use: boolean }> = {}
          for (const [rid, u] of Object.entries(race.uids ?? {})) {
            if (u === uid) continue
            const inp = inputsRef.current[u]
            const n = inp?.u ?? 0
            out[rid] = { accel: inp?.a === 1, use: n > (lastUseRef.current[u] ?? 0) }
            lastUseRef.current[u] = n
          }
          return out
        },
        publish: (snap) => publishSnap(code, snap),
      }
    return {
      role: 'guest',
      subscribe: (cb) => watchRacePart(code, 'snap', (v) => v && cb(v as never)),
      sendInput: (accel, useCount) => sendRaceInput(code, uid, accel, useCount),
    }
  }, [code, race, isHost, uid])

  function finish(res: RaceResult[]) {
    setResults(res)
    setPhase('result')
    if (res.find((r) => r.id === myRacerId)?.rank === 1) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 600)
      sfx.win()
    } else sfx.lose()
  }

  const fixed: FixedRacer[] = playerList.map(([u, p], i) => ({
    key: u,
    name: p.racer.name,
    photo: p.racer.photo,
    level: p.racer.level,
    label: `${p.name}${i === 0 ? '（ホスト）' : ''}${u === uid ? '・きみ' : ''}`,
  }))

  return (
    <div className="race">
      <Confetti show={confetti} />
      {error && phase !== 'racing' && <p className="race-net-error">⚠️ {error}</p>}

      {phase === 'pick' && (
        <div className="battle-step">
          <h2 className="battle-step-title">① つれていく 虫を えらぼう</h2>
          <p className="race-lead">ストーリーで そだてた レベルと わざで はしるよ！</p>
          <MyBugGrid
            bugs={bugs}
            save={save}
            onPick={(b) => {
              sfx.tap()
              setMyBug(b)
              setPhase(name ? 'menu' : 'name')
            }}
          />
          <button
            className="btn btn-ghost battle-back"
            onClick={() => {
              sfx.tap()
              onBack()
            }}
          >
            ← もどる
          </button>
        </div>
      )}

      {phase === 'name' && (
        <div className="battle-step">
          <h2 className="battle-step-title">② きみの なまえは？</h2>
          <p className="race-lead">ともだちの がめんに 出るよ（8もじ まで）</p>
          <input
            className="race-net-input"
            value={name}
            maxLength={8}
            placeholder="なまえ"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="race-lineup-actions">
            <button
              className="btn btn-big btn-primary"
              disabled={!name.trim()}
              onClick={() => {
                sfx.tap()
                setName(name.trim())
                saveName(name.trim())
                setPhase('menu')
              }}
            >
              けってい
            </button>
          </div>
        </div>
      )}

      {phase === 'menu' && myBug && (
        <div className="battle-step">
          <MyRacerCard me={myRacerInit(myBug, save, 'x', RACE_COLORS[0])} compact />
          <p className="race-lead">
            なまえ：<b>{name}</b>{' '}
            <button className="btn btn-ghost race-net-small" onClick={() => setPhase('name')}>
              かえる
            </button>
          </p>
          <div className="race-lineup-actions">
            <button className="btn btn-big btn-primary" disabled={busy} onClick={create}>
              🏠 へやを つくる
            </button>
            <button
              className="btn btn-big"
              disabled={busy}
              onClick={() => {
                sfx.tap()
                setError('')
                setPhase('joinEnter')
              }}
            >
              🚪 へやに はいる（コードを いれる）
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                setPhase('pick')
              }}
            >
              ← 虫を えらびなおす
            </button>
          </div>
        </div>
      )}

      {phase === 'joinEnter' && (
        <div className="battle-step">
          <h2 className="battle-step-title">へやの コードを いれてね</h2>
          <input
            className="race-net-input race-net-code"
            value={codeInput}
            maxLength={4}
            placeholder="ABCD"
            autoCapitalize="characters"
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <div className="race-lineup-actions">
            <button className="btn btn-big btn-primary" disabled={busy || codeInput.trim().length !== 4} onClick={join}>
              {busy ? 'つないでいるよ…' : 'はいる'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.tap()
                setPhase('menu')
              }}
            >
              ← もどる
            </button>
          </div>
        </div>
      )}

      {phase === 'lobby' && code && (
        <div className="battle-step">
          <div className="race-net-code-box">
            <span>へやの コード</span>
            <b>{code}</b>
            <small>{isHost ? 'ともだちに おしえてね（さいだい 6にん）' : 'ホストが スタートするのを まってね'}</small>
          </div>
          {status === 'racing' && !myRacerId && <p className="race-lead">いまは レース ちゅう。つぎの レースから はしれるよ！</p>}
          <RaceSlots
            count={setup.count}
            minCount={Math.max(2, playerList.length)}
            onCount={isHost ? (count) => setHostSetup({ ...hostSetup, count }) : undefined}
            fixed={fixed}
            slots={setup.slots ?? []}
            onSlots={isHost ? (slots) => setHostSetup({ ...hostSetup, slots }) : undefined}
            bugs={isHost ? bugs : []}
            excludeIds={myBug ? [myBug.id] : []}
            baseLv={baseLv}
          />
          <LapPicker
            laps={setup.laps}
            onLaps={
              isHost
                ? (laps) => {
                    sfx.tap()
                    setHostSetup({ ...hostSetup, laps })
                  }
                : undefined
            }
          />
          <RaceHowto />
          <div className="race-lineup-actions">
            {isHost && (
              <button className="btn btn-big btn-primary" onClick={hostStart}>
                レース スタート 🏁（{Math.min(MAX_RACERS, setup.count)}ひき）
              </button>
            )}
            <button className="btn btn-ghost" onClick={leave}>
              🚪 へやを でる
            </button>
          </div>
        </div>
      )}

      {phase === 'racing' && race && myRacerId && link && (
        <>
          <RaceTrack key={race.no} racers={race.racers} laps={race.laps} viewerId={myRacerId} net={link} onFinish={finish} />
          {isHost && <p className="race-net-note">きみが ホストだよ。この がめんを とじると みんなの レースが とまるよ。</p>}
        </>
      )}

      {phase === 'result' && race && myRacerId && (
        <div className="race-result">
          <RaceResults results={results} racers={race.racers} viewerId={myRacerId} />
          <div className="race-result-actions">
            {isHost ? (
              <button
                className="btn btn-big btn-primary"
                onClick={() => {
                  sfx.tap()
                  if (code) backToLobby(code)
                }}
              >
                へやに もどって もういちど 🔄
              </button>
            ) : (
              <p className="race-lead">ホストが つぎの レースを じゅんび するのを まってね</p>
            )}
            <button className="btn btn-ghost" onClick={leave}>
              🚪 へやを でる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
