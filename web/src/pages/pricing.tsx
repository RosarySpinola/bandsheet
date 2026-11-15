import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Reveal } from "@/components/gl/reveal"
import { PricingContent } from "@/components/pricing/pricing-content"

/** Public plans page, inside the site header and footer. The app shell shows the same content at /unit/pricing. */
export default function PricingPage() {
  return (
    <div className="min-h-svh bg-white">
      <SiteHeader />
      <main className="gl-section pt-[calc(var(--gl)*12)]! max-[991px]:pt-28!">
        <div className="gl-container flex flex-col gap-[calc(var(--gl)*5)]">
          <Reveal>
            <h1 className="gl-h1">Choose your plan</h1>
            <p className="gl-body1 mt-[var(--gl)] max-w-[calc(var(--gl)*48)]">
              Free for a single chapel, every feature included. Federations pay per member.
            </p>
          </Reveal>
          <PricingContent />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
