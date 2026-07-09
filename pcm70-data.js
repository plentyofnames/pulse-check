/* ============================================================================
 * pcm70-data.js — PCM 70 parameter metadata & lookup tables (DATA ONLY)
 *
 * No DOM, no I/O, no logic beyond table literals. Consumed by Codec/Convert in
 * index.html. Everything here is transcribed from the Owner's Manual chapter 6
 * (Tables 4–14) and MUST be verified against the scanned PDF before trusting —
 * see IMPLEMENTATION.md "Session strategy for implementation".
 *
 * Populated across milestone M2. This M0 stub only fixes the shape.
 * ==========================================================================*/
(function (root) {
  "use strict";

  // --- Program-type registry (types 4–14 → 7 shared layout tables) ---------
  // sizeParams drive the size/reverb-time formulas (manual Table 10).
  const PROGRAM_TYPES = {
    4:  { name: "Chorus and Echo",   layout: "chorusEcho" },
    5:  { name: "Multiband Delay",   layout: "multiband" },
    6:  { name: "Resonant Chords",   layout: "resonantChords" },
    7:  { name: "Concert Hall",      layout: "concertHall",    sizeParams: { minSize: 5, timeConst: 444, sizeConst: 164, sizeBase: 31362 } },
    8:  { name: "Rich Chamber",      layout: "richReverb",     sizeParams: { minSize: 8, timeConst: 388, sizeConst: 511, sizeBase: 30151 } },
    9:  { name: "Rich Plate",        layout: "richReverb",     sizeParams: { minSize: 8, timeConst: 471, sizeConst: 424, sizeBase: 30892 } },
    10: { name: "Infinite Reverb",   layout: "infinite",       sizeParams: { minSize: 8, timeConst: 388, sizeConst: 511, sizeBase: 30151 } },
    11: { name: "Multiband Rhythm",  layout: "multiband",      bpm: true },
    12: { name: "Chorus and Rhythm", layout: "chorusEcho",     bpm: true },
    13: { name: "Rhythmic Chords",   layout: "resonantChords", bpm: true },
    14: { name: "Inverse Room",      layout: "inverseRoom" },
  };

  // --- Parameter layouts (manual Tables 4–9A) ------------------------------
  // Each entry carries BOTH `byte` (bulk-dump offset, drives Codec word index
  // via (byte-47)/2) AND `paramNum = row*10 + col` (drives param-change sysex).
  // See IMPLEMENTATION.md "Critical subtlety". Populated in M2.
  const LAYOUTS = {
    // concertHall: [ { row, label, params: [ { col, name, byte, rawMin, rawMax, kind, unit } ] } ],
    // ...6 more
  };

  // --- Lookup tables (manual Tables 11–14) ---------------------------------
  // Pre-transcribed from a low-quality scan; re-verify against PDF page 61 in M2.
  const REVERB_TIMES = [];   // Table 11 (32 entries)
  const LEVELS = [];         // Table 12 (index 0 = OFF, last = FULL)
  const FREQUENCIES = [];    // Table 13 (32 entries, 0 = flat/OFF)
  const DELAY_SAMPLES = [];  // Table 14 (~256 entries; ms = samples*148/5000)

  // --- Patch source enumeration (manual 6-5) -------------------------------
  // 0 OFF, 1–32 Ctrl 0–31, 33–64 Switch 64–95, 65 Pitch Wheel, 66 After Touch,
  // 67 Last Note, 68 Last Velocity, 69 Soft Knob, 70 MIDI Clock.
  const PATCH_SOURCES = [];  // built in M2/M3

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
