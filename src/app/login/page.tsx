'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idleMsg, setIdleMsg] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get('reason') === 'idle') setIdleMsg(true);
  }, [searchParams]);

  function renderTurnstile() {
    if (turnstileRef.current && !(widgetIdRef.current)) {
      widgetIdRef.current = (window as any).turnstile.render(turnstileRef.current, {
        sitekey: '0x4AAAAAADCyhLNEN4SvhkFe',
        callback: (token: string) => setCfToken(token),
        theme: 'dark',
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, cfToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }
      // Route by role
      if (data.role === 'cashier' || data.role === 'supervisor') {
        router.push('/counter');
      } else if (data.role === 'rider') {
        router.push('/rider');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace" }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'40px 48px', width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#e2e6f0', fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:-2 }}>Pusok · Lapu-Lapu City</div>
          </div>
        </div>

        <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.15em', marginBottom:24 }}>SIGN IN TO DASHBOARD</div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'#e2e6f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'#e2e6f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {idleMsg && (
            <div style={{ fontSize:12, color:'#f5a623', background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:8, padding:'8px 12px', fontFamily:"'DM Mono',monospace" }}>
              Session ended due to inactivity. Please log in again.
            </div>
          )}

          {error && (
            <div style={{ fontSize:12, color:'#f87171', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, padding:'8px 12px' }}>
              {error}
            </div>
          )}

          <div ref={turnstileRef} />

          <button
            type="submit"
            disabled={loading || !cfToken}
            style={{ marginTop:8, padding:'12px', background: (loading || !cfToken) ? 'var(--border)' : 'rgba(0,212,170,0.12)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:8, color: (loading || !cfToken) ? 'var(--muted)' : '#00d4aa', fontSize:13, fontWeight:600, cursor: (loading || !cfToken) ? 'not-allowed' : 'pointer', letterSpacing:'0.05em', fontFamily:"'Syne',sans-serif" }}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" onLoad={renderTurnstile} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
