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

## OPEN: per-program parameter tables differ V2.0 ↔ V3.00 — needs re-transcription

The V2.0 per-program tables (Tables 4–9, pp. 8-8…8-14) are **not identical** to the
V3.00 tables currently in `pcm70-data.js`. Proven on **Concert Hall (V2.0 p. 8-11)**:

- **SIZE**: V2.0 = raw `491–532`, display "5.6–34.7m" (implies min-size 8); V3.00 =
  `488–537`, "3.5–38.3m" (min-size 5). The V2.0 size row is internally inconsistent with
  a min-size of 5, so the V2.0 size constants on p. 8-14 must be read carefully.
- **Reflections**: V2.0 Concert Hall has **7 reflection levels + 7 reflection delays**
  (words 19–25 then 26–32, contiguous); V3.00 has **5 levels + 7 delays** (words 24–25
  unused). Real structural difference.
- **Manual printing errors on p. 8-11**: the Param# column is shifted one row below
  Table 1's `10*row+col` rule (rows 2–4 print 10.., 20.., 30.. instead of 20.., 30..,
  40..), and row 4's Byte# column overlaps row 3. Trust byte-sequential order + the
  `10*row+col` rule, not the printed Param#/Byte# in those rows.

### To do
- [ ] Re-transcribe V2.0 Tables 4–9 (pp. 8-8…8-14) into `pcm70-data.js`, one table per
      pass + a diff pass, correcting the printed-column errors via byte order + Table 1.
- [ ] Read V2.0 size-constants table (p. 8-14) — get V2.0 min-size / time-const / size-
      const / size-base per reverb type (may differ from V3.00 Table 10).
- [ ] **Cross-check against the unit** for cells the V2.0 manual prints inconsistently
      (Concert Hall SIZE min-size; reflection counts): Get a known factory program of
      each algorithm and compare decoded display values to the front panel.

## Protocol behaviour (from M4 onward)
- [ ] Active dump request (`60`) returns the running program.
- [ ] Stored dump request (`61`, reg 0–49) returns a register; 30 ms pacing holds.
- [ ] Parameter-change sysex audibly moves the active buffer.
- [ ] Store-to-register + verify readback; M PROTECT behaviour.
- [ ] Program Change loads registers.

## Confirmed on hardware

_(nothing yet — awaiting first session with the unit)_
