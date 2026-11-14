/**
 * Single source of timing. Scene ranges (frames @30fps) and narration cues.
 * Re-timed from ElevenLabs v4 with-timestamps output (public/vo/vo-alignment.json) once generated:
 * run `node scripts/retime.mjs` to rewrite CUES and SCENES; scenes read only from here.
 */
export type Scene = { id: string; from: number; dur: number }

export const SCENES: Scene[] = [
  { id: "S1", from: 0, dur: 204 },
  { id: "S2", from: 204, dur: 393 },
  { id: "S3", from: 597, dur: 612 },
  { id: "S4", from: 1209, dur: 858 },
  { id: "S5", from: 2067, dur: 568 },
  { id: "S6", from: 2635, dur: 530 },
  { id: "S7", from: 3165, dur: 456 },
  { id: "S8", from: 3621, dur: 207 },
]
export const TOTAL = 3828

export type Cue = { id: string; from: number; to: number; text: string }
/** Caption cues (absolute frames). Estimates until VO alignment lands. */
export const CUES: Cue[] = [
  { id: "N1", from: 20, to: 215, text: "Say your union asks for average pay by grade, and a month later one reporter joins and you ask again." },
  { id: "N2", from: 212, to: 339, text: "Both tables hide any group smaller than three, so they look safe." },
  { id: "N3", from: 335, to: 607, text: "But subtract one from the other, and you get her exact salary: seventy thousand euros. Nobody hacked anything. Two honest tables did it." },
  { id: "N4", from: 605, to: 697, text: "Bandsheet is built to stop exactly that." },
  { id: "N5", from: 692, to: 1222, text: "So a member drops in the payslip email their payroll sent. NEAR AI Cloud reads it inside a confidential GPU. Before anything is sent, we check a fresh attestation, an Intel TDX quote and NVIDIA's GPU report tied to our nonce, and afterwards the signature on its answer." },
  { id: "N6", from: 1217, to: 1604, text: "The entry is sealed in the browser to a key that only exists inside an OutLayer enclave. Each member's NEAR key can call only submit, so it goes on chain without gas, and a newer payslip replaces the old one." },
  { id: "N7", from: 1599, to: 2079, text: "Now, if someone edits even one digit, it doesn't count. The chapel voted on NEAR to trust the employer's DKIM key, and the enclave checks every signature. In release three, someone turned a four into a six on one payslip, and the enclave threw it out." },
  { id: "N8", from: 2075, to: 2437, text: "When the chapel wants a release, it votes in its Sputnik DAO. Two of three seats approve, the contract calls the enclave, and the enclave replays every earlier table and solves the attacker's equations first." },
  { id: "N9", from: 2432, to: 2648, text: "So it publishes four bands, withholds the Senior one, and writes why to NEAR, with the exact subtraction it refused." },
  { id: "N10", from: 2643, to: 3178, text: "We ran a hundred generated attacks. A typical tool leaked salaries in ninety-five of them. Bandsheet leaked none, and still published nearly three cells in four. You don't have to trust us: one command re-checks nineteen claims against the chain, and you can try the subtraction yourself on the site." },
  { id: "N11", from: 3173, to: 3633, text: "Union reps can ask Bandsheet from Claude through an MCP tool, say why a table was refused, and it answers without a single salary. And every member sees where they stand next to Eurostat's median for their job, with an Article 7 pay request ready to send." },
  { id: "N12", from: 3629, to: 3753, text: "That's Bandsheet: every band published, and nobody exposed." },
]

export const sceneById = (id: string) => SCENES.find((s) => s.id === id)!
