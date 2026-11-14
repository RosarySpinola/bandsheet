import { wordFrame } from "../../lib/words"
import { sceneById } from "../../timeline"

/**
 * S5–S6 beat sheet. Every beat is a word of the v3 narration (src/lib/words.ts), converted to the scene's
 * local frame. No numeric word offsets: a re-time moves everything with the voice.
 */
export const S5_FROM = sceneById("S5").from
export const S6_FROM = sceneById("S6").from
export const S5_DUR = sceneById("S5").dur
export const S6_DUR = sceneById("S6").dur
const w5 = (p: string) => wordFrame(p) - S5_FROM
const w6 = (p: string) => wordFrame(p) - S6_FROM

/** S5 · N8 + N9 (local frames). */
export const B5 = {
  heading: w5("wants a release"),
  kicker: w5("votes in its"),
  dao: w5("Sputnik DAO"),
  approve1: w5("Two of three"),
  approve2: w5("three seats"),
  fold: w5("approve, the contract"),
  contract: w5("contract calls"),
  calls: w5("calls the enclave"),
  enclave: w5("enclave, and the enclave replays"),
  callback: w5("and the enclave replays"),
  replays: w5("replays every"),
  every: w5("every earlier"),
  earlier: w5("earlier table"),
  table: w5("table and solves"),
  solves: w5("solves the"),
  attackers: w5("attacker"),
  equations: w5("equations first"),
  publishes: w5("publishes four"),
  four: w5("four bands"),
  withholds: w5("withholds"),
  writes: w5("writes why"),
  near: w5("to NEAR, with"),
  exact: w5("exact subtraction"),
  subtraction: w5("subtraction it refused"),
  refused: w5("refused."),
}

/** S6 · N10 (local frames). */
export const B6 = {
  ran: w6("We ran"),
  hundred: w6("hundred generated"),
  generated: w6("generated attacks"),
  typical: w6("attacks. A typical"),
  ninetyFive: w6("ninety-five"),
  ofThem: w6("of them"),
  leaked: w6("leaked none"),
  none: w6("none, and"),
  still: w6("and still published"),
  published: w6("published nearly"),
  nearly: w6("nearly three cells"),
  three: w6("three cells"),
  inFour: w6("in four"),
  trust: w6("You don't have"),
  command: w6("one command"),
  rechecks: w6("command re-checks"),
  nineteen: w6("nineteen claims"),
  claims: w6("claims against"),
  chain: w6("against the chain"),
  youCan: w6("and you can try"),
  tryIt: w6("try the subtraction"),
  subtraction: w6("subtraction yourself"),
  site: w6("on the site"),
}
