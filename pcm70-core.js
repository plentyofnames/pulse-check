/* ============================================================================
 * pcm70-core.js — pure, DOM-free byte + conversion layer
 *
 * Shared by index.html (the app) and test.html (round-trip assertions).
 * Nothing here touches the DOM, Web MIDI, or localStorage — every function is a
 * pure transform, so the whole layer is testable without hardware.
 *
 * (Structural note: IMPLEMENTATION.md suggested a 2-file split, but its own
 * testability requirement — "everything above Midi is testable ... open a
 * scratch test.html" — needs the pure core importable. So the pure layer lives
 * here; index.html keeps Midi/Store/UI/Librarian/Log. Still zero build.)
 *
 * Sysex framing transcribed from Owner's Manual 6-4/6-5 (PDF pp. 50–51):
 *   All msgs: F0 06 00 … F7   (06 = Lexicon, 00 = PCM 70)
 *   First data byte's high nibble discriminates the message:
 *     0x0. = active bulk (c=0)   0x1. = stored bulk (c=1)
 *     0x2. = parameter change    0x3. = dump request
 *   low nibble = MIDI channel 0–15.
 * Every framing claim is a HYPOTHESIS until checked on hardware (M6) — keep the
 * checksum + pacing swappable in one place.
 * ==========================================================================*/
