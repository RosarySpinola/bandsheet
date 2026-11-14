import { AbsoluteFill, useCurrentFrame } from "remotion"
import { Paper } from "../lib/paper"
import { B3, HAS_F1, PAN, S3_FROM, dropped, inOut, lerp, outQuint, panAt, prog } from "./s34/beats"
import { BrowserFrame } from "./s34/BrowserFrame"
import { ENV_H } from "./s34/Envelope"
import { F1Footage } from "./s34/F1Footage"
import { Receipt } from "./s34/Receipt"
import { BROWSER, DROP_AT, cam3, panelOnScreen } from "./s34/s3Layout"
import { Card, EnvelopeAt, HOVER, SealStage } from "./s34/SealEnvelope"
import { SubmitStandIn } from "./s34/SubmitStandIn"

const START = { x: 960, y: 540 } // S2 handoff: centred envelope outline (s12/HANDOFF.md)
const CARD_HOME = { x: 960, y: 470 }
const FLIP_FROM = panelOnScreen(B3.receipt[0])

/**
 * S3 · Submit. N4: S2's envelope outline opens and Noor's payslip email rises out to be read.
 * N5: it drops into the real /unit/submit page (footage F1, time-mapped in s34/F1Footage): the camera
 * reads "Read from your payslip" on "NEAR AI Cloud reads it", then the Verified panel on "inside a
 * confidential GPU". On "Before anything" the panel opens into the attestation receipt (s34/Receipt),
 * which builds on the words: fresh nonce, Intel TDX, NVIDIA + our nonce, the answer's signature, 28 of 28.
 * Tail: the S3→S4 pan (`PAN`) carries the receipt out right and brings the sealing station in from the left.
 */
export function S3() {
  const f = useCurrentFrame()
  const abs = S3_FROM + f

  // N4: outline grows from S2's 360×240, opens, the card rises out and grows to read.
  const grow0 = lerp(360 / 420, 1, prog(f, B3.growOutline, inOut))
  const envFill = prog(f, [B3.growOutline[0] + 2, B3.growOutline[0] + 22])
  const pocket = prog(f, [B3.growOutline[0] + 6, B3.growOutline[0] + 26])
  const flapOpen = prog(f, B3.flapOpen, inOut)
  const rise1 = prog(f, B3.cardRise, outQuint)
  const grow = prog(f, B3.cardGrow, outQuint)
  const envOut = prog(f, [B3.cardGrow[0] - 2, B3.cardGrow[0] + 24], inOut)
  const reveal = prog(f, B3.reveal, (t) => t)

  // N5a: browser rises behind; card drops into the dropzone.
  const bIn = prog(f, B3.browserIn, outQuint)
  const bFade = prog(f, [B3.browserIn[0], B3.browserIn[0] + 20])
  const bGone = prog(f, [B3.receipt[0] + 2, B3.receipt[0] + 16])
  const drop = prog(f, B3.drop, inOut)
  const cardFade = 1 - prog(f, [B3.drop[1] - 8, B3.drop[1] + 2])

  const beats = {
    page: prog(f, B3.page),
    drop: prog(f, dropped),
    fields: prog(f, [B3.read, B3.read + 40], (t) => t),
    panel: prog(f, [B3.inside - 4, B3.inside + 16]),
    checks: prog(f, [B3.inside + 10, B3.receipt[0]], (t) => t),
    attested: prog(f, [B3.receipt[0] - 14, B3.receipt[0] - 2], outQuint),
    seal: 0,
  }

  const cam = cam3(f)
  const pan = panAt(abs)

  const inSlot = f < B3.cardRise[1]
  const riseTop = START.y - ENV_H / 2 - 80
  const cardA = inSlot
    ? { x: START.x, y: lerp(START.y + 30, riseTop, rise1), s: 0.44, o: prog(f, [B3.cardRise[0] - 4, B3.cardRise[0] + 4]), reveal }
    : { x: START.x, y: lerp(riseTop, CARD_HOME.y, grow), s: lerp(0.44, 1, grow), reveal }
  const cardB = { x: lerp(cardA.x, DROP_AT.x, drop), y: lerp(cardA.y, DROP_AT.y, drop), s: lerp(cardA.s, DROP_AT.s, drop), o: cardFade, reveal }

  return (
    <AbsoluteFill>
      <Paper camera={cam}>
        {f >= B3.browserIn[0] - 4 && bGone < 1 ? (
          <div style={{ position: "absolute", left: BROWSER.left, top: BROWSER.top, opacity: bFade * (1 - bGone), transform: `translateY(${(1 - bIn) * 320}px) scale(${0.9 + 0.1 * bIn})`, transformOrigin: "50% 40%" }}>
            <BrowserFrame url="bandsheet.pages.dev/unit/submit" w={BROWSER.w} h={BROWSER.h}>
              {HAS_F1 ? <F1Footage f={f} /> : <SubmitStandIn {...beats} />}
            </BrowserFrame>
          </div>
        ) : null}

        {envOut < 1 ? (
          <EnvelopeAt
            cx={START.x}
            cy={START.y + envOut * 140}
            o={1 - envOut}
            s={grow0 * (1 - envOut * 0.12)}
            pocket={pocket}
            flap={1 - 2 * flapOpen}
            fill={envFill}
            card={inSlot ? cardA : undefined}
          />
        ) : null}
        {!inSlot && cardFade > 0 ? <Card {...cardB} /> : null}
      </Paper>
      {/* The footage fades into the paper above the caption band while the camera is pushed in. */}
      {f >= B3.browserIn[0] && bGone < 1 ? (
        <AbsoluteFill style={{ opacity: bFade * (1 - bGone), background: "linear-gradient(to bottom, rgba(255,255,255,0) 858px, #ffffff 930px)" }} />
      ) : null}

      <Receipt abs={abs} from={FLIP_FROM} dx={pan * PAN.d} />
      {pan > 0 ? (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${-(1 - pan) * PAN.d}px)` }}>
          <SealStage from={HOVER} lift={1} tuck={0} envIn={1} fold={0} stamp={0} label={0} arc={0} />
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
