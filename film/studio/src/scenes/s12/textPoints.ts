import { useEffect, useState } from "react"
import { continueRender, delayRender } from "remotion"
import { rand } from "./data"

export type Pt = { x: number; y: number }
/** Glyph layout of a centre-anchored run: x of each glyph's left edge (relative to centre) + inside points. */
export type Glyphs = { xs: number[]; pts: Pt[]; ready?: boolean }

/**
 * Samples `n` points inside the glyphs of `text` (centre-anchored, alphabetic baseline at 0,0),
 * from an offscreen canvas drawn with the loaded webfont. Deterministic: grid scan + seeded pick.
 */
function sample(text: string, family: string, size: number, n: number, seed: number): Glyphs {
  const w = Math.ceil(size * text.length * 0.8) + 40
  const h = Math.ceil(size * 1.6)
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  const ctx = cv.getContext("2d")
  if (!ctx) return { xs: [], pts: [] }
  ctx.fillStyle = "#000"
  ctx.font = `500 ${size}px "${family}"`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  const ox = w / 2
  const oy = h * 0.72
  ctx.fillText(text, ox, oy)
  const total = ctx.measureText(text).width
  const chars = [...text]
  const xs = chars.map((_, i) => -total / 2 + ctx.measureText(chars.slice(0, i).join("")).width)
  const data = ctx.getImageData(0, 0, w, h).data
  const inside: Pt[] = []
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 140) inside.push({ x: x - ox, y: y - oy })
    }
  }
  const pts: Pt[] = []
  if (inside.length > 0) {
    for (let i = 0; i < n; i++) {
      const p = inside[Math.floor(rand(seed + i * 1.37) * inside.length)]
      pts.push({ x: p.x + rand(seed + i * 2.1) - 0.5, y: p.y + rand(seed + i * 3.3) - 0.5 })
    }
  }
  return { xs, pts }
}

const released = new Set<number>()
const release = (h: number) => {
  if (released.has(h)) return
  released.add(h)
  continueRender(h)
}

export function useGlyphs(text: string, family: string, size: number, n: number, seed = 7): Glyphs {
  const [g, setG] = useState<Glyphs>({ xs: [], pts: [] })
  const [handle] = useState(() => delayRender(`sample ${text}`))
  useEffect(() => {
    let live = true
    document.fonts
      .load(`500 ${size}px "${family}"`)
      .then(() => document.fonts.ready)
      .then(() => {
        if (live) setG({ ...sample(text, family, size, n, seed), ready: true })
      })
      .catch(() => {
        if (live) setG({ xs: [], pts: [], ready: true })
      })
    return () => {
      live = false
    }
  }, [text, family, size, n, seed])
  // Release the render only after the sampled glyphs are committed.
  useEffect(() => {
    if (g.ready) release(handle)
  }, [g.ready, handle])
  return g
}
