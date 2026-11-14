import { useEffect, useState } from "react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"
import { ShardField } from "./shard-field"

/** Greenlock load sequence: copy rises 3rem over 1000ms after 500ms, art layer fades in 500ms after 1000ms. */
export function Hero() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section className="relative h-svh max-h-[1080px] min-h-[560px] overflow-hidden bg-[var(--hero-bg)]">
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500 ease-gl [transition-delay:1000ms]",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="absolute inset-0 max-[991px]:hidden">
          <ShardField />
        </div>
        <div className="absolute inset-0 min-[992px]:hidden">
          <ShardField mobile />
        </div>
      </div>

      <div className="gl-container relative z-[4] flex h-full items-center pt-[calc(var(--gl)*6)] max-[991px]:items-end max-[991px]:pt-0 max-[991px]:justify-center max-[991px]:pb-14 max-[991px]:text-center">
        <div
          className={cn(
            "flex max-w-[calc(var(--gl)*52)] flex-col gap-[calc(var(--gl)*2)] transition-[opacity,transform] duration-1000 ease-gl [transition-delay:500ms]",
            ready ? "translate-y-0 opacity-100" : "translate-y-[calc(var(--gl)*3)] opacity-0",
          )}
        >
          <h1 className="gl-h1">
            Every band published.
            <br />
            Nobody exposed.
          </h1>
          <p className="gl-body1 max-w-[calc(var(--gl)*34)] max-[991px]:mx-auto">
            A sealed pay-band box for unions. It shows members what the grade really pays, and refuses
            any table that would give away one colleague's salary.
          </p>
          <Link
            to="/unit"
            className="gl-cta group inline-flex w-fit items-center gap-[calc(var(--gl)*0.5)] max-[991px]:mx-auto"
          >
            <span className="wipe group-hover:after:scale-x-100">Open the demo unit</span>
            <span aria-hidden="true" className="inline-block translate-y-[0.08em]">↳</span>
          </Link>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[62%] bg-gradient-to-t from-[var(--hero-bg)] via-[var(--hero-bg)]/85 to-transparent min-[992px]:hidden" />
      <div className="absolute inset-x-0 bottom-0 z-[5] h-[2px] bg-mint min-[992px]:hidden" />
    </section>
  )
}
