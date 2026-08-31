'use strict';

function _pyRound(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

class Biquad {
  constructor(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0.0;
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }

  static lowpass(freq, sr, q = 0.707) {
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = (1 - cosw0) / 2;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) / 2;
    return new Biquad(b0, b1, b2, 1 + alpha, -2 * cosw0, 1 - alpha);
  }

  static highpass(freq, sr, q = 0.707) {
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    return new Biquad(b0, b1, b2, 1 + alpha, -2 * cosw0, 1 - alpha);
  }

  static peaking(freq, sr, gainDb, q = 1.0) {
    const A = 10 ** (gainDb / 40);
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = 1 + alpha * A, b1 = -2 * cosw0, b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A, a1 = -2 * cosw0, a2 = 1 - alpha / A;
    return new Biquad(b0, b1, b2, a0, a1, a2);
  }

  static lowshelf(freq, sr, gainDb, q = 0.707) {
    const A = 10 ** (gainDb / 40);
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const sq = 2 * Math.sqrt(A) * alpha;
    const b0 = A * (A + 1 - (A - 1) * cosw0 + sq);
    const b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
    const b2 = A * (A + 1 - (A - 1) * cosw0 - sq);
    const a0 = A + 1 + (A - 1) * cosw0 + sq;
    const a1 = -2 * (A - 1 + (A + 1) * cosw0);
    const a2 = A + 1 + (A - 1) * cosw0 - sq;
    return new Biquad(b0, b1, b2, a0, a1, a2);
  }

  static highshelf(freq, sr, gainDb, q = 0.707) {
    const A = 10 ** (gainDb / 40);
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const sq = 2 * Math.sqrt(A) * alpha;
    const b0 = A * (A + 1 + (A - 1) * cosw0 + sq);
    const b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
    const b2 = A * (A + 1 + (A - 1) * cosw0 - sq);
    const a0 = A + 1 - (A - 1) * cosw0 + sq;
    const a1 = 2 * (A - 1 - (A + 1) * cosw0);
    const a2 = A + 1 - (A - 1) * cosw0 - sq;
    return new Biquad(b0, b1, b2, a0, a1, a2);
  }
}

function applyFilter(buf, biquad) {
  const { b0, b1, b2, a1, a2 } = biquad;
  const n = buf.samples.length;
  const out = new Float64Array(n);
  let { x1, x2, y1, y2 } = biquad;
  const s = buf.samples;
  for (let i = 0; i < n; i++) {
    const x = s[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  biquad.x1 = x1; biquad.x2 = x2; biquad.y1 = y1; biquad.y2 = y2;
  buf.samples = out;
  return buf;
}

const lowpass = (buf, { freq, q = 0.707 } = {}) => applyFilter(buf, Biquad.lowpass(freq, buf.sr, q));
const highpass = (buf, { freq, q = 0.707 } = {}) => applyFilter(buf, Biquad.highpass(freq, buf.sr, q));
const eqBand = (buf, { freq, gainDb, q = 1.0 } = {}) => applyFilter(buf, Biquad.peaking(freq, buf.sr, gainDb, q));
const lowShelf = (buf, { freq, gainDb, q = 0.707 } = {}) => applyFilter(buf, Biquad.lowshelf(freq, buf.sr, gainDb, q));
const highShelf = (buf, { freq, gainDb, q = 0.707 } = {}) => applyFilter(buf, Biquad.highshelf(freq, buf.sr, gainDb, q));

function distortion(buf, { drive = 5.0, mix = 1.0 } = {}) {
  const s = buf.samples;
  for (let i = 0; i < s.length; i++) {
    const wet = Math.tanh(s[i] * drive);
    s[i] = wet * mix + s[i] * (1 - mix);
  }
  return buf;
}

function bitcrush(buf, { bitDepth = 8, downsample = 1 } = {}) {
  if (downsample < 1) throw new RangeError("'downsample' must be >= 1");
  const levels = 2 ** bitDepth;
  const s = buf.samples;
  let held = 0.0;
  for (let i = 0; i < s.length; i++) {
    if (i % downsample === 0) held = _pyRound(s[i] * levels) / levels;
    s[i] = held;
  }
  return buf;
}

function delay(buf, { timeSec = 0.3, feedback = 0.4, mix = 0.35, repeatsTail = 3 } = {}) {
  const delaySamples = Math.max(Math.trunc(timeSec * buf.sr), 1);
  const tail = delaySamples * repeatsTail;
  const dryLen = buf.samples.length;
  const nTotal = dryLen + tail;
  const out = new Float64Array(nTotal);
  const line = new Float64Array(delaySamples);
  let idx = 0;
  for (let i = 0; i < nTotal; i++) {
    const dry = i < dryLen ? buf.samples[i] : 0.0;
    const delayed = line[idx];
    out[i] = dry + delayed * mix;
    line[idx] = dry + delayed * feedback;
    idx = (idx + 1) % delaySamples;
  }
  buf.samples = out;
  return buf;
}

function _combFilter(samples, delayLen, feedback) {
  const line = new Float64Array(delayLen);
  const out = new Float64Array(samples.length);
  let idx = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = line[idx];
    out[i] = y;
    line[idx] = x + y * feedback;
    idx = (idx + 1) % delayLen;
  }
  return out;
}

function _allpassFilter(samples, delayLen, gain = 0.5) {
  const line = new Float64Array(delayLen);
  const out = new Float64Array(samples.length);
  let idx = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const buffered = line[idx];
    const y = -gain * x + buffered;
    line[idx] = x + gain * y;
    out[i] = y;
    idx = (idx + 1) % delayLen;
  }
  return out;
}

