import { useRef, useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { Reveal } from "@/components/gl/reveal"
import { CELL_CHOICES, choiceLabel, type CellChoice, type HeroId } from "@/components/unit-b/attack-math"
import { ChoiceGroup } from "@/components/unit-b/choice-group"
import { EvalFigure } from "@/components/unit-b/eval-figure"
import { GuardPanel } from "@/components/unit-b/guard-panel"
import { NaivePanel } from "@/components/unit-b/naive-panel"
import { CheatSection } from "@/components/unit-b/cheat-section"
import { Page, PageHeader, SquareButton } from "@/components/unit"

function Label({ children }: { children: string }) {
  return <span className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">{children}</span>
}

export default function AttackPage() {
  const [pair, setPair] = useState<[HeroId, HeroId]>([2, 1])
  const [choice, setChoice] = useState<CellChoice>("Senior")
  const [run, setRun] = useState(0)
  const [from, minus] = pair
  const stage = useRef<HTMLDivElement>(null)
  const go = () => {
    setRun((r) => r + 1)
    const el = stage.current
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: el.offsetHeight > window.innerHeight ? "start" : "end" })
    }
  }

  /** After the first run, every change replays the subtraction straight away. */
  const pick = (c: CellChoice) => {
    setChoice(c)
    if (run > 0) setRun((r) => r + 1)
  }
  const swap = () => {
    setPair(([a, b]) => [b, a])
    if (run > 0) setRun((r) => r + 1)
  }

  return (
    <Page className="gap-8 md:gap-10 md:pt-12">
      <PageHeader
        glyph="attack"
        eyebrow="Attack lab · synthetic demo unit"
        title="Subtract two honest tables."
        lede="You are the attacker. Both tools answered the same two requests, before and after one member joined. Pick a cell and subtract."
      />

      <Reveal>
        <div className="flex flex-col gap-6 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-6 md:flex-row md:gap-10">
            <div className="flex flex-col gap-3">
              <Label>Releases</Label>
              <div className="flex items-center gap-2">
                <span className="inline-flex min-h-10 items-center border border-ink px-4 font-serif text-[1.125rem] whitespace-nowrap text-ink tabular">
                  #{from} − #{minus}
                </span>
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap the order of the releases"
                  title="Swap the order"
                  className="inline-grid size-10 cursor-pointer place-items-center border border-border text-ink transition-colors duration-[400ms] ease-gl hover:border-ink hover:bg-lav-soft focus-visible:outline-2 focus-visible:outline-lav"
                >
                  <ArrowLeftRight className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label>Cell</Label>
              <ChoiceGroup
                label="Cell to subtract"
                value={choice}
                onChange={pick}
                options={CELL_CHOICES.map((c) => ({ value: c, label: choiceLabel(c), hint: c === "all" ? "Add every cell together, then subtract" : undefined }))}
              />
            </div>
          </div>
          <SquareButton onClick={go} className="min-w-[11rem] text-[1.0625rem]">
            {run === 0 ? "Subtract" : "Run it again"}
          </SquareButton>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div ref={stage} className="grid scroll-mt-6 scroll-mb-6 grid-cols-1 gap-6 lg:grid-cols-2">
          <NaivePanel from={from} minus={minus} choice={choice} run={run} />
          <GuardPanel from={from} minus={minus} choice={choice} run={run} />
        </div>
      </Reveal>

      <Reveal delay={400}>
        <EvalFigure />
      </Reveal>

      <div className="pt-8 md:pt-12">
        <CheatSection />
      </div>
    </Page>
  )
}
