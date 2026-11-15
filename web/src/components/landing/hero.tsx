import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"

const NARROW = "(max-width: 991px)"
const ART = {
  wide: { src: "/landing/hero.mp4", poster: "/landing/hero-poster.webp" },
  narrow: { src: "/landing/hero-mobile.mp4", poster: "/landing/hero-mobile-poster.webp" },
}

/** One looping muted shard video (our own render), the wide or the vertical cut; paused for reduced motion. */
function HeroVideo() {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      if (mq.matches) v.pause()
      else if (document.visibilityState === "visible") void v.play().catch(() => undefined)
    }
    apply()
    mq.addEventListener("change", apply)
    // A page opened in a background tab can't start playback; start it when the tab is shown.
    document.addEventListener("visibilitychange", apply)
    return () => {
      mq.removeEventListener("change", apply)
      document.removeEventListener("visibilitychange", apply)
    }
  }, [narrow])
  const art = narrow ? ART.narrow : ART.wide
  return (
    <video
      key={art.src}
      ref={ref}
      className="absolute inset-0 size-full object-cover"
      src={art.src}
      poster={art.poster}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  )
}

/** Greenlock load sequence: copy rises 3rem over 1000ms after 500ms, the art layer fades in 500ms after 1000ms. */
export function Hero() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section className="relative h-svh max-h-[1080px] min-h-[600px] overflow-hidden bg-[var(--hero-bg)]">
      <div
        className="absolute inset-0 bg-cover bg-center max-[991px]:bg-[url(/landing/hero-mobile-poster.webp)] min-[992px]:bg-[url(/landing/hero-poster.webp)]"
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500 ease-gl [transition-delay:1000ms]",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        <HeroVideo />
      </div>

      <div className="gl-container relative z-[4] flex h-full items-center max-[991px]:items-end max-[991px]:justify-center max-[991px]:pb-[calc(var(--gl)*3.5)] max-[991px]:text-center">
        <div
          className={cn(
            "flex flex-col gap-[calc(var(--gl)*2.25)] pt-[calc(var(--gl)*2)] transition-[opacity,transform] duration-1000 ease-gl [transition-delay:500ms] max-[991px]:items-center max-[991px]:gap-[calc(var(--gl)*1.5)]",
            ready ? "translate-y-0 opacity-100" : "translate-y-[calc(var(--gl)*3)] opacity-0",
          )}
        >
          <h1 className="gl-h1">
            Every band published.
            <br />
            Nobody exposed.
          </h1>
          <p className="gl-body1 max-w-[calc(var(--gl)*24)] max-[991px]:max-w-[17rem]">
            Union pay bands that never expose one colleague
          </p>
          <div className="mt-[calc(var(--gl)*1.5)] flex flex-col gap-[calc(var(--gl)*1)] max-[991px]:mt-[calc(var(--gl)*0.75)] max-[991px]:items-center">
            <Link to="/start" className="gl-cta group inline-flex w-fit items-baseline gap-[calc(var(--gl)*0.5)]">
              <span className="wipe group-hover:after:scale-x-100">Start your unit</span>
              <span aria-hidden="true" className="text-[0.8em]">↳</span>
            </Link>
            <Link to="/unit" className="gl-body1 group inline-flex w-fit items-baseline gap-[calc(var(--gl)*0.4)] text-ink">
              <span className="wipe group-hover:after:scale-x-100">Explore the example chapel</span>
              <span aria-hidden="true" className="text-[0.8em]">↳</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