function reverb(buf, { roomSize = 0.6, damping = 0.5, mix = 0.3 } = {}) {
  const combDelaysMs = [29.7, 37.1, 41.1, 43.7];
  const feedback = 0.28 + roomSize * 0.35;
  const n = buf.samples.length;
  let wet = new Float64Array(n);
  for (const ms of combDelaysMs) {
    const d = Math.max(Math.trunc((buf.sr * ms) / 1000), 1);
    const combOut = _combFilter(buf.samples, d, feedback * (1 - damping * 0.3));
    for (let i = 0; i < n; i++) wet[i] += combOut[i] / combDelaysMs.length;
  }
  for (const ms of [5.0, 1.7]) {
    const d = Math.max(Math.trunc((buf.sr * ms) / 1000), 1);
    wet = _allpassFilter(wet, d, 0.5);
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.samples[i] * (1 - mix) + wet[i] * mix;
  buf.samples = out;
  return buf;
}

function chorus(buf, { rate = 1.5, depthMs = 3.0, mix = 0.5 } = {}) {
  const sr = buf.sr;
  const n = buf.samples.length;
  const maxDelay = Math.trunc((depthMs * 2 * sr) / 1000) + 2;
  const history = new Float64Array(maxDelay);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = buf.samples[i];
    history[i % maxDelay] = x;
    const lfo = (Math.sin((2 * Math.PI * rate * i) / sr) + 1) / 2;
    const delaySamples = ((depthMs / 1000) * sr * lfo);
    const readPos = i - delaySamples;
    const idx0 = ((Math.floor(readPos) % maxDelay) + maxDelay) % maxDelay;
    const idx1 = (idx0 + 1) % maxDelay;
    const frac = readPos - Math.floor(readPos);
    const delayed = readPos < 0 ? 0.0 : history[idx0] * (1 - frac) + history[idx1] * frac;
    out[i] = x * (1 - mix) + delayed * mix;
  }
  buf.samples = out;
  return buf;
}

function tremolo(buf, { rate = 5.0, depth = 0.5 } = {}) {
  const sr = buf.sr;
  const s = buf.samples;
  for (let i = 0; i < s.length; i++) {
    const lfo = 1 - depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * rate * i) / sr));
    s[i] *= lfo;
  }
  return buf;
}

