const appUrl = (import.meta.env.VITE_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}
      >
        {/* Brand & Purpose column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <a href="#/">
              <img src="/logo.svg" alt="MediTriage AI" style={{ height: '46px', width: 'auto', objectFit: 'contain' }} />
            </a>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '280px' }}>
            AI-assisted clinical decision support for geriatric triage. It does not replace
            doctors, hospitals, or emergency services — a clinician always makes the final call.
          </p>
          <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: 'var(--primary-soft)', color: 'var(--primary-dark)', fontSize: '11px', fontWeight: 600 }}>
            <span>Stitch MCP Design System</span>
          </div>
        </div>

        {/* Clinical Platform */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', marginBottom: '14px' }}>
            Clinical Platform
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <li>
              <a href={`${appUrl}/en/triage/intake`} style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Triage Intake
              </a>
            </li>
            <li>
              <a href={`${appUrl}/en/patient/emergency-card`} style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Emergency QR Card
              </a>
            </li>
            <li>
              <a href={`${appUrl}/en/resources`} style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Pune Emergency Directory
              </a>
            </li>
            <li>
              <a href={`${appUrl}/en/dashboard/clinician`} style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Clinician Priority Queue
              </a>
            </li>
            <li>
              <a href="#/clinical" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} className="hover:underline transition">
                Platform Architecture Overview &rarr;
              </a>
            </li>
          </ul>
        </div>

        {/* Governance & Compliance */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', marginBottom: '14px' }}>
            Governance & Safety
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <li>
              <a href="#/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                DPDP Act 2023 Principles
              </a>
            </li>
            <li>
              <a href="#/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Clinician Supremacy Mandate
              </a>
            </li>
            <li>
              <a href="#/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Clinical Safety Protocols
              </a>
            </li>
            <li>
              <a href="#/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Cryptographic Audit Logs
              </a>
            </li>
          </ul>
        </div>

        {/* Company & Support */}
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)', marginBottom: '14px' }}>
            Explore &amp; Solutions
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <li>
              <a href="#/about" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                About &amp; Geriatric Mission
              </a>
            </li>
            <li>
              <a href="#/faqs" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Frequently Asked Questions
              </a>
            </li>
            <li>
              <a href="#/sales" style={{ color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
                Pricing &amp; Hospital Tiers
              </a>
            </li>
            <li>
              <a href="#/sales" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} className="hover:underline transition">
                Request Clinical Pilot &rarr;
              </a>
            </li>
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
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>&copy; 2026 MediTriage AI. All rights reserved. Architected with Stitch MCP.</span>
        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
          Statutory Clinical Decision-Support System. Emergency? Dial 112 / 108 immediately.
        </span>
      </div>
    </footer>
  )
}
