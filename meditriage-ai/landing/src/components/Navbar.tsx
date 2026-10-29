import { useState, useEffect } from 'react'

const appUrl = (import.meta.env.VITE_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: scrolled ? 'var(--glass-bg)' : 'rgba(251, 250, 247, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid rgba(18, 38, 58, 0.06)',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <a href="#/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img src="/logo.svg" alt="MediTriage AI" style={{ height: '48px', width: 'auto', objectFit: 'contain', display: 'block' }} />
      </a>

      {/* Desktop Navigation Links */}
      <nav className="hidden lg:flex items-center gap-6">
        <a href="#/clinical" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }} className="hover:text-(--primary) transition">
          Clinical Platform
        </a>
        <a href="#/about" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--ink) transition">
          About &amp; Mission
        </a>
        <a href="#/faqs" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--ink) transition">
          FAQs
        </a>
        <a href="#/sales" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--ink) transition">
          Pricing &amp; Sales
        </a>
        <a href="#/privacy" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'none' }} className="hover:text-(--ink) transition">
          DPDP Act &amp; Safety
        </a>
      </nav>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a
          href={`${appUrl}/en/triage/intake`}
          className="hidden sm:inline-flex"
          style={{
            padding: '8px 16px',
            borderRadius: '999px',
            backgroundColor: 'var(--primary-soft)',
            border: '1px solid rgba(22, 114, 110, 0.2)',
            color: 'var(--primary-dark)',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'background 0.15s ease',
          }}
        >
          Launch Intake
        </a>

        <a
          href={`${appUrl}/en/login`}
          style={{
            padding: '8px 18px',
            borderRadius: '999px',
            backgroundColor: 'var(--surface)',
            border: '1px solid rgba(18, 38, 58, 0.14)',
            color: 'var(--ink)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(18, 38, 58, 0.14)')}
        >
          Sign In
        </a>

        {/* Mobile toggle button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-(--muted) hover:text-(--ink)"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-(--surface) border-b border-(--border) p-6 shadow-lg flex flex-col gap-4 lg:hidden">
          <a
            href="#/clinical"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-(--ink) hover:text-(--primary)"
          >
            Clinical Platform (Intake, QR Card, Directory, Queue)
          </a>
          <a
            href="#/about"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-(--muted) hover:text-(--ink)"
          >
            About &amp; Mission
          </a>
          <a
            href="#/faqs"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-(--muted) hover:text-(--ink)"
          >
            FAQs
          </a>
          <a
            href="#/sales"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-(--muted) hover:text-(--ink)"
          >
            Pricing &amp; Sales
          </a>
          <a
            href="#/privacy"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-(--muted) hover:text-(--ink)"
          >
            DPDP Act 2023 Principles
          </a>
          <a
            href="#/terms"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-medium text-(--muted) hover:text-(--ink)"
          >
            Terms &amp; Clinician Supremacy
          </a>
          <div className="pt-2 border-t border-(--border) flex flex-col gap-2">
            <a
              href={`${appUrl}/en/triage/intake`}
              className="px-4 py-2 text-center rounded-xl bg-(--primary) text-white text-xs font-bold"
            >
              Launch Triage Intake
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
