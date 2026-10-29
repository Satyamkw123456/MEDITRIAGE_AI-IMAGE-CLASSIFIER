import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturesSection from './components/FeaturesSection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import FAQsPage from './pages/FAQsPage'
import SalesPage from './pages/SalesPage'
import AboutPage from './pages/AboutPage'
import ClinicalPage from './pages/ClinicalPage'

const appUrl = (import.meta.env.VITE_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

export default function App() {
  const [currentHash, setCurrentHash] = useState(() => window.location.hash || '')

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateTo = (hash: string) => {
    window.location.hash = hash
    setCurrentHash(hash)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isSubpage =
    currentHash.startsWith('#/privacy') ||
    currentHash.startsWith('#/terms') ||
    currentHash.startsWith('#/faqs') ||
    currentHash.startsWith('#/sales') ||
    currentHash.startsWith('#/about') ||
    currentHash.startsWith('#/clinical')

  const renderContent = () => {
    if (currentHash.startsWith('#/privacy')) {
      return <PrivacyPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }
    if (currentHash.startsWith('#/terms')) {
      return <TermsPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }
    if (currentHash.startsWith('#/faqs')) {
      return <FAQsPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }
    if (currentHash.startsWith('#/sales')) {
      return <SalesPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }
    if (currentHash.startsWith('#/about')) {
      return <AboutPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }
    if (currentHash.startsWith('#/clinical')) {
      return <ClinicalPage onBack={() => navigateTo('#/')} appUrl={appUrl} />
    }

    return (
      <>
        <Hero />
        <FeaturesSection />
        <CTASection />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-(--bg) text-(--ink) selection:bg-(--primary-soft) selection:text-(--primary-dark) flex flex-col justify-between">
      <Navbar />
      <main className={`grow ${isSubpage ? 'pt-24 pb-16' : ''}`}>
        {renderContent()}
      </main>
      <Footer />
    </div>
  )
}
