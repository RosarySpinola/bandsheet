# S2 → S3 handoff (T2 end pose)

S2's last frame (absolute S2_END − 1 = 596, S2 local 392 with the v3 VO timeline) shows ONLY this, on paper white `#ffffff`:

| Property | Value |
|---|---|
| Space | Screen space, 1920×1080 (independent of the S1/S2 world camera) |
| Shape | Envelope outline: rectangle plus a V flap; no fill, square corners, miter joins |
| Rectangle | centre (960, 540), 360 × 240 → x 780–1140, y 420–660 |
| Flap | polyline (780, 420) → (960, 552) → (1140, 420) |
| Stroke | 2 px, ink `#0f3026`, opacity 1 |
| Motion at the cut | none: particles have settled and faded, the camera no longer affects it |

Source of truth: `envelope.ts` (`ENV`); S3 can import it: `import { ENV } from "../s12/envelope"`.

T2 timeline (absolute frames, from `B.t2 = S2_END − 24` = 573):
- t2−12 … t2−2: the middle column (equation, label) fades out (nothing is left for particles to cross).
- t2−6 … t2+6: the two returned tables (with stamps, dots, Noor's red dot) part 70 px outward and fade; they sit outside the particles' path.
- t2 … t2+2: the €70,000 glyphs hide; 400 particles sampled from the glyph shapes take their place.
- t2 … t2+22: particles spiral (swirl ≤ 1.5 rad, 28% outward bulge) into evenly spaced outline points; red `#c8344f` → ink.
- t2+15 … t2+21: the crisp SVG outline fades in while the particles fade out.

S3 should open on exactly this outline and grow the envelope card (payslip email) out of it.

## Beats (v3 narration)
Every beat is `wordFrame()` in `data.ts` (`B`). The S2 tail is new: on "Nobody" (502) the camera pulls back
(1.6 → 0.86, 34 f), the Senior rows leave the stack sideways and both tables re-form side by side (`RET.dx` ±220),
the subtraction (equation, €70,000, label) rises into the gap between them; on "Two honest" (543/546) each table
is stamped "passes n ≥ 3" (`Stamp.tsx`, first pressed on "look safe" in S1), and on "honest" (555) every n cell lights.
