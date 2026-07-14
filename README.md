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

The unit this editor targets runs **software V2.0**. Confirmed against the V2.0 manual's
own MIDI Implementation Data (ch. 8), the sysex framing and 167-byte bulk layout are
identical to V3.00, but two V3.0 features are absent, so the app does not offer them:

- **Program type 14 (Inverse Room)** — V3.0 only (its dumps can crash a V2.0 unit).
  The Rhythm/BPM algorithms (types 11–13) **do** exist in V2.0 and are available.
- **Patch source “MIDI Clock”** — V2.0 has no MIDI-clock source; BPM programs sync via
  switches, not MIDI clock.

To re-enable the full V3.0 set, set `FIRMWARE = 3.0` in [`pcm70-data.js`](pcm70-data.js).

The per-program parameter tables in `pcm70-data.js` are reconciled to the V2.0 manual
(ch. 8). Two layouts differed from V3.00 and were corrected — Chorus & Echo word order
and Concert Hall (DCY OPT word, 7 reflection levels, no CHORUSING); the rest were
identical. A couple of V2.0 manual misprints were worked around, and the BPM-variant
limits still want a hardware spot-check — details in
[`HARDWARE-NOTES.md`](HARDWARE-NOTES.md).

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
