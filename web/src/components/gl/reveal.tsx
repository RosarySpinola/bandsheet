import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Fires once when `amount` of the element is in view (Greenlock triggers at 15-25%), or, for an element taller than the
 * viewport, once it covers `amount` of the viewport. Re-observes when a background tab becomes visible, since a page
 * loaded in a hidden tab gets no intersection updates until then.
 */
export function useInViewOnce<T extends Element>(amount = 0.2) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const seen = (e: IntersectionObserverEntry) => {
      const rootH = e.rootBounds?.height ?? window.innerHeight
      return e.isIntersecting && (e.intersectionRatio >= amount || e.intersectionRect.height >= rootH * amount)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some(seen)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: [0, 0.02, 0.05, 0.1, amount / 2, amount] },
    )
    io.observe(el)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      io.unobserve(el)
      io.observe(el)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [amount, inView])
  return { ref, inView }
}

type RevealProps = {
  children: ReactNode
  className?: string
  /** stagger delay in ms (Greenlock uses 0 / 200 / 400) */
  delay?: number
  /** 1000ms for big blocks, 500ms for small rows */
  duration?: 500 | 1000
  as?: ElementType
}

/** Rise 3 Greenlock-rem and fade 0 -> 1 with the shared ease. */
export function Reveal({ children, className, delay = 0, duration = 1000, as: Tag = "div" }: RevealProps) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.2)
  return (
    <Tag
      ref={ref}
      data-in={inView}
      className={cn(
        "translate-y-[calc(var(--gl)*3)] opacity-0 transition-[opacity,transform] ease-gl data-[in=true]:translate-y-0 data-[in=true]:opacity-100",
        className,
      )}
      style={{ transitionDuration: `${duration}ms`, transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
