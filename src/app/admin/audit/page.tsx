import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import AuditLogShell from '@/app/_components/AuditLogShell';

export default async function AuditPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/dashboard');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '56px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#00d4aa,#00a884)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#000',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', fontFamily: "'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Audit Trail</div>
          </div>
        </div>
        <a href="/admin" style={{
          padding: '6px 16px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted)', fontFamily: "'DM Mono',monospace",
          fontSize: 11, textDecoration: 'none',
        }}>← Admin</a>
      </nav>

      <AuditLogShell />
    </div>
  );
}
