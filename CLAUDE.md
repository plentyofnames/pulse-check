# PCM 70 Editor

Web-based editor/librarian for the Lexicon PCM 70 digital effects processor. Vanilla
JS + Web MIDI, no build step, single-page — sibling project to `../Lexicon Reflex
Editor` (same stack, reuse its MIDI plumbing patterns).

**Target hardware runs software V2.0** (a 3.0.1 ROM upgrade is planned — see
IMPLEMENTATION.md "Firmware 3.0.1 support"). Both manuals are on hand:
`lexicon_pcm70.pdf` (V2.0, MIDI data in ch. 8) and `PCM70-OM_original.pdf` (V3.00,
ch. 6). V2.0's sysex framing + bulk layout are identical to V3.00; V2.0 has no type 14
(Inverse Room) and no MIDI-clock source — gated via `FIRMWARE` in `pcm70-data.js`.
The parameter tables are reconciled to V2.0 **and hardware-calibrated** — both
manuals misprint layouts and ranges; `HARDWARE-NOTES.md` is the ledger of what is
proven vs. hypothesis, and every loaded dump is audited against the tables (console
"⚠ audit" lines + raw-words log). Trust a real dump over either manual.

**Start here: `IMPLEMENTATION.md`** — full plan: architecture guidelines, sysex
protocol reference, state model, code structure with schemas, milestone task list
(M0–M7), and a PDF page map for the manual.

Key facts that trip people up:

- `PCM70-OM_original.pdf` is a **scanned** manual — pages are images; use `Read` with
  the `pages` parameter (chapter 6, PDF pages 47–61, is the sysex spec).
- Bulk-dump word index `(byte−47)/2` ≠ sysex parameter number `row*10+col`. Layout
  tables must carry both. See "Critical subtlety" in IMPLEMENTATION.md.
- The PCM 70 never transmits front-panel edits; the editor is master, `Get` resyncs.
- ≥30 ms between stored bulk messages; all sends go through the paced queue.
- Treat the manual's sysex claims as hypotheses until verified on the real unit
  (record findings in `HARDWARE-NOTES.md`).

Working style: no frameworks, no npm; CSS custom properties for theming (light +
dark, faceplate/VFD identity per the design mockup linked in IMPLEMENTATION.md);
one render path (never fork a `...Silent` duplicate); pure byte-level functions
kept DOM-free and testable.
