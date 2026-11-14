/** Display helpers. Everything a person reads goes through these so numbers look the same everywhere. */

const eurFmt = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const intFmt = new Intl.NumberFormat("en-IE")

export const eur = (n: number) => eurFmt.format(n)
export const int = (n: number) => intFmt.format(n)

export function signedEur(n: number): string {
  if (n === 0) return eur(0)
  return `${n > 0 ? "+" : "−"}${eur(Math.abs(n))}`
}

export function signedPct(n: number): string {
  if (n === 0) return "0%"
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-IE", { maximumFractionDigits: 1 })}%`
}

/** a1dd4054…3f57 */
export function shortHash(h: string | null | undefined, head = 8, tail = 4): string {
  if (!h) return "—"
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`
}

/** NEAR block timestamps are nanoseconds as a decimal string; ISO strings are accepted too. */
export function fromNanos(ns: string | number | null | undefined): Date | null {
  if (ns === null || ns === undefined) return null
  const s = String(ns)
  if (!/^\d+$/.test(s)) {
    const t = Date.parse(s)
    return Number.isNaN(t) ? null : new Date(t)
  }
  const ms = s.length > 13 ? Number(s.slice(0, s.length - 6)) : Number(s)
  return Number.isFinite(ms) ? new Date(ms) : null
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })

export function when(d: Date | null): string {
  if (!d) return "—"
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`
}

export function relative(d: Date | null, now = Date.now()): string {
  if (!d) return "—"
  const s = Math.round((now - d.getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return dateFmt.format(d)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${int(n)} ${n === 1 ? one : many}`
}

/** Cell key {grade:"Senior"} -> "Senior"; {grade:"Senior",site:"Port"} -> "Senior · Port". */
export function cellLabel(key: Record<string, string>): string {
  return Object.values(key).join(" · ") || "All members"
}

export const GRADE_ORDER = ["Junior", "Reporter", "Senior", "Editor", "Chief"] as const

export function gradeRank(g: string | undefined): number {
  const i = GRADE_ORDER.indexOf((g ?? "") as (typeof GRADE_ORDER)[number])
  return i === -1 ? 99 : i
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/** Hex digest -> base58, the form NEAR shows a contract's code_hash in. */
export function hexToBase58(hex: string): string {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2) return ""
  let n = BigInt(`0x${hex || "0"}`)
  let out = ""
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out
    n /= 58n
  }
  for (let i = 0; i < hex.length && hex.slice(i, i + 2) === "00"; i += 2) out = `1${out}`
  return out
}
