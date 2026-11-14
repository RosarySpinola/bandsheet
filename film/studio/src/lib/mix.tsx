import { Audio, Sequence, interpolate, staticFile } from "remotion"
import { CUES, TOTAL } from "../timeline"
import { VO_LEAD, wordFrame } from "./words"

/** Master mix: VO (-14 LUFS), Infinity bed (-23.5 LUFS) ducked under speech, word-pinned SFX. */
export { VO_LEAD }

type Cue = { file: string; at: number; vol: number; trimTo?: number }
/* Each sound identifies one action; no repeated whooshes (house rule). */
const SFX: Cue[] = [
  { file: "keyboard-typing-5997.mp3", at: wordFrame("average pay by grade"), vol: 0.12, trimTo: 75 },
  { file: "paper-slide-03.mp3", at: wordFrame("subtract"), vol: 0.32 },
  { file: "display-digits-3.mp3", at: wordFrame("seventy") - 6, vol: 0.22, trimTo: 40 },
  { file: "es-suction-pop-5-sfx-producer.mp3", at: wordFrame("sealed"), vol: 0.4 },
  { file: "lens-flare-transition-sound-effect.mp3", at: wordFrame("OutLayer enclave"), vol: 0.26 },
  { file: "mixkit-metal-hit-woosh-1485.mp3", at: wordFrame("doesn't count"), vol: 0.3 },
  { file: "rm-click-2.mp3", at: wordFrame("D-K-I-M key"), vol: 0.35 },
  { file: "rm-click-2.mp3", at: wordFrame("D-K-I-M key") + 9, vol: 0.35 },
  { file: "display-digits-3.mp3", at: wordFrame("a four into a six") + 8, vol: 0.2, trimTo: 30 },
  { file: "rm-click-2.mp3", at: wordFrame("Two of three"), vol: 0.3 },
  { file: "rm-click-2.mp3", at: wordFrame("Two of three") + 9, vol: 0.3 },
  { file: "paper-slide-03.mp3", at: wordFrame("withholds"), vol: 0.26 },
  { file: "quick-win.mp3", at: wordFrame("one command"), vol: 0.24 },
  { file: "mixkit-cinematic-transition-wind-swoosh.mp3", at: wordFrame("every band published") - 10, vol: 0.22 },
]

/** Music bed: 1 s fade in, duck to 55% under speech (8-frame ramps), 2 s fade out. */
function bedVolume(f: number): number {
  const fadeIn = interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" })
  const fadeOut = interpolate(f, [TOTAL - 60, TOTAL], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  let duck = 1
  for (const c of CUES) {
    const d = interpolate(f, [c.from - 8, c.from, c.to, c.to + 8], [1, 0.55, 0.55, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    duck = Math.min(duck, d)
  }
  return 0.9 * fadeIn * fadeOut * duck
}

export function Mix() {
  return (
    <>
      <Audio src={staticFile("music/infinity-bed.mp3")} volume={bedVolume} />
      <Sequence from={VO_LEAD} name="VO">
        <Audio src={staticFile("vo/vo-final.mp3")} />
      </Sequence>
      {SFX.map((s, k) => (
        <Sequence key={k} from={Math.max(0, s.at)} durationInFrames={s.trimTo} name={`SFX ${s.file}`}>
          <Audio src={staticFile(`sfx/${s.file}`)} volume={s.vol} />
        </Sequence>
      ))}
    </>
  )
}
