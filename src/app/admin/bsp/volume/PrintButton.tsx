'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding:'8px 16px', borderRadius:6,
        border:'1px solid rgba(0,212,170,0.3)', background:'rgba(0,212,170,0.08)',
        color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:11,
        cursor:'pointer', letterSpacing:'0.05em',
      }}
    >
      🖨 PRINT FILING SHEET
    </button>
  );
}
