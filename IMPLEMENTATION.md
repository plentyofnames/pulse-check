# PCM 70 Editor — Implementation Plan

Web-based editor/librarian for the Lexicon PCM 70 (software V3.00), successor to the
[Lexicon Reflex Editor](../Lexicon%20Reflex%20Editor/index.html) ("Reflex Hammer").
Reference document: `PCM70-OM_original.pdf` (Owner's Manual; Chapter 6 = MIDI
implementation & sysex protocol, pages 6-1…6-15 of the manual, PDF pages 47–61).
Design mockup: https://claude.ai/code/artifact/b72bc555-7578-4647-8121-0c345794a3e9
(dark faceplate / phosphor-cyan VFD theme, rack strip + librarian + row-grouped
params + patch bay).

---

## Guidelines

### Architecture

- **Same stack as the Reflex editor**: static site, vanilla JS, Web MIDI with
  `{ sysex: true }`, no build step, deployable on GitHub Pages. Chrome/Edge/Opera only.
- **Two files instead of one**: `index.html` (UI + logic) and `pcm70-data.js`
  (parameter metadata + lookup tables). The PCM 70's data tables are ~10× the Reflex's;
  keeping them separate keeps both files navigable. Still zero tooling.
- Reuse from Reflex `index.html` (1384 lines): port enumeration/selection UI, channel
  dropdown, `pendingRequest` + timeout pattern, `handleMidiMessage` dispatch shape, the
  metadata-table + `raw ↔ display ↔ physical` conversion-layer pattern. Do **not** reuse
  the Reflex sysex framing (model ID `02`, 8-in-7 packing) — the PCM 70 differs (below).
- Avoid the Reflex's known warts: no duplicated `updateParameterGrid`/`...Silent`
  (one render function with a `silent` flag), CSS custom properties instead of
  hard-coded colors, no scattered `setTimeout` chains for pacing (use one send queue).

### Sysex reference (from manual ch. 6 — verify every message on real hardware)

All messages: `F0 06 00 …data… F7` (Lexicon = `06`, PCM 70 = `00`). Channel byte
nibbles below use `n` = MIDI channel 0–15.

| Message | Bytes after header |
|---|---|
| Parameter change (to unit) | `0010nnnn` `gg` (param 0–89), value as 2 bytes: top 3 bits (`00000vvv`), low 7 bits (`0vvvvvvv`) |
| Bulk dump request | `0011nnnn`, event `60` (active) / `61` (stored), reg # 0–49 (or 50 = active buffer) |
| Bulk data (both directions) | `000cnnnn` (c: 0 = active/running, 1 = stored register), reg # 0–49 / 50, byte count `02 4E` (=334, MSB first), 334 nybble bytes (hi nybble then lo nybble per data byte, 167 data bytes), 7-bit checksum of the nybblized bytes |

Constraints:
- **30 ms minimum between stored bulk data messages** (slow 1987 CPU — treat as floor, tune up if flaky).
- The PCM 70 **never transmits parameter changes** (front-panel edits are invisible to us).
- Program Change (`Cn pp`): 0–49 loads register 0.0–4.9; 50–119 loads presets 0.0 up (FIX mode). Transmit is always FIX-format.

Bulk data layout (167 bytes):

| Bytes | Content |
|---|---|
| 0 | Program type (4 Chorus&Echo, 5 Multiband, 6 Resonant Chords, 7 Concert Hall, 8 Rich Chamber, 9 Rich Plate, 10 Infinite Reverb, 11 Multiband Rhythm, 12 Chorus&Rhythm, 13 Rhythmic Chords, 14 Inverse Room) |
| 1–2 | Stored parameter-matrix position (row, col) |
| 3–16 | Name, 14 chars, last must be 0 |
| 17–26 | Patch sources ×10 |
| 27–36 | Patch destinations ×10 (encoded `row*10 + col`) |
| 37–46 | Patch scale factors ×10 (0–127 → −128…−1; 128–255 → +1…+128) |
| 47–166 | 60 parameter words, 2 bytes each: byte 0 = low 8 bits, byte 1 = high 2 bits |

