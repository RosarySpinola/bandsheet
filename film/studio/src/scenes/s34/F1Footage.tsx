import { OffthreadVideo, Sequence, interpolate, staticFile } from "remotion"
import { B3 } from "./beats"

/**
 * Real /unit/submit footage (public/footage/F1.mp4, 1920×1080, 438 f, stitched with hard cuts).
 * Source segments used (F1 frames): member key + upload/dropzone 99–132 · confirm step with "Read from your
 * payslip", the DKIM card and the Verified panel ("28 of 28 checks passed") 156–215. Each plays at its own
 * rate inside an S3-local window keyed to the words; the cut falls inside a camera move (`cam3`), and the
 * confirm segment runs until the Verified panel has opened into the receipt.
 */
const XF = 4
export const F1_SEGMENTS = (() => {
  const s = [
    { name: "upload", from: B3.browserIn[0] - 4, to: B3.drop[1] + 4, src: [99, 132] }, // ends on "email"
    { name: "confirm", from: B3.drop[1] + 2, to: B3.receipt[1] + 2, src: [156, 215] }, // "NEAR AI Cloud reads it…" → "Before anything"
  ]
  return s.map((g) => ({ ...g, rate: (g.src[1] - g.src[0]) / (g.to - g.from) }))
})()

/** The browser's content area for footage: exactly 16:9 so nothing is cropped. */
export const F1_W = 1291
export const F1_H = 726
export const F1_K = F1_W / 1920

export function F1Footage({ f }: { f: number }) {
  return (
    <>
      {F1_SEGMENTS.map((g, i) => {
        const fadeIn = i === 0 ? 1 : interpolate(f, [g.from, g.from + XF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        return (
          <Sequence key={g.name} from={g.from} durationInFrames={g.to - g.from + (i < F1_SEGMENTS.length - 1 ? XF + 2 : 0)} layout="none" name={`F1 ${g.name}`}>
            <OffthreadVideo
              src={staticFile("footage/F1.mp4")}
              muted
              trimBefore={g.src[0]}
              playbackRate={g.rate}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: fadeIn }}
            />
          </Sequence>
        )
      })}
    </>
  )
}

/** Footage pixel (1920×1080 source) → world px, for a content area whose top-left is (cl, ct). */
export const f1World = (cl: number, ct: number, nx: number, ny: number) => ({ x: cl + nx * F1_K, y: ct + ny * F1_K })

/** Regions of interest in source pixels (measured from the footage frames). */
export const F1_ROI = {
  dropzone: { x: 1112, y: 727, h: 206 }, // dashed dropzone, upload step
  read: { x: 822, y: 600 }, // "Read from your payslip: EUR 5,833.33…" over the "Signed by harbourcourier.example" card
  verified: { x: 1400, y: 640 }, // "Verified inside NEAR AI Cloud's enclave · 28 of 28 checks passed"
}
/** The Verified panel's box in source pixels (confirm step): it opens into the receipt. */
export const F1_PANEL = { x: 1132, y: 480, w: 540, h: 438 }
