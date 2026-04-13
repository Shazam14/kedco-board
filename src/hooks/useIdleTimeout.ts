'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useIdleTimeout(minutes = 20) {
  const router = useRouter();
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ms = minutes * 60 * 1000;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login?reason=idle');
      }, ms);
    };

    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [minutes, router]);
}
