'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [screen, setScreen] = useState<'home' | 'login' | 'register'>('home')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [])

  async function handleRegister() {
    if (!username || !email || !password) { setError('Please fill in all fields'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return }
    setLoading(true); setError('')
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          username: username.toLowerCase().replace(/\s+/g, '_'),
          mmr: 1000,
          current_level: 1,
          cleared_levels: [],
        })
        if (profileError && !profileError.message.includes('duplicate')) {
          setError(profileError.message); setLoading(false); return
        }
        router.push('/dashboard')
      }
    } catch (e) { setError('Something went wrong. Try again.') }
    setLoading(false)
  }

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Invalid email or password'); setLoading(false); return }
      router.push('/dashboard')
    } catch (e) { setError('Something went wrong. Try again.') }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  function handleGuest() {
    localStorage.setItem('mathspeed_guest', 'true')
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {screen === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '3px', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '24px' }}>MathSpeed Pro</div>
              <h1 style={{ fontSize: '48px', fontWeight: '300', lineHeight: '1.1', marginBottom: '12px', letterSpacing: '-2px' }}>
                Train your<br /><span style={{ color: 'var(--accent)', fontWeight: '600' }}>mental math</span>
              </h1>
              <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6' }}>1000 levels · Procedural generation<br />Real analytics · 100% free</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '40px' }}>
              {[['1K', 'Levels'], ['4', 'Operations'], ['Free', 'Forever']].map(([v, l]) => (
                <div key={l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', color: 'var(--accent)', fontWeight: '700' }}>{v}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setScreen('register')} style={btnStyle('primary')}>Get started — free</button>
              <button onClick={() => setScreen('login')} style={btnStyle('secondary')}>Sign in</button>
              <button onClick={handleGuest} style={btnStyle('ghost')}>Continue as guest</button>
            </div>
          </div>
        )}

        {screen === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={() => { setScreen('home'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '14px', fontFamily: 'var(--sans)', textAlign: 'left', marginBottom: '8px' }}>← Back</button>
            <div>
              <h2 style={{ fontSize: '26px', fontWeight: '400', marginBottom: '4px' }}>Welcome back</h2>
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Sign in to your account</p>
            </div>
            {error && <div style={{ background: 'rgba(240,90,90,.1)', border: '1px solid rgba(240,90,90,.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}
            <div style={fieldWrap}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div style={fieldWrap}><label style={labelStyle}>Password</label><input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
            <button onClick={handleLogin} disabled={loading} style={btnStyle('primary')}>{loading ? 'Signing in...' : 'Sign in'}</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text3)', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button onClick={handleGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
              <GoogleIcon /> Continue with Google
            </button>
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text2)' }}>No account? <button onClick={() => { setScreen('register'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--sans)' }}>Sign up free</button></p>
          </div>
        )}

        {screen === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={() => { setScreen('home'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '14px', fontFamily: 'var(--sans)', textAlign: 'left', marginBottom: '8px' }}>← Back</button>
            <div>
              <h2 style={{ fontSize: '26px', fontWeight: '400', marginBottom: '4px' }}>Create account</h2>
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Free forever. No credit card.</p>
            </div>
            {error && <div style={{ background: 'rgba(240,90,90,.1)', border: '1px solid rgba(240,90,90,.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}
            <div style={fieldWrap}><label style={labelStyle}>Username</label><input style={inputStyle} type="text" placeholder="swift_calculator" value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div style={fieldWrap}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div style={fieldWrap}><label style={labelStyle}>Password</label><input style={inputStyle} type="password" placeholder="min 6 characters" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} /></div>
            <button onClick={handleRegister} disabled={loading} style={btnStyle('primary')}>{loading ? 'Creating...' : 'Create account'}</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text3)', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button onClick={handleGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
              <GoogleIcon /> Continue with Google
            </button>
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text2)' }}>Already have an account? <button onClick={() => { setScreen('login'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--sans)' }}>Sign in</button></p>
          </div>
        )}

      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#EA4335" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#4285F4" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#34A853" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

const btnStyle = (type: 'primary' | 'secondary' | 'ghost'): React.CSSProperties => ({
  padding: '14px 20px', borderRadius: '10px',
  border: type === 'primary' ? 'none' : `1px solid ${type === 'secondary' ? '#3a3a4f' : '#2a2a3a'}`,
  background: type === 'primary' ? 'var(--accent)' : type === 'secondary' ? 'var(--bg3)' : 'transparent',
  color: type === 'primary' ? '#fff' : 'var(--text)',
  fontSize: '15px', fontWeight: '500', fontFamily: 'var(--sans)', cursor: 'pointer', width: '100%',
})
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' }
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.5px' }
const inputStyle: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', color: 'var(--text)', fontSize: '15px', fontFamily: 'var(--sans)', outline: 'none' }
