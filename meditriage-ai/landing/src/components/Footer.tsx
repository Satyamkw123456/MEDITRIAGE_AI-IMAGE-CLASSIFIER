
export default function Footer() {
  return (
    <footer
      id="safety"
      style={{
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid rgba(18, 38, 58, 0.08)',
        padding: '64px 36px 36px',
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}
      >
        {/* Brand & Purpose column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <img src="/logo.svg" alt="MediTriage AI" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '300px' }}>
            AI-assisted clinical decision support for geriatric triage. It does not replace
            doctors, hospitals, or emergency services — a clinician always makes the final call.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', marginBottom: '14px' }}>
            Clinical Platform
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <li><a href="http://localhost:3000/en/triage/intake" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Triage Intake</a></li>
            <li><a href="http://localhost:3000/en/patient/emergency-card" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Emergency QR Card</a></li>
            <li><a href="http://localhost:3000/en/resources" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Pune Emergency Directory</a></li>
            <li><a href="http://localhost:3000/en/dashboard/clinician" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Clinician Priority Queue</a></li>
          </ul>
        </div>

        {/* Governance & Compliance */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', marginBottom: '14px' }}>
            Governance & Safety
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <li><a href="http://localhost:3000/en/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>DPDP Act 2023 Principles</a></li>
            <li><a href="http://localhost:3000/en/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Clinician Supremacy Mandate</a></li>
            <li><a href="http://localhost:3000/en/dashboard/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Clinical Safety Protocols</a></li>
            <li><a href="http://localhost:3000/en/dashboard/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Cryptographic Audit Logs</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar with copyright and required medical disclaimers */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '24px',
          borderTop: '1px solid rgba(18, 38, 58, 0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>© 2026 MediTriage AI. All rights reserved.</span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Not a substitute for professional medical advice.</span>
      </div>
    </footer>
  )
}
