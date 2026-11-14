# components/unit: shared demo-unit UI (owner: ui-a)

Import from the barrel: `import { PageHeader, Section, ... } from "@/components/unit"`.
Every component is already themed to Greenlock (square corners, ink #0f3026, no shadows, ease-gl motion).

## Layout
| Component | Props | Notes |
|---|---|---|
| `Page` | `children, className?, width?: "wide" \| "narrow"` | Page body container: max 78rem (wide) or 60rem; 16px gutter on mobile. Wrap each page in it. |
| `PageHeader` | `title, lede?, eyebrow?, glyph?: NavItem["kind"], actions?, className?` | Serif H1, 2px ink rule below. `glyph` takes "overview" or any `GlyphKind`. |
| `Section` | `title?, aside?, children, band?, delay?, id?, className?` | Reveal rise (3rem, 1000ms). `band` paints #f4f5f3. Use `delay` 0/200/400 to stagger. |
| `Fact` | `label, children, className?` | Uppercase label over a value. Put it inside a `<dl>`. |
| `Figure` | `value, caption, className?` | Big serif number with a caption. |
| `Sidebar`, `MobileNav` | none | Used by `pages/unit/app-shell.tsx`. Don't render them in pages. |

## Data display
| Component | Props | Notes |
|---|---|---|
| `TxLink` | `tx: string (hash or nearblocks URL), label?, className?` | nearblocks testnet link, short hash, wipe underline and arrow nudge. |
| `AccountLink` | `id, className?` | nearblocks account link. |
| `ExtLink` | `href, children, className?` | Any external link in the same style. |
| `HashValue` | `value, head?=8, tail?=4, className?` | Short monospace hash, full value on hover, copy button. |
| `CopyButton` | `value, label?, className?` | Square icon button; the icon becomes a tick for 1.6s. |
| `StatusTag` (`./status`) | `status` | released / partially_released / refused (ink outline) / error (grey), and Sputnik InProgress / Approved / Rejected / Expired / Failed. Never red. |
| `VerifiedPanel` | `verified: Verified, title?, defaultOpen?, className?` | NEAR AI Cloud attestation result (`verified` from /api/extract or /api/stand): model, nonce, chat_id, signers, collapsible checks. |
| `PassMark` | `pass: boolean, className?` | Filled ink tick, or ink-outlined cross. |
| `Tip` / `TipProvider` | `content, children (one focusable element), side?` | Square ink tooltip. The provider is already in the shell. |

## States
| Component | Props | Notes |
|---|---|---|
| `EmptyState` | `title, body?, action?, className?` | Band block with a serif line. |
| `ErrorState` | `error: unknown, title?, onRetry?, tone?: "calm" \| "alarm", children?` | Turns `ApiError {error, code}` into plain words (lib/api `plainError`). `alarm` renders ink on lavender (refusals, failed attestation); red is reserved for an exposed salary. |
| `Shimmer` | `className` | Square pulse block for layout-matched skeletons. |

## Actions and inputs (no native controls)
| Component | Props | Notes |
|---|---|---|
| `CtaButton` / `CtaLink` | `children, size?: "md" \| "lg"`, plus button props or `to` | Greenlock text CTA "Label ↳" with the wipe underline. |
| `SquareButton` | `variant?: "ink" \| "paper" \| "line"`, plus button props | Solid square button with a 400ms colour change. |
| `GlSelect` | `label, value, onChange, options: {value,label,hint?}[], placeholder?, invalid?` | Radix Select: underline field, square list with a 2px frame. |
| `GlField` | input props + `label, hint?, invalid?, prefix?` | Underline text field. |
| `Dropzone` | `onFile(file), file?, disabled?` | PNG/JPEG/PDF ≤ 6 MB, hidden native input. |

## lib
- `lib/api.ts`: `api(path, zodSchema, init?)`, `postJson(body)`, `ApiError`, `plainError(err)`, schemas (`VerifiedSchema`, `ExtractResponseSchema`, `StandResponseSchema`, `ReleasesResponseSchema`), calls `extractPayslip`, `askStand`, `getReleasesApi`, `getDemoInvite`.
- `lib/chain.ts`: `CONTRACT`, `DAO`, `explorer.{tx,account,attestation,dao}`, `txHashOf`, `view(contract, method, args)` (raw RPC with failover), and react-query hooks `usePolicy`, `useReleases` (server first, chain fallback), `useProposals`, `useDeployed`, `useDemoLog`. Chain queries are cached for 60s and retry with backoff, because the public RPCs rate-limit.
- `lib/format.ts`: `eur`, `int`, `signedEur`, `signedPct`, `shortHash`, `fromNanos`, `when`, `relative`, `plural`, `cellLabel`, `gradeRank`, `GRADE_ORDER`.
