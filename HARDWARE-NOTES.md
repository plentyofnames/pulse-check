# Hardware notes

Findings from the real PCM 70 and from the manuals. The manual's sysex claims are
hypotheses until confirmed (see IMPLEMENTATION.md "Hardware-truth rule").

**Unit under test: software V2.0.** We now have BOTH manuals: the V2.0 owner's manual
(`lexicon_pcm70.pdf`, MIDI Implementation Data in ch. 8) and the V3.00 manual
(`PCM70-OM_original.pdf`, ch. 6). The parameter tables in `pcm70-data.js` were first
transcribed from V3.00 and are being reconciled to V2.0.

## Confirmed from the V2.0 manual (ch. 8, "MIDI Implementation Data")

- **Sysex framing is identical to V3.00.** `F0 06 00 … F7`; bulk `oooc nnnn`/`oopp pppp`,
  byte count `02 4E` (334), 167 data bytes as hi/lo nybble pairs, 7-bit sumcheck of the
  nybblized bytes; param change `oo10 nnnn`; request `oo11 nnnn` event `60`/`61`. Our
  Sysex/Codec layer needs no change. (V2.0 manual pp. 8-5/8-6.)
- **Table 1 (param numbering) and Table 2 (167-byte bulk layout) are identical** to what
  we implemented (p. 8-7).
- **Table 3 program types stop at 13.** 4 Chorus and Echo, 5 Multiband, 6 Resonant Chords,
  7 Concert Hall, 8 Rich Chamber, 9 Rich Plate, 10 Infinite Reverb, 11 Multiband Rhythm,
  12 Chorus and Rhythm, 13 Rhythmic Chords. **No type 14 (Inverse Room)** — that is V3.0
  only. (p. 8-7.) → app gated to types 4–13.
