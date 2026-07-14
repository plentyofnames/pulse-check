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

- **Chorus and Echo (Table 4)**: V2.0 orders row 0 naturally — CHORUS at word 4
  (byte 55), DIFFUSION at word 6 (byte 59). V3.00 had swapped those two words. Fixed.
- **Concert Hall (Table 7)**: V2.0 has **DCY OPT at word 7 and no CHORUSING param**
  (V3.00 added CHORUSING at word 7 and pushed DCY OPT to word 8), and **7 reflection
  levels** (words 19–25) where V3.00 had 5 (words 24–25 unused). Both fixed.
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

### Still to confirm on hardware
- [ ] **BPM-variant limits** (types 11–13): the `bpm` master/voice overrides (448–575 /
      500–524) come from the V3.00 footnotes; the V2.0 footnotes are partly cropped in
      the scan. Get a Rhythm program and check the delay-parameter ranges.
- [ ] Spot-check a Concert Hall dump from the unit to confirm the 7-reflection-level
      layout and DCY OPT word (the V2.0 table page had the printing errors noted above).

## Protocol behaviour (from M4 onward)
- [ ] Active dump request (`60`) returns the running program.
- [ ] Stored dump request (`61`, reg 0–49) returns a register; 30 ms pacing holds.
- [ ] Parameter-change sysex audibly moves the active buffer.
- [ ] Store-to-register + verify readback; M PROTECT behaviour.
- [ ] Program Change loads registers.

## Confirmed on hardware

_(nothing yet — awaiting first session with the unit)_
