import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, CheckCircle } from 'lucide-react'
import TrustPreviewCard from './TrustPreviewCard'

const appUrl = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '')

function Social({ path }: { path: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--muted)" xmlns="http://www.w3.org/2000/svg">
      <path d={path} />
    </svg>
  )
}

const barLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  textDecoration: 'none',
}

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches && videoRef.current) {
      videoRef.current.pause()
    }
  }, [])

  return (
    <section style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Decorative Video Background */}
      <video
        ref={videoRef}
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
        preload="metadata"
        aria-hidden="true"
      />

      {/* Radial soft ambient wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 75% 65% at 50% 48%, rgba(251, 250, 247, 0.6) 0%, rgba(251, 250, 247, 0.25) 50%, rgba(251, 250, 247, 0.4) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Centered lockup with frosted scrim for guaranteed >= 4.5:1 text contrast */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          paddingTop: '110px',
          paddingBottom: '90px',
          paddingLeft: '20px',
          paddingRight: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '740px',
            width: '100%',
            background: 'var(--scrim-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '28px',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: 'var(--shadow-md)',
            padding: '36px 32px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Brand lockup */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '16px',
              background: 'rgba(255, 255, 255, 0.85)',
              padding: '8px 24px',
              borderRadius: '999px',
              border: '1px solid rgba(18, 38, 58, 0.08)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.svg" alt="MediTriage AI" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--primary-dark)', marginTop: '1px' }}>
              Clinical Intelligence Platform
            </span>
          </motion.div>

          {/* Headline without heavy drop shadow */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.24, ease: 'easeOut' }}
            className="font-display"
            style={{
              margin: 0,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
              lineHeight: 1.08,
            }}
          >
            <span style={{ display: 'block', fontWeight: 600, fontSize: 'clamp(2.4rem, 5.8vw, 4.2rem)' }}>
              Triage that knows
            </span>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 'clamp(2.4rem, 5.8vw, 4.2rem)', color: 'var(--primary-dark)' }}>
              what's normal for them.
            </span>
          </motion.h1>

          {/* Subtitle tone */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.38, ease: 'easeOut' }}
            className="font-display"
            style={{
              margin: '18px 0 0',
              maxWidth: '520px',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: '18px',
              lineHeight: 1.5,
              color: 'var(--ink)',
            }}
          >
            Built for the patients standard triage overlooks.
          </motion.p>

          {/* Supporting copy */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.48, ease: 'easeOut' }}
            style={{
              margin: '12px 0 0',
              maxWidth: '540px',
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--muted)',
              fontWeight: 400,
            }}
          >
            MediTriage AI compares every older patient against their own baseline, flags what
            their medications might be masking, and tells clinicians exactly how much to trust
            each result.
          </motion.p>

          {/* CTA & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '28px', gap: '14px' }}>
            <motion.a
              href="#demo"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
              whileHover={{ backgroundColor: 'var(--primary-dark)', scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '16px 44px',
                borderRadius: '999px',
                border: '1.5px solid var(--primary-dark)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                backgroundColor: 'var(--primary)',
                boxShadow: 'var(--shadow-md)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              See It In Action <ArrowRight size={15} />
            </motion.a>

            <a
              href={`${appUrl}/en/login`}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--primary-dark)',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Sign in
            </a>
          </div>

          {/* Slim Trust Strip directly under Hero Lockup */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(18, 38, 58, 0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              fontSize: '11.5px',
              fontWeight: 500,
              color: 'var(--muted)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} color="var(--primary)" /> Decision support only
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={12} color="var(--primary)" /> Clinician always decides
            </span>
            <span>•</span>
            <span>DPDP Act 2023 aligned</span>
            <span>•</span>
            <span>English / हिन्दी / मराठी</span>
          </motion.div>
        </div>
      </div>

      {/* Floating proof card */}
      <div style={{ position: 'absolute', bottom: '94px', right: 'clamp(16px, 4vw, 64px)', zIndex: 10 }} className="hidden lg:block">
        <TrustPreviewCard />
      </div>

      {/* Floating footer bar in-hero */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.85, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 36px 20px',
          borderTop: '1px solid rgba(18,38,58,0.06)',
          background: 'linear-gradient(to top, var(--bg) 0%, rgba(251,250,247,0) 100%)',
          paddingTop: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Social path="M15 8h-2a1 1 0 00-1 1v2h3l-.4 3H12v6H9v-6H7v-3h2V8.5A3.5 3.5 0 0112.5 5H15z" />
            <Social path="M4 4l6.8 8.2L4.3 20H6l5.6-6.3L16.5 20H20l-7.1-8.6L19.4 4h-1.7l-5.1 5.8L7.6 4z" />
            <Social path="M4.5 9H7v11H4.5zM5.75 4a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2zM9.5 9H12v1.6c.4-.8 1.6-1.7 3.2-1.7 2.6 0 3.3 1.6 3.3 4.2V20H16v-4.9c0-1.3-.5-2.1-1.6-2.1S12.5 13.8 12.5 15V20H9.5z" />
          </div>
          <a href={`${appUrl}/en/privacy`} className="hidden sm:inline-block" style={barLabel}>
            Privacy Policy
          </a>
        </div>

        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', ...barLabel, display: 'flex', gap: '5px' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>Scroll</span>
          <span>To Explore</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <a href={`${appUrl}/en/terms`} className="hidden sm:inline-block" style={barLabel}>
            Terms of Service
          </a>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
            <path d="M5 15V9M10 19V5M15 16V8M20 13v-2" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </motion.div>
    </section>
  )
}
