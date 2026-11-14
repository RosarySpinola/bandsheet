import type { ReleaseRecord, Suppressed } from "@bandsheet/core"

export type BandSource = { from: number; withheld: { id: number; reason: Suppressed["reason"] }[] }

const isGrade = (key: Record<string, unknown>, grade: string) => Object.keys(key).length === 1 && key.grade === grade

/**
 * Which release a grade's band comes from (newest one that published the grade-only cell), and which newer
 * releases withheld it. Mirrors the server's latestBands / bandSource walk, so the copy matches the figure.
 */
export function bandSource(releases: readonly ReleaseRecord[], grade: string): BandSource | null {
  const withheld: BandSource["withheld"] = []
  for (let i = releases.length - 1; i >= 0; i--) {
    const r = releases[i]!
    if (r.status !== "released" && r.status !== "partially_released") continue
    if (r.cells.some((c) => isGrade(c.key, grade))) return { from: r.id, withheld: withheld.reverse() }
    const s = r.suppressed.find((x) => isGrade(x.key, grade))
    if (s) withheld.push({ id: r.id, reason: s.reason })
  }
  return null
}

const list = (ids: number[]) =>
  ids.length === 1 ? `#${ids[0]}` : `${ids.slice(0, -1).map((i) => `#${i}`).join(", ")} and #${ids.at(-1)}`

/** One plain sentence: where the band comes from and, if older than the latest release, why. */
export function bandSourceText(src: BandSource | null, grade: string, latest: number | undefined): string {
  if (!src) return `No release has published a safe ${grade} band yet.`
  if (src.withheld.length === 0) {
    return src.from === latest
      ? `Your ${grade} band comes from release #${src.from}, the latest.`
      : `Your ${grade} band comes from release #${src.from}; later releases did not publish ${grade} on its own.`
  }
  const ids = src.withheld.map((w) => w.id)
  const why = src.withheld.every((w) => w.reason === "small_cell")
    ? `it covered fewer than k members`
    : `comparing it with release #${src.from} would expose one member's pay`
  return `Your ${grade} band comes from release #${src.from}. ${ids.length === 1 ? "Release" : "Releases"} ${list(ids)} withheld ${grade}, because ${why}, so #${src.from} is still the latest safe figure.`
}
