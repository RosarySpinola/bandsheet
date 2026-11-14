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
    body: "Payslips arrive as the employer's own payroll email. The chapel votes to trust the employer's DKIM key on NEAR, and the engine checks every signature inside the enclave. Change one digit and the entry is refused.",
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
      <div className="gl-container grid grid-cols-2 gap-[calc(var(--gl)*14.375)] max-[991px]:grid-cols-1 max-[991px]:gap-12">
        <div className="sticky top-[calc(var(--gl)*8)] flex h-fit flex-col gap-[calc(var(--gl)*3)] max-[991px]:static">
          <LockArt />
          <h2 className="gl-h1">
            What nobody
            <br />
            can see
          </h2>
        </div>
        <div className="flex flex-col gap-[calc(var(--gl)*5)] pt-[calc(var(--gl)*10)] max-[991px]:pt-0">
          {BLOCKS.map((b, i) => (
            <Reveal key={b.title} delay={i * 200}>
              <h3 className="mb-[calc(var(--gl)*0.75)] text-[calc(var(--gl)*1.75)] font-semibold text-ink max-[991px]:text-lg">{b.title}</h3>
              <p className="gl-body3 max-w-[calc(var(--gl)*40)]">{b.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Frosted lavender/green glass lock (our own SVG, after Greenlock's 3D lock). */
function LockArt() {
  return (
    <svg viewBox="0 0 200 240" className="w-[calc(var(--gl)*14)] max-[991px]:w-36" aria-hidden="true">
      <defs>
        <linearGradient id="lock-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4edff" />
          <stop offset="0.45" stopColor="#c9bcff" />
          <stop offset="1" stopColor="#1f5249" />
        </linearGradient>
        <linearGradient id="lock-shackle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f5249" />
          <stop offset="0.5" stopColor="#dcd6ff" />
          <stop offset="1" stopColor="#8b78fe" />
        </linearGradient>
        <filter id="lock-soft"><feGaussianBlur stdDeviation="0.6" /></filter>
      </defs>
      <path d="M58 110 V72 a42 42 0 0 1 84 0 V110" fill="none" stroke="url(#lock-shackle)" strokeWidth="18" strokeLinecap="round" />
      <rect x="32" y="104" width="136" height="118" fill="url(#lock-body)" filter="url(#lock-soft)" />
      <rect x="32" y="104" width="136" height="118" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
      <path d="M32 104 L168 104 L32 222 Z" fill="#ffffff" fillOpacity="0.18" />
      <circle cx="100" cy="152" r="11" fill="#0f3026" />
      <rect x="95" y="156" width="10" height="28" fill="#0f3026" />
    </svg>
  )
}
