# PCM 70 Editor

A web-based editor / librarian for the **Lexicon PCM 70** digital effects processor
(software V3.00). Vanilla JS + Web MIDI, no build step, single page.

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

## Required PCM 70 settings

For the editor to talk to the unit, set in the PCM 70's Control Program:

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
