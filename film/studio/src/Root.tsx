import { Composition, Sequence, AbsoluteFill } from "remotion"
import { FPS, W, H } from "./tokens"
import { SCENES, TOTAL } from "./timeline"
import { Captions } from "./lib/captions"
import { Mix } from "./lib/mix"
import { S1 } from "./scenes/S1"
import { S2 } from "./scenes/S2"
import { S3 } from "./scenes/S3"
import { S4 } from "./scenes/S4"
import { S5 } from "./scenes/S5"
import { S6 } from "./scenes/S6"
import { S7 } from "./scenes/S7"
import { S8 } from "./scenes/S8"

const MAP = { S1, S2, S3, S4, S5, S6, S7, S8 } as const
const HAS_VO = true

function Film() {
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {SCENES.map((s) => {
        const C = MAP[s.id as keyof typeof MAP]
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <C />
          </Sequence>
        )
      })}
      <Captions />
      {HAS_VO ? <Mix /> : null}
    </AbsoluteFill>
  )
}

export function Root() {
  return (
    <>
      <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
      {SCENES.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={MAP[s.id as keyof typeof MAP]}
          durationInFrames={s.dur}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </>
  )
}
