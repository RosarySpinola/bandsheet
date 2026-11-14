import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader"
import { loadFont as loadSans } from "@remotion/google-fonts/Manrope"
import { Easing } from "remotion"

/** Bandsheet's own look (the app theme). References teach motion only, never palette or type. */
export const serif = loadSerif("normal", { weights: ["500"] }).fontFamily
export const sans = loadSans("normal", { weights: ["400", "600"] }).fontFamily

export const C = {
  paper: "#ffffff",
  band: "#f4f5f3",
  heroBg: "#e9e8e9",
  ink: "#0f3026",
  text: "#0a1516",
  gray350: "#50696b",
  inactive: "#bebebe",
  ghost: "#eceef0",
  lav: "#cdc2ff",
  lav100: "#f4edff",
  lav300: "#8b78fe",
  green: "#1f5249",
  mint: "#75d79f",
  alarm: "#c8344f",
  line: "rgba(15,48,38,0.14)",
} as const

export const FPS = 30
export const W = 1920
export const H = 1080
export const SAFE = 64

/** The app's single easing (Greenlock): cubic-bezier(.25,.1,.25,1). */
export const ease = Easing.bezier(0.25, 0.1, 0.25, 1)
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)
export const easeOutQuint = Easing.bezier(0.23, 1, 0.32, 1)
