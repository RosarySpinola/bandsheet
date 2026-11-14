import { loadFont } from "@remotion/google-fonts/JetBrainsMono"

/** Mono for DKIM headers, keys and error codes (owned by s34; not a global token). */
export const mono = loadFont("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily
