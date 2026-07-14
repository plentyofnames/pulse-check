# PCM 70 Editor

A web-based editor / librarian for the **Lexicon PCM 70** digital effects processor.
Vanilla JS + Web MIDI, no build step, single page.

**Target firmware: software V2.0.** The parameter tables were transcribed from the
V3.00 owner's manual (the only one to hand), but the app is gated to the V2.0 feature
set — see [Firmware](#firmware) below and [`HARDWARE-NOTES.md`](HARDWARE-NOTES.md).

> Sibling project to the Lexicon Reflex Editor — same stack, same MIDI plumbing patterns.

## Status

Under construction. See [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for the full plan and
milestone list (M0–M7).

## Running

The app is a static page. Any static server works; a launch config is provided for
Claude Code:

```
python3 -m http.server 8770
# then open http://localhost:8770/
```

Requires a **Chromium-based browser** (Chrome / Edge / Opera) — Web MIDI with SysEx is
not available in Firefox or Safari.

## Firmware

The unit this editor targets runs **software V2.0**. The V3.00 manual documents two
additions that are absent on V2.0, so the app does not offer them:

- **Program types 11–14** — the Rhythm/BPM variants (Multiband Rhythm, Chorus &
  Rhythm, Rhythmic Chords) and **Inverse Room**. The BPM programs need MIDI-clock
  tempo sync; Inverse Room is explicitly V3.0 (its dumps can crash a V2.0 unit).
- **Patch source “MIDI Clock”** — "not implemented in version 2.0" (manual 6-5).

The seven shared algorithms (types 4–10) are assumed identical between V2.0 and V3.0
in byte layout, limits, and checksum — this assumption is flagged for verification
against the real unit in [`HARDWARE-NOTES.md`](HARDWARE-NOTES.md). To re-enable the
full V3.0 set, set `FIRMWARE = 3.0` in [`pcm70-data.js`](pcm70-data.js).

## Required PCM 70 settings

For the editor to talk to the unit, set in the PCM 70's Control Program (values below
are from the V3.00 manual — confirm the exact menu on a V2.0 unit):

- **MIDI CHNL** — match the editor's channel selector
- **OMNI OFF**
- **PGM CHNG FIX** — for Program-Change register loading
- **M PROTECT OFF** — otherwise Store-to-register is silently rejected

## Notes

- The PCM 70 never transmits front-panel edits — the editor is master; press **Get** to
  resync after tweaking the unit directly.
- Bulk messages are paced (≥30 ms) through a single send queue.
- Hardware-verified behavior is recorded in `HARDWARE-NOTES.md` as it is discovered.

## License

TBD. The scanned owner's manual (`PCM70-OM_original.pdf`) is copyrighted Lexicon
documentation and is **not** part of this repository.
