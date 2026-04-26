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

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, padding: '11px 14px',
    color: 'var(--text-strong)', fontSize: 13,
    fontFamily: 'var(--font-mono)', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 20, padding: '40px 44px', width: '100%', maxWidth: 380,
        boxShadow: 'var(--shadow-pop)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--teal-300), var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: 'var(--text-on-teal)',
            fontFamily: 'var(--font-display)',
          }}>K</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }}>
              Kedco<span style={{ color: 'var(--teal-300)' }}>FX</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', marginTop: -1 }}>Pusok · Lapu-Lapu City</div>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: 24 }}>SIGN IN TO DASHBOARD</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>USERNAME</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required style={inputStyle} />
          </div>

          {idleMsg && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-gold)', background: 'rgba(212,166,74,0.08)', border: '1px solid rgba(212,166,74,0.2)', borderRadius: 8, padding: '8px 12px' }}>
              Session ended due to inactivity. Please log in again.
            </div>
          )}

          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-coral)', background: 'rgba(238,108,90,0.08)', border: '1px solid rgba(238,108,90,0.2)', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div ref={turnstileRef} />

          <button
            type="submit"
            disabled={loading || !cfToken}
            style={{
              marginTop: 8, padding: '13px', borderRadius: 10, border: 'none',
              background: (loading || !cfToken) ? 'var(--bg-raised)' : 'var(--teal-400)',
              color: (loading || !cfToken) ? 'var(--text-faint)' : 'var(--text-on-teal)',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
              cursor: (loading || !cfToken) ? 'not-allowed' : 'pointer',
              transition: 'background 150ms',
            }}
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
