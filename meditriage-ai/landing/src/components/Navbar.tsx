import { HeartPulse } from 'lucide-react'

export default function Navbar() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '16px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(251, 250, 247, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(18, 38, 58, 0.06)',
      }}
    >
      <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <HeartPulse size={16} strokeWidth={2.4} />
        </div>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
          }}
        >
          MediTriage
        </span>
      </a>

      <nav className="hidden md:flex items-center gap-7">
        <a href="#features" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }}>
          Features
        </a>
        <a href="#architecture" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }}>
          Clinical Intelligence
        </a>
        <a href="#safety" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }}>
          Safety & Disclaimers
        </a>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a
          href="http://localhost:3001/en/login"
          style={{
            padding: '8px 18px',
            borderRadius: '999px',
            backgroundColor: 'var(--surface)',
            border: '1px solid rgba(18, 38, 58, 0.12)',
            color: 'var(--ink)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Clinical Portal
        </a>
      </div>
    </header>
  )
}
