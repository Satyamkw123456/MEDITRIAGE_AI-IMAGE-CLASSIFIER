import { Activity, ShieldCheck, HeartPulse, QrCode, FileCheck2, Users } from 'lucide-react'

const features = [
  {
    icon: Activity,
    title: 'Geriatric Delta Engine',
    description: 'Compares vital signs against the patient’s personalized 12-month baseline rather than arbitrary standard population thresholds.',
  },
  {
    icon: ShieldCheck,
    title: 'Medication Shield',
    description: 'Detects pharmacological masking — alerting clinicians when beta-blockers, analgesics, or sedatives blunt vital physiological distress indicators.',
  },
  {
    icon: FileCheck2,
    title: 'Calibrated Quality Layer',
    description: 'Deterministic rule agreement and evidence density scoring gives clinicians full transparency into algorithmic confidence.',
  },
  {
    icon: QrCode,
    title: 'Expiring Emergency QR Card',
    description: 'Cryptographically hashed, revocable emergency profile providing first responders immediate access to critical life-saving data without identity leakage.',
  },
  {
    icon: Users,
    title: 'Caregiver & Proxy Intake',
    description: 'Granular permission scoping enables designated caregivers to report symptoms, manage medical baselines, and initiate proxy triage.',
  },
  {
    icon: HeartPulse,
    title: 'Pune-First Resource Directory',
    description: 'Real-time directory of local emergency ambulance units (108), geriatric wards, and pharmacies with one-tap verified routing.',
  },
]

export default function FeaturesSection() {
  return (
    <section
      id="features"
      style={{
        padding: '96px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 64px' }}>
        <h2
          className="font-display"
          style={{
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            margin: '0 0 16px',
          }}
        >
          Engineered for clinical precision where standard triage fails.
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          Older patients rarely present with textbook symptoms. MediTriage AI equips healthcare teams with personalized decision support.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {features.map((feat) => {
          const Icon = feat.icon
          return (
            <div
              key={feat.title}
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '18px',
                border: '1px solid rgba(18, 38, 58, 0.08)',
                padding: '28px',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-dark)',
                  marginBottom: '18px',
                }}
              >
                <Icon size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
                {feat.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                {feat.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
