'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generateRound, getTimerForLevel, OPERATIONS, OP_SYMBOLS, OP_LABELS, Operation, Question } from '@/lib/engine'

interface QuestionResult {
  question: Question
  userAnswer: number | '—'
  correct: boolean
  time: number
  skipped: boolean
}

interface RoundResult {
  op: Operation
  correct: number
  total: number
  pass: boolean
  results: QuestionResult[]
}

function GameInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const level = parseInt(params.get('level') || '1')
  const mode = params.get('mode') || 'level'
  const practiceOp = (params.get('op') || 'addition') as Operation
  const timed = params.get('timed') !== 'false'
  const rounds = mode === 'practice' ? [practiceOp] : [...OPERATIONS]

  const [phase, setPhase] = useState<'game' | 'roundSummary' | 'levelClear' | 'levelFail'>('game')
  const [roundIndex, setRoundIndex] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState<QuestionResult[]>([])
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [timeLeft, setTimeLeft] = useState(timed ? getTimerForLevel(level) : 9999)
  const [timerMax] = useState(timed ? getTimerForLevel(level) : 9999)
  const [questionStart, setQuestionStart] = useState(Date.now())
  const [shake, setShake] = useState(false)
  const [saving, setSaving] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const resultsRef = useRef<QuestionResult[]>([])
  const questionsRef = useRef<Question[]>([])
  const currentQRef = useRef(0)
  const roundResultsRef = useRef<RoundResult[]>([])

  // Tab visibility anti-cheat
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden && phase === 'game' && timed) {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [phase, timed])

  const finishRound = useCallback((finalResults: QuestionResult[], op: Operation) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const correct = finalResults.filter(r => r.correct).length
    const pass = correct >= 8
    const rr: RoundResult = { op, correct, total: finalResults.length, pass, results: finalResults }
    const next = [...roundResultsRef.current, rr]
    roundResultsRef.current = next
    setRoundResults(next)
    setResults(finalResults)
    setPhase('roundSummary')
  }, [])

  const timeUp = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const existing = [...resultsRef.current]
    questionsRef.current.slice(currentQRef.current).forEach(q => {
      existing.push({ question: q, userAnswer: '—', correct: false, time: 0, skipped: true })
    })
    finishRound(existing, rounds[roundIndex])
  }, [finishRound, roundIndex, rounds])

  useEffect(() => {
    const qs = generateRound(rounds[roundIndex], level)
    setQuestions(qs)
    questionsRef.current = qs
    setCurrentQ(0); currentQRef.current = 0
    setAnswer('')
    setResults([]); resultsRef.current = []
    if (roundIndex === 0) { roundResultsRef.current = []; setRoundResults([]) }
    setPhase('game')
    const t = timed ? getTimerForLevel(level) : 9999
    setTimeLeft(t)
    setQuestionStart(Date.now())
    if (timerRef.current) clearInterval(timerRef.current)
    if (timed) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { timeUp(); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [roundIndex])

  function submitAnswer() {
    if (!answer) return
    const q = questionsRef.current[currentQRef.current]
    if (!q) return
    const userAns = parseInt(answer)
    const elapsed = Date.now() - questionStart
    const correct = userAns === q.answer
    if (!correct) { setShake(true); setTimeout(() => setShake(false), 400) }
    const newResult: QuestionResult = { question: q, userAnswer: userAns, correct, time: elapsed, skipped: false }
    const newResults = [...resultsRef.current, newResult]
    resultsRef.current = newResults
    setAnswer('')
    const nextQ = currentQRef.current + 1
    if (nextQ >= questionsRef.current.length) {
      finishRound(newResults, rounds[roundIndex])
    } else {
      currentQRef.current = nextQ
      setCurrentQ(nextQ)
      setQuestionStart(Date.now())
    }
  }

  function skipQuestion() {
    const q = questionsRef.current[currentQRef.current]
    if (!q) return
    if (!q._skipped) {
      q._skipped = true
      const qs = [...questionsRef.current]
      qs.push(qs.splice(currentQRef.current, 1)[0])
      questionsRef.current = qs
      setQuestions([...qs])
      setAnswer(''); setQuestionStart(Date.now()); return
    }
    const newResult: QuestionResult = { question: q, userAnswer: '—', correct: false, time: Date.now() - questionStart, skipped: true }
    const newResults = [...resultsRef.current, newResult]
    resultsRef.current = newResults
    setAnswer('')
    const nextQ = currentQRef.current + 1
    if (nextQ >= questionsRef.current.length) {
      finishRound(newResults, rounds[roundIndex])
    } else {
      currentQRef.current = nextQ; setCurrentQ(nextQ); setQuestionStart(Date.now())
    }
  }

  function kp(val: string) {
    if (val === 'del') { setAnswer(a => a.slice(0, -1)); return }
    if (val === 'enter') { submitAnswer(); return }
    if (answer.length < 6) setAnswer(a => a + val)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'game') return
      if (e.key >= '0' && e.key <= '9') kp(e.key)
      else if (e.key === 'Backspace') kp('del')
      else if (e.key === 'Enter') kp('enter')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, answer])

  function proceedFromSummary() {
    const isLast = roundIndex >= rounds.length - 1
    if (mode === 'practice' || isLast) finishSession(roundResultsRef.current)
    else setRoundIndex(i => i + 1)
  }

  async function finishSession(rr: RoundResult[]) {
    if (mode === 'practice') { router.push('/dashboard'); return }
    const allPassed = rr.every(r => r.pass)
    const totalCorrect = rr.reduce((a, r) => a + r.correct, 0)
    const totalQ = rr.reduce((a, r) => a + r.total, 0)
    const passed = allPassed && totalCorrect / totalQ >= 0.8
    const mmrGained = passed ? Math.floor(10 + level * 0.5) : 0

    setSaving(true)
    try {
      await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, mode, passed, roundResults: rr, totalCorrect, totalQuestions: totalQ, mmrGained }),
      })
    } catch (e) { console.error('Failed to save session', e) }
    setSaving(false)

    setPhase(passed ? 'levelClear' : 'levelFail')
  }

  const q = questions[currentQ]
  const timerPct = timed ? timeLeft / timerMax : 1
  const circ = 150.8
  const op = rounds[roundIndex]

  // ── ROUND SUMMARY ──
  if (phase === 'roundSummary') {
    const lastRound = roundResults[roundResults.length - 1]
    const isLast = roundIndex >= rounds.length - 1
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: '480px', margin: '0 auto', padding: '24px', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '64px', fontWeight: '700', color: lastRound?.pass ? 'var(--green)' : 'var(--danger)', lineHeight: 1 }}>{lastRound?.correct}/10</div>
          <div style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '8px' }}>Round complete · {OP_LABELS[op]}</div>
          <div style={{ marginTop: '10px' }}>
            <span style={{ background: lastRound?.pass ? 'rgba(111,212,176,.15)' : 'rgba(240,90,90,.15)', color: lastRound?.pass ? 'var(--green)' : 'var(--danger)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}>
              {lastRound?.pass ? '✓ Round passed' : '✗ Round failed'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>Question review</div>
        {results.map((r, i) => (
          <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text2)' }}>{r.question.display} = ?</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              {r.correct
                ? <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--green)' }}>✓ {r.question.answer}</div>
                : <><div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--danger)' }}>✗ {String(r.userAnswer)}</div><div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--green)' }}>{r.question.answer}</div></>
              }
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.time ? (r.time / 1000).toFixed(1) + 's' : '—'}</div>
            </div>
          </div>
        ))}
        <div style={{ height: '16px' }} />
        <button onClick={proceedFromSummary} disabled={saving} style={mainBtn}>{saving ? 'Saving...' : mode === 'practice' || isLast ? 'See results →' : `Next: ${OP_LABELS[rounds[roundIndex + 1]]} →`}</button>
        <button onClick={() => router.push('/dashboard')} style={{ ...mainBtn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', marginTop: '8px' }}>Exit to menu</button>
      </div>
    )
  }

  // ── LEVEL CLEAR ──
  if (phase === 'levelClear') {
    const totalCorrect = roundResults.reduce((a, r) => a + r.correct, 0)
    const totalQ = roundResults.reduce((a, r) => a + r.total, 0)
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎯</div>
          <div style={{ fontSize: '32px', fontWeight: '300', marginBottom: '4px' }}>Level Cleared</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '56px', color: 'var(--green)', fontWeight: '700', marginBottom: '4px' }}>{level}</div>
          <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '32px' }}>{totalCorrect}/{totalQ} correct · {Math.round(totalCorrect / totalQ * 100)}% accuracy</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
            {roundResults.map(r => (
              <div key={r.op} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: '700', color: r.pass ? 'var(--green)' : 'var(--danger)' }}>{r.correct}/10</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', textTransform: 'uppercase' }}>{r.op.substring(0, 3)}</div>
              </div>
            ))}
          </div>
          <button onClick={() => router.push(`/game?level=${level + 1}&mode=level`)} style={{ ...mainBtn, marginBottom: '10px' }}>Play Level {level + 1} →</button>
          <button onClick={() => router.push('/dashboard')} style={{ ...mainBtn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>Back to menu</button>
        </div>
      </div>
    )
  }

  // ── LEVEL FAIL ──
  if (phase === 'levelFail') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💪</div>
          <div style={{ fontSize: '32px', fontWeight: '300', marginBottom: '8px' }}>Not quite</div>
          <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '32px', lineHeight: '1.6' }}>You need 8/10 on each round to pass.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
            {roundResults.map(r => (
              <div key={r.op} style={{ background: 'var(--bg3)', border: `1px solid ${r.pass ? 'var(--green)' : 'var(--danger)'}`, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: '700', color: r.pass ? 'var(--green)' : 'var(--danger)' }}>{r.correct}/10</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', textTransform: 'uppercase' }}>{r.op.substring(0, 3)}</div>
              </div>
            ))}
          </div>
          <button onClick={() => router.push(`/game?level=${level}&mode=level`)} style={{ ...mainBtn, marginBottom: '10px' }}>Retry Level {level}</button>
          <button onClick={() => router.push('/dashboard')} style={{ ...mainBtn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>Back to menu</button>
        </div>
      </div>
    )
  }

  if (!q) return null
  const qParts = q.display.split(' ')

  // ── GAME ──
  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>✕</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {mode === 'level' ? `Level ${level} · Round ${roundIndex + 1}/${rounds.length}` : `Practice · ${OP_LABELS[op]}`}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '500' }}>{OP_LABELS[op]}</span>
          </div>
          <div style={{ height: '4px', background: 'var(--bg4)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: `${(currentQ / questions.length) * 100}%`, transition: 'width .3s' }} />
          </div>
        </div>
        {timed && (
          <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg4)" strokeWidth="4" />
              <circle cx="28" cy="28" r="24" fill="none"
                stroke={timeLeft > 30 ? 'var(--accent)' : timeLeft > 10 ? 'var(--warn)' : 'var(--danger)'}
                strokeWidth="4" strokeDasharray={circ} strokeDashoffset={circ * (1 - timerPct)}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset .1s, stroke .5s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: '700', color: timeLeft > 30 ? 'var(--text)' : timeLeft > 10 ? 'var(--warn)' : 'var(--danger)' }}>
              {timeLeft}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Question {Math.min(currentQ + 1, questions.length)} of {questions.length}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '52px', fontWeight: '700', textAlign: 'center', lineHeight: 1.1, marginBottom: '8px', letterSpacing: '-1px' }}>
          {qParts[0]}<span style={{ color: 'var(--accent)', margin: '0 8px' }}>{qParts[1]}</span>{qParts[2]}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '28px', color: 'var(--text3)', marginBottom: '32px' }}>=</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: '36px', fontWeight: '700', minHeight: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg3)', border: `2px solid ${shake ? 'var(--danger)' : answer ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: '16px', width: '100%', maxWidth: '260px', letterSpacing: '2px',
          animation: shake ? 'shake .3s' : 'none',
        }}>
          {answer || '_'}
        </div>
        <button onClick={skipQuestion} style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', background: 'var(--warn)', color: '#000', borderRadius: '4px', padding: '1px 5px', fontWeight: '700' }}>SKIP</span>
          move to end ↓
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', padding: '16px 20px 24px', flexShrink: 0 }}>
        {['7','8','9','4','5','6','1','2','3','del','0','enter'].map(k => (
          <button key={k} onClick={() => kp(k)} style={{
            height: '58px', borderRadius: '10px', border: `1px solid ${k === 'enter' ? 'var(--accent)' : 'var(--border)'}`,
            background: k === 'enter' ? 'var(--accent)' : 'var(--bg3)',
            color: k === 'enter' ? '#fff' : 'var(--text)',
            fontFamily: 'var(--mono)', fontSize: k === 'del' ? '16px' : '22px', fontWeight: '700',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
            {k === 'del' ? '⌫' : k === 'enter' ? '→' : k}
          </button>
        ))}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  )
}

export default function GamePage() {
  return <Suspense fallback={<div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--mono)' }}>Loading...</div>}><GameInner /></Suspense>
}

declare module '@/lib/engine' { interface Question { _skipped?: boolean } }
const mainBtn: React.CSSProperties = { padding: '14px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: '500', fontFamily: 'var(--sans)', cursor: 'pointer', width: '100%' }
