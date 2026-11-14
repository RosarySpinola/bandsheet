import alignment from "../../public/vo/vo-alignment.json"

/** Word timing from the Eleven v4 take (public/vo/vo-alignment.json). Frames are absolute film frames @30fps. */
export const VO_LEAD = 15 // frames; must match scripts/retime.mjs LEAD
const FPS = 30
type Al = { alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } }
const al = (alignment as Al).alignment
const spoken = al.characters.join("")

/** Absolute frame where the nth occurrence of `phrase` starts. Spelled forms: "Band-sheet", "D-K-I-M", "M-C-P", "T-D-X". */
export function wordFrame(phrase: string, nth = 1): number {
  let i = -1
  for (let k = 0; k < nth; k++) i = spoken.indexOf(phrase, i + 1)
  if (i < 0) throw new Error(`words: phrase not in narration: ${phrase}`)
  return Math.round(al.character_start_times_seconds[i] * FPS) + VO_LEAD
}

/** Absolute frame where `phrase` (nth occurrence) finishes being spoken. */
export function wordEnd(phrase: string, nth = 1): number {
  let i = -1
  for (let k = 0; k < nth; k++) i = spoken.indexOf(phrase, i + 1)
  if (i < 0) throw new Error(`words: phrase not in narration: ${phrase}`)
  return Math.round(al.character_end_times_seconds[i + phrase.length - 1] * FPS) + VO_LEAD
}

/** Spoken form of on-screen text (the voice reads spelled-out acronyms and "Band-sheet"). */
export const spokenForm = (s: string) =>
  s.replace(/Bandsheet/g, "Band-sheet").replace(/TDX/g, "T-D-X").replace(/DKIM/g, "D-K-I-M").replace(/MCP/g, "M-C-P")

/** Frame where `text` (on-screen form) starts being spoken, searching from character `from`. */
export function textFrame(text: string, from = 0): { frame: number; at: number } {
  const probe = spokenForm(text).slice(0, 18)
  const i = spoken.indexOf(probe, from)
  if (i < 0) throw new Error(`words: text not in narration: ${probe}`)
  return { frame: Math.round(al.character_start_times_seconds[i] * FPS) + VO_LEAD, at: i + 1 }
}