function compressor(buf, { thresholdDb = -18, ratio = 4.0, attack = 0.005, release = 0.1, makeupDb = 0.0 } = {}) {
  const sr = buf.sr;
  const threshold = 10 ** (thresholdDb / 20);
  const attackCoef = Math.exp(-1 / (sr * attack));
  const releaseCoef = Math.exp(-1 / (sr * release));
  const makeup = 10 ** (makeupDb / 20);
  const oneMinusAttack = 1 - attackCoef;
  const oneMinusRelease = 1 - releaseCoef;
  const k = 1 - 1 / ratio;
  let env = 0.0;
  const s = buf.samples;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    const rectified = Math.abs(x);
    if (rectified > env) env = attackCoef * env + oneMinusAttack * rectified;
    else env = releaseCoef * env + oneMinusRelease * rectified;
    const gain = env > threshold ? (threshold / env) ** k : 1.0;
    out[i] = x * gain * makeup;
  }
  buf.samples = out;
  return buf;
}

function limiter(buf, { ceilingDb = -0.3, release = 0.05 } = {}) {
  const ceiling = 10 ** (ceilingDb / 20);
  const sr = buf.sr;
  const releaseCoef = Math.exp(-1 / (sr * release));
  const oneMinusRelease = 1 - releaseCoef;
  let gain = 1.0;
  const s = buf.samples;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    const ax = Math.abs(x);
    const targetGain = ax > ceiling ? ceiling / ax : 1.0;
    if (targetGain < gain) gain = targetGain;
    else gain = gain * releaseCoef + targetGain * oneMinusRelease;
    out[i] = x * gain;
  }
  buf.samples = out;
  return buf;
}

function _panGains(sample, pan) {
  const angle = ((pan + 1) * Math.PI) / 4;
  return [sample * Math.cos(angle), sample * Math.sin(angle)];
}

function panStereo(buf, pan = 0.0) {
  const angle = ((pan + 1) * Math.PI) / 4;
  const lg = Math.cos(angle), rg = Math.sin(angle);
  const s = buf.samples;
  const left = new Float64Array(s.length);
  const right = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    left[i] = s[i] * lg;
    right[i] = s[i] * rg;
  }
  return [left, right];
}

function vibrato(buf, { rate = 5.0, depthMs = 4.0 } = {}) {
  const sr = buf.sr;
  const n = buf.samples.length;
  const maxDelay = Math.trunc((depthMs * 2 * sr) / 1000) + 2;
  const history = new Float64Array(maxDelay);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = buf.samples[i];
    history[i % maxDelay] = x;
    const lfo = Math.sin((2 * Math.PI * rate * i) / sr);
    const delaySamples = (depthMs / 1000) * sr * (0.5 + 0.5 * lfo);
    const readPos = i - delaySamples;
    if (readPos < 0) { out[i] = 0.0; continue; }
    const idx0 = Math.floor(readPos) % maxDelay;
    const idx1 = (idx0 + 1) % maxDelay;
    const frac = readPos - Math.floor(readPos);
    out[i] = history[idx0] * (1 - frac) + history[idx1] * frac;
  }
  buf.samples = out;
  return buf;
}

function phaser(buf, { rate = 0.5, depth = 0.7, stages = 4, mix = 0.5 } = {}) {
  const sr = buf.sr;
  const n = buf.samples.length;
  const out = new Float64Array(n);
  const stageStates = new Float64Array(stages);
  for (let i = 0; i < n; i++) {
    const x = buf.samples[i];
    const lfo = (Math.sin((2 * Math.PI * rate * i) / sr) + 1) / 2;
    const freq = 300 + depth * lfo * 3000;
    const tanVal = Math.tan((Math.PI * freq) / sr);
    const a = (tanVal - 1) / (tanVal + 1);
    let wet = x;
    for (let sIdx = 0; sIdx < stages; sIdx++) {
      const y = a * wet + stageStates[sIdx];
      stageStates[sIdx] = wet - a * y;
      wet = y;
    }
    out[i] = x * (1 - mix) + wet * mix;
  }
  buf.samples = out;
  return buf;
}

