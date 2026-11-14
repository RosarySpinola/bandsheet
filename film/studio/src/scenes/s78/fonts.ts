import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono"

/** Same mono face as S6's terminal (IBM Plex Mono), so tool names read as one system across the cut. */
export const mono = loadMono("normal", { weights: ["400", "500"] }).fontFamily
