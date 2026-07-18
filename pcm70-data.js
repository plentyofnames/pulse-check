/* ============================================================================
 * pcm70-data.js — PCM 70 parameter metadata & lookup tables (DATA ONLY)
 *
 * Transcribed from the Owner's Manual chapter 6 (V3.00): layout Tables 4–9A
 * (pp. 6-6…6-12), size constants Table 10 + the "size" table on 6-13, display
 * formulas 6-13…6-14, and lookup Tables 11–14 (6-15).
 *
 * Target hardware runs software V2.0. The layouts below are reconciled to the
 * V2.0 tables (manual ch. 8, Tables 4–9) EXCEPT where real dumps proved the
 * V2.0 print wrong: Chorus & Echo row 0 keeps the V3.00 byte order (hardware-
 * refuted 2026-07-14, see HARDWARE-NOTES). Concert Hall still follows the V2.0
 * table (DCY OPT word 7, 7 reflection levels, no CHORUSING) — from the same
 * suspect scan, so watch the dump audit log. Other algorithms are identical
 * V2.0↔V3.00. V2.0 has no type 14 (Inverse Room) and no
 * MIDI-clock source; the FIRMWARE gate near the exports enforces that. A few
 * V2.0 manual misprints were corrected against the display math — see
 * HARDWARE-NOTES.md.
 *
 * Every entry carries BOTH `byte` (first byte of the 2-byte word in the bulk
 * dump — drives the sequential word index (byte-47)/2) AND, derived below,
 * `paramNum = row*10 + col` (drives the parameter-change sysex). These are NOT
 * the same ordering — see IMPLEMENTATION.md "Critical subtlety".
 *
 * `kind` selects the formatter in Convert. Numeric ranges verified against the
 * manual's worked examples (6-14) where possible; a few display curves (fxdb,
 * Resonant-Chords predelay) are linear approximations pending hardware checks.
 * ==========================================================================*/
