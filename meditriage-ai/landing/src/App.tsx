import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturesSection from './components/FeaturesSection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--primary-soft)] selection:text-[var(--primary-dark)]">
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
