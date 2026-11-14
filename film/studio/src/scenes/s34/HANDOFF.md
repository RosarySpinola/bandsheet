# S3–S4 handoff (v3 narration)

Every beat is pinned with `wordFrame()` (`w3`/`w4` in `beats.ts`, `W` in `Receipt.tsx`); offsets after a word are
animation durations only. S3 runs 597–1209, S4 1209–2067 (`timeline.ts`).

## S4 → S5 (T4 end pose), unchanged
S4's last frame (absolute 2066, S4 local 857) shows ONLY this, on paper white `#ffffff`:

| Element | Value |
|---|---|
| Space | Screen space, 1920×1080, no DOM camera transform |
| Crystal (3D) | `CrystalCanvas` from `./s34/Crystal`, centre (960, 250), circumradius r = 112 px, `orbit` = 20° (0.349 rad), `pulse` = 0, `fan` = 0, `absFrame` = film frame (`turntable(absFrame)`) |
| Light line | 4 px `#8b78fe`, glow `0 0 14px #cdc2ff, 0 0 4px #8b78fe`; vertical x 958–962 from y 362 to y 560 |
| Bus | horizontal 4 px, same colour, y 558–562, x 600 → 1320 |
| Drops | three 4 px verticals at x 600, 960, 1320 from y 560 to y 620 |
| Seat tiles | 300 × 150, 2 px ink, white, square; centres x 600 / 960 / 1320, top y 620 |
| Tile content | "Seat N" Manrope 600 26 px ink, left pad 26 px; empty pass-mark box 34 px at right pad 26 px |
| Motion at the cut | tiles just settled; crystal still turning. The forged card, its label and the Release #3 counter have faded by local 852–856. |

T4 is compressed by the voice: "threw it out" starts at 2043, 24 frames before the cut. The crystal rises 2039–2054,
line 2053–2059, split 2057–2062, tiles 2057–2065. Reuse: `SPLIT`/`SeatSplit`, `Seat`, `CrystalCanvas` as before.

## S2 → S3 (T2 in), unchanged
S3 opens on S2's 360×240 outline at (960, 540) and grows it to 420×280 on "Band-sheet is built".

## S3 → S4 (no held pose; a pan straddles the cut)
`PAN` (beats.ts, absolute "its answer" + 8 → + 36): the receipt slides right by 1500 px while the sealing station
(open envelope at (620, 500), Noor's card at (620, 280) scale 0.44) arrives from the left. S3 and S4 both render
it from the absolute frame, so 1208 → 1209 is continuous. The card tucks as the station lands, the flap folds by
"sealed" (1239), the lock stamps on it, and the envelope arcs into the crystal on "enclave" (1352).

## Beats by word
- S3: browser on "So a member"; card drops on "drops", lands on "email"; camera on "Read from your payslip" on
  "NEAR AI Cloud"; Verified panel on "inside"; the panel opens into the receipt on "Before anything" (908).
  Receipt (`Receipt.tsx`, real run `server/fixtures/recorded-eml.json`): nonce types on "fresh"; gateway/model
  Intel TDX rows on "Intel"/"T-D-X"; NVIDIA row on "NVIDIA"; nonce link on "nonce"; signature rows on "signature";
  "28 of 28 checks passed" on "on its answer". Labels are the exact `guard()`/`add()` labels from server/src/nearai.
- S4 N6b: access key card on "Each member" (key, FunctionCall, receiver, `["submit"]` lit on "only submit",
  "member pays 0" lit on "without gas"); six entries leave the card on "goes on chain" (count 32 → 38); the
  receipt log of tx BEEqPUbC… types on "a newer payslip" and `"replaced":true` lights on "replaces"; count stays 38.
- S4 N7: Ingrid's signed card on "Now" (caret at the digit on "edits", DKIM line on "doesn't count"); it parks on
  "The chapel voted"; the trust inset (proposal #2) on "voted"; seats on "D-K-I-M key"; the trusted d=/s= chip flies
  into the crystal on "checks every signature"; the card returns large on "In release three"; 4 → 6 on "a four";
  red on "six"; it hits the crystal on "enclave" (label `dkim_bad_signature`, counter "37 verified · 1 refused") and
  is thrown out on "threw it out".

## Footage flags (`beats.ts`)
`HAS_F1 = true`: S3 plays F1 segments upload (99–132) and confirm (156–215), see `F1Footage.tsx`.
`HAS_F2 = false`: F2.mp4 exists but was recorded at 15:23, before the vote page listed governance proposals; it shows
only release proposals #0, #1 and #6. The inset is the stand-in built from the real proposal #2 (tx 4G8BgLru…).
