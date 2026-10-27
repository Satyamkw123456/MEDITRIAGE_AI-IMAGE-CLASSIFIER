import { ArrowRight, ShieldCheck } from 'lucide-react'

export default function CTASection() {
  return (
    <section
      id="demo"
      style={{
        position: 'relative',
        padding: '96px 24px',
        backgroundColor: 'var(--primary-dark)',
        color: '#ffffff',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, rgba(13, 148, 136, 0) 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            fontSize: '11.5px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '20px',
          }}
        >
          <ShieldCheck size={14} /> Clinical Decision Support
        </div>

        <h2
          className="font-display"
          style={{
            fontSize: 'clamp(2rem, 4.5vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            margin: '0 0 16px',
          }}
        >
          Ready to experience geriatric-aware clinical triage?
        </h2>

        <p style={{ fontSize: '15.5px', color: 'rgba(255,255,255,0.85)', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          Transparent by design. Safe by default. A human clinician always has the final word.
        </p>

        <a
          href="http://localhost:3000/en/triage/intake"
          style={{
            padding: '16px 36px',
            borderRadius: '999px',
            backgroundColor: '#ffffff',
            color: 'var(--primary-dark)',
            fontSize: '13.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          Launch Triage Intake <ArrowRight size={15} />
        </a>
      </div>
    </section>
  )
}