- **No MIDI-Clock patch source.** The V2.0 MIDI Implementation Chart (8-3) shows Clock
  TX/RX = no; beat-sync in BPM programs is switch-driven (patch a switch to "1/24th of a
  beat"), not MIDI clock. → source #70 removed from the UI.
- **The unit never transmits parameter changes** (8-6) — Get-to-resync model holds.
- **30 ms between stored bulk messages** (8-5) — matches our pacing floor.

## DONE: per-program tables reconciled to V2.0 (Tables 4–9, pp. 8-8…8-14)

All six V2.0 tables were diffed against the V3.00 data. Only two layouts differed:

- **Chorus and Echo (Table 4)**: ~~V2.0 orders row 0 naturally — CHORUS at word 4
  (byte 55), DIFFUSION at word 6 (byte 59). V3.00 had swapped those two words.~~
  **REFUTED ON HARDWARE 2026-07-14.** A real V2.0 preset dump (0.7 PSYCHO ECHOES)
  had byte55 = 527 — impossible for CHORUS (max 518), a plausible DIFFUSION (65) —
  and byte59 = 518, which is exactly CHORUS 6VC T. The dump layout follows the
  **V3.00** order (DIFFUSION@55, HC@57, CHORUS@59); the V2.0 print is another
  misprint. Data reverted. The byte57 (HC) mystery is resolved — see
  "table lookups clamp" below.
- **Concert Hall (Table 7)**: ~~V2.0 has DCY OPT at word 7 and no CHORUSING param,
  and 7 reflection levels.~~ **REFUTED 2026-07-17** by two independent sources:
  a real Concert Hall dump had raw 400 (non-level garbage) at byte 97, and the
  V2.0 manual's own ch. 4 parameter matrix (Table 4.4, pp. 4-2/4-3) shows
  CHORUSING at 0.8, DECAY OPT at 0.7, only 4 reflection levels (3.5/3.6 = N/A)
  and 4 reflection delays. The ch. 8 print was wrong again. Layout now follows
  V3.00 bytes with V2.0's param set: DCY OPT param 7 @ byte 63, CHORUSING
  param 8 @ byte 61 (the V3.00 cross — if a future dump audit flags 0.7
  DCY OPT out of range, swap those two bytes), levels MSTR+L1/L2/R1/R2
  (85–93), delays MSTR+L1/L2/R1/R2 (99–107); bytes 95/97/109/111 unused on
  V2.0 (V3.00 uses 109/111 for its extra R2/R3 delays).
- **Multiband (5), Resonant Chords (6), Rich Chamber/Plate (8), Infinite (9)**: byte-
  for-byte identical to what we had — no change.
- **Size constants (p. 8-14)** match our `sizeParams` exactly (Concert Hall 5/444/164/
  31362, Rich Chamber 8/388/511/30151, Rich Plate 8/471/424/30892, Inf 8/388/511/30151).

### Manual errors in the V2.0 tables (worked around, not followed literally)
- **Concert Hall SIZE** prints `491–532`/"5.6–34.7m" (p. 8-11) — these are byte-for-byte
  the Rich Plate row and imply min-size 8, contradicting Concert Hall's min-size 5. Kept
  the correct `488–537` (min-size 5); the display formula `(size+minSize)*71/100`
  reproduces Rich Plate's own "5.6–34.7m" from min-size 8, confirming the copy-paste.
- **Size formula** on p. 8-14 prints `*71/10`; the correct divisor is `/100` (verified
  against Rich Plate's printed 5.6–34.7 m range). Our Convert uses `/100`.
- **Param#/Byte# columns** in the reverb tables are shifted one row (rows print 10.., 20..,
  30.. instead of 20.., 30.., 40..) and row-4 Byte# overlaps row 3. We follow byte order
  + Table 1's `10*row+col` rule instead.
- **Frequency display anchor**: the manuals' "value = raw − low limit" into Table 13
  contradicts the printed display ranges for params with rawMin 497 (Concert Hall
  XOVER/HC etc. print 170 Hz minimum, but value 0 would be 0 Hz). Table 13 is anchored
  at **raw 496 = entry 0** for all freq params (`Convert.FREQ_BASE`); rawMin-497 params
  then start at entry 1 = 170 Hz, matching their printed ranges.
- The editor **audits every loaded dump** and logs words outside our limits
  ("⚠ audit …" console lines) — this is how the Concert Hall and Chorus & Echo
  ch. 8 misprints were caught. Trust ch. 4's parameter matrices over ch. 8's
  byte tables when they disagree; trust a real dump over both.

### Test plan for the next hardware session

- [ ] **Sweep unit** (Registers tab): all 50 stored dumps arrive, 30 ms pacing holds,
      names look right. Then **Backup (.syx)** and keep the file (pre-experiment
      safety copy of whatever is on the unit).
- [x] **Preset sweep — done 2026-07-18, byte-perfect.** All 43 factory presets swept
      into the library and exported; the export is **byte-identical (43/43)** to the
      independent `dumps/Lexicon-PCM-70-Ver-2.syx` bank. This simultaneously (a)
      authenticates the internet bank as unmodified factory data, (b) proves the whole
      read pipeline (PC load → active dump → codec → library → .syx export) is
      byte-transparent on real hardware, and (c) confirms our preset table's names/PC
      mapping for all 43 presets.
- [ ] **Store with verify**: store the working copy into an unused register — expect
      "✓ stored and verified". Also try with M PROTECT on to see the failure path.
- [x] **Patch live-sync — done 2026-07-18.** Params 60–79 (source, destination)
      sync correctly; the unit displays controller names (CC7 "VOLUME", CC6
      "DATA ENTR"). The scale encoding (80–89) was WRONG in the manual: two
      editor↔panel pairs (raw 76 → +77, raw 159 → −97) prove raw 0–127 → +1…+128
      and 128–255 → −128…−1 — formula 13 is printed exactly backwards. Codec
      fixed; re-verify one scale value after the fix.
- [x] **BPM displays — done 2026-07-18.** Voice delays as n/24 beat match the panel.
      RATE BPM calibrated from two editor↔panel pairs (raw 484 → 100 BPM,
      raw 502 → 118): **BPM = (raw − 448) + 64**, i.e. 448–575 → 64–191 BPM.
- [x] **Infinite Reverb REV TIME — calibrated 2026-07-18.** Not linear: it is the
      size-dependent Table 11 reverb-time formula (like RT LOW/MID), INF past the
      table end (val ≥ 32). Verified: panel 3.9 s / 32 s / INF at val 25/31/32
      match the formula exactly (timeFactor 23 at factory SIZE).
- [x] **Resonant Chords voice predelay — checked 2026-07-18, linear accepted.**
      Six panel↔editor pairs (0/125/243/364/485/602 vs 0/124/240/361/482/601)
      agree within 1–3 ms (<1%); the tiny mid-range bow suggests mild
      nonlinearity, but it is inaudible and underdetermined by the data. The
      linear display stays, deviation accepted.

**V2.0 validation complete 2026-07-18** — every algorithm family, both sweep
directions, store+verify, patch live-sync, and all display curves are
hardware-checked. Clear for the 3.0.1 ROM swap (back up registers first!).

### Test plan for the first 3.0.1 session (after the ROM swap)

Set the firmware selector in the rack strip to **V3.01** first (persisted; it
switches layouts, the preset matrix, Inverse Room, and the MIDI Clock source).

- [ ] **Registers survived?** Sweep unit. If the bank was wiped by the swap:
      Registers tab → **Restore (.syx)** with the pre-swap backup (M PROTECT off);
      it writes all 50 paced and sweeps to verify.
- [ ] **Basic protocol re-check**: Get, preset load (new V3 matrix — e.g. 3.0
      SUSTAIN HALL), a param edit with auto-send. Expect no change (framing is
      version-identical), but verify.
- [ ] **Concert Hall V3 layout** (concertHallV3: 4 levels 85–93, 6 delays 99–111,
      delay master centered 512, voices anchored 400): load a Hall preset, check
      for ⚠ audit lines, and compare rows 3/4 panel↔app like the V2.0 calibration.
      Also confirm whether LVL MSTR zero sits at raw 512 (477 anchor) on V3 too.
- [ ] **Inverse Room** (first ever): load 6.0 INVERSE ROOM — audit lines + panel
      comparison for the whole layout (Table 9A was transcribed but never
      verified); check the DURATION-dependent limits behavior (editor does not
      model them yet).
- [ ] **Row 6 preset names**: the V3 preset table's row 6 is manual-derived —
      the load log will report any name mismatches; fix the table from the unit.
- [ ] **MIDI Clock patch source** (#70): patch it to a BPM program's RATE and
      confirm the unit follows external clock; check the patch-scale encoding
      still matches (expected: same firmware family).
- [ ] **Preset sweep V3**: sweep → library → export a verified V3.01 preset bank
      (also fills in the true row-6 names/types).

### Still to confirm on hardware
- [ ] **BPM-variant limits** (types 11–13): the `bpm` master/voice overrides (448–575 /
      500–524) come from the V3.00 footnotes; the V2.0 footnotes are partly cropped in
      the scan. Get a Rhythm program and check the delay-parameter ranges.
- [ ] Spot-check a Concert Hall dump from the unit to confirm the 7-reflection-level
      layout and DCY OPT word (the V2.0 table page had the printing errors noted above).

## Protocol behaviour (from M4 onward)
- [x] Active dump request (`60`) returns the running program.
- [ ] Stored dump request (`61`, reg 0–49) returns a register; 30 ms pacing holds.
- [x] Parameter-change sysex changes the active buffer — confirmed 2026-07-17
      (editor edits show up on the unit's panel, e.g. the DCY OPT toggle at 0.7;
      master drags demonstrably rewrite voice words).
- [ ] Store-to-register + verify readback; M PROTECT behaviour.
- [ ] Program Change loads presets/registers — **requires 1.2 PGM CHNG = FIX in
      Control Program 7.0 on the unit** (OFF = PCs silently ignored). The editor
      now waits `PC_LOAD_DELAY_MS` (400 ms, tunable in index.html) after sending
      a PC before requesting the dump, and verifies the returned dump's matrix
      position against the requested preset (retries once, then loads whatever
      the unit actually runs and says so in the console). If preset loads still
      return the *old* program, raise the delay.
- [x] ~~Bulk dump byte 1/2 (matrix row/col) reflects the loaded preset's position~~
      **REFUTED 2026-07-17**: after loading preset 3.0 via PC 80, the active dump's
      bytes 1/2 read 0.0. They do not identify the loaded program — the editor now
      verifies preset loads by NAME (bytes 3–16) with program type as fallback.
- [x] DCY OPT byte position **confirmed 2026-07-17**: toggling DCY OPT in the editor
      moves 0.7 on the unit — so the V3.00 byte/param cross holds on V2.0:
      DCY OPT param 7 @ byte 63, CHORUSING param 8 @ byte 61.

## Confirmed on hardware

- **2026-07-17 — Parameter-change sysex puts the unit into parameter mode, and in
  that state it IGNORES MIDI Program Changes.** (Panel: all key LEDs off, display
  shows the last-changed parameter.) Loading works again after the unit receives
  an active bulk dump (Put → panel shows REG mode), or after pressing PGM on the
  front panel. Since the editor cannot see the panel's mode (the user may press
  PGM/REG themselves), it sends a Put unconditionally before every preset
  Program Change. Beware in logs: a PC ignored this way
  makes the follow-up dump return the *old edited buffer* — which can look like a
  successful load if only the name is checked.
- **2026-07-17 — Masters rewrite their voice words.** Dragging a master (with
  live param sends) made the unit rewrite all four voice words of that row to
  one clamped value (raw 420 ×4) — the stored voice values are not independent
  of the master. Also the key evidence for the row-3/4 byte swap below.
- **2026-07-17 — Concert Hall rows 3/4 RESOLVED by panel-vs-dump comparison**
  (factory 3.0: dump bytes 85=512, 87–93=495×4, 99=400, 101/103=495,
  105/107=512; panel: 3.0=0, 3.1–3.4=OFF, 4.0=0, 4.1–4.4=000ms, L3/R3 present
  in both rows):
  - Layout = the V2.0 ch8 print after all: **levels 85–97, delays 99–111,
    7-wide** (an earlier "delays at 87–93" swap inference was wrong, see next
    bullet). The ch4 matrix's N/A at 3.5/3.6/4.5/4.6 was a misprint — the
    panel has L3/R3 in both rows.
  - Hardware zero points: LVL MSTR 0 @ raw 512 → range **477–547** (printed
    472 misprinted); DLY MSTR 0 @ raw **400** → range 94–706 (centered on 400,
    not 512!); delay voices 000 ms @ raw **512** → range 512–736 (raw 495 also
    shows 000 via clamping). The two delay ranges are PROVISIONAL — confirm by
    setting 4.0/4.1 to known values on the panel and watching which raw values
    arrive.
- **2026-07-17 — Rich Chamber (type 8) layout & ranges confirmed as printed**
  (Table 8, identical V2.0↔V3.00): panel 4.1 REFL L1 set to 408 ms (and 400 ms)
  round-trips through the dump and displays identically in the editor — so its
  reflection delays anchor at raw 400 as printed, and a fresh 4.0 RICH CHAMBER
  load shows panel and app in full agreement. The Concert Hall zero-point
  anomalies (DLY MSTR centered at 400, delay voices at 512) are therefore
  Concert-Hall-specific, NOT a reverb-family convention. Rich Plate and
  Infinite Reverb share this layout family and presumably its correctness
  (spot-check on first use).
- **2026-07-17 — The firmware stores out-of-range parameter bytes.** Factory
  3.0 ships raw 400 in a level slot (R3) and raw 495 in delay slots; a master
  drag rewrites voice words by raw delta (level voices 495 → 420 after a −75
  master move), sailing below the legal floor. The panel (and now the editor)
  clamps only the *display*. Consequences: audit lines on factory programs are
  expected and truthful, and **value-range arguments alone cannot identify a
  byte's parameter** — that's what invalidated the earlier swap inference.
  Only panel-vs-dump comparison is conclusive.
- **2026-07-17 — Active-dump bytes 1/2 are the panel's matrix cursor, not the
  loaded program's identity** (read 0.0 after one 3.0 load, 3.0 after another).

- **2026-07-14 — Active dump request/parse works** (`60`, reg 50): Get returns a
  bulk dump that decodes to the correct program type and name, checksum OK. So
  the F0 06 00 framing, nybble pairs, 7-bit sumcheck, and 167-byte layout are
  right on V2.0 hardware.
- **2026-07-14 — Preset loading via Program Change works** (PC 50+row*10+col,
  then delayed active-dump fetch): 0.7 PSYCHO ECHOES loaded with correct name
  and type. The PC→preset mapping and the matrix-position bytes (1–2) behave
  as the manuals claim.
- **2026-07-14 — Chorus & Echo dump layout = V3.00 order** (see refutation above).
- **2026-07-14 — Table lookups clamp at the table ends.** PSYCHO ECHOES stores
  HC = raw **552**, far beyond the printed 496–527 range, and the unit's front
  panel displays plain "15.0 kHz" (the table's last entry). So the manuals'
  printed raw ranges are the *editable* ranges; factory presets store values
  beyond them and the firmware saturates the display lookup. `Convert._tbl`
  mirrors this for freq/level/rtime/pitch/chorusMode; the editor still shows
  such values amber and logs them in the dump audit. Editing one snaps it into
  the printed range (that is also what the front panel would do).
