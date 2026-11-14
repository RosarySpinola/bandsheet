import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Hero } from "@/components/landing/hero"
import { Ticker } from "@/components/landing/ticker"
import { ProofBand } from "@/components/landing/proof-band"
import { FocusSection } from "@/components/landing/focus-section"
import { KeySlider } from "@/components/landing/key-slider"
import { ExploreList } from "@/components/landing/explore-list"
import { PrivacySection } from "@/components/landing/privacy-section"

/** Greenlock page order: hero, ticker, numbers, focus, key message, products, security, footer. */
export function LandingPage() {
  return (
    <div className="min-h-svh bg-white">
      <SiteHeader />
      <main>
        <Hero />
        <Ticker />
        <ProofBand />
        <FocusSection />
        <KeySlider />
        <ExploreList />
        <PrivacySection />
      </main>
      <SiteFooter />
    </div>
  )
}
