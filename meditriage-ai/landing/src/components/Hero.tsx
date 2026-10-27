import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import TrustPreviewCard from './TrustPreviewCard'

function Social({ path }: { path: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--muted)" xmlns="http://www.w3.org/2000/svg">
      <path d={path} />
    </svg>
  )
}

const barLabel: React.CSSProperties = {
  fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--muted)', textDecoration: 'none',
}

export default function Hero() {
  return (
    <section style={{ position: 'relative', width: '100%', height: '100vh', minHeight: '640px', overflow: 'hidden' }}>
      {/* Video Background — fully visible */}
      <video
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Subtle radial wash centered on text — keeps video vivid while ensuring crisp typography */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 68% 56% at 50% 48%, rgba(251, 250, 247, 0.72) 0%, rgba(251, 250, 247, 0.45) 40%, rgba(251, 250, 247, 0.08) 75%, rgba(251, 250, 247, 0.3) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Centered lockup — Glacier-mechanic staggered reveal */}
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>

        {/* Brand lockup */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '26px',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '10px 22px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 4px 16px rgba(18, 38, 58, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.svg" alt="MediTriage AI" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--primary-dark)', paddingLeft: '0.3em' }}>
            Clinical Intelligence Platform
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.24, ease: 'easeOut' }}
          className="font-display"
          style={{
            margin: 0,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            textShadow: '0 2px 24px rgba(255, 255, 255, 0.9), 0 1px 6px rgba(255, 255, 255, 0.95)',
          }}
        >
          <span style={{ display: 'block', fontWeight: 600, fontSize: 'clamp(2.6rem, 6.4vw, 4.6rem)' }}>
            Triage that knows
          </span>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 'clamp(2.6rem, 6.4vw, 4.6rem)', color: 'var(--primary-dark)' }}>
            what's normal for them.
          </span>
        </motion.h1>

        {/* Accent line (short, italic — Glacier-style subtitle tone) */}
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.38, ease: 'easeOut' }}
          className="font-display"
          style={{
            margin: '22px 0 0',
            maxWidth: '520px',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: '19px',
            lineHeight: 1.5,
            color: 'var(--ink)',
            textShadow: '0 1px 12px rgba(255, 255, 255, 0.95)',
          }}
        >
          Built for the patients standard triage overlooks.
        </motion.p>

        {/* Supporting copy */}
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.48, ease: 'easeOut' }}
          style={{
            margin: '14px 0 0',
            maxWidth: '540px',
            fontSize: '15.5px',
            lineHeight: 1.65,
            color: '#1a324b',
            fontWeight: 500,
            textShadow: '0 1px 12px rgba(255, 255, 255, 0.95)',
          }}
        >
          MediTriage AI compares every older patient against their own baseline, flags what
          their medications might be masking, and tells clinicians exactly how much to trust
          each result.
        </motion.p>

        {/* True-ellipse CTA — Glacier mechanic */}
        <motion.a
          href="#demo"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
          whileHover={{ backgroundColor: 'var(--primary-dark)', scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            marginTop: '38px', padding: '19px 56px', borderRadius: '50%',
            border: '1.5px solid var(--primary-dark)', color: '#fff', textDecoration: 'none',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            backgroundColor: 'var(--primary)', boxShadow: 'var(--shadow-md)',
            display: 'inline-flex', alignItems: 'center', gap: '10px',
          }}
        >
          See It In Action <ArrowRight size={15} />
        </motion.a>
      </div>

      {/* Floating proof card */}
      <div style={{ position: 'absolute', bottom: '94px', right: 'clamp(16px, 4vw, 64px)', zIndex: 10 }} className="hidden lg:block">
        <TrustPreviewCard />
      </div>

      {/* Floating footer bar — Glacier mechanic, in-hero */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.85, ease: 'easeOut' }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 36px 24px', borderTop: '1px solid rgba(18,38,58,0.06)',
          background: 'linear-gradient(to top, var(--bg) 0%, rgba(251,250,247,0) 100%)',
          paddingTop: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Social path="M15 8h-2a1 1 0 00-1 1v2h3l-.4 3H12v6H9v-6H7v-3h2V8.5A3.5 3.5 0 0112.5 5H15z" />
            <Social path="M4 4l6.8 8.2L4.3 20H6l5.6-6.3L16.5 20H20l-7.1-8.6L19.4 4h-1.7l-5.1 5.8L7.6 4z" />
            <Social path="M4.5 9H7v11H4.5zM5.75 4a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2zM9.5 9H12v1.6c.4-.8 1.6-1.7 3.2-1.7 2.6 0 3.3 1.6 3.3 4.2V20H16v-4.9c0-1.3-.5-2.1-1.6-2.1S12.5 13.8 12.5 15V20H9.5z" />
          </div>
          <a href="#privacy" className="hidden sm:inline-block" style={barLabel}>Privacy Policy</a>
        </div>

        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', ...barLabel, display: 'flex', gap: '5px' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>Scroll</span>
          <span>To Explore</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <a href="#terms" className="hidden sm:inline-block" style={barLabel}>Terms of Service</a>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
            <path d="M5 15V9M10 19V5M15 16V8M20 13v-2" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </motion.div>
    </section>
  )
}
