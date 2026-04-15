'use client';
import { useState, useEffect } from 'react';

const S: Record<string, React.CSSProperties> = {
  card: { background:'#0f1117', border:'1px solid #1e2230', borderRadius:14, overflow:'hidden' },
  mono: { fontFamily:"'DM Mono',monospace" },
  syne: { fontFamily:"'Syne',sans-serif" },
};

const ROLE_COLOR: Record<string, string> = {
  admin:      '#f5a623',
  supervisor: '#a78bfa',
  cashier:    '#00d4aa',
  rider:      '#5b8cff',
};
const ROLE_ORDER = ['admin', 'supervisor', 'cashier', 'rider'];

interface UserRow {
  id:        string;
  username:  string;
  full_name: string;
  role:      string;
  branch:    string | null;
  is_active: boolean;
  is_demo:   boolean;
}

interface EditState {
  full_name: string;
  branch:    string;
  new_password: string;
}

export default function AdminUsersPage() {
  const [users,    setUsers]   = useState<UserRow[]>([]);
  const [loading,  setLoading] = useState(true);
  const [editing,  setEditing] = useState<string | null>(null); // username
  const [editVals, setEditVals] = useState<EditState>({ full_name:'', branch:'', new_password:'' });
  const [saving,   setSaving]  = useState(false);
  const [msg,      setMsg]     = useState<{ username: string; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function startEdit(u: UserRow) {
    setEditing(u.username);
    setEditVals({ full_name: u.full_name, branch: u.branch ?? '', new_password: '' });
    setMsg(null);
  }

  async function saveEdit(username: string) {
    setSaving(true);
    setMsg(null);
    try {
      // Update name + branch
      const patch = await fetch(`/api/admin/users/${username}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ full_name: editVals.full_name, branch: editVals.branch || null }),
      });
      const patchData = await patch.json();
      if (!patch.ok) { setMsg({ username, ok:false, text: patchData.detail ?? 'Update failed' }); return; }

      // Reset password if provided
      if (editVals.new_password) {
        const pw = await fetch(`/api/admin/users/${username}/reset-password`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ new_password: editVals.new_password }),
        });
        const pwData = await pw.json();
        if (!pw.ok) { setMsg({ username, ok:false, text: pwData.detail ?? 'Password reset failed' }); return; }
      }

      // Update local state
      setUsers(prev => prev.map(u => u.username === username ? {
        ...u,
        full_name: patchData.full_name,
        branch:    patchData.branch,
      } : u));
      setEditing(null);
      setMsg({ username, ok:true, text: editVals.new_password ? 'Saved + password reset' : 'Saved' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.username}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !u.is_active }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(x => x.username === u.username ? { ...x, is_active: !u.is_active } : x));
    }
  }

  const grouped = ROLE_ORDER.map(role => ({
    role,
    users: users.filter(u => u.role === role),
  })).filter(g => g.users.length > 0);

  const ROLE_LABEL: Record<string, string> = {
    admin:'Admin', supervisor:'Supervisors', cashier:'Cashiers', rider:'Riders',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#080a10', color:'#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', ...S.syne }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginTop:-2 }}>Admin Panel</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', color:'#4a5468', ...S.mono, fontSize:11, textDecoration:'none' }}>← Dashboard</a>
          <a href="/admin" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.08)', color:'#a78bfa', ...S.mono, fontSize:11, textDecoration:'none' }}>Admin Home</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px', maxWidth:860, margin:'0 auto', display:'flex', flexDirection:'column', gap:24 }}>

        {/* Header */}
        <div>
          <div style={{ ...S.mono, fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:6 }}>ADMIN · USERS</div>
          <div style={{ ...S.syne, fontSize:26, fontWeight:800, letterSpacing:'-0.02em' }}>Manage Users</div>
          <div style={{ ...S.mono, fontSize:11, color:'#4a5468', marginTop:4 }}>
            {loading ? 'Loading...' : `${users.length} total users — click any row to edit name, branch, or reset password`}
          </div>
        </div>

        {grouped.map(({ role, users: roleUsers }) => (
          <div key={role} style={S.card}>
            {/* Group header */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #1e2230', background:`rgba(${role==='admin'?'245,166,35':role==='supervisor'?'167,139,250':role==='cashier'?'0,212,170':'91,140,255'},0.06)`, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:ROLE_COLOR[role] }} />
              <span style={{ ...S.syne, fontSize:12, fontWeight:700, color:ROLE_COLOR[role] }}>{ROLE_LABEL[role]}</span>
              <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{roleUsers.length}</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 120px 80px 80px', padding:'8px 20px', borderBottom:'1px solid #1e2230', gap:12 }}>
              {['USERNAME','NAME / BRANCH','','STATUS',''].map((h,i) => (
                <span key={i} style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>{h}</span>
              ))}
            </div>

            {roleUsers.map((u, i) => {
              const isEditing = editing === u.username;
              const flash = msg?.username === u.username;
              return (
                <div key={u.username}>
                  <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 120px 80px 80px', padding:'10px 20px', borderBottom: i < roleUsers.length-1 ? '1px solid #1e2230' : 'none', background: isEditing ? 'rgba(255,255,255,0.03)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.012)', gap:12, alignItems:'center' }}>

                    {/* Username */}
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ ...S.mono, fontSize:12, color: ROLE_COLOR[role] }}>{u.username}</span>
                      {u.is_demo && (
                        <span style={{ ...S.mono, fontSize:9, padding:'1px 6px', borderRadius:10, background:'rgba(91,140,255,0.1)', border:'1px solid rgba(91,140,255,0.25)', color:'#5b8cff', letterSpacing:'0.08em' }}>DEMO</span>
                      )}
                    </div>

                    {/* Name + branch — editable */}
                    {isEditing ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <input
                          value={editVals.full_name}
                          onChange={e => setEditVals(p => ({ ...p, full_name: e.target.value }))}
                          placeholder="Display name"
                          style={{ background:'#161922', border:'1px solid #5b8cff44', borderRadius:6, padding:'6px 10px', color:'#e2e6f0', ...S.mono, fontSize:12, outline:'none' }}
                        />
                        {(role === 'cashier') && (
                          <input
                            value={editVals.branch}
                            onChange={e => setEditVals(p => ({ ...p, branch: e.target.value }))}
                            placeholder="Branch name (e.g. SM Seaside)"
                            style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:6, padding:'6px 10px', color:'#4a5468', ...S.mono, fontSize:11, outline:'none' }}
                          />
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ ...S.mono, fontSize:12, color:'#e2e6f0' }}>{u.full_name}</div>
                        {u.branch && <div style={{ ...S.mono, fontSize:10, color:'#4a5468', marginTop:1 }}>{u.branch}</div>}
                      </div>
                    )}

                    {/* Password reset field — only when editing */}
                    {isEditing ? (
                      <input
                        type="password"
                        value={editVals.new_password}
                        onChange={e => setEditVals(p => ({ ...p, new_password: e.target.value }))}
                        placeholder="New password"
                        style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:6, padding:'6px 10px', color:'#f5a623', ...S.mono, fontSize:11, outline:'none' }}
                      />
                    ) : (
                      <div />
                    )}

                    {/* Status toggle */}
                    <div>
                      {u.role !== 'admin' ? (
                        <button
                          onClick={() => toggleActive(u)}
                          style={{ ...S.mono, fontSize:10, padding:'3px 10px', borderRadius:20, border:`1px solid ${u.is_active ? 'rgba(0,212,170,0.3)' : 'rgba(255,92,92,0.3)'}`, background: u.is_active ? 'rgba(0,212,170,0.08)' : 'rgba(255,92,92,0.08)', color: u.is_active ? '#00d4aa' : '#ff5c5c', cursor:'pointer' }}
                        >
                          {u.is_active ? 'ACTIVE' : 'OFF'}
                        </button>
                      ) : (
                        <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>—</span>
                      )}
                    </div>

                    {/* Edit / Save / Cancel */}
                    <div style={{ display:'flex', gap:4 }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(u.username)}
                            disabled={saving}
                            style={{ ...S.mono, fontSize:10, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(0,212,170,0.3)', background:'rgba(0,212,170,0.1)', color:'#00d4aa', cursor:'pointer' }}
                          >
                            {saving ? '…' : 'SAVE'}
                          </button>
                          <button
                            onClick={() => { setEditing(null); setMsg(null); }}
                            style={{ ...S.mono, fontSize:10, padding:'4px 8px', borderRadius:6, border:'1px solid #1e2230', color:'#4a5468', background:'transparent', cursor:'pointer' }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          style={{ ...S.mono, fontSize:10, padding:'4px 10px', borderRadius:6, border:'1px solid #1e2230', color:'#4a5468', background:'transparent', cursor:'pointer' }}
                        >
                          EDIT
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline flash message */}
                  {flash && (
                    <div style={{ padding:'6px 20px', ...S.mono, fontSize:10, color: msg!.ok ? '#00d4aa' : '#ff5c5c', background: msg!.ok ? 'rgba(0,212,170,0.05)' : 'rgba(255,92,92,0.05)', borderBottom: i < roleUsers.length-1 ? '1px solid #1e2230' : 'none' }}>
                      {msg!.ok ? '✓' : '✗'} {msg!.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ ...S.mono, fontSize:10, color:'#4a5468', display:'flex', gap:20, flexWrap:'wrap' }}>
          {Object.entries(ROLE_COLOR).map(([r, c]) => (
            <span key={r}><span style={{ color:c }}>■</span> {r}</span>
          ))}
          <span style={{ marginLeft:'auto' }}>Default password for new staff: Kedco@2026!</span>
        </div>
      </div>
    </div>
  );
}
