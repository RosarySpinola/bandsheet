import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { checkKey, type CheckedKey, type KeySource } from "@/components/unit/key-check"
import { setMember, useMember } from "@/components/unit/session"
import { UNIT_NAME } from "@/components/unit/nav"
import { HashValue } from "@/components/unit/copy-button"
import { CtaButton, SquareButton } from "@/components/unit/links"
import { ErrorState } from "@/components/unit/states"
import { PassMark } from "@/components/unit/verified-panel"
import { JoinVisual } from "@/components/unit/join/join-visual"

type State = { status: "idle" | "busy" | "error" | "done"; source?: KeySource; data?: CheckedKey; error?: unknown }

/** Only same-app paths are accepted as a return target. */
const safeNext = (n: string | null) => (n && /^\/unit(\/[a-z-]*)?$/.test(n) ? n : "/unit")

export default function Join() {
  const [params] = useSearchParams()
  const next = safeNext(params.get("next"))
  const navigate = useNavigate()
  const current = useMember()
  const [text, setText] = useState("")
  const [state, setState] = useState<State>({ status: "idle" })

  const open = async (source: KeySource) => {
    setState({ status: "busy", source })
    try {
      const data = await checkKey(source, text)
      if (data.member) {
        setMember({ invite: data.raw, slot: data.invite.slot, publicKey: data.invite.publicKey, demo: data.demo, joinedAt: Date.now() })
      }
      setState({ status: "done", source, data })
    } catch (error) {
      setState({ status: "error", source, error })
    }
  }
  const busy = state.status === "busy"
  const d = state.data

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-band lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-serif text-[1.75rem] leading-none font-medium text-ink">
            Bandsheet
          </Link>
          <Link to="/" className="group inline-flex items-center gap-2 text-[1rem] text-ink">
            <ArrowLeft className="size-4 transition-transform duration-500 ease-gl group-hover:-translate-x-1" />
            <span className="wipe">Back to site</span>
          </Link>
        </div>

        <main className="my-auto flex w-full max-w-[30rem] flex-col gap-8 py-14 animate-in fade-in-0 slide-in-from-bottom-12 delay-500 duration-1000 fill-mode-both ease-gl">
          <div className="flex flex-col gap-4">
            <p className="text-[0.9375rem] text-muted-foreground">{UNIT_NAME} · synthetic demo on NEAR testnet</p>
            <h1 className="font-serif text-[3rem] leading-[1.02] font-medium text-ink [font-variation-settings:'opsz'_72] md:text-[4rem]">
              Join your chapel
            </h1>
            <p className="text-[1.0625rem] leading-relaxed text-foreground">
              Open your member key. It lets you add your pay privately and ask where you stand. It cannot read anyone's figures, yours
              included.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <SquareButton onClick={() => open("demo")} disabled={busy} className="w-full">
              {busy && state.source === "demo" ? "Opening the demo member's key…" : "Use the demo member"}
            </SquareButton>
            <div className="flex items-center gap-4 text-[0.875rem] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or open your own invite
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="invite" className="text-[0.9375rem] font-medium text-ink">
                Invite JSON
              </label>
              <textarea
                id="invite"
                rows={4}
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='{ "account_id": "bandsheet-3f36b7.testnet", "private_key": "ed25519:…" }'
                className="w-full resize-y border-b border-ink bg-transparent py-2 font-mono text-[0.875rem] text-ink outline-none placeholder:text-muted-foreground/70 hover:border-b-2 focus-visible:border-b-2"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CtaButton size="lg" onClick={() => open("paste")} disabled={busy || !text.trim()}>
                Open key
              </CtaButton>
              <button
                type="button"
                onClick={() => open("outsider")}
                disabled={busy}
                className="wipe cursor-pointer text-[0.9375rem] text-muted-foreground transition-colors duration-[400ms] hover:text-ink disabled:opacity-50"
              >
                Try a key that isn't a member
              </button>
            </div>
          </div>

          <div aria-live="polite">
            {busy && <p className="text-[0.9375rem] text-muted-foreground">Asking the contract whether this key belongs to a member…</p>}
            {state.status === "error" && <ErrorState error={state.error} className="bg-white" />}
            {state.status === "done" && d && (
              <div className={cn("flex flex-col gap-5 border-t-2 p-6", d.member ? "border-ink bg-white" : "border-ink bg-lav-soft")}>
                <div className="flex items-start gap-3">
                  <PassMark pass={d.member} className="mt-0.5 size-7" />
                  <p className="text-[1.0625rem] leading-snug font-semibold text-ink">
                    {d.member ? `You're a member of ${UNIT_NAME}` : "Refused: this key is not a member of the chapel"}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Slot id</span>
                  <HashValue value={d.invite.slot} head={14} tail={8} />
                </div>
                {d.member ? (
                  <CtaButton size="lg" onClick={() => navigate(next)}>
                    Enter the chapel
                  </CtaButton>
                ) : (
                  <p className="text-[0.9375rem] text-foreground">The contract checked its member list. Nothing was stored in this tab.</p>
                )}
              </div>
            )}
            {state.status === "idle" && current && (
              <p className="text-[0.9375rem] text-muted-foreground">
                This tab already holds the key for slot <code className="font-mono">{current.slot.slice(0, 10)}…</code>.{" "}
                <Link to={next} className="wipe font-semibold text-ink">
                  Continue with it
                </Link>
              </p>
            )}
          </div>
        </main>

        <p className="max-w-[30rem] text-[0.8125rem] leading-relaxed text-muted-foreground">
          A synthetic demo on NEAR testnet. Your key is kept in this tab's session storage and is gone when you close it. It can only call{" "}
          <code className="font-mono">submit</code> on the chapel's contract. No real pay data, no mainnet, no payments.
        </p>
      </div>
      <JoinVisual />
    </div>
  )
}
