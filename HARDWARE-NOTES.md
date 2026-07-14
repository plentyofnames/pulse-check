# Hardware notes

Findings from testing against the real PCM 70. The manual's sysex claims are
hypotheses until confirmed here (see IMPLEMENTATION.md "Hardware-truth rule").

**Unit under test: software V2.0.** The only manual available is the V3.00 owner's
manual, so everything below was transcribed from V3.00 and must be re-checked on V2.0.

## To verify

### Firmware V2.0 vs the V3.00 manual — highest priority
- [ ] **Bulk-dump format unchanged?** Confirm a V2.0 active dump is still
      `F0 06 00 … F7` with byte count `02 4E` (334 nybbles → 167 data bytes) and the
      same 7-bit nybble sumcheck. If V2.0 uses a different length/layout, the codec
      needs a V2.0 branch. *This gates everything — check it first (Get + read the
      raw RX line in the console).*
- [ ] **Per-parameter tables (types 4–10) identical?** The raw min/max and byte
      offsets in `pcm70-data.js` come from the V3.00 tables. Get a known program and
      compare decoded display values against the unit's front panel.
- [ ] **Parameter numbering** (`row*10+col`) and the value encoding (3+7 bits,
      MSB first) unchanged in V2.0.

### Confirmed V3.0-only (already gated off in the app)
- Program types 11–14 (Multiband Rhythm, Chorus & Rhythm, Rhythmic Chords, Inverse
  Room) — not offered on V2.0. Inverse Room dumps reportedly crash V2.0 units.
- Patch source 70 (MIDI Clock) — "not implemented in version 2.0" (manual 6-5).
- [ ] Confirm the V2.0 unit indeed reports only algorithms 4–10.

### Protocol behaviour (from M4 onward)
- [ ] Active dump request (`60`) returns the running program.
- [ ] Stored dump request (`61`, reg 0–49) returns a register; 30 ms pacing holds.
- [ ] Parameter-change sysex audibly moves the active buffer.
- [ ] Store-to-register + verify readback; M PROTECT behaviour.
- [ ] Program Change loads registers (PGM CHNG FIX).
- [ ] Front-panel edits are NOT transmitted (Get is the only resync).

## Confirmed

_(nothing yet — awaiting first session with the unit)_