function autopan(buf, { rate = 1.0, depth = 1.0 } = {}) {
  const sr = buf.sr;
  const n = buf.samples.length;
  const left = new Float64Array(n);
  const right = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = buf.samples[i];
    const lfo = Math.sin((2 * Math.PI * rate * i) / sr) * depth;
    const angle = ((lfo + 1) * Math.PI) / 4;
    left[i] = x * Math.cos(angle);
    right[i] = x * Math.sin(angle);
  }
  return [left, right];
}

function noiseGate(buf, { thresholdDb = -40, attack = 0.002, release = 0.15 } = {}) {
  const sr = buf.sr;
  const threshold = 10 ** (thresholdDb / 20);
  const attackCoef = Math.exp(-1 / (sr * attack));
  const releaseCoef = Math.exp(-1 / (sr * release));
  const oneMinusRelease = 1 - releaseCoef;
  let env = 0.0;
  let gain = 0.0;
  const s = buf.samples;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    const rectified = Math.abs(x);
    env = rectified < env ? env * releaseCoef + rectified * oneMinusRelease : rectified;
    const target = env > threshold ? 1.0 : 0.0;
    const coef = target > gain ? attackCoef : releaseCoef;
    gain = gain * coef + target * (1 - coef);
    out[i] = x * gain;
  }
  buf.samples = out;
  return buf;
}

function saturation(buf, { amount = 0.3, mix = 1.0 } = {}) {
  const drive = 1 + amount * 4;
  const tanhDrive = Math.tanh(drive);
  const s = buf.samples;
  for (let i = 0; i < s.length; i++) {
    const wet = Math.tanh(s[i] * drive) / tanhDrive;
    s[i] = wet * mix + s[i] * (1 - mix);
  }
  return buf;
}

function wah(buf, { rate = 2.0, minFreq = 400, maxFreq = 2000, q = 3.0 } = {}) {
  const sr = buf.sr;
  const n = buf.samples.length;
  const out = new Float64Array(n);
  let x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0;
  for (let i = 0; i < n; i++) {
    const x = buf.samples[i];
    const lfo = (Math.sin((2 * Math.PI * rate * i) / sr) + 1) / 2;
    const freq = minFreq + (maxFreq - minFreq) * lfo;
    const w0 = (2 * Math.PI * freq) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = alpha, b1 = 0.0, b2 = -alpha;
    const a0 = 1 + alpha, a1 = -2 * cosw0, a2 = 1 - alpha;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    out[i] = y;
  }
  buf.samples = out;
  return buf;
}

function exciter(buf, { freq = 3000, amount = 0.3 } = {}) {
  const bright = buf.copy();
  highShelf(bright, { freq, gainDb: 6.0 });
  saturation(bright, { amount: 0.5 });
  const s = buf.samples;
  const h = bright.samples;
  for (let i = 0; i < s.length; i++) s[i] = s[i] + h[i] * amount;
  return buf;
}

function sidechain(buf, pattern, { bpm, stepsPerBeat = 4, depth = 0.6, release = 0.2 } = {}) {
  const sr = buf.sr;
  const stepDur = 60 / bpm / stepsPerBeat;
  const n = buf.samples.length;
  const releaseCoef = Math.exp(-1 / (sr * release));
  const oneMinusRelease = 1 - releaseCoef;
  const triggerFlags = new Uint8Array(n);
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '.') {
      const pos = Math.trunc(i * stepDur * sr);
      if (pos >= 0 && pos < n) triggerFlags[pos] = 1;
    }
  }
  const s = buf.samples;
  const out = new Float64Array(n);
  let gain = 1.0;
  for (let i = 0; i < n; i++) {
    if (triggerFlags[i]) gain = 1 - depth;
    else gain = gain + (1 - gain) * oneMinusRelease;
    out[i] = s[i] * gain;
  }
  buf.samples = out;
  return buf;
}

function deEsser(buf, { freq = 6500, thresholdDb = -26, ratio = 4.0, q = 1.0 } = {}) {
  const high = buf.copy();
  highpass(high, { freq, q });
  compressor(high, { thresholdDb, ratio, attack: 0.001, release: 0.05 });
  const low = buf.copy();
  lowpass(low, { freq, q });
  const s = buf.samples;
  for (let i = 0; i < s.length; i++) s[i] = low.samples[i] + high.samples[i];
  return buf;
}