Sysex parameter numbering: 0–59 = `row*10 + col`, 60–69 sources, 70–79 destinations,
80–89 scale factors, 90–103 name characters.

Patch source encoding: 0 = OFF, 1–32 = Ctrl 0–31, 33–64 = Switch 64–95, 65 Pitch Wheel,
66 After Touch, 67 Last Note, 68 Last Velocity, 69 Soft Knob, 70 MIDI Clock.

### Display-value math (manual 6-13…6-15)

Raw 10-bit values are canonical in the data model; the UI always shows physical units.
Per-program-type parameter layouts with raw min/max are in manual **Tables 4–9A**
(7 layouts cover the 11 program types; BPM variants share layouts with altered limits —
footnotes on 6-6/6-7). Conversions need the manual's lookup tables transcribed into
`pcm70-data.js`:

- **Table 11** reverb times (32 entries), **Table 12** levels (OFF, −30…FULL, 34 entries),
  **Table 13** frequencies Hz (32 entries), **Table 14** delay-time samples (~256 entries).
- Formulas: size display `(raw−min+minSize)*71/100`; reverb time via size factor / time
  factor / Table 11; predelay `value*2 ms`; gate time `value*18 ms`; delay times piecewise
  (`value−48`, `(value−98)*2`, … / Table 14 below 98 via samples`*148/5000`).
- **Size-dependent limits**: SIZE (or DURATION for Inverse Room) re-clamps the *max* of
  PDELAY and reflection delays (formulas in items 5–6, manual 6-13). When SIZE shrinks
  below a stored value, hardware keeps the internal value but flags it out of range —
  mirror that: show `>` / `<` marker rather than silently rewriting the value.
- Resonant Chords pitch params display as notes (Db1–Eb7).

### State model — where the truth lives

Three layers, editor working copy in the middle:

```
Hardware registers 0.0–4.9  ←store/fetch→  EDITOR WORKING COPY  ←save/load→  Browser library
        (permanent, 50)                    (canonical for UI)              (localStorage + .syx files)
                                                 ↕ live
                                    Hardware ACTIVE buffer (audible)
```

- The **working copy** (one 167-byte program + dirty flag + origin tag
  `{register n | preset | library id | scratch}`) is the single source of truth for
  the UI. Every widget edit mutates it first.
- **Live sync (Auto-send ON, default)**: each edit also emits one parameter-change
  sysex → the hardware **active buffer** follows the editor in real time. Coalesce
  per-parameter and pace ≥30 ms via the send queue. Auto-send OFF: edits accumulate;
  **Send** pushes the whole working copy as an active bulk dump (c=0).
- **Get** = request active dump (event `60`) and overwrite the working copy
  (confirm first if dirty). This is the *only* way to pick up front-panel tweaks —
  the unit won't tell us. Say so in the UI ("unit edited? press Get").
- **Load register** (click in librarian): send Program Change `n` so the unit
  audibly loads it, then Get to mirror it. (Pure-sysex alternative: fetch stored dump
  and re-send as active — decide after hardware testing; PC is the proven path and
  the Reflex needed exactly this fallback.)
- **Peek register** (secondary action): request stored dump (event `61`) into the
  editor *without* touching the unit's active buffer.
