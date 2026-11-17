import { Reveal } from "@/components/gl/reveal"

const BLOCKS = [
  {
    title: "Not the committee",
    body: "Entries are sealed in the member's browser to an X25519 key that was generated inside the enclave and is locked to one build of the engine. The committee only ever handles ciphertext.",
  },
  {
    title: "Not our server",
    body: "Payslips go to NEAR AI Cloud only after its TEE attestation checks out against a fresh nonce. The signed response is verified, then forgotten. Nothing is stored.",
  },
  {
    title: "Not a forger",
    body: "A payroll email carries the employer's DKIM signature. The employer's signing key is recorded on NEAR, and the engine checks every signature inside the enclave. Change one digit and the signature fails. In your own unit, a payslip without one is badged self-attested.",
  },
  {
    title: "Not the attacker",
    body: "Each release is a sum over members. Before publishing, the engine asks whether any single member can be solved from everything ever released. If so, that cell stays withheld.",
  },
]

/** Greenlock sticky security block: art + title held left, three blocks rising in on the right. */
export function PrivacySection() {
  return (
    <section id="privacy" className="gl-section bg-white">
      <div className="gl-container gl-halves max-[991px]:gap-y-12">
        <div className="sticky top-[calc(var(--gl)*8)] flex h-fit flex-col gap-[calc(var(--gl)*1)] max-[991px]:static">
          <img src="/landing/crystal-lock.webp" alt="" width={800} height={800} loading="lazy" className="-ml-[calc(var(--gl)*3)] w-[calc(var(--gl)*24)] mix-blend-multiply max-[991px]:-ml-4 max-[991px]:w-56" />
          <h2 className="gl-h1">
            What nobody
            <br />
            can see
          </h2>
        </div>
        <div className="flex flex-col gap-[calc(var(--gl)*3.25)] self-center max-[991px]:pt-0">
          {BLOCKS.map((b, i) => (
            <Reveal key={b.title} delay={i * 200}>
              <h3 className="mb-[calc(var(--gl)*0.75)] text-[calc(var(--gl)*1.75)] font-semibold text-ink max-[991px]:text-lg">{b.title}</h3>
              <p className="gl-body3 max-w-[calc(var(--gl)*44)]">{b.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
