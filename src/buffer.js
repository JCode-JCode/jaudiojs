'use strict';

const SAMPLE_RATE = 44100;

const _MT_N = 624;
const _MT_M = 397;
const _MT_MATRIX_A = 0x9908b0df;
const _MT_UPPER = 0x80000000;
const _MT_LOWER = 0x7fffffff;

class Random {
  constructor(seed) {
    this.mt = new Uint32Array(_MT_N);
    this.mti = _MT_N + 1;
    this.reseed(seed);
  }

  reseed(seed) {
    if (seed === null || seed === undefined) {

      const a = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const b = Math.floor(Math.random() * 0xffffffff) >>> 0;
      this._initByArray([a, b]);
      return;
    }

    let n = typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed));
    if (n < 0n) n = -n;
    if (n === 0n) {
      this._initByArray([0]);
      return;
    }
    const key = [];
    while (n > 0n) {
      key.push(Number(n & 0xffffffffn));
      n >>= 32n;
    }
    this._initByArray(key);
  }

  _initGenrand(s) {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < _MT_N; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = _MT_N;
  }

  _initByArray(initKey) {
    this._initGenrand(19650218);
    const mt = this.mt;
    let i = 1;
    let j = 0;
    let k = Math.max(_MT_N, initKey.length);
    for (; k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + initKey[j] + j) >>> 0;
      i++;
      j++;
      if (i >= _MT_N) { mt[0] = mt[_MT_N - 1]; i = 1; }
      if (j >= initKey.length) j = 0;
    }
    for (k = _MT_N - 1; k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= _MT_N) { mt[0] = mt[_MT_N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
  }

  _genrandInt32() {
    const mt = this.mt;
    if (this.mti >= _MT_N) {
      let kk;
      for (kk = 0; kk < _MT_N - _MT_M; kk++) {
        const y = (mt[kk] & _MT_UPPER) | (mt[kk + 1] & _MT_LOWER);
        mt[kk] = (mt[kk + _MT_M] ^ (y >>> 1) ^ (y & 1 ? _MT_MATRIX_A : 0)) >>> 0;
      }
      for (; kk < _MT_N - 1; kk++) {
        const y = (mt[kk] & _MT_UPPER) | (mt[kk + 1] & _MT_LOWER);
        mt[kk] = (mt[kk + (_MT_M - _MT_N)] ^ (y >>> 1) ^ (y & 1 ? _MT_MATRIX_A : 0)) >>> 0;
      }
      const y = (mt[_MT_N - 1] & _MT_UPPER) | (mt[0] & _MT_LOWER);
      mt[_MT_N - 1] = (mt[_MT_M - 1] ^ (y >>> 1) ^ (y & 1 ? _MT_MATRIX_A : 0)) >>> 0;
      this.mti = 0;
    }
    let y = mt[this.mti++];
    y ^= y >>> 11;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random() {
    const a = this._genrandInt32() >>> 5;
    const b = this._genrandInt32() >>> 6;
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
  }

  uniform(a, b) {
    return a + (b - a) * this.random();
  }
}

const _moduleRng = new Random();

function seedRandom(seed) {
  _moduleRng.reseed(seed);
}

function _toFloat64Array(samples) {
  if (samples == null) return new Float64Array(0);
  if (samples instanceof Float64Array) return samples;
  return Float64Array.from(samples);
}

class AudioBuffer {

  constructor(samples = null, sr = SAMPLE_RATE) {
    this.sr = sr;
    this.samples = _toFloat64Array(samples);
  }

  static silence(duration, sr = SAMPLE_RATE) {
    return new AudioBuffer(new Float64Array(Math.max(0, Math.trunc(duration * sr))), sr);
  }

  static fromFunction(duration, fn, sr = SAMPLE_RATE) {
    const n = Math.trunc(duration * sr);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = fn(i / sr);
    return new AudioBuffer(out, sr);
  }

  get length() {
    return this.samples.length;
  }

  get duration() {
    return this.samples.length ? this.samples.length / this.sr : 0.0;
  }

  copy() {
    return new AudioBuffer(this.samples.slice(), this.sr);
  }

  gain(factor) {
    const s = this.samples;
    for (let i = 0; i < s.length; i++) s[i] *= factor;
    return this;
  }

  gainDb(db) {
    return this.gain(10 ** (db / 20));
  }

  padTo(nSamples) {
    if (this.samples.length < nSamples) {
      const out = new Float64Array(nSamples);
      out.set(this.samples);
      this.samples = out;
    }
    return this;
  }

  mix(other, { at = 0.0, volume = 1.0 } = {}) {
    if (at < 0) throw new RangeError("'at' must be >= 0");
    const start = Math.trunc(at * this.sr);
    const needed = start + other.samples.length;
    if (needed > this.samples.length) this.padTo(needed);
    const dst = this.samples;
    const src = other.samples;
    for (let i = 0; i < src.length; i++) dst[start + i] += src[i] * volume;
    return this;
  }

  append(other) {
    const out = new Float64Array(this.samples.length + other.samples.length);
    out.set(this.samples, 0);
    out.set(other.samples, this.samples.length);
    this.samples = out;
    return this;
  }

  repeat(times) {
    if (times === 0) {
      this.samples = new Float64Array(0);
      return this;
    }
    const original = this.samples.slice();
    const out = new Float64Array(original.length * times);
    for (let t = 0; t < times; t++) out.set(original, t * original.length);
    this.samples = out;
    return this;
  }

  slice(startSec, endSec) {
    const start = Math.trunc(startSec * this.sr);
    const end = Math.trunc(endSec * this.sr);
    return new AudioBuffer(this.samples.slice(Math.max(0, start), Math.max(0, end)), this.sr);
  }

  reverse() {
    this.samples.reverse();
    return this;
  }

  peak() {
    let m = 0.0;
    const s = this.samples;
    for (let i = 0; i < s.length; i++) {
      const a = Math.abs(s[i]);
      if (a > m) m = a;
    }
    return m;
  }

  normalize(peak = 0.95) {
    const m = this.peak();
    if (m > 0) this.gain(peak / m);
    return this;
  }

  clip(limit = 1.0) {
    const s = this.samples;
    for (let i = 0; i < s.length; i++) {
      s[i] = Math.max(-limit, Math.min(limit, s[i]));
    }
    return this;
  }

  fadeIn(duration) {
    const n = Math.min(Math.trunc(duration * this.sr), this.samples.length);
    if (n === 0) return this;
    for (let i = 0; i < n; i++) this.samples[i] *= i / n;
    return this;
  }

  fadeOut(duration) {
    const n = Math.min(Math.trunc(duration * this.sr), this.samples.length);
    if (n === 0) return this;
    const total = this.samples.length;
    for (let i = 0; i < n; i++) this.samples[total - 1 - i] *= i / n;
    return this;
  }

  toArray() {
    return Array.from(this.samples);
  }
}

function mixBuffers(buffers, volumes = null) {
  if (!buffers || buffers.length === 0) throw new RangeError("'buffers' must not be empty");
  if (volumes == null) volumes = buffers.map(() => 1.0);
  const maxLen = Math.max(...buffers.map((b) => b.samples.length));
  const sr = buffers[0].sr;
  const result = new Float64Array(maxLen);
  buffers.forEach((b, idx) => {
    const v = volumes[idx];
    const s = b.samples;
    for (let i = 0; i < s.length; i++) result[i] += s[i] * v;
  });
  return new AudioBuffer(result, sr);
}

function whiteNoise(duration, { sr = SAMPLE_RATE, amp = 1.0, seed = null, rng = null } = {}) {
  const n = Math.trunc(duration * sr);
  const r = rng != null ? rng : seed != null ? new Random(seed) : _moduleRng;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = r.uniform(-amp, amp);
  return new AudioBuffer(out, sr);
}

module.exports = { SAMPLE_RATE, AudioBuffer, mixBuffers, whiteNoise, seedRandom, Random };
