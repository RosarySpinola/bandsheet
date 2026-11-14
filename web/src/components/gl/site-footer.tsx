import { Link } from "react-router"

/** Greenlock footer: white, quiet, two columns of small links. */
export function SiteFooter() {
  return (
    <footer className="bg-white px-[calc(var(--gl)*2.25)] pt-[calc(var(--gl)*3.125)] pb-[calc(var(--gl)*1.5)] max-[991px]:px-4 max-[991px]:pt-10">
      <div className="gl-container grid grid-cols-2 gap-6 text-[calc(var(--gl)*1.25)] leading-[calc(var(--gl)*2)] text-text max-[991px]:text-sm max-[991px]:leading-6">
        <div className="flex flex-col">
          <span>© Bandsheet, 2026. Built at NEAR HACKATHON.</span>
          <Link to="/unit/verify" className="wipe w-fit">
            Verify it yourself
          </Link>
        </div>
        <div className="flex flex-col items-start">
          <span>Runs on NEAR testnet · synthetic demo unit</span>
          <div className="flex gap-6">
            <a href="https://github.com/RosarySpinola/bandsheet" className="wipe" target="_blank" rel="noreferrer">
              Source
            </a>
            <Link to="/unit" className="wipe">
              Demo unit
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
