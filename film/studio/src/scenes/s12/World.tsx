import { AbsoluteFill } from "remotion"
import { C, serif } from "../../tokens"
import { DOT_DEPTH, camera, layerCam, layerStyle } from "./camera"
import { Dots } from "./Dots"
import { Equation, FIG } from "./Equation"
import { Burst, T2 } from "./Particles"
import { Table } from "./Table"
import { useGlyphs } from "./textPoints"

/**
 * The S1+S2 world on one absolute clock. Two depth layers share one camera: the paper/table layer
 * (depth 1) and the member-dots layer (depth DOT_DEPTH, a touch closer to the lens: parallax).
 * T2 particles and the envelope live in screen space so S3 can match the pose exactly.
 */
export function World({ t }: { t: number }) {
  const g = useGlyphs(FIG.text, serif, FIG.size, 400)
  const cam = camera(t)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <div style={layerStyle(cam)}>
        <Table k={0} t={t} />
        <Table k={1} t={t} />
        <Equation t={t} g={g} />
      </div>
      <div style={layerStyle(layerCam(cam, DOT_DEPTH))}>
        <Dots t={t} />
        <Burst t={t} g={g} />
      </div>
      <T2 t={t} g={g} />
    </AbsoluteFill>
  )
}
