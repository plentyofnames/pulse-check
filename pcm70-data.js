/* ============================================================================
 * pcm70-data.js — PCM 70 parameter metadata & lookup tables (DATA ONLY)
 *
 * Transcribed from the Owner's Manual chapter 6 (V3.00): layout Tables 4–9A
 * (pp. 6-6…6-12), size constants Table 10 + the "size" table on 6-13, display
 * formulas 6-13…6-14, and lookup Tables 11–14 (6-15).
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
    5:  { name: "Multiband Delay",   layout: "multiband" },
    6:  { name: "Resonant Chords",   layout: "resonantChords" },
    7:  { name: "Concert Hall",      layout: "concertHall",
          sizeParams: { minSize: 5, timeConst: 444, sizeConst: 164, sizeBase: 31362, sizeRawMin: 488, sizeRawMax: 537 } },
    8:  { name: "Rich Chamber",      layout: "richReverb",
          sizeParams: { minSize: 8, timeConst: 388, sizeConst: 511, sizeBase: 30151, sizeRawMin: 493, sizeRawMax: 531 } },
    9:  { name: "Rich Plate",        layout: "richReverb",
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
        p(3, "CHORUSING", 53, 462, 561, "plain"),
        p(6, "DIFFUSION", 55, 462, 561, "plain"),
        p(5, "HC",        57, 496, 527, "freq"),
        p(4, "CHORUS",    59, 506, 518, "chorusMode"),
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
        ...voices(1, "V", 111, 462, 562, "pan").map((e, i) => (e.name = `V${i + 1} PAN`, e)),
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
        ...voices(1, "V", 125, 462, 562, "pan").map((e, i) => (e.name = `V${i + 1} PAN`, e)),
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
        ...voices(1, "V", 125, 462, 562, "panR").map((e, i) => (e.name = `V${i + 1} PAN`, e)),
      ]},
    ],

    // ---- Table 7: Concert Hall (type 7) ----
    concertHall: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -80, dispMax: 12, unit: "dB" }),
        p(2, "SOFT KNOB", 51, 448, 575, "softknob"),
        p(3, "SIZE",      53, 488, 537, "size"),
        p(4, "GATE TIME", 55, 384, 639, "gate"),
        p(5, "PDELAY",    57, 385, 638, "predelay"),
        p(6, "HC",        59, 497, 527, "freq"),
        p(8, "CHORUSING", 61, 462, 561, "plain"),
        p(7, "DCY OPT",   63, 512, 513, "onoff"),
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
        p(3, "REFL R1", 91, 495, 530, "level"),
        p(4, "REFL R2", 93, 495, 530, "level"),
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

    // ---- Table 8: Rich Chamber & Rich Plate (types 8, 9) ----
    // SIZE raw limits come from the program type's sizeParams (differ per type).
    richReverb: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -80, dispMax: 12, unit: "dB" }),
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

    // ---- Table 9: Infinite Reverb (type 10) ----
    infinite: [
      { row: 0, label: "Master", params: [
        p(0, "MIX",       47, 462, 562, "mix"),
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -80, dispMax: 12, unit: "dB" }),
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
        p(1, "FX ADJ",    49, 461, 563, "fxdb", { dispMin: -80, dispMax: 12, unit: "dB" }),
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
  // Index = raw source byte value.
  const PATCH_SOURCES = (() => {
    const list = ["OFF"];
    for (let i = 0; i <= 31; i++) list.push(`Ctrl ${i}`);        // 1–32
    for (let i = 64; i <= 95; i++) list.push(`Switch ${i}`);     // 33–64
    list.push("Pitch Wheel");    // 65
    list.push("After Touch");    // 66
    list.push("Last Note");      // 67
    list.push("Last Velocity");  // 68
    list.push("Soft Knob");      // 69
    list.push("MIDI Clock");     // 70
    return list;
  })();

  root.PCM70 = {
    PROGRAM_TYPES,
    LAYOUTS,
    REVERB_TIMES,
    LEVELS,
    FREQUENCIES,
    DELAY_SAMPLES,
    PATCH_SOURCES,
  };
})(typeof window !== "undefined" ? window : globalThis);
