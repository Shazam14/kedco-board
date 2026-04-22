'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function DateOverrideBanner() {
  const pathname = usePathname();
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/login') return;

    const check = () =>
      fetch('/api/admin/test-date')
        .then(r => r.json())
        .then(d => {
          const today = new Date().toISOString().split('T')[0];
          const d2 = d.test_date ?? null;
          setActiveDate(d2 && d2 !== today ? d2 : null);
        })
        .catch(() => {});

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [pathname]);

  if (!activeDate) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#f5a623',
      color: '#000',
      fontFamily: "'DM Mono',monospace",
      fontSize: 12,
      fontWeight: 700,
      padding: '8px 16px',
      textAlign: 'center',
      letterSpacing: '0.05em',
    }}>
      DATE OVERRIDE ACTIVE — System is running as {activeDate}. Real date is {new Date().toISOString().split('T')[0]}.
      <a
        href="/admin"
        style={{ marginLeft: 16, color: '#000', textDecoration: 'underline', fontWeight: 700 }}
      >
        Change in Admin
      </a>
    </div>
  );
}