- **Store to register** (permanent save): send stored bulk (c=1, reg #), wait, then
  request the same register back and byte-compare = **verify readback**. On mismatch,
  surface it — likely M PROTECT is on (it can't be cleared via sysex; tell the user to
  turn it off in the unit's Control Program 7.0, param 0.1).
- Register **rename** = edit name bytes in working copy + Store. Enforce 14 chars,
  ASCII, last byte 0.
- **Never auto-store.** Put/Store are always explicit; amber dot marks
  working-copy-dirty vs. its origin register.

### Widgets & interaction

- **Sliders** for continuous parameters (as in Reflex) — good for coarse sweeps.
- **Knobs** for the 10 patch **scale factors** (±128) and anywhere horizontal space is
  tight. Knob spec: vertical drag mapped to ~200 px for full range, `Shift` = fine
  (×10 finer), scroll wheel = ±1 step, double-click = default, arrow keys when focused,
  proper `tabindex` and `aria-valuenow`.
- **Every value read-out is editable**: click → becomes a text input pre-filled with
  the display value, `Enter` commits (parse number, ignore unit suffix, snap to nearest
  legal raw value, clamp to current limits), `Esc` cancels, blur commits. Applies to
  sliders, knobs, and selects-with-numeric-domains alike.
- Dropdowns for enumerated params (DCY OPT, CHORUS mode, patch sources/destinations).
  Destination dropdowns list only the loaded program type's parameters, labeled
  `row.col NAME` exactly like the front panel.
- Sysex console strip at the bottom logs TX/RX (last N messages, hex + decoded) —
  primary debugging aid against real hardware.

### Hardware-truth rule

The Reflex taught us documented sysex ≠ working sysex (its register-recall sysex never
worked; Program Change did). Treat every manual claim as a hypothesis:
log everything, keep fallbacks (PC instead of active-dump-send, etc.), and keep the
30 ms pacing adjustable in one constant. Also: the manual warns V3.00 **Inverse Room**
dumps crash V2.00 units — before storing, if we ever learn the unit's version, gate on
it; at minimum document the warning in the README.

---

## Code structure

Two source files, no build step:

```
index.html      app: styles + markup shell + all logic (script sections below)
pcm70-data.js   data only — program types, parameter layouts, lookup tables
```

### Script sections in `index.html`

Keep these as separate, clearly-commented sections (plain objects/functions, no framework):

1. **`Sysex`** — pure byte-level builders/parsers, no I/O, no DOM:
   - `buildParamChange(ch, paramNum, raw10)` → `Uint8Array`
   - `buildDumpRequest(ch, { stored, reg })`
   - `buildBulkData(ch, { stored, reg, data167 })` (nybblize + checksum)
   - `parse(bytes)` → `{ kind: "bulk", stored, reg, data167 }` or `null`
     (validate header `F0 06 00`, byte count 334, checksum; report failures)
2. **`Codec`** — `decodeProgram(data167)` ⇄ `encodeProgram(prog)` using the
   Program shape below and the layout tables from `pcm70-data.js`.
3. **`Convert`** — display math, all pure:
   - `limitsFor(meta, ctx)` → `{ rawMin, rawMax }` (`ctx` = current SIZE/DURATION raw,
     program type — needed for the size-dependent clamps)
   - `toDisplay(meta, raw, ctx)` → `{ text, outOfRange }`
   - `fromDisplay(meta, text, ctx)` → nearest legal raw (typed input path)
4. **`Midi`** — Web MIDI ports + the *only* place bytes leave/enter the app:
   - paced send queue: `enqueue(bytes, { coalesceKey })` — a trailing-edge coalescer
     per key (e.g. `"param:11"`) so knob drags collapse to the latest value; global
     pacing `SEND_INTERVAL_MS = 30` (single tunable constant)
   - `request(msg, { timeoutMs, retries })` → Promise of the matching parsed reply
     (the Reflex `pendingRequest` pattern, promisified)
5. **`Store`** — app state: `workingCopy` (Program), `dirty`, `origin`
   (`{ kind: "register"|"preset"|"library"|"scratch", id }`), MIDI settings, library
   index. Mutations go through functions (`setParam`, `setPatch`, `setName`,
   `replaceProgram`) that fire a single `onChange` → render. No direct state writes
   from UI handlers.
6. **`UI`** — render + widget factories: `renderAll()`, `renderParams()`,
   `renderPatchBay()`, `renderLibrarian()`, `renderVfd()`; factories `makeSlider`,
   `makeKnob`, `makeValueInput`, `makeEnumSelect`. One render path; a `{ silent }`
   option suppresses MIDI sends when populating from a dump (do **not** duplicate the
   render function like the Reflex did).
7. **`Librarian`** — register sweep, localStorage persistence, `.syx`/JSON
   import/export, register⇄library copy.
8. **`Log`** — ring buffer of decoded TX/RX lines + console-strip render.

Dependency direction: `UI → Store → { Codec, Convert, Midi } → Sysex → pcm70-data.js`.
Nothing below `Store` touches the DOM; everything above `Midi` is testable without
hardware (open a scratch `test.html` that asserts codec/convert round-trips).

### Program object (working copy)

```js
{
  type: 7,                          // program type 4–14
  matrixPos: { row: 3, col: 0 },    // stored program-matrix position
  name: "LARGE HALL A",             // ≤14 ASCII chars
  patches: [                        // exactly 10
    { src: 2, dest: 11, scale: 64 } // src 0–70, dest = row*10+col, scale −128…+128
  ],
  words: new Uint16Array(60)        // raw 10-bit values, SEQUENTIAL dump order
}
```

**Critical subtlety — two different parameter indices.** In the bulk dump, the 60
words at bytes 47–166 are packed *sequentially with no gaps*, so a parameter's word
index is `(byteOffset − 47) / 2` — which is **not** `row*10 + col`. Example (Concert
Hall): REFL DLY MSTR is bytes 99–100 → word 26, but its parameter number for the
param-change sysex is 40 (row 4, col 0). Every layout entry therefore carries **both**
`byte` (from Tables 4–9A) and `paramNum = row*10 + col`. `Codec` maps by `byte`;
`Sysex.buildParamChange` uses `paramNum`. Getting this wrong scrambles programs.

### Layout schema (`pcm70-data.js`)

```js
const PROGRAM_TYPES = {
  4:  { name: "Chorus and Echo",  layout: "chorusEcho" },
  5:  { name: "Multiband Delay",  layout: "multiband" },
  6:  { name: "Resonant Chords",  layout: "resonantChords" },
  7:  { name: "Concert Hall",     layout: "concertHall" },
  8:  { name: "Rich Chamber",     layout: "richReverb", sizeParams: { minSize: 8,  timeConst: 388, sizeConst: 511, sizeBase: 30151 } },
  9:  { name: "Rich Plate",       layout: "richReverb", sizeParams: { minSize: 8,  timeConst: 471, sizeConst: 424, sizeBase: 30892 } },
  10: { name: "Infinite Reverb",  layout: "infinite",   sizeParams: { minSize: 8,  timeConst: 388, sizeConst: 511, sizeBase: 30151 } },
  11: { name: "Multiband Rhythm", layout: "multiband",  bpm: true },
  12: { name: "Chorus and Rhythm",layout: "chorusEcho", bpm: true },
  13: { name: "Rhythmic Chords",  layout: "resonantChords", bpm: true },
  14: { name: "Inverse Room",     layout: "inverseRoom" },
};
// Concert Hall sizeParams: { minSize: 5, timeConst: 444, sizeConst: 164, sizeBase: 31362 }

const LAYOUTS = {
  concertHall: [
    { row: 0, label: "Master", params: [
      { col: 0, name: "MIX",   byte: 47, rawMin: 462, rawMax: 562, kind: "mix"  },
      { col: 1, name: "FX ADJ",byte: 49, rawMin: 461, rawMax: 563, kind: "fxdb" },
      { col: 3, name: "SIZE",  byte: 53, rawMin: 488, rawMax: 537, kind: "size" },
      // …exactly as printed in manual Table 7, incl. gaps & BPM overrides
    ]},
    // rows 1–4; row 5 (MIDI patches) is NOT in `words` — it lives in `patches`
  ],
  // …6 more layouts
};
```

`kind` selects the formatter in `Convert` — the full set:
`mix` (0–100 %), `fxdb` (−90…+12 dB), `plain` (0–99), `onoff`, `level` (Table 12),
`rtime` (Table 11 + size factor), `freq` (Table 13), `delay` (piecewise + Table 14),
`predelay` (×2 ms), `gate` (×18 ms, top = OFF), `size` (×71/100 + minSize),
`chorusMode` (OFF, 1VC S…6VC S, 1VC T…6VC T), `pitch` (note names Db1–Eb7),
`softknob` (0–127), `signed` (bipolar masters like −35…+35, −100…+100).

### Event flows (reference)

```
knob/slider/typed value
  → Convert.fromDisplay → clamp via limitsFor
  → Store.setParam(paramNum, raw)            [dirty ← true]
  → UI updates that one cell (no full re-render)
  → if autoSend: Midi.enqueue(Sysex.buildParamChange(...), { coalesceKey: "param:N" })

Get                                          Load register (librarian click)
  → Midi.request(active dump)                  → confirm if dirty
  → Sysex.parse → Codec.decode                 → Midi.send(ProgramChange reg)
  → confirm if dirty → Store.replaceProgram    → then Get (as left)
  → renderAll({ silent: true })

Store to register                            SIZE/DURATION edit
  → Codec.encode(workingCopy)                  → recompute limitsFor of dependent
  → Midi.enqueue(bulk stored, reg)               params (PDELAY, REFL DLY …)
  → Midi.request(stored dump, reg)             → re-render those cells with
  → byte-compare → toast OK / M-PROTECT hint     out-of-range markers, keep raw
```

### Manual page map (for the implementing session)

The manual is scanned images — `Read` with `pages`, don't grep. PDF page = printed page:

| Content | Manual pages | PDF pages |
|---|---|---|
| Sysex message formats, param numbering, bulk layout, program types | 6-4…6-5 | 50–51 |
| Layout Tables 4, 5, 6, 7, 8, 9, 9A + size constants (Table 10) | 6-6…6-12 | 52–58 |
| Display formulas (size, rtime, levels, predelay, clamping items 5–6) | 6-13…6-14 | 59–60 |
| Lookup Tables 11–14 | 6-15 | 61 |
| Per-preset descriptions & patch listings (optional, for preset browser) | ch. 4 | 25–39 |
| Dynamic MIDI / patching behavior | 5-4…5-6 | 43–45 |

### Lookup tables (pre-transcribed — verify against PDF page 61 before trusting)

Indexing for all: `table[value]` counts row-by-row, `value = row*10 + col`.

```js
// Table 11 — reverb times (32 entries; units per manual formula: displayed s = timeFactor*t/500)
const REVERB_TIMES = [5,6,8,9,11,12,13,14,15,17, 18,20,22,24,26,28,30,34,38,42,
                      46,52,57,65,75,85,100,120,160,220, 350,700];

// Table 12 — levels in dB (35 entries; index 0 = OFF, last = FULL)
const LEVELS = ["OFF",-30,-27,-24,-22,-21,-19,-18,-17,-16, -15,-14,-13,-12,-11,-10,
                -9.5,-9.0,-8.5,-8.0, -7.5,-7.0,-6.5,-6.0,-5.5,-5.0,-4.5,-4.0,-3.5,-3.0,
                -2.5,-2.0,-1.5,-1.0,-0.5, "FULL"];  // ⚠ ragged in the scan — recount!

// Table 13 — frequencies in Hz (32 entries; 0 = flat/OFF)
const FREQUENCIES = [0,170,350,530,720,920,1120,1330,1550,1780,
                     2020,2270,2530,2810,3100,3410,3730,4080,4450,4850,
                     5280,5750,6270,6830,7470,8190,9020,10000,11100,12300,
                     13600,15000];

// Table 14 — delay-time samples: ~256 entries, NOT transcribed here.
// Transcribe carefully from PDF page 61 (10 columns per row, values 0…31687).
// Sanity checks: monotonically increasing; displayed ms = samples*148/5000.
```

⚠ Tables 11–13 were transcribed from a low-quality scan by reading the page image —
treat as 95 % right, re-verify each against PDF page 61 in the implementing session
(cheap: one `Read` call, three small tables). Table 14 must be transcribed fresh.

### Session strategy for implementation

- One milestone (or less) per session; start each session by reading this file.
- M2 is the highest-risk milestone (data fidelity). Transcribe **one layout table per
  agent/pass** directly from its PDF page, then have a *separate* pass re-read the page
  and diff against the transcription — scan OCR errors are the main failure mode.
- Build M1 against the codec round-trip tests before ever touching hardware.
- Anything hardware-behavioral (M4/M6) needs you at the desk with the PCM 70 and MIDI
  cables — the model can't hear the reverb; plan those as interactive sessions.

---

## Task list

### M0 — Scaffolding
- [ ] `git init`, README stub, `.gitignore` (PDFs, `.claude/`)
- [ ] `index.html` skeleton: theme tokens (light/dark via CSS custom properties, per mockup), rack strip / librarian / editor / patch bay / console layout grid
- [ ] `.claude/launch.json` with `python3 -m http.server` on a free port (the Reflex one points at the EF-303 project — don't copy it)

### M1 — MIDI core
- [ ] Web MIDI connect, port pickers, channel select; persist selections in localStorage
- [ ] Sysex builders: param change, bulk request (active/stored), bulk data (active/stored)
- [ ] Nybblize/denybblize + 7-bit checksum, 167-byte codec (name, patches, 60 words)
- [ ] Receive dispatcher with `pendingRequest` + timeout/retry; paced send queue (≥30 ms, coalescing)
- [ ] TX/RX console strip (hex + decoded)

### M2 — Data model (`pcm70-data.js`)
- [ ] Program-type registry (types 4–14 → 7 layout tables, incl. BPM-variant limit overrides)
- [ ] Parameter tables from manual Tables 4–9A: per param `{ row, col, name, rawMin, rawMax, kind, unit }`
- [ ] Transcribe lookup Tables 11/12/13/14; implement all display formulas (size, reverb time, levels, frequency, delay, predelay, gate, chorus mode, pitch-as-note)
- [ ] Inverse conversions (typed input → nearest raw) + round-trip unit tests in a scratch HTML page
- [ ] Size/duration-dependent limit recalculation + out-of-range (`<`/`>`) flagging
- [ ] Patch source/destination/scale encode–decode

### M3 — Editor UI
- [ ] Working-copy store with dirty tracking + origin tag; single render path (with `silent` option)
- [ ] Row-grouped parameter panel generated from metadata; panel swap on program-type change
- [ ] Widgets: slider + editable value, knob (drag/wheel/keys/double-click/type-in), enum select
- [ ] Dynamic MIDI patch bay (10 × source/destination/scale-knob), destinations filtered to loaded program
- [ ] Register-name field (14-char, uppercase), VFD header mirroring name/program/last edit
- [ ] Program selector for all 42 presets + register origin display

### M4 — Hardware sync
- [ ] Auto-send live parameter changes through the send queue
- [ ] Get (active dump → working copy, dirty confirm) / Send (working copy → active bulk)
- [ ] Load register via Program Change + Get; Peek via stored-dump request
- [ ] Store-to-register with verify readback + M PROTECT error message
- [ ] Version-mismatch / malformed-dump error handling (checksum fail, wrong byte count, unknown program type)

### M5 — Librarian
- [ ] Register sweep: request all 50 stored dumps (paced), populate list with names + type chips
- [ ] Browser library in localStorage: save/duplicate/rename/delete named programs
- [ ] `.syx` export (single program / full 50-register backup) and import (drag & drop), plus JSON export for diff-friendly backups
- [ ] Move/copy between library ⇄ registers

### M6 — Hardware validation (needs the real unit)
- [ ] Verify each message type against the PCM 70; record actual behavior in `HARDWARE-NOTES.md`
- [ ] Tune bulk pacing; test full 50-register sweep reliability
- [ ] Test edge programs: BPM variants, Resonant Chords pitches, Inverse Room, size↔delay clamping vs. hardware display
- [ ] Confirm Program-Change register loading + PGM CHNG mode expectations (FIX vs TABLE) and document required unit settings (Control Program: MIDI CHNL, OMNI OFF, PGM CHNG FIX, M PROTECT OFF)

### M7 — Polish & release
- [ ] Light-theme pass, responsive layout, keyboard/focus audit, reduced-motion
- [ ] README: setup, required PCM 70 settings, browser support, quirks
- [ ] GitHub repo + Pages deploy

---

**Suggested first milestone (walking skeleton)**: M0 + M1 + the Concert Hall table only
from M2 + a minimal M3/M4 — connect, Get the active program, render it, turn one knob
and hear it change. Everything after that is filling in tables and chrome.
