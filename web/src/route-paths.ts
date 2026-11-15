/**
 * Every page path the SPA serves (see router.tsx). The Pages Function in functions/[[path]].ts answers these with the
 * app and any other page path with the app's "not found" page and HTTP 404, so unknown URLs are not soft 404s.
 */
export const UNIT_PAGES = ["join", "submit", "releases", "attack", "vote", "stand", "verify", "how", "help", "pricing"] as const

export const SPA_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/how",
  "/signin",
  "/unit",
  ...UNIT_PAGES.map((p) => `/unit/${p}`),
])

/** A judge's own unit: /start, /join/:unitId (the invite link) and /u/:unitId with its pages. */
export const OWN_UNIT_PAGES = ["invite", "submit", "releases", "vote", "verify", "stand"] as const
const OWN_UNIT = new RegExp(`^(/start|/join/\\d{1,9}|/u/\\d{1,9}(/(${OWN_UNIT_PAGES.join("|")}))?)$`)

/** Is this URL path one of the app's pages? Trailing slashes are ignored. */
export function isSpaPath(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return SPA_PATHS.has(p || "/") || OWN_UNIT.test(p)
}