(function (root) {
  "use strict";

  // Terse entry constructor: p(col, name, byte, rawMin, rawMax, kind, extra?)
  function p(col, name, byte, rawMin, rawMax, kind, extra) {
    return Object.assign({ col, name, byte, rawMin, rawMax, kind }, extra || {});
  }
  // A group of 6 identical "voice" entries (V1..V6) sharing limits/kind.
  function voices(startCol, prefix, startByte, rawMin, rawMax, kind, extra) {
    const out = [];
    for (let i = 0; i < 6; i++) {
      out.push(p(startCol + i, `${prefix}${i + 1}`, startByte + i * 2, rawMin, rawMax, kind, extra));
    }
    return out;
  }

  /* ---- Program-type registry (Table 3 + size constants) ----------------- *
   * sizeParams: from manual Table 10 / the 6-13 "size" table. sizeRawMin/Max
   * are the SIZE (or DURATION) parameter's own raw limits — they differ per
   * reverb type even though those types share a layout.                      */
  const PROGRAM_TYPES = {
    4:  { name: "Chorus and Echo",   layout: "chorusEcho" },
    5:  { name: "Multiband",         layout: "multiband" },
    6:  { name: "Resonant Chords",   layout: "resonantChords" },
    7:  { name: "Concert Hall",      layout: "concertHall", layoutV3: "concertHallV3",
          sizeParams: { minSize: 5, timeConst: 444, sizeConst: 164, sizeBase: 31362, sizeRawMin: 488, sizeRawMax: 537 } },
    8:  { name: "Rich Chamber",      layout: "richReverb",
          sizeParams: { minSize: 8, timeConst: 388, sizeConst: 511, sizeBase: 30151, sizeRawMin: 493, sizeRawMax: 531 } },
    9:  { name: "Rich Plate",        layout: "richReverb", layoutV3: "richPlateV3",
          sizeParams: { minSize: 8, timeConst: 471, sizeConst: 424, sizeBase: 30892, sizeRawMin: 491, sizeRawMax: 532 } },
    10: { name: "Infinite Reverb",   layout: "infinite",
          sizeParams: { minSize: 8, timeConst: 388, sizeConst: 511, sizeBase: 30151, sizeRawMin: 493, sizeRawMax: 531 } },
    11: { name: "Multiband Rhythm",  layout: "multiband",      bpm: true },
    12: { name: "Chorus and Rhythm", layout: "chorusEcho",     bpm: true },
    13: { name: "Rhythmic Chords",   layout: "resonantChords", bpm: true },
    14: { name: "Inverse Room",      layout: "inverseRoom" },
  };

  // BPM-version overrides for delay params (Table 4/5/6 footnotes): master
  // 448–575, voices 500–524.
  const BPM_MST = { rawMin: 448, rawMax: 575 };
  const BPM_VOICE = { rawMin: 500, rawMax: 524 };

  /* ---- Layout tables (Tables 4–9A) ------------------------------------- */
  const LAYOUTS = {

    // ---- Table 4: Chorus and Echo (type 4; BPM = type 12) ----
    chorusEcho: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }),
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        // Dump order per the V3.00 table (CHORUS@59, DIFFUSION@55). The V2.0
        // manual's "natural" order (CHORUS@55, DIFFUSION@59) was REFUTED on the
        // real V2.0 unit 2026-07-14: a preset dump had byte55=527 (impossible
        // for CHORUS, max 518; fine for DIFFUSION=65) and byte59=518 (= CHORUS
        // 6VC T exactly). Param numbers (cols) still per the manuals — verify
        // 0.4/0.5/0.6 against the front panel. See HARDWARE-NOTES.md.
        p(3, "CHORUSING", 53, 462, 561, "plain"),
        p(4, "CHORUS",    59, 506, 518, "chorusMode"),
        p(5, "HC",        57, 496, 527, "freq"),
        p(6, "DIFFUSION", 55, 462, 561, "plain"),
      ]},
      { row: 1, label: "Levels", params: [
        p(0, "LVL MST", 67, 477, 547, "signed", { dispMin: -35, dispMax: 35 }),
        ...voices(1, "V", 69, 495, 530, "level").map((e, i) => (e.name = `V${i + 1} LVL`, e)),
      ]},
      { row: 2, label: "Delays", params: [
        p(0, "DLY MST", 81, 260, 764, "linear", { dispMin: -252, dispMax: 252, unit: "ms", bpm: BPM_MST }),
        ...voices(1, "V", 83, 386, 638, "delay", { bpm: BPM_VOICE }).map((e, i) => (e.name = `V${i + 1} DLY`, e)),
      ]},
      { row: 3, label: "Feedback", params: [
        p(0, "FDBK MST", 95, 318, 706, "signed", { dispMin: -194, dispMax: 194 }),
        ...voices(1, "V", 97, 415, 609, "pct", { dispMin: -97, dispMax: 97, unit: "%" }).map((e, i) => (e.name = `V${i + 1} FDBK`, e)),
      ]},
      { row: 4, label: "Pan", params: [
        p(0, "PAN MST", 109, 412, 612, "signed", { dispMin: -100, dispMax: 100 }),
        ...voices(1, "V", 111, 462, 562, "pan", { dispMin: -50, dispMax: 50 }).map((e, i) => (e.name = `V${i + 1} PAN`, e)),
      ]},
    ],

    // ---- Table 5: Multiband Delay (type 5; BPM = type 11) ----
    multiband: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }),
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "DIFFUSION", 53, 462, 561, "plain"),
        p(4, "V1 FDBK",   55, 462, 561, "plain"),
        p(5, "V2 FDBK",   57, 462, 561, "plain"),
      ]},
      { row: 1, label: "Levels", params: [
        p(0, "LVL MST", 67, 477, 547, "signed", { dispMin: -35, dispMax: 35 }),
        ...voices(1, "V", 69, 495, 530, "level").map((e, i) => (e.name = `V${i + 1} LVL`, e)),
      ]},
      { row: 2, label: "Delays", params: [
        p(0, "DLY MST", 81, 292, 732, "linear", { dispMin: -315, dispMax: 315, unit: "ms", bpm: BPM_MST }),
        ...voices(1, "V", 83, 354, 669, "delay", { bpm: BPM_VOICE }).map((e, i) => (e.name = `V${i + 1} DLY`, e)),
      ]},
      { row: 3, label: "Low cut", params: [
        p(0, "LC MST", 95, 481, 543, "signed", { dispMin: -30, dispMax: 30 }),
        ...voices(1, "V", 97, 496, 527, "freq").map((e, i) => (e.name = `V${i + 1} LC`, e)),
      ]},
      { row: 4, label: "High cut", params: [
        p(0, "HC MST", 109, 481, 543, "signed", { dispMin: -30, dispMax: 30 }),
        ...voices(1, "V", 111, 496, 527, "freq").map((e, i) => (e.name = `V${i + 1} HC`, e)),
      ]},
      { row: 5, label: "Pan", params: [
        p(0, "PAN MST", 123, 412, 612, "signed", { dispMin: -100, dispMax: 100 }),
        ...voices(1, "V", 125, 462, 562, "pan", { dispMin: -50, dispMax: 50 }).map((e, i) => (e.name = `V${i + 1} PAN`, e)),
      ]},
    ],

    // ---- Table 6: Resonant Chords (type 6; BPM = type 13) ----
    resonantChords: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }),
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "V3 FDBK",   53, 462, 561, "plain"),
        p(4, "V6 FDBK",   55, 462, 561, "plain"),
        p(5, "HFC LEFT",  57, 496, 527, "freq"),
        p(6, "HFC RIGHT", 59, 496, 527, "freq"),
      ]},
      { row: 1, label: "Levels", params: [
        p(0, "LVL MST", 67, 477, 547, "signed", { dispMin: -35, dispMax: 35 }),
        ...voices(1, "V", 69, 495, 530, "level").map((e, i) => (e.name = `V${i + 1} LVL`, e)),
      ]},
      { row: 2, label: "Pitch", params: [
        p(0, "PCH MST", 81, 438, 586, "signed", { dispMin: -74, dispMax: 74 }),
        ...voices(1, "V", 83, 475, 549, "pitch").map((e, i) => (e.name = `V${i + 1} PITCH`, e)),
      ]},
      { row: 3, label: "Resonance", params: [
        p(0, "RESN MST", 95, 318, 706, "signed", { dispMin: -194, dispMax: 194 }),
        ...voices(1, "V", 97, 415, 609, "pct", { dispMin: -97, dispMax: 97, unit: "%" }).map((e, i) => (e.name = `V${i + 1} RESN`, e)),
      ]},
      { row: 4, label: "Predelay", params: [
        p(0, "PDL MST", 109, 308, 716, "signed", { dispMin: -204, dispMax: 204, bpm: BPM_MST }),
        ...voices(1, "V", 111, 410, 614, "delaylin", { dispMin: 0, dispMax: 773, unit: "ms", bpm: BPM_VOICE }).map((e, i) => (e.name = `V${i + 1} PDL`, e)),
      ]},
      { row: 5, label: "Pan", params: [
        p(0, "PAN MST", 123, 412, 612, "signed", { dispMin: -100, dispMax: 100 }),
        ...voices(1, "V", 125, 462, 562, "panR", { dispMin: -50, dispMax: 50 }).map((e, i) => (e.name = `V${i + 1} PAN`, e)),
      ]},
    ],

    // ---- Table 7: Concert Hall (type 7) ----
    // Rows 3/4 calibrated against the real unit 2026-07-17 (factory 3.0 dump
    // vs. front-panel readout — see HARDWARE-NOTES "Concert Hall rows 3/4"):
    //   - 7-wide rows, levels 85–97 then delays 99–111, exactly as the V2.0
    //     ch8 table prints them. (The ch4 matrix's N/A at x.5/x.6 was a
    //     misprint — the panel has L3/R3 in both rows.)
    //   - Zero points from hardware: LVL MSTR 0 = raw 512 → range 477–547
    //     (printed 472 was a misprint; matches every other ±35 master).
    //     DLY MSTR 0 = raw 400 → range 94–706 (±306 centered on 400, NOT 512).
    //     Delay voices 0 ms = raw 512 → range 512–736. Both PROVISIONAL until
    //     a panel-vs-editor sweep confirms the extremes.
    //   - The firmware stores out-of-range voice values (master drags apply a
    //     raw delta, factory data ships below-range bytes) and clamps only the
    //     display — expect audit lines on factory programs; they are real.
    // CHORUSING param 8 @ byte 61, DCY OPT param 7 @ byte 63 (V3.00 cross —
    // hardware-confirmed 2026-07-17: editor DCY OPT toggle moves 0.7 on the unit).
    concertHall: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }), // 1 dB/step, 0 dB @ raw 551 (hw 2026-07-19); printed "-80" is a misprint
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        // SIZE: 488–537 (min-size 5). The V2.0 table misprints 491–532/"5.6–34.7m"
        // — a copy of the Rich Plate row (min-size 8); those are inconsistent with
        // Concert Hall's own size constants, so we keep the correct 488–537.
        p(3, "SIZE",      53, 488, 537, "size"),
        p(4, "GATE TIME", 55, 384, 639, "gate"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
        p(7, "DCY OPT",   63, 512, 513, "onoff"),   // byte/param crossed —
        p(8, "CHORUSING", 61, 462, 561, "plain"),   // see layout comment above
      ]},
      { row: 1, label: "Reverb time", params: [
        p(0, "RT LOW",   67, 496, 527, "rtime"),
        p(1, "RT MID",   69, 496, 527, "rtime"),
        p(2, "XOVER",    71, 497, 527, "freq"),
        p(3, "RT HC",    73, 496, 527, "freq"),
        p(4, "RTL STOP", 75, 496, 527, "rtime"),
        p(5, "RTM STOP", 77, 496, 527, "rtime"),
      ]},
      { row: 2, label: "Reverb design", params: [
        p(0, "DIFFUSION",  79, 462, 561, "plain"),
        p(1, "ATTACK",     81, 462, 561, "plain"),
        p(2, "DEFINITION", 83, 462, 561, "plain"),
      ]},
      { row: 3, label: "Reflection levels", params: [
        p(0, "REFL LVL MSTR", 85, 477, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 87, 495, 530, "level"),
        p(2, "REFL L2", 89, 495, 530, "level"),
        p(3, "REFL L3", 91, 495, 530, "level"),
        p(4, "REFL R1", 93, 495, 530, "level"),
        p(5, "REFL R2", 95, 495, 530, "level"),
        p(6, "REFL R3", 97, 495, 530, "level"),
      ]},
      { row: 4, label: "Reflection delays", params: [
        p(0, "REFL DLY MSTR", 99, 94, 706, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 101, 512, 736, "delay"),
        p(2, "REFL L2", 103, 512, 736, "delay"),
        p(3, "REFL L3", 105, 512, 736, "delay"),
        p(4, "REFL R1", 107, 512, 736, "delay"),
        p(5, "REFL R2", 109, 512, 736, "delay"),
        p(6, "REFL R3", 111, 512, 736, "delay"),
      ]},
    ],

    // ---- Table 7 (V3.00): Concert Hall on 3.0.x firmware ----
    // Rows 0–2 identical to V2.0. Rows 3/4 per the V3.00 ch6 table: 4
    // reflection levels (85–93) and 6 delays (99–111), delay master centered
    // raw 512 and voices anchored raw 400 — i.e. NOT the V2.0 arrangement.
    // LVL MSTR keeps the hardware-proven 477 anchor (both manuals print 472;
    // V2.0 hardware said 477 and the display code is likely shared).
    // UNVERIFIED on real 3.0.1 hardware — check the dump audit + panel after
    // the ROM swap, exactly like the V2.0 calibration.
    concertHallV3: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }), // 1 dB/step, 0 dB @ raw 551 (hw 2026-07-19); printed "-80" is a misprint
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "SIZE",      53, 488, 537, "size"),
        p(4, "GATE TIME", 55, 384, 639, "gate"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
        p(7, "DCY OPT",   63, 512, 513, "onoff"),
        p(8, "CHORUSING", 61, 462, 561, "plain"),
      ]},
      { row: 1, label: "Reverb time", params: [
        // Running RTs on 3.0.1 sit 3 raw steps LOWER than V2.0 (493–524, same
        // 32-entry Table 11 span) — hardware-calibrated 2026-07-19 with five
        // panel↔app pairs incl. both range ends (0.45 s @493, 63 s @524).
        // The stopped RTs keep the 496 anchor (they matched unchanged).
        p(0, "RT LOW",   67, 493, 524, "rtime"),
        p(1, "RT MID",   69, 493, 524, "rtime"),
        p(2, "XOVER",    71, 497, 527, "freq"),
        p(3, "RT HC",    73, 496, 527, "freq"),
        p(4, "RTL STOP", 75, 496, 527, "rtime"),
        p(5, "RTM STOP", 77, 496, 527, "rtime"),
      ]},
      { row: 2, label: "Reverb design", params: [
        p(0, "DIFFUSION",  79, 462, 561, "plain"),
        p(1, "ATTACK",     81, 462, 561, "plain"),
        p(2, "DEFINITION", 83, 462, 561, "plain"),
      ]},
      { row: 3, label: "Reflection levels", params: [
        // master + FOUR levels confirmed on 3.0.1 panel (3.5/3.6 don't exist)
        p(0, "REFL LVL MSTR", 85, 477, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 87, 495, 530, "level"),
        p(2, "REFL L2", 89, 495, 530, "level"),
        p(3, "REFL R1", 91, 495, 530, "level"),
        p(4, "REFL R2", 93, 495, 530, "level"),
      ]},
      { row: 4, label: "Reflection delays", params: [
        // Hardware-calibrated on 3.0.1 (SUSTAIN HALL, 2026-07-19): master
        // centered raw 400 (panel 0 there — printed 206–818/center-512 wrong
        // on BOTH firmwares), voices anchored raw 512 like V2.0 (panel 0 at
        // 512 AND at below-range 400), and only FOUR voices — the panel says
        // 4.5/4.6 unavailable, so bytes 109/111 are unused on 3.0.1. The
        // V3.00 ch6 table (6 voices, 400 anchor) is refuted on this firmware.
        p(0, "REFL DLY MSTR", 99, 94, 706, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 101, 512, 736, "delay"),
        p(2, "REFL L2", 103, 512, 736, "delay"),
        p(3, "REFL R1", 105, 512, 736, "delay"),
        p(4, "REFL R2", 107, 512, 736, "delay"),
      ]},
    ],

    // ---- Table 8: Rich Chamber & Rich Plate (types 8, 9) ----
    // SIZE raw limits come from the program type's sizeParams (differ per type).
    richReverb: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }), // 1 dB/step, 0 dB @ raw 551 (hw 2026-07-19); printed "-80" is a misprint
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "SIZE",      53, 493, 531, "size"),
        p(4, "GATE TIME", 55, 384, 639, "gate"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
        p(7, "DCY OPT",   61, 512, 513, "onoff"),
      ]},
      { row: 1, label: "Reverb time", params: [
        p(0, "RT LOW",   67, 496, 527, "rtime"),
        p(1, "RT MID",   69, 496, 527, "rtime"),
        p(2, "XOVER",    71, 497, 527, "freq"),
        p(3, "RT HC",    73, 496, 527, "freq"),
        p(4, "RTL STOP", 75, 496, 527, "rtime"),
        p(5, "RTM STOP", 77, 496, 527, "rtime"),
      ]},
      { row: 2, label: "Reverb design", params: [
        p(0, "DIFFUSION",  79, 462, 561, "plain"),
        p(1, "ATTACK",     81, 462, 561, "plain"),
        p(2, "DEFINITION", 83, 462, 561, "plain"),
      ]},
      { row: 3, label: "Reflection levels", params: [
        p(0, "REFL LVL MSTR", 85, 472, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 87, 495, 530, "level"),
        p(2, "REFL L2", 89, 495, 530, "level"),
        p(3, "REFL L3", 91, 495, 530, "level"),
        p(4, "REFL R1", 93, 495, 530, "level"),
        p(5, "REFL R2", 95, 495, 530, "level"),
        p(6, "REFL R3", 97, 495, 530, "level"),
      ]},
      { row: 4, label: "Reflection delays", params: [
        p(0, "REFL DLY MSTR", 99, 206, 818, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 101, 400, 624, "delay"),
        p(2, "REFL L2", 103, 400, 624, "delay"),
        p(3, "REFL L3", 105, 400, 624, "delay"),
        p(4, "REFL R1", 107, 400, 624, "delay"),
        p(5, "REFL R2", 109, 400, 624, "delay"),
        p(6, "REFL R3", 111, 400, 624, "delay"),
      ]},
    ],

    // ---- Rich Plate on 3.0.1 (type 9) ----
    // Identical to richReverb except the running RTs: hardware-calibrated
    // 2026-07-19 (VOX PLATE, SIZE 520 → time factor 22): the panel reads
    // Table 11 ten entries above the 496 anchor → range 486–517. The running-
    // RT anchor is a per-type constant on 3.0.1 (Chamber 496 confirmed exact,
    // Hall 493, Plate 486) with no discernible rule — and it is invisible on
    // the panel (each range spans the full table), so V2.0 may have had the
    // same anchors all along, unverified. Stopped RTs stay at 496 everywhere.
    richPlateV3: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }),
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "SIZE",      53, 491, 532, "size"),
        p(4, "GATE TIME", 55, 384, 639, "gate"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
        p(7, "DCY OPT",   61, 512, 513, "onoff"),
      ]},
      { row: 1, label: "Reverb time", params: [
        p(0, "RT LOW",   67, 486, 517, "rtime"),
        p(1, "RT MID",   69, 486, 517, "rtime"),
        p(2, "XOVER",    71, 497, 527, "freq"),
        p(3, "RT HC",    73, 496, 527, "freq"),
        p(4, "RTL STOP", 75, 496, 527, "rtime"),
        p(5, "RTM STOP", 77, 496, 527, "rtime"),
      ]},
      { row: 2, label: "Reverb design", params: [
        p(0, "DIFFUSION",  79, 462, 561, "plain"),
        p(1, "ATTACK",     81, 462, 561, "plain"),
        p(2, "DEFINITION", 83, 462, 561, "plain"),
      ]},
      { row: 3, label: "Reflection levels", params: [
        p(0, "REFL LVL MSTR", 85, 472, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 87, 495, 530, "level"),
        p(2, "REFL L2", 89, 495, 530, "level"),
        p(3, "REFL L3", 91, 495, 530, "level"),
        p(4, "REFL R1", 93, 495, 530, "level"),
        p(5, "REFL R2", 95, 495, 530, "level"),
        p(6, "REFL R3", 97, 495, 530, "level"),
      ]},
      { row: 4, label: "Reflection delays", params: [
        p(0, "REFL DLY MSTR", 99, 206, 818, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 101, 400, 624, "delay"),
        p(2, "REFL L2", 103, 400, 624, "delay"),
        p(3, "REFL L3", 105, 400, 624, "delay"),
        p(4, "REFL R1", 107, 400, 624, "delay"),
        p(5, "REFL R2", 109, 400, 624, "delay"),
        p(6, "REFL R3", 111, 400, 624, "delay"),
      ]},
    ],

    // ---- Table 9: Infinite Reverb (type 10) ----
    infinite: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }), // 1 dB/step, 0 dB @ raw 551 (hw 2026-07-19); printed "-80" is a misprint
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "SIZE",      53, 493, 531, "size"),
        p(4, "REV TIME",  55, 496, 528, "revtime"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
      ]},
      { row: 1, label: "Reverb design", params: [
        p(0, "DIFFUSION",  67, 462, 561, "plain"),
        p(1, "ATTACK",     69, 462, 561, "plain"),
        p(2, "DEFINITION", 71, 462, 561, "plain"),
      ]},
      { row: 2, label: "Reflection levels", params: [
        p(0, "REFL LVL MSTR", 73, 472, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 75, 495, 530, "level"),
        p(2, "REFL L2", 77, 495, 530, "level"),
        p(3, "REFL L3", 79, 495, 530, "level"),
        p(4, "REFL R1", 81, 495, 530, "level"),
        p(5, "REFL R2", 83, 495, 530, "level"),
        p(6, "REFL R3", 85, 495, 530, "level"),
      ]},
      { row: 3, label: "Reflection delays", params: [
        p(0, "REFL DLY MSTR", 87, 206, 818, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 89, 400, 624, "delay"),
        p(2, "REFL L2", 91, 400, 624, "delay"),
        p(3, "REFL L3", 93, 400, 624, "delay"),
        p(4, "REFL R1", 95, 400, 624, "delay"),
        p(5, "REFL R2", 97, 400, 624, "delay"),
        p(6, "REFL R3", 99, 400, 624, "delay"),
      ]},
    ],

    // ---- Table 9A: Inverse Room (type 14) ----
    inverseRoom: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -90, dispMax: 12, unit: "dB" }), // 1 dB/step, 0 dB @ raw 551 (hw 2026-07-19); printed "-80" is a misprint
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "DURATION",  53, 493, 531, "linear", { dispMin: 102, dispMax: 600, unit: "ms" }),
        p(4, "PDELAY",    57, 385, 638, "predelay"),
        p(5, "HC",        59, 497, 527, "freq"),
      ]},
      { row: 1, label: "Slopes", params: [
        p(0, "LO SLOPE", 67, 496, 527, "linear", { dispMin: -64, dispMax: 60, unit: "%" }),
        p(1, "MD SLOPE", 69, 496, 527, "linear", { dispMin: -64, dispMax: 60, unit: "%" }),
        p(2, "XOVER",    71, 496, 527, "freq"),
        p(3, "RT HC",    73, 496, 527, "freq"),
      ]},
      { row: 2, label: "Reverb design", params: [
        p(0, "DIFFUSION",  79, 462, 561, "plain"),
        p(1, "ATTACK",     81, 462, 561, "plain"),
        p(2, "DEFINITION", 83, 462, 561, "plain"),
      ]},
      { row: 3, label: "Reflection levels", params: [
        p(0, "REFL LVL MSTR", 85, 472, 547, "signed", { dispMin: -35, dispMax: 35 }),
        p(1, "REFL L1", 87, 495, 530, "level"),
        p(2, "REFL L2", 89, 495, 530, "level"),
        p(3, "REFL L3", 91, 495, 530, "level"),
        p(4, "REFL R1", 93, 495, 530, "level"),
        p(5, "REFL R2", 95, 495, 530, "level"),
        p(6, "REFL R3", 97, 495, 530, "level"),
      ]},
      { row: 4, label: "Reflection delays", params: [
        p(0, "REFL DLY MSTR", 99, 206, 818, "signed", { dispMin: -306, dispMax: 306, unit: "ms" }),
        p(1, "REFL L1", 101, 400, 624, "delay"),
        p(2, "REFL L2", 103, 400, 624, "delay"),
        p(3, "REFL L3", 105, 400, 624, "delay"),
        p(4, "REFL R1", 107, 400, 624, "delay"),
        p(5, "REFL R2", 109, 400, 624, "delay"),
        p(6, "REFL R3", 111, 400, 624, "delay"),
      ]},
    ],
  };

  // Normalize: derive paramNum (row*10+col) and word index ((byte-47)/2) once.
  for (const layoutName of Object.keys(LAYOUTS)) {
    for (const group of LAYOUTS[layoutName]) {
      for (const e of group.params) {
        e.row = group.row;
        e.paramNum = group.row * 10 + e.col;
        e.word = (e.byte - 47) / 2;
      }
    }
  }

  /* ---- Lookup tables (Tables 11–14) ------------------------------------ *
   * All indexed as table[value], value counted row-by-row (value = row*10+col).
   * Tables 11–13 verified cell-by-cell against PDF p. 61. Table 14 is filled
   * from independent cross-checked transcriptions (see pcm70-data-table14.js).  */

  // Table 11 — reverberation times (32 entries).
  const REVERB_TIMES = [
    5, 6, 8, 9, 11, 12, 13, 14, 15, 17,
    18, 20, 22, 24, 26, 28, 30, 34, 38, 42,
    46, 52, 57, 65, 75, 85, 100, 120, 160, 220,
    350, 700,
  ];

  // Table 12 — levels in dB (36 entries; 0 = OFF, 35 = FULL).
  const LEVELS = [
    "OFF", -30, -27, -24, -22, -21, -19, -18, -17, -16,
    -15, -14, -13, -12, -11, -10, -9.5, -9.0, -8.5, -8.0,
    -7.5, -7.0, -6.5, -6.0, -5.5, -5.0, -4.5, -4.0, -3.5, -3.0,
    -2.5, -2.0, -1.5, -1.0, -0.5, "FULL",
  ];

  // Table 13 — frequencies in Hz (32 entries; 0 = flat).
  const FREQUENCIES = [
    0, 170, 350, 530, 720, 920, 1120, 1330, 1550, 1780,
    2020, 2270, 2530, 2810, 3100, 3410, 3730, 4080, 4450, 4850,
    5280, 5750, 6270, 6830, 7470, 8190, 9020, 10000, 11100, 12300,
    13600, 15000,
  ];

  // Table 14 — delay-time samples. Loaded from pcm70-data-table14.js (kept
  // separate because it is large and independently verified). ms = value*148/5000.
  const DELAY_SAMPLES = root.PCM70_TABLE14 || [];

  /* ---- Patch source enumeration (manual 6-5 / formula 11) -------------- */
  // Index = raw source byte value. The unit's own display names controllers
  // (hardware-observed: CC7 → "VOLUME", CC6 → "DATA ENTR"), so label the
  // standard ones the same way.
  // Abbreviated to fit the patch-bay selects (~13 chars incl. "Ctrl NN ").
  const CC_NAMES = {
    1: "Mod", 2: "Breath", 4: "Foot", 5: "Porta",
    6: "Data", 7: "Vol", 8: "Bal", 10: "Pan", 11: "Expr",
  };
  const PATCH_SOURCES = (() => {
    const list = ["OFF"];
    for (let i = 0; i <= 31; i++) list.push(CC_NAMES[i] ? `Ctrl ${i} ${CC_NAMES[i]}` : `Ctrl ${i}`); // 1–32
    for (let i = 64; i <= 95; i++) list.push(`Switch ${i}`);     // 33–64
    list.push("Pitch Wheel");    // 65
    list.push("After Touch");    // 66
    list.push("Last Note");      // 67
    list.push("Last Velocity");  // 68
    list.push("Soft Knob");      // 69
    list.push("MIDI Clock");     // 70
    return list;
  })();

  /* ---- Factory preset programs (V2.0 manual Table 2.1, p. 2-4/2-5) ------ *
   * Matrix position row.col. In PGM CHNG FIX mode a MIDI Program Change of
   * pc = 50 + row*10 + col loads the program (manual 5-8; e.g. PC 64 → 1.4).
   * `type` is the algorithm the preset is built on — rows 0–5 are certain;
   * row 6 (MIDI Effects) types are best-effort (the unit's dump is
   * authoritative when loaded). Row 7 (Control Program, Cor Reg Table) is
   * system config, not an effect, so it is omitted. */
  function pr(row, col, name, type) {
    return { row, col, name, type, num: `${row}.${col}`, pc: 50 + row * 10 + col };
  }
  const PRESET_ROWS = [
    "Chorus & Echo", "Multiband Delays", "Resonant Chords", "Concert Halls",
    "Rich Chambers", "Rich Plates", "MIDI Effects",
  ];
  const PRESETS_V2 = [
    // Row 0 — Chorus & Echo (BPM variants → Chorus and Rhythm, type 12)
    pr(0, 0, "CHORUS", 4), pr(0, 1, "CHORUS ECHOES", 4), pr(0, 2, "ECHO FLANGE", 4),
    pr(0, 3, "STEREO FLANGE", 4), pr(0, 4, "DOUBLE SLAP", 4), pr(0, 5, "SPIN ECHOES", 4),
    pr(0, 6, "SWARBLE", 4), pr(0, 7, "PSYCHO ECHOES", 4), pr(0, 8, "ECHOES BPM", 12),
    pr(0, 9, "CHORUS & ECHO BPM", 12),
    // Row 1 — Multiband Delays (BPM → Multiband Rhythm, type 11)
    pr(1, 0, "SINGLE DELAY", 5), pr(1, 1, "DOUBLE DELAY", 5), pr(1, 2, "PAN DELAY", 5),
    pr(1, 3, "CIRCULAR DLYS", 5), pr(1, 4, "4 VOICE DELAY", 5), pr(1, 5, "QUATRO DELAYS", 5),
    pr(1, 6, "FILTERED DLYS", 5), pr(1, 7, "SHUFFLE BPM", 11), pr(1, 8, "BOUNCING BPM", 11),
    // Row 2 — Resonant Chords (BPM → Rhythmic Chords, type 13)
    pr(2, 0, "MAJOR CHORD", 6), pr(2, 1, "MINOR CHORD", 6), pr(2, 2, "7TH SHARP 11", 6),
    pr(2, 3, "DOM 13TH", 6), pr(2, 4, "RYM IN C BPM", 13), pr(2, 5, "RYM C MIN BPM", 13),
    // Row 3 — Concert Halls
    pr(3, 0, "CONCERT HALL", 7), pr(3, 1, "LONG HALL", 7), pr(3, 2, "GYMNASIUM", 7),
    // Row 4 — Rich Chambers (4.4 Infinite Reverb, type 10)
    pr(4, 0, "RICH CHAMBER", 8), pr(4, 1, "SMALL ROOM", 8), pr(4, 2, "TILED ROOM", 8),
    pr(4, 3, "GATED CHAMBER", 8), pr(4, 4, "INF REVERB", 10),
    // Row 5 — Rich Plates
    pr(5, 0, "RICH PLATE", 9), pr(5, 1, "SMALL PLATE", 9), pr(5, 2, "GATED PLATE", 9),
    // Row 6 — MIDI Effects (BPM/MIDI presets; types best-effort — see note above)
    pr(6, 0, "MIDI ECHO BPM", 12), pr(6, 1, "CASCADE BPM", 11), pr(6, 2, "FILTR PAN BPM", 11),
    pr(6, 3, "MIDI CHRD BPM", 13), pr(6, 4, "MIDI SLAP BPM", 12), pr(6, 5, "MIDI CT HALL", 7),
    pr(6, 6, "MIDI INF RVB", 10),
  ];

  /* V3.00 factory matrix. Rows 0–5 extracted from a real V3.00 preset bank
   * dump (names byte-exact, incl. "BONANZA  BPM" / "KICK  CHAMBER" double
   * spaces; row 5 has FOUR plates — the manual's matrix diagram misprints 3).
   * Row 6 (Inverse Room, type 14) names are from the manual's program matrix —
   * best-effort until swept from a real 3.0.x unit. */
  const PRESETS_V3 = [
    // Row 0 — Chorus & Echo
    pr(0, 0, "MOD WOBBLE", 4), pr(0, 1, "ECHORUS", 4), pr(0, 2, "TUNNEL", 4),
    pr(0, 3, "POWER PHLANGE", 4), pr(0, 4, "6 VOICE COMBO", 4), pr(0, 5, "FOR STRINGS", 4),
    pr(0, 6, "UNLIN", 4), pr(0, 7, "FLANGE O ECHO", 4), pr(0, 8, "AUTO CHORUS", 12),
    pr(0, 9, "BONANZA  BPM", 12),
    // Row 1 — Multiband Delays
    pr(1, 0, "PING PONG MOD", 5), pr(1, 1, "SIX ACROSS", 5), pr(1, 2, "FILTER 4 EFX", 5),
    pr(1, 3, "MIDI MOD PAN", 11), pr(1, 4, "AUTO SINGLE", 11), pr(1, 5, "AUTO TUMBLE", 11),
    pr(1, 6, "AUTO BOUNCE", 11),
    // Row 2 — Resonant Chords
    pr(2, 0, "MAJOR MOD", 6), pr(2, 1, "MAJOR MODAL", 6), pr(2, 2, "AUTO SUSPENSE", 13),
    // Row 3 — Concert Halls
    pr(3, 0, "SUSTAIN HALL", 7), pr(3, 1, "CONCERT WAVE", 7), pr(3, 2, "SOFT SPACE", 7),
    pr(3, 3, "5 OCLOCK HALL", 7), pr(3, 4, "SOFT ECHOES", 7),
    // Row 4 — Rich Chambers (4.7 Infinite AT, type 10)
    pr(4, 0, "SOFT AMBIENCE", 8), pr(4, 1, "LOCKER ROOM", 8), pr(4, 2, "SNARE CHAMBER", 8),
    pr(4, 3, "KICK  CHAMBER", 8), pr(4, 4, "MEDIUM ROOM", 8), pr(4, 5, "VOX CHAMBER", 8),
    pr(4, 6, "OPEN GATE", 8), pr(4, 7, "INFINITE A T", 10),
    // Row 5 — Rich Plates (four of them)
    pr(5, 0, "VOX PLATE", 9), pr(5, 1, "PD PLATE", 9), pr(5, 2, "BRASS PLATE", 9),
    pr(5, 3, "SMALL PLATE", 9),
    // Row 6 — Inverse Room (V3-only, type 14)
    pr(6, 0, "INVERSE ROOM", 14), pr(6, 1, "INVERSE 2", 14), pr(6, 2, "HEAD BANGER", 14),
    pr(6, 3, "SKI JUMP", 14), pr(6, 4, "ATOM SMASHER", 14), pr(6, 5, "GATED ROOM", 14),
  ];

  /* ---- Target firmware ------------------------------------------------- *
   * Runtime-switchable (UI setting; there is no sysex version query — the
   * unit only shows its version on the display at power-on). Differences:
   *   - V2.0 has no type 14 (Inverse Room) and no MIDI-Clock patch source
   *     (its Rhythm/BPM sync is switch-driven); sending an Inverse Room
   *     program to a V2.0 unit crashes it.
   *   - Concert Hall's dump layout differs between firmwares (rows 3/4) —
   *     layoutFor() resolves per firmware.
   *   - The factory preset matrix differs entirely — presets() resolves it. */
  let FIRMWARE = 2.0;
  const V3_ONLY_TYPES = new Set([14]);          // Inverse Room — V3.0 only
  const MIDI_CLOCK_SRC = 70;                     // patch source — V3.0 only

  function setFirmware(v) {
    FIRMWARE = v;
    root.PCM70.FIRMWARE = v;
  }
  function availableTypes() {
    const all = Object.keys(PROGRAM_TYPES).map(Number);
    return FIRMWARE >= 3 ? all : all.filter((t) => !V3_ONLY_TYPES.has(t));
  }
  // [rawValue, label] pairs for the source picker; drops MIDI Clock on V2.0.
  function patchSources() {
    const pairs = PATCH_SOURCES.map((name, raw) => [raw, name]);
    return FIRMWARE >= 3 ? pairs : pairs.filter(([raw]) => raw !== MIDI_CLOCK_SRC);
  }
  // The layout for a program type under the CURRENT firmware.
  function layoutFor(type) {
    const t = PROGRAM_TYPES[type];
    if (!t) return null;
    return LAYOUTS[(FIRMWARE >= 3 && t.layoutV3) ? t.layoutV3 : t.layout];
  }
  // The factory preset matrix under the CURRENT firmware.
  function presets() { return FIRMWARE >= 3 ? PRESETS_V3 : PRESETS_V2; }

  root.PCM70 = {
    FIRMWARE,
    setFirmware,
    layoutFor,
    presets,
    PROGRAM_TYPES,
    PRESETS_V2,
    PRESETS_V3,
    PRESET_ROWS,
    LAYOUTS,
    REVERB_TIMES,
    LEVELS,
    FREQUENCIES,
    DELAY_SAMPLES,
    PATCH_SOURCES,
    availableTypes,
    patchSources,
  };
})(typeof window !== "undefined" ? window : globalThis);
