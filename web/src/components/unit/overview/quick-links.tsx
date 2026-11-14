import { Link } from "react-router"
import { SCREENS } from "@/components/gl/screens"
import { Glyph } from "@/components/gl/glyph"
import { Reveal } from "@/components/gl/reveal"

/** Greenlock product list: rows grey (#bebebe) at rest, ink on hover in 500ms, glyph un-greys in 700ms. */
export function QuickLinks() {
  return (
    <ul className="flex flex-col">
      {SCREENS.map((s, i) => (
        <Reveal as="li" key={s.to} duration={500} delay={Math.min(i, 3) * 100}>
          <Link
            to={s.to}
            className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 border-b border-border py-5 md:grid-cols-[minmax(0,20rem)_1fr_auto] md:py-6"
          >
            <span className="col-start-1 row-start-1 text-[1.375rem] leading-tight font-semibold text-ink transition-colors md:text-inactive duration-500 ease-gl md:group-hover:text-ink md:group-focus-visible:text-ink md:text-[1.625rem]">
              {s.title}
            </span>
            <span className="col-span-2 row-start-2 text-[0.9375rem] leading-relaxed text-muted-foreground transition-colors md:text-inactive duration-500 ease-gl md:group-hover:text-foreground md:col-span-1 md:col-start-2 md:row-start-1">
              {s.blurb}
            </span>
            <span className="col-start-2 row-start-1 transition-[filter,opacity] md:opacity-45 md:grayscale duration-700 ease-gl md:group-hover:opacity-100 md:group-hover:grayscale-0 md:col-start-3">
              <Glyph kind={s.kind} className="size-12 md:size-14" />
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  )
}
