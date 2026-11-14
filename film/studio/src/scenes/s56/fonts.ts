import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader"
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono"

/** Scene-local faces (tokens.ts owns the upright serif and Manrope). */
export const serifItalic = loadSerif("italic", { weights: ["400"] }).fontFamily
export const mono = loadMono("normal", { weights: ["400", "500"] }).fontFamily
