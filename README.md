# Pulse Check

A browser-based **Web MIDI** SysEx editor and librarian for the **Lexicon PCM 70**
digital effects processor — with its **P**ulse **C**ode **M**odulation vitals
thoroughly examined. Sibling of [Reflex Hammer](https://github.com/plentyofnames/reflex-hammer).

▶︎ **Live app:** https://plentyofnames.github.io/pulse-check/

Move a control and the change reaches the PCM 70 in real time. Sweep the unit's 50
registers or its factory presets into a browser-side library, audition and edit them,
store back to any register, and keep byte-exact `.syx` backups of everything.

## Features

- **All eleven algorithms** (Chorus & Echo, Multiband Delay, Resonant Chords, Concert
  Hall, Rich Chamber, Rich Plate, Infinite Reverb, the three Rhythm/BPM variants, and
  Inverse Room on 3.0.x) with live parameter sends and physical-unit readouts
  (seconds, meters, Hz, dB, beat fractions, BPM).
- **Both firmware generations**: a rack-strip selector switches the app between
  **V2.0** and **V3.0x** — layouts, preset matrices, Inverse Room, and the MIDI Clock
  patch source all follow. (Inverse Room dumps are blocked from being sent to V2.0
  units, which they can crash.)
- **Hardware-calibrated parameter tables.** Both owner's manuals misprint byte
  layouts, ranges, and encodings; every table in this editor was verified against a
  real unit, on both firmwares — the findings (and the manuals' sins) are documented
  in [`HARDWARE-NOTES.md`](HARDWARE-NOTES.md). Loaded dumps are audited against the
  tables live, with raw word dumps in the console.
- **Dynamic MIDI patch bay**: all ten patches (source → destination → ±128 scale knob)
  with live sync. Remember: patches *offset* a parameter's stored value — for 1:1
  MIDI-clock tempo tracking, set RATE BPM to 64 first.
- **Built-in MIDI clock generator** (24 ppqn, timestamp-scheduled) to drive the
  Rhythm programs' clock patches from the browser.
- **Librarian**: sweep all 50 registers (paced per the unit's 30 ms rule), store with
  byte-compare verification, full-bank `.syx` **Backup** and **Restore**, factory
  **preset sweep** into an unlimited browser library, `.syx` import/export.
- No build step, no dependencies — one static page plus two data files.

## Requirements

- A **Web MIDI–capable browser**: Chrome, Edge, or Opera. (Safari and Firefox do not
  support Web MIDI.)
- A MIDI interface connected to the PCM 70's MIDI In **and** Out.
- On the unit, in the Control Program (7.0): **MIDI CHNL** matching the editor,
  **OMNI OFF**, **PGM CHNG = FIX**, and **M PROTECT OFF** for storing to registers.

## Usage

1. Open the live app and allow MIDI access when prompted.
2. Select MIDI Out/In, the unit's channel, and set the **firmware selector** (in the
   rack strip) to what your unit shows at power-on — V2.0 or V3.0x.
3. Click a preset or register to load it (audibly, on the unit), and edit away —
   **Auto-send** keeps the unit following the editor.
4. **Get** re-reads the unit's active program; **Put** pushes the working copy.
   The PCM 70 never transmits front-panel edits, so after tweaking knobs on the
   unit itself, press **Get**.
5. In the Registers tab: **Sweep unit** to read all 50 registers, hover a row to
   **⤓ store** the working copy there, **Backup**/**Restore** for full-bank `.syx`.
6. In the Presets tab: **Sweep → library** captures the factory bank; the Library
   tab holds unlimited programs with `.syx` import/export.

> **Note:** the active buffer is volatile — store to a register (or the library)
> or edits are lost when you load something else or power off.

## Provenance

The protocol reference that emerged from building this — sysex framing, bulk dump
layout, per-algorithm byte maps, display-value curves, and the encoding quirks the
manuals got wrong — lives in [`HARDWARE-NOTES.md`](HARDWARE-NOTES.md), verified
against a real PCM 70 running V2.0 and then 3.0.1. Corrections welcome, but bring a
word dump.

## License

MIT. The Lexicon owner's manuals are copyrighted and are not part of this repository.
