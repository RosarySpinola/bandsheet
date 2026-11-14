# S5–S6 handoff poses (owner: film-c; v3 re-time 14 Nov 2026)

All S5/S6 beats are words: `beats.ts` reads `wordFrame()` (src/lib/words.ts); no numeric word offsets remain.

## In: T4 (S4 → S5)
S5 frame 0 equals S4's T4 end pose and reads its geometry from the S4 owner's files, so it follows their changes:
- tiles and light: `SPLIT` (s34/SeatSplit) and `Seat` (s34/VoteInset), drawn by `S4Tail` (s56/Seats) and dissolved over 14 f;
- crystal: `CrystalCanvas` (s34/Crystal) at x 960, y 250, r 112, orbit 20°, `absFrame` continuous (s56/Engine); over the first 14 f it lifts to y 186, r 90, clear of the vote type. On "the contract calls the enclave" it becomes the call chain's enclave node (x 1520, y 695, r 80).
If S4 changes its end pose (y, r or orbit), update `HOME` and `ORBIT` in s56/Engine.tsx.

## Out: T5 (S5 → S6), screen space, the same on S5's last frame (film 2634) and S6 f0 (film 2635)
Paper white. Label "Transaction  ·  release #3  ·  NEAR testnet", Manrope 400, 22 px, #50696b, at left 120,
top 150 (still typing; S6 continues the same type-on). Full tx hash in IBM Plex Mono 500, 62 px, ink, at left 120, top 196.
Geometry is in `TXH` and the hash in `TX_HASH` (s56/data.ts).

## Out: T6 (S6 → S7), S6's last frame (film 3164), screen space
Before it, S6 shows the live /unit/attack page (public/footage/F7-attack.mp4) beside this sidebar with "Attack lab" active;
over S6's last 14 frames the page clears to paper and the active row moves up to "Where do I stand".
- Left sidebar: x 0–360, y 0–1080, fill #f4f5f3 (C.band). Right of it: paper white, empty.
- Wordmark "Bandsheet" in Newsreader 500, 42 px, ink, at left 40, top 60.
- Chip "Synthetic demo unit · NEAR testnet": Manrope 15 px, #cdc2ff fill, #3b2aa8 text, padding 6/10, at left 40, top 140.
- Nav rows at left 40, top 236 + i × 52 (i = 0..8): Overview, Submit a payslip, Where do I stand,
  Release ledger, Attack lab, Chapel vote, How it works, Help, Verify it yourself.
  Each row has an 18 px square (ink when active, #bebebe otherwise), a 16 px gap and a Manrope 22 px label.
  The active row is "Where do I stand" (i = 2): ink text with a 2 px ink underline. The others are #50696b.
- Constants: `SIDEBAR_W`, `NAV`, `NAV_ACTIVE`, `NAV_TOP` and `NAV_PITCH` in s56/data.ts.
S7 can keep this sidebar fixed and fill x 360–1920 (for example, with the /unit/stand view).
