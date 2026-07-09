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

  /* ---- Convert: raw ⇄ display math (manual 6-13…6-15) ------------------ *
   * ctx = { type, sizeRaw } — program type (4–14) and the current raw value of
   * the SIZE/DURATION param (for size-dependent formulas & clamps). Tables are
   * read lazily from root.PCM70 so this stays pure and load-order tolerant.    */

  // Pitch note names Db1 … Eb7 (75 semitones), flats, octave rolls over at C.
  const PITCH_NAMES = (() => {
    const PC = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const out = [];
    for (let i = 0; i < 75; i++) { const abs = 13 + i; out.push(PC[abs % 12] + Math.floor(abs / 12)); }
    return out; // index 0 = Db1, index 74 = Eb7
  })();

  const Convert = {
    PITCH_NAMES,

    // --- size-context helpers (reverb programs only) ---
    _sp(type) { return (root.PCM70.PROGRAM_TYPES[type] || {}).sizeParams || null; },
    _isBpm(type) { return !!(root.PCM70.PROGRAM_TYPES[type] || {}).bpm; },
    _sizeValue(ctx) { const sp = this._sp(ctx.type); return sp ? (ctx.sizeRaw - sp.sizeRawMin) : null; },
    _sizeFactor(ctx) { const sp = this._sp(ctx.type); return Math.round((this._sizeValue(ctx) * 10) / sp.minSize) + 10; },
    _samples(ctx) { const sp = this._sp(ctx.type); return Math.max(0, sp.sizeBase - this._sizeFactor(ctx) * sp.sizeConst); },
    _predelayRange(ctx) { return Math.max(0, Math.min(254, Math.floor(this._samples(ctx) / 68) - 1)); },
    _reflDelayX(ctx) {
      const T = root.PCM70.DELAY_SAMPLES, s = this._samples(ctx);
      for (let i = 0; i < T.length; i++) if (T[i] >= s) return i;
      return T.length - 1;
    },

    limitsFor(meta, ctx) {
      let rawMin = meta.rawMin, rawMax = meta.rawMax;
      if (this._isBpm(ctx.type) && meta.bpm) { rawMin = meta.bpm.rawMin; rawMax = meta.bpm.rawMax; }
      const sp = this._sp(ctx.type);
      if (meta.kind === "size" && sp) { rawMin = sp.sizeRawMin; rawMax = sp.sizeRawMax; }
      if (sp && ctx.sizeRaw != null) {
        if (meta.kind === "predelay") rawMax = rawMin + this._predelayRange(ctx) - 1;
        else if (meta.kind === "delay") rawMax = rawMin + this._reflDelayX(ctx) - 2;
      }
      return { rawMin, rawMax };
    },

    // Piecewise delay-time display (ms) for a delay "value" = raw - rawMin.
    _delayMs(value) {
      const T = root.PCM70.DELAY_SAMPLES;
      if (value <= 97) return T[value] * 148 / 5000;
      if (value <= 147) return value - 48;
      if (value <= 197) return (value - 98) * 2;
      if (value <= 247) return (value - 148) * 4;
      return (value - 198) * 8;
    },

    // Truncate to 3 significant figures (matches the manual's displayed values).
    _sig3(x) {
      if (x === 0) return 0;
      const neg = x < 0; x = Math.abs(x);
      const mag = Math.floor(Math.log10(x));
      const f = Math.pow(10, 2 - mag);
      let v = Math.floor(x * f) / f;
      return neg ? -v : v;
    },

    _lin(meta, raw, limits) {
      const span = meta.rawMax - meta.rawMin;
      const t = span ? (raw - meta.rawMin) / span : 0;
      return meta.dispMin + t * (meta.dispMax - meta.dispMin);
    },

    _fmtFreq(hz) {
      if (hz >= 1000) return (hz / 1000).toFixed(2).replace(/0$/, "") + " kHz";
      return hz + " Hz";
    },

    // toDisplay -> { text, num, outOfRange }. num is the numeric display value
    // (null for pure enums), used by fromDisplay's nearest-match.
    toDisplay(meta, raw, ctx) {
      const limits = this.limitsFor(meta, ctx);
      const oor = raw < limits.rawMin || raw > limits.rawMax;
      const wrap = (text, num) => ({ text, num: num == null ? null : num, outOfRange: oor });
      const val = raw - meta.rawMin; // "value" used by most manual formulas
      const D = root.PCM70;

      switch (meta.kind) {
        case "mix": {
          const pct = Math.round(val * 100 / (meta.rawMax - meta.rawMin));
          return wrap(pct + "%", pct);
        }
        case "softknob": return wrap(String(val), val);
        case "plain":    return wrap(String(val), val);
        case "onoff":    return wrap(raw >= meta.rawMax ? "ON" : "OFF", null);

        case "fxdb": case "linear": case "signed": case "pct": {
          const n = Math.round(this._lin(meta, raw, limits)); // manual shows integer steps
          const sign = (meta.dispMin < 0 && n > 0) ? "+" : "";
          return wrap(sign + n + (meta.unit ? " " + meta.unit : ""), n);
        }
        case "pan": case "panR": {
          const n = Math.round(this._lin(meta, raw, limits)); // -50..+50
          const L = meta.kind === "panR" ? n > 0 : n < 0;
          const txt = n === 0 ? "CTR" : Math.abs(n) + (L ? "L" : "R");
          return wrap(txt, n);
        }
        case "level": {
          const lv = D.LEVELS[val];
          if (lv === "OFF" || lv === "FULL") return wrap(lv, null);
          return wrap(lv + " dB", typeof lv === "number" ? lv : null);
        }
        case "freq": {
          const hz = D.FREQUENCIES[val];
          return wrap(this._fmtFreq(hz), hz);
        }
        case "size": {
          const sp = this._sp(ctx.type);
          const sv = raw - limits.rawMin;
          const m = Math.trunc((sv + sp.minSize) * 71 / 100 * 10) / 10; // 1-decimal, truncated
          return wrap(m + " m", m);
        }
        case "rtime": {
          const sp = this._sp(ctx.type);
          const timeFactor = Math.round(this._sizeFactor(ctx) * sp.timeConst / 1000);
          const t = timeFactor * D.REVERB_TIMES[val] / 500; // seconds
          const s = this._sig3(t);
          return wrap(s + " s", s);
        }
        case "revtime": return wrap(val >= (meta.rawMax - meta.rawMin) ? "INF" : this._sig3(val * 0.04 + 0.04) + " s", null);
        case "gate": {
          if (raw >= meta.rawMax) return wrap("OFF", null);
          const ms = val * 18;
          return ms >= 1000 ? wrap(this._sig3(ms / 1000) + " s", ms) : wrap(ms + " ms", ms);
        }
        case "predelay": {
          const ms = val * 2;
          return wrap(ms + " ms", ms);
        }
        case "delay": {
          const ms = this._sig3(this._delayMs(val));
          return wrap(ms + " ms", ms);
        }
        case "delaylin": {
          const ms = Math.round(this._lin(meta, raw, limits));
          return wrap(ms + " ms", ms);
        }
        case "chorusMode": {
          if (val === 0) return wrap("OFF", null);
          return wrap(val <= 6 ? `${val}VC S` : `${val - 6}VC T`, null);
        }
        case "pitch": return wrap(PITCH_NAMES[val] || "?", null);
        default: return wrap(String(raw), raw);
      }
    },

    // Nearest legal raw for a typed display string. Exact text match wins for
    // enums; otherwise nearest numeric display value, clamped to current limits.
    fromDisplay(meta, text, ctx) {
      const limits = this.limitsFor(meta, ctx);
      const clean = String(text).trim();
      const target = parseFloat(clean.replace(/,/g, "").replace(/[^0-9.\-]/g, ""));
      const hasNum = isFinite(target);
      let best = limits.rawMin, bestErr = Infinity, exact = null;
      for (let raw = meta.rawMin; raw <= meta.rawMax; raw++) {
        const d = this.toDisplay(meta, raw, ctx);
        if (d.text.toUpperCase() === clean.toUpperCase()) { exact = raw; break; }
        if (hasNum && d.num != null) {
          const e = Math.abs(d.num - target);
          if (e < bestErr) { bestErr = e; best = raw; }
        }
      }
      let raw = exact != null ? exact : best;
      return Math.max(limits.rawMin, Math.min(limits.rawMax, raw));
    },
  };

  root.PCM70CORE = { Sysex, Codec, Convert };
})(typeof window !== "undefined" ? window : globalThis);