function duckUnder(buf, trigger, { depth = 0.6, attack = 0.01, release = 0.15, threshold = 0.05 } = {}) {
  const sr = buf.sr;
  const nTrigger = trigger.samples.length;
  const attackCoef = Math.exp(-1 / (sr * attack));
  const releaseCoef = Math.exp(-1 / (sr * release));
  const oneMinusAttack = 1 - attackCoef;
  const oneMinusRelease = 1 - releaseCoef;
  const peak = trigger.peak() || 1.0;
  const trigSamples = trigger.samples;
  let env = 0.0;
  const s = buf.samples;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const t = i < nTrigger ? Math.abs(trigSamples[i]) / peak : 0.0;
    if (t > env) env = attackCoef * env + oneMinusAttack * t;
    else env = releaseCoef * env + oneMinusRelease * t;
    const active = env > threshold ? 1.0 : env / threshold;
    const gain = 1 - depth * active;
    out[i] = s[i] * gain;
  }
  buf.samples = out;
  return buf;
}

function stereoWidener(left, right, width = 1.3) {
  const { AudioBuffer } = require('./buffer');
  const n = Math.min(left.samples.length, right.samples.length);
  const newLeft = new Float64Array(n);
  const newRight = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const m = (left.samples[i] + right.samples[i]) / 2;
    const sd = ((left.samples[i] - right.samples[i]) / 2) * width;
    newLeft[i] = m + sd;
    newRight[i] = m - sd;
  }
  return [new AudioBuffer(newLeft, left.sr), new AudioBuffer(newRight, left.sr)];
}

function haasWiden(left, right, { delayMs = 15, mix = 0.35 } = {}) {
  const { AudioBuffer } = require('./buffer');
  const sr = left.sr;
  const delaySamples = Math.max(Math.trunc((delayMs * sr) / 1000), 1);
  const n = Math.min(left.samples.length, right.samples.length);
  const delayedRight = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const src = i - delaySamples;
    delayedRight[i] = src >= 0 ? right.samples[src] : 0.0;
  }
  const newLeft = left.samples.slice(0, n);
  const newRight = new Float64Array(n);
  for (let i = 0; i < n; i++) newRight[i] = right.samples[i] * (1 - mix) + delayedRight[i] * mix;
  return [new AudioBuffer(newLeft, sr), new AudioBuffer(newRight, sr)];
}

function loudnessMaximizer(buf, { targetCrestDb = 10.0, ceilingDb = -0.3, iterations = 8, driveStepDb = 1.5 } = {}) {
  const ceiling = 10 ** (ceilingDb / 20);
  let prevCrestDb = null;
  for (let it = 0; it < iterations; it++) {
    const n = buf.samples.length;
    if (n === 0) break;
    const peak = buf.peak();
    if (peak <= 0) break;
    let sumSq = 0.0;
    for (let i = 0; i < n; i++) sumSq += buf.samples[i] * buf.samples[i];
    const rms = Math.sqrt(sumSq / n);
    if (rms <= 0) break;
    const crestDb = 20 * Math.log10(peak) - 20 * Math.log10(rms);
    if (crestDb <= targetCrestDb) break;
    if (prevCrestDb !== null && crestDb >= prevCrestDb - 0.05) break;
    prevCrestDb = crestDb;
    buf.gainDb(driveStepDb);
    limiter(buf, { ceilingDb, release: 0.05 });
  }
  const m = buf.peak();
  if (m > 0) buf.gain(ceiling / m);
  return buf;
}

module.exports = {
  Biquad, applyFilter,
  lowpass, highpass, eqBand, lowShelf, highShelf,
  distortion, bitcrush, delay, reverb, chorus, tremolo,
  compressor, limiter, panStereo, vibrato, phaser, autopan,
  noiseGate, saturation, wah, exciter, sidechain, deEsser, duckUnder,
  stereoWidener, haasWiden, loudnessMaximizer,
  _panGains,
};
