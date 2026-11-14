import { Link } from "react-router"

const LINK = "wipe w-fit"

/** Greenlock footer: white, quiet, two halves of small links; copyright and legal left, facts and links right. */
export function SiteFooter() {
  return (
    <footer className="bg-white pt-[calc(var(--gl)*3.125)] pb-[calc(var(--gl)*1.5)] max-[991px]:pt-10 max-[991px]:pb-6">
      <div className="gl-container gl-halves gl-body3 max-[991px]:gap-y-6">
        <div className="flex flex-col justify-end gap-[calc(var(--gl)*0.5)] max-[991px]:order-2">
          <span>© Bandsheet, 2026 · Built at NEAR HACKATHON</span>
          <div className="flex gap-x-[calc(var(--gl)*1.5)] max-[991px]:gap-x-5">
            <Link to="/privacy" className={LINK}>
              Privacy Policy
            </Link>
            <Link to="/terms" className={LINK}>
              Terms
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-[calc(var(--gl)*0.5)]">
          <span>NEAR testnet · synthetic Harbour Courier chapel</span>
          <div className="flex flex-wrap gap-x-[calc(var(--gl)*1.5)] gap-y-1 max-[991px]:gap-x-5">
            <Link to="/unit" className={LINK}>
              Live demo
            </Link>
            <Link to="/pricing" className={LINK}>
              Pricing
            </Link>
            <Link to="/unit/verify" className={LINK}>
              Verify it yourself
            </Link>
            <a href="https://github.com/RosarySpinola/bandsheet" className={LINK} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
