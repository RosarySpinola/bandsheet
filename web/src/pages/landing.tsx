import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Hero } from "@/components/landing/hero"
import { Ticker } from "@/components/landing/ticker"
import { ProofBand } from "@/components/landing/proof-band"
import { FocusSection } from "@/components/landing/focus-section"
import { KeySlider } from "@/components/landing/key-slider"
import { ExploreList } from "@/components/landing/explore-list"
import { ScreensCard } from "@/components/landing/screens-card"
import { PrivacySection } from "@/components/landing/privacy-section"

/** Greenlock page order: hero, ticker, numbers, focus, key message, products, product media card, security, footer. */
export function LandingPage() {
  return (
    <div className="lp min-h-svh overflow-x-clip bg-white">
      <SiteHeader />
      <main>
        <Hero />
        <Ticker />
        <ProofBand />
        <FocusSection />
        <KeySlider />
        <ExploreList />
        <ScreensCard />
        <PrivacySection />
      </main>
      <SiteFooter />
    </div>
  )
}
