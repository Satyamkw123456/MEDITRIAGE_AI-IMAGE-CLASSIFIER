import { motion } from 'framer-motion'
import { ShieldCheck, AlertCircle, Activity, Stethoscope } from 'lucide-react'

export default function TrustPreviewCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.7, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        width: '320px',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '18px',
        border: '1px solid rgba(18, 38, 58, 0.08)',
        boxShadow: 'var(--shadow-lg)',
        padding: '18px 20px',
        textAlign: 'left',
      }}
    >
      {/* Header with status pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: 'var(--primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Activity size={15} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
            Geriatric Delta Engine
          </span>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '3px 8px',
            borderRadius: '999px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.2)',
          }}
        >
          Priority Alert
        </span>
      </div>

      {/* Case Delta Metric */}
      <div style={{ backgroundColor: 'var(--bg)', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
          <span>Baseline Comparison</span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Age 78 • Female</span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
          BP 108/65 <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>(Baseline 145/88)</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
          Relative hypotension flagged against personal 12-month median.
        </p>
      </div>

      {/* Medication Masking Flag */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px' }}>
        <AlertCircle size={14} color="#ea580c" style={{ marginTop: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '11.5px', color: 'var(--ink)', lineHeight: 1.45 }}>
          <strong>Medication Shield:</strong> Beta-blocker (Metoprolol) masking physiological tachycardia response.
        </span>
      </div>

      {/* Trust & Human Verification Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(18, 38, 58, 0.06)',
          paddingTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--muted)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-dark)', fontWeight: 600 }}>
          <ShieldCheck size={14} /> 94% Agreement
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Stethoscope size={13} /> Clinician Review
        </span>
      </div>
    </motion.div>
  )
}
