import { sceneById } from "../../timeline"
import { wordEnd, wordFrame } from "../../lib/words"

/**
 * S7/S8 beat sheet in LOCAL scene frames. Every word beat is pinned to the Eleven v4 alignment through
 * `wordFrame()` (src/lib/words.ts); only motion lengths and small lead-ins are numbers.
 * N11 runs over S7 (3165–3621), N12 over S8 (3621–3828).
 */
const S7_FROM = sceneById("S7").from
const S8_FROM = sceneById("S8").from
export const S7_DUR = sceneById("S7").dur
export const S8_DUR = sceneById("S8").dur
const w7 = (p: string, n = 1) => wordFrame(p, n) - S7_FROM
const e7 = (p: string, n = 1) => wordEnd(p, n) - S7_FROM
const w8 = (p: string, n = 1) => wordFrame(p, n) - S8_FROM
const e8 = (p: string, n = 1) => wordEnd(p, n) - S8_FROM

export const T7_LEN = 24
/** Frames of S8 over which the fan finishes its sweep to the hero pose. */
export const S8_SWEEP = 36
/** Unified fan progress across the S7→S8 cut: 0 at S7 t7, 1 at S8 frame S8_SWEEP. */
export const FAN_TOTAL = T7_LEN + S8_SWEEP

const reps = w7("Union reps")
const claude = w7("from Claude")
const mcp = w7("M-C-P tool")
const why = w7("why a table")
const refused = w7("refused,")
const answers = w7("answers without")
const without = w7("without a single")
const single = w7("single salary")
const member = w7("And every member")
const stand = w7("stand next")
const eurostat = w7("Eurostat's median")
const median = w7("median for")
const job = w7("their job")
const art7 = w7("Article 7")
const request = w7("request ready")
const ready = w7("ready to send")

export const S7B = {
  // MCP: the S6 sidebar is on screen at frame 0; the chat card arrives with "Union reps"
  cardIn: reps - 3,
  sidebarOut: claude, // "from Claude": we leave the app; sidebar retracts, camera centres the card
  chain: claude + 4, // Claude → bandsheet-mcp → API chain draws
  tools: mcp, // the six real tool names land on "M-C-P tool"
  askType: why, // question types on "why a table"
  askRate: 0.55,
  chipIn: refused - 2, // explain_refusal call on "refused"
  chipDone: answers - 4,
  answer: answers, // verbatim tool output arrives on "answers"
  answerRate: 0.3,
  noSalary: without, // "No individual salary" row on "without"
  underline: single, // its underline draws on "single salary"
  underlineEnd: e7("single salary"),
  // stand: camera travels down to /unit/stand (real F6), answer lands on "stand"
  travel1: member,
  travel1Len: 30,
  standIn: stand, // = F6 source frame 148, where the real answer arrives
  push: stand + 2,
  pushLen: 28,
  medianLine: eurostat, // dashed median line draws, corrected label types
  medianWord: median,
  job, // "for their job": the ISCO group lights up
  // letter
  travel2: art7 - 22, // leave the panel so the letter is settled by "Article 7"
  travel2Len: 26,
  letterIn: art7 - 20,
  letterType: art7 - 2,
  art7, // "Article 7" lights up in the subject line
  sign: request, // signature draws on "request ready"
  signLen: 18,
  ready,
  fadeOut: ready, // on "ready to send" the letter leaves, the stroke stays
  t7: S7_DUR - T7_LEN, // T7: stroke fans into shards (continues into S8; must equal S7_DUR - T7_LEN)
} as const

export const S8B = {
  bgIn: 0, // white paper → hero glow over 0–40
  that: w8("That's Band-sheet"),
  line1: w8("every band published") - 3,
  line2: w8("nobody exposed") - 3,
  url: e8("nobody exposed") - 4,
  sponsors: e8("nobody exposed") + 12,
  tiny: e8("nobody exposed") + 28,
  driftEnd: e8("nobody exposed") + 44, // drift and sway ease to zero; the rest is the clean thumbnail hold
} as const
