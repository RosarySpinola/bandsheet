import { Check } from "lucide-react"
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperSeparator, StepperTitle, StepperTrigger } from "@/components/reui/stepper"
import { cn } from "@/lib/utils"
import type { Step } from "./use-submit-flow"

export const STEPS: { n: Step; title: string }[] = [
  { n: 1, title: "Your member key" },
  { n: 2, title: "Upload payslip" },
  { n: 3, title: "Confirm fields" },
  { n: 4, title: "Seal and send" },
  { n: 5, title: "Done" },
]

/** ReUI stepper restyled: square numbered indicators, 2px ink rule for completed spans, no jumping ahead. */
export function StepsNav({ step, reached, onStep, locked }: { step: Step; reached: Step; onStep: (s: Step) => void; locked?: boolean }) {
  const current = STEPS[step - 1]!
  return (
    <Stepper value={step} onValueChange={(v) => onStep(v as Step)} indicators={{ completed: <Check className="size-4" strokeWidth={2.5} /> }}>
      <StepperNav className="gap-0">
        {STEPS.map((s) => {
          const disabled = locked || s.n > reached || (reached === 5 && s.n < 5)
          return (
            <StepperItem key={s.n} step={s.n} disabled={disabled} className="relative justify-start not-last:flex-1">
              <StepperTrigger className="flex-col items-start gap-3 rounded-none text-left outline-none focus-visible:ring-0 disabled:opacity-100 [&:focus-visible_[data-slot=stepper-indicator]]:outline-2 [&:focus-visible_[data-slot=stepper-indicator]]:outline-lav">
                <StepperIndicator
                  className={cn(
                    "size-9 rounded-none border-0 text-[0.9375rem] font-semibold transition-colors duration-500 ease-gl",
                    "data-[state=inactive]:bg-band data-[state=inactive]:text-[var(--slide-off)]",
                    "data-[state=active]:bg-ink data-[state=active]:text-white",
                    "data-[state=completed]:bg-lav-mid data-[state=completed]:text-ink",
                  )}
                >
                  {s.n}
                </StepperIndicator>
                <StepperTitle
                  className={cn(
                    "hidden text-[0.9375rem] leading-tight font-medium transition-colors duration-500 ease-gl md:block",
                    "data-[state=inactive]:text-[var(--slide-off)] data-[state=active]:text-ink data-[state=completed]:text-ink",
                  )}
                >
                  {s.title}
                </StepperTitle>
              </StepperTrigger>
              {s.n < 5 && (
                <StepperSeparator className="absolute top-[1.0625rem] right-3 left-12 m-0 h-0.5 rounded-none bg-border transition-colors duration-500 ease-gl group-data-[state=completed]/step:bg-ink" />
              )}
            </StepperItem>
          )
        })}
      </StepperNav>
      <p className="mt-4 text-[0.9375rem] font-medium text-ink md:hidden" aria-live="polite">
        Step {step} of 5 · {current.title}
      </p>
    </Stepper>
  )
}
