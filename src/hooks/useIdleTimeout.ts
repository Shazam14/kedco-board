'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
const STORAGE_KEY = 'kedco_last_activity';

export function useIdleTimeout(minutes = 20) {
  const router = useRouter();
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ms     = minutes * 60 * 1000;

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login?reason=idle');
  }, [router]);

  useEffect(() => {
    const reset = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, ms);
    };

    // When tab comes back into focus, check elapsed time via localStorage
    // (setTimeout is throttled in background tabs and can't be trusted)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      if (last && Date.now() - last > ms) logout();
    };

    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, logout]);
}
