'use strict';

const { AudioBuffer, SAMPLE_RATE } = require('./buffer');

function sineWave(freq, duration, { sr = SAMPLE_RATE, amp = 1.0, phase = 0.0 } = {}) {
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr + phase);
  return new AudioBuffer(out, sr);
}

function squareWave(freq, duration, { sr = SAMPLE_RATE, amp = 1.0, duty = 0.5 } = {}) {
  if (freq <= 0) throw new RangeError("'freq' must be > 0");
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const phase = ((i / sr) * freq) % 1.0;
    out[i] = phase < duty ? amp : -amp;
  }
  return new AudioBuffer(out, sr);
}

function sawWave(freq, duration, { sr = SAMPLE_RATE, amp = 1.0 } = {}) {
  if (freq <= 0) throw new RangeError("'freq' must be > 0");
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const phase = ((i / sr) * freq) % 1.0;
    out[i] = amp * (2 * phase - 1);
  }
  return new AudioBuffer(out, sr);
}

function triangleWave(freq, duration, { sr = SAMPLE_RATE, amp = 1.0 } = {}) {
  if (freq <= 0) throw new RangeError("'freq' must be > 0");
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const phase = ((i / sr) * freq) % 1.0;
    out[i] = amp * (4 * Math.abs(phase - 0.5) - 1);
  }
  return new AudioBuffer(out, sr);
}

function envelopeAdsr(nSamples, { sr = SAMPLE_RATE, attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2 } = {}) {
  const a = Math.trunc(attack * sr);
  const d = Math.trunc(decay * sr);
  const r = Math.trunc(release * sr);
  const s = Math.max(nSamples - a - d - r, 0);
  const env = new Float64Array(nSamples);
  let idx = 0;
  for (let i = 0; i < a && idx < nSamples; i++, idx++) env[idx] = i / a;
  for (let i = 0; i < d && idx < nSamples; i++, idx++) env[idx] = 1 - ((1 - sustain) * i) / d;
  for (let i = 0; i < s && idx < nSamples; i++, idx++) env[idx] = sustain;
  for (let i = 0; i < r && idx < nSamples; i++, idx++) env[idx] = sustain * (1 - i / r);

  return env;
}

function applyEnvelope(buf, opts = {}) {
  const env = envelopeAdsr(buf.samples.length, { sr: buf.sr, ...opts });
  const s = buf.samples;
  for (let i = 0; i < s.length; i++) s[i] *= env[i];
  return buf;
}

const NOTE_FREQS = {
  C: 16.35, 'C#': 17.32, D: 18.35, 'D#': 19.45, E: 20.6,
  F: 21.83, 'F#': 23.12, G: 24.5, 'G#': 25.96, A: 27.5,
  'A#': 29.14, B: 30.87,
};

function noteFreq(note, octave = 4) {
  if (!(note in NOTE_FREQS)) {
    throw new RangeError(`unknown note '${note}'. valid notes: ${Object.keys(NOTE_FREQS)}`);
  }
  return NOTE_FREQS[note] * 2 ** octave;
}

function resampleLinear(buf, ratio) {
  if (ratio <= 0) throw new RangeError("'ratio' must be > 0");
  const src = buf.samples;
  const nSrc = src.length;
  const nOut = Math.max(Math.trunc(nSrc / ratio), 1);
  const out = new Float64Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const pos = i * ratio;
    const idx0 = Math.trunc(pos);
    if (idx0 >= nSrc) {
      out[i] = 0.0;
      continue;
    }
    const idx1 = Math.min(idx0 + 1, nSrc - 1);
    const frac = pos - idx0;
    out[i] = src[idx0] * (1 - frac) + src[idx1] * frac;
  }
  return new AudioBuffer(out, buf.sr);
}

function changeSpeed(buf, factor) {
  return resampleLinear(buf, factor);
}

function pitchShiftSemitones(buf, semitones) {
  const ratio = 2 ** (semitones / 12);
  const shifted = resampleLinear(buf, ratio);
  const nTarget = buf.samples.length;
  if (shifted.samples.length >= nTarget) {
    shifted.samples = shifted.samples.slice(0, nTarget);
  } else {
    shifted.padTo(nTarget);
  }
  return shifted;
}

module.exports = {
  sineWave, squareWave, sawWave, triangleWave,
  envelopeAdsr, applyEnvelope,
  NOTE_FREQS, noteFreq,
  resampleLinear, changeSpeed, pitchShiftSemitones,
};