(function (root) {
  "use strict";

  const F0 = 0xf0, F7 = 0xf7;
  const MANUFACTURER = 0x06;   // Lexicon
  const DEVICE = 0x00;         // PCM 70
  const BULK_DATA_BYTES = 167; // Table 2
  const BULK_NYBBLES = 334;    // 167 * 2, sent hi-nybble then lo-nybble
  const COUNT_HI = 0x02, COUNT_LO = 0x4e; // byte count 334, MSB first

  /* ---- nybblize / checksum (isolated for easy hardware re-tuning) -------- */

  // 167 data bytes -> 334 nybble bytes (hi nybble first, per manual).
  function nybblize(data167) {
    const out = new Uint8Array(BULK_NYBBLES);
    for (let i = 0; i < BULK_DATA_BYTES; i++) {
      const b = data167[i] & 0xff;
      out[i * 2] = (b >> 4) & 0x0f;   // hi nybble
      out[i * 2 + 1] = b & 0x0f;      // lo nybble
    }
    return out;
  }

  // 334 nybble bytes -> 167 data bytes.
  function denybblize(nybbles) {
    const out = new Uint8Array(BULK_DATA_BYTES);
    for (let i = 0; i < BULK_DATA_BYTES; i++) {
      out[i] = ((nybbles[i * 2] & 0x0f) << 4) | (nybbles[i * 2 + 1] & 0x0f);
    }
    return out;
  }

  // "sumcheck of nybblized data bytes (high bit = 0)" — 7-bit sum of the 334
  // transmitted nybble bytes. THE checksum definition; change here if hardware
  // disagrees.
  function checksum(nybbles) {
    let s = 0;
    for (let i = 0; i < nybbles.length; i++) s += nybbles[i] & 0x0f;
    return s & 0x7f;
  }

  /* ---- Sysex: builders + parser ---------------------------------------- */

  const Sysex = {
    F0, F7, MANUFACTURER, DEVICE, BULK_DATA_BYTES,
    nybblize, denybblize, checksum,

    // Parameter change → unit.  0x2. discriminator; value MSB-first (3 + 7 bits).
    buildParamChange(ch, paramNum, raw10) {
      const n = ch & 0x0f;
      const v = raw10 & 0x3ff;
      return new Uint8Array([
        F0, MANUFACTURER, DEVICE,
        0x20 | n,
        paramNum & 0x7f,
        (v >> 7) & 0x07,   // top 3 bits
        v & 0x7f,          // low 7 bits
        F7,
      ]);
    },

    // Dump request.  event 0x60 = active, 0x61 = stored.  reg 0–49, or 50 = active buf.
    buildDumpRequest(ch, { stored = false, reg = 50 } = {}) {
      const n = ch & 0x0f;
      return new Uint8Array([
        F0, MANUFACTURER, DEVICE,
        0x30 | n,
        stored ? 0x61 : 0x60,
        reg & 0x7f,
        F7,
      ]);
    },

    // Bulk data → unit.  c=0 active / c=1 stored; 334 nybbles + checksum.
    buildBulkData(ch, { stored = false, reg = 50, data167 } = {}) {
      if (!data167 || data167.length !== BULK_DATA_BYTES) {
        throw new Error(`buildBulkData: data167 must be ${BULK_DATA_BYTES} bytes`);
      }
      const n = ch & 0x0f;
      const nyb = nybblize(data167);
      const out = new Uint8Array(7 + BULK_NYBBLES + 2);
      let p = 0;
      out[p++] = F0; out[p++] = MANUFACTURER; out[p++] = DEVICE;
      out[p++] = (stored ? 0x10 : 0x00) | n;   // 000c nnnn
      out[p++] = reg & 0x3f;                    // 00pp pppp
      out[p++] = COUNT_HI; out[p++] = COUNT_LO; // byte count 334, MSB first
      out.set(nyb, p); p += BULK_NYBBLES;
      out[p++] = checksum(nyb);                 // osss ssss
      out[p++] = F7;
      return out;
    },

    // Parse any inbound PCM 70 sysex. Returns a typed object or null.
    // Reports checksum/length failures rather than throwing so the caller can log.
    parse(bytes) {
      if (!bytes || bytes.length < 5) return null;
      if (bytes[0] !== F0 || bytes[1] !== MANUFACTURER || bytes[2] !== DEVICE) return null;
      if (bytes[bytes.length - 1] !== F7) return null;

      const disc = (bytes[3] & 0xf0) >> 4;
      const ch = bytes[3] & 0x0f;

      if (disc === 0x0 || disc === 0x1) {
        // bulk data
        const stored = disc === 0x1;
        const reg = bytes[4] & 0x3f;
        const countOk = bytes[5] === COUNT_HI && bytes[6] === COUNT_LO;
        const nyb = bytes.slice(7, 7 + BULK_NYBBLES);
        const gotChecksum = bytes[7 + BULK_NYBBLES];
        const lenOk = bytes.length === 7 + BULK_NYBBLES + 2;
        const wantChecksum = checksum(nyb);
        const checksumOk = gotChecksum === wantChecksum;
        return {
          kind: "bulk", stored, reg, ch,
          countOk, lenOk, checksumOk,
          gotChecksum, wantChecksum,
          data167: (countOk && lenOk) ? denybblize(nyb) : null,
        };
      }
      if (disc === 0x2) {
        const raw = ((bytes[5] & 0x07) << 7) | (bytes[6] & 0x7f);
        return { kind: "param", ch, paramNum: bytes[4] & 0x7f, raw };
      }
      if (disc === 0x3) {
        return { kind: "request", ch, event: bytes[4], reg: bytes[5] & 0x7f };
      }
      return null;
    },
  };

  /* ---- Codec: 167-byte program ⇄ Program object ------------------------ */
  // Program layout (Table 2):
  //   0        program type
  //   1,2      matrix position row, col
  //   3–16     name (14 bytes; byte 16 must be 0)
  //   17–26    patch sources ×10
  //   27–36    patch destinations ×10
  //   37–46    patch scale factors ×10 (raw 0–255 → signed, see below)
  //   47–166   60 words × 2 bytes  (byte0 = low 8 bits, byte1 = high 2 bits)
  const NAME_OFF = 3, NAME_LEN = 14;
  const SRC_OFF = 17, DEST_OFF = 27, SCALE_OFF = 37, PATCH_N = 10;
  const WORDS_OFF = 47, WORDS_N = 60;

  // Scale factor raw byte ⇄ signed (manual 6-5): 0–127 → −128…−1, 128–255 → +1…+128.
  // Bijective over 0..255 (there is no 0). Verified by round-trip test.
  function scaleToSigned(raw) { return raw <= 127 ? raw - 128 : raw - 127; }
  function scaleFromSigned(s) { return s < 0 ? s + 128 : s + 127; }

  function decodeName(data) {
    let s = "";
    for (let i = 0; i < NAME_LEN; i++) {
      const c = data[NAME_OFF + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  const Codec = {
    scaleToSigned, scaleFromSigned,

    decodeProgram(data167) {
      const patches = [];
      for (let i = 0; i < PATCH_N; i++) {
        patches.push({
          src: data167[SRC_OFF + i],
          dest: data167[DEST_OFF + i],
          scale: scaleToSigned(data167[SCALE_OFF + i]),
        });
      }
      const words = new Uint16Array(WORDS_N);
      for (let i = 0; i < WORDS_N; i++) {
        const lo = data167[WORDS_OFF + i * 2];
        const hi = data167[WORDS_OFF + i * 2 + 1] & 0x03;
        words[i] = (hi << 8) | lo;
      }
      return {
        type: data167[0],
        matrixPos: { row: data167[1], col: data167[2] },
        name: decodeName(data167),
        patches,
        words,
      };
    },

    encodeProgram(prog) {
      const data = new Uint8Array(BULK_DATA_BYTES);
      data[0] = prog.type & 0xff;
      data[1] = prog.matrixPos.row & 0xff;
      data[2] = prog.matrixPos.col & 0xff;
      // name: up to 13 chars, byte 16 forced 0 (manual: last char must be 0)
      const name = (prog.name || "").toUpperCase();
      for (let i = 0; i < NAME_LEN - 1; i++) {
        data[NAME_OFF + i] = i < name.length ? name.charCodeAt(i) & 0x7f : 0;
      }
      data[NAME_OFF + NAME_LEN - 1] = 0;
      for (let i = 0; i < PATCH_N; i++) {
        const p = prog.patches[i] || { src: 0, dest: 0, scale: -128 };
        data[SRC_OFF + i] = p.src & 0xff;
        data[DEST_OFF + i] = p.dest & 0xff;
        data[SCALE_OFF + i] = scaleFromSigned(p.scale) & 0xff;
      }
      for (let i = 0; i < WORDS_N; i++) {
        const w = prog.words[i] & 0x3ff;
        data[WORDS_OFF + i * 2] = w & 0xff;
        data[WORDS_OFF + i * 2 + 1] = (w >> 8) & 0x03;
      }
      return data;
    },
  };

  /* ---- Convert: raw ⇄ display math (filled in M2) ---------------------- */
  const Convert = {
    // limitsFor(meta, ctx) -> { rawMin, rawMax }
    // toDisplay(meta, raw, ctx) -> { text, outOfRange }
    // fromDisplay(meta, text, ctx) -> raw
  };

  root.PCM70CORE = { Sysex, Codec, Convert };
})(typeof window !== "undefined" ? window : globalThis);
