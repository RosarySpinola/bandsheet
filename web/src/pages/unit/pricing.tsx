import { Page } from "@/components/unit/page"
import { PageHeader } from "@/components/unit/page-header"
import { PricingContent } from "@/components/pricing/pricing-content"

/** Pricing inside the app shell, so a member never has to leave the app to read the plans. */
export default function UnitPricing() {
  return (
    <Page>
      <PageHeader
        glyph="pricing"
        eyebrow="Learn"
        title="Choose your plan"
        lede="Free for a single chapel, every feature included. Federations pay per member."
      />
      <div className="flex flex-col gap-16">
        <PricingContent inApp />
      </div>
    </Page>
  )
}
