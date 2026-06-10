'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { OPERATIONS, OP_SYMBOLS, OP_LABELS, Operation } from '@/lib/engine'

interface Profile {
  id: string
  username: string
  mmr: number
  current_level: number
  cleared_levels: number[]
}

interface Analytics {
  totalQuestions: number
  totalCorrect: number
  byOp: Record<Operation, { correct: number; total: number; avgTime: number }>
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [tab, setTab] = useState<'levels' | 'practice' | 'analytics' | 'leaderboard'>('levels')
  const [practiceOp, setPracticeOp] = useState<Operation>('addition')
  const [practiceTimed, setPracticeTimed] = useState(true)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const guest = localStorage.getItem('mathspeed_guest')
      if (guest === 'true') { setIsGuest(true); setLoading(false); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Retry up to 5 times — Google OAuth callback may not have saved profile yet
      let prof = null
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) { prof = data; break }
        await new Promise(r => setTimeout(r, 800))
      }
      // Fallback: create profile if still missing
      if (!prof) {
        const username = (user.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '_')
        const { data: newProf } = await supabase.from('profiles').insert({
          id: user.id,
          username: username + '_' + Math.floor(Math.random() * 1000),
          mmr: 1000, current_level: 1, cleared_levels: [],
        }).select().single()
        prof = newProf
      }
      if (!prof) { router.push('/'); return }
      setProfile(prof)

      // Load analytics
      const { data: rounds } = await supabase
        .from('round_results')
        .select('operation, correct, total, avg_response_time, game_sessions!inner(user_id)')
        .eq('game_sessions.user_id', user.id)

      if (rounds) {
        const byOp: any = {
          addition: { correct: 0, total: 0, avgTime: 0 },
          subtraction: { correct: 0, total: 0, avgTime: 0 },
          multiplication: { correct: 0, total: 0, avgTime: 0 },
          division: { correct: 0, total: 0, avgTime: 0 },
        }
        let totalQ = 0, totalC = 0
        rounds.forEach((r: any) => {
          if (byOp[r.operation]) {
            byOp[r.operation].correct += r.correct
            byOp[r.operation].total += r.total
            byOp[r.operation].avgTime = r.total > 0 ? r.avg_response_time : 0
            totalC += r.correct; totalQ += r.total
          }
        })
        setAnalytics({ totalQuestions: totalQ, totalCorrect: totalC, byOp })
      }

      // Load leaderboard
      const { data: lb } = await supabase.from('public_leaderboard').select('username, mmr, current_level').limit(10)
      if (lb) setLeaderboard(lb)

      setLoading(false)
    }
    load()
  }, [])

  async function logout() {
    localStorage.removeItem('mathspeed_guest')
    await supabase.auth.signOut()
    router.push('/')
  }

  function startLevel(level: number) {
    if (isGuest && level > 3) { setShowGuestModal(true); return }
    router.push(`/game?level=${level}&mode=level`)
  }

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const cleared = profile?.cleared_levels || []
  const currentLevel = profile?.current_level || 1
  const mmr = profile?.mmr || 0
  const username = profile?.username || 'Guest'
  const overallAcc = analytics && analytics.totalQuestions > 0 ? Math.round(analytics.totalCorrect / analytics.totalQuestions * 100) : 0

  const sections = [
    { start: 1, end: 20, label: 'Beginner' },
    { start: 21, end: 60, label: 'Intermediate' },
    { start: 61, end: 120, label: 'Advanced' },
    { start: 121, end: 250, label: 'Expert' },
    { start: 251, end: 500, label: 'Elite' },
    { start: 501, end: 1000, label: 'Master' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' }}>

      {showGuestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: '24px 24px 0 0', border: '1px solid var(--border)', padding: '28px 24px', width: '100%', maxWidth: '480px' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Create a free account</h3>
            <div style={{ background: 'rgba(240,160,74,.1)', border: '1px solid rgba(240,160,74,.3)', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '13px', color: 'var(--warn)', lineHeight: '1.6' }}>
              ⚡ Guest access limited to Level 3. Sign up free to unlock all 1000 levels.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => { localStorage.removeItem('mathspeed_guest'); router.push('/') }} style={btn('primary')}>Create free account</button>
              <button onClick={() => setShowGuestModal(false)} style={btn('ghost')}>Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '500' }}>
          {tab === 'levels' ? 'Levels' : tab === 'practice' ? 'Practice' : tab === 'analytics' ? 'Analytics' : 'Rankings'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isGuest && <div style={{ background: 'rgba(124,110,240,.15)', border: '1px solid rgba(124,110,240,.3)', borderRadius: '20px', padding: '4px 12px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--accent)' }}>{mmr} MMR</div>}
          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowUserMenu(v => !v)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
              {username[0].toUpperCase()}
            </div>
            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: '44px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '10px', padding: '6px', minWidth: '160px', zIndex: 50 }}>
                <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text2)', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>{username}</div>
                <button onClick={() => { setShowUserMenu(false); logout() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '13px', fontFamily: 'var(--sans)', cursor: 'pointer', borderRadius: '6px' }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>

        {/* LEVELS TAB */}
        {tab === 'levels' && (
          <div>
            <div style={{ padding: '0 24px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--green)', borderRadius: '3px', width: `${(cleared.length / 1000 * 100).toFixed(1)}%` }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{cleared.length}/1000</span>
            </div>
            {sections.map(sec => (
              <div key={sec.label} style={{ padding: '0 24px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: '10px' }}>
                  {sec.label} · Lv {sec.start}–{sec.end}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
                  {Array.from({ length: Math.min(25, sec.end - sec.start + 1) }, (_, i) => {
                    const lvl = sec.start + i
                    const isCleared = cleared.includes(lvl)
                    const isCurrent = lvl === currentLevel
                    const isLocked = !isCleared && !isCurrent && lvl > currentLevel
                    return (
                      <button key={lvl} onClick={() => !isLocked && startLevel(lvl)} style={{
                        aspectRatio: '1', borderRadius: '10px',
                        border: `1px solid ${isCleared ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                        background: isCleared ? 'rgba(111,212,176,.12)' : isCurrent ? 'rgba(124,110,240,.2)' : 'var(--bg3)',
                        color: isCleared ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--text2)',
                        fontFamily: 'var(--mono)', fontSize: '12px', cursor: isLocked ? 'not-allowed' : 'pointer',
                        opacity: isLocked ? .3 : 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isCurrent ? '0 0 0 1px var(--accent) inset' : 'none',
                      }}>
                        {lvl}{isCleared && <span style={{ position: 'absolute', top: '2px', right: '3px', fontSize: '7px' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PRACTICE TAB */}
        {tab === 'practice' && (
          <div style={{ padding: '0 24px' }}>
            <div style={st}>Select operation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {OPERATIONS.map(op => (
                <div key={op} onClick={() => setPracticeOp(op)} style={{ background: practiceOp === op ? 'rgba(124,110,240,.1)' : 'var(--bg3)', border: `2px solid ${practiceOp === op ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '16px', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '32px', color: 'var(--accent)' }}>{OP_SYMBOLS[op]}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{OP_LABELS[op]}</div>
                </div>
              ))}
            </div>
            <div style={st}>Timer mode</div>
            <div style={{ display: 'flex', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '3px', marginBottom: '20px' }}>
              {[['Timed', true], ['Untimed', false]].map(([label, val]) => (
                <div key={String(val)} onClick={() => setPracticeTimed(val as boolean)} style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', background: practiceTimed === val ? 'var(--accent)' : 'transparent', color: practiceTimed === val ? '#fff' : 'var(--text2)' }}>{label as string}</div>
              ))}
            </div>
            <div style={st}>Difficulty</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[{ label: 'Easy', sub: 'Lv 1–20', color: 'var(--green)', ref: 10 }, { label: 'Medium', sub: 'Lv 21–60', color: 'var(--accent)', ref: 50 }, { label: 'Hard', sub: 'Lv 61–120', color: 'var(--warn)', ref: 100 }, { label: 'Elite', sub: 'Lv 121+', color: 'var(--danger)', ref: 200 }].map(d => (
                <div key={d.label} onClick={() => router.push(`/game?level=${d.ref}&mode=practice&op=${practiceOp}&timed=${practiceTimed}`)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>{d.label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', color: d.color, fontWeight: '700' }}>{d.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === 'analytics' && (
          <div style={{ padding: '0 24px' }}>
            <div style={st}>Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              {[
                { label: 'Accuracy', val: overallAcc + '%', color: 'var(--green)', sub: 'overall' },
                { label: 'Level', val: String(currentLevel), color: 'var(--warn)', sub: 'current' },
                { label: 'MMR', val: String(mmr), color: 'var(--accent)', sub: 'rating' },
                { label: 'Questions', val: String(analytics?.totalQuestions || 0), color: 'var(--text)', sub: 'answered' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: '700', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '4px' }}>{s.sub}</div>
                </div>
              ))}
            </div>
            {analytics ? (
              <>
                <div style={st}>By operation</div>
                {OPERATIONS.map(op => {
                  const d = analytics.byOp[op]
                  const opAcc = d.total > 0 ? Math.round(d.correct / d.total * 100) : 0
                  const opTime = d.total > 0 ? (d.avgTime / 1000).toFixed(1) : '—'
                  return (
                    <div key={op} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>{OP_SYMBOLS[op]} {OP_LABELS[op]}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '3px' }}>{opAcc}% · {d.correct}/{d.total}</div>
                      </div>
                      <div style={{ width: '80px', height: '6px', background: 'var(--bg4)', borderRadius: '3px', overflow: 'hidden', margin: '0 12px' }}>
                        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '3px', width: `${opAcc}%` }} />
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text2)', minWidth: '36px', textAlign: 'right' }}>{opTime}s</div>
                    </div>
                  )
                })}
              </>
            ) : <div style={{ fontSize: '13px', color: 'var(--text3)', padding: '16px 0' }}>Complete a level to see analytics.</div>}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === 'leaderboard' && (
          <div style={{ padding: '0 24px' }}>
            <div style={st}>Global rankings</div>
            {leaderboard.length === 0
              ? <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No rankings yet. Be the first!</div>
              : leaderboard.map((r, i) => (
                <div key={r.username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: r.username === username ? 'rgba(124,110,240,.08)' : 'var(--bg3)', border: `1px solid ${r.username === username ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: '700', minWidth: '28px', textAlign: 'center', color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text2)' }}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.username}{r.username === username ? ' (you)' : ''}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Lv {r.current_level}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>{r.mmr}</div>
                </div>
              ))
            }
          </div>
        )}

      </div>

      <nav style={{ display: 'flex', background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '8px 0 16px', flexShrink: 0, position: 'sticky', bottom: 0, zIndex: 10 }}>
        {(['levels', 'practice', 'analytics', 'leaderboard'] as const).map((t, i) => {
          const icons = ['⊞', '⚡', '◈', '◉']
          const labels = ['Levels', 'Practice', 'Stats', 'Ranks']
          return (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
              <span style={{ fontSize: '20px', color: tab === t ? 'var(--accent)' : 'var(--text3)' }}>{icons[i]}</span>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px', color: tab === t ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--sans)' }}>{labels[i]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const btn = (type: string): React.CSSProperties => ({
  padding: '14px 20px', borderRadius: '10px',
  border: type === 'primary' ? 'none' : '1px solid var(--border)',
  background: type === 'primary' ? 'var(--accent)' : 'transparent',
  color: type === 'primary' ? '#fff' : 'var(--text)',
  fontSize: '15px', fontWeight: '500', fontFamily: 'var(--sans)', cursor: 'pointer', width: '100%',
})
const st: React.CSSProperties = { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', margin: '20px 0 12px' }
