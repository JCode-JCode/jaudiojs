'use strict';

const { AudioBuffer, whiteNoise, SAMPLE_RATE } = require('./buffer');
const { sawWave, sineWave, squareWave, applyEnvelope, noteFreq } = require('./synth');
const { lowpass } = require('./effects');

function bassSynth(note, octave, duration, sr = 44100) {
  const freq = noteFreq(note, octave);
  const buf = sawWave(freq, duration, { sr, amp: 0.8 });
  buf.mix(sineWave(freq / 2, duration, { sr, amp: 0.4 }), { at: 0.0 });
  lowpass(buf, { freq: 800, q: 0.9 });
  applyEnvelope(buf, { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.1 });
  buf.normalize(0.8);
  return buf;
}

function pluckSynth(note, octave, duration, sr = 44100) {
  const freq = noteFreq(note, octave);
  const buf = squareWave(freq, duration, { sr, amp: 0.5 });
  lowpass(buf, { freq: 3000, q: 0.8 });
  applyEnvelope(buf, { attack: 0.002, decay: duration * 0.5, sustain: 0.0, release: duration * 0.3 });
  buf.normalize(0.8);
  return buf;
}

function padSynth(note, octave, duration, sr = 44100) {
  const freq = noteFreq(note, octave);
  const buf = sineWave(freq, duration, { sr, amp: 0.5 });
  buf.mix(sineWave(freq * 1.005, duration, { sr, amp: 0.5 }), { at: 0.0 });
  lowpass(buf, { freq: 2000, q: 0.7 });
  applyEnvelope(buf, { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 });
  buf.normalize(0.7);
  return buf;
}

const PIANO_HARMONICS = [
  [1, 1.0, 0.9], [2, 0.55, 1.6], [3, 0.35, 2.4], [4, 0.22, 3.4],
  [5, 0.14, 4.6], [6, 0.09, 6.0], [7, 0.05, 7.5], [8, 0.03, 9.0],
];

function pianoSynth(note, octave, duration, sr = SAMPLE_RATE, velocity = 1.0) {
  const freq = noteFreq(note, octave);
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  for (const [h, amp, decayRate] of PIANO_HARMONICS) {
    const hfreq = freq * h * (1 + 0.0004 * h * h);
    const gain = amp * velocity;
    const dtheta = (2 * Math.PI * hfreq) / sr;
    const cInc = Math.cos(dtheta);
    const sInc = Math.sin(dtheta);
    const decayPerSample = Math.exp(-decayRate / sr);
    let curC = 1.0;
    let curS = 0.0;
    let env = gain;
    for (let i = 0; i < n; i++) {
      out[i] += env * curS;
      env *= decayPerSample;
      const nextC = curC * cInc - curS * sInc;
      const nextS = curS * cInc + curC * sInc;
      curC = nextC;
      curS = nextS;
      if ((i & 1023) === 0 && i > 0) {
        const norm = Math.sqrt(curC * curC + curS * curS);
        curC /= norm;
        curS /= norm;
      }
    }
  }
  const buf = new AudioBuffer(out, sr);
  buf.mix(whiteNoise(0.006, { sr, amp: 0.15 * velocity }), { at: 0.0 });
  buf.normalize(0.85);
  return buf;
}

function _freqCurve(notes, bpm, sr, glideTime) {
  const freqs = notes.map(([n, o]) => noteFreq(n, o));
  const durations = notes.map(([, , b]) => (b * 60) / bpm);
  const total = durations.reduce((a, b) => a + b, 0);
  const nTotal = Math.trunc(total * sr);
  const curve = new Float64Array(nTotal);
  let cum = 0.0;
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    const d = durations[i];
    const segStart = Math.trunc(cum * sr);
    const segEnd = Math.min(Math.trunc((cum + d) * sr), nTotal);
    const prevF = i > 0 ? freqs[i - 1] : f;
    const glideSamples = Math.min(Math.trunc(glideTime * sr), Math.max(segEnd - segStart, 0));
    for (let s = segStart; s < segEnd; s++) {
      const local = s - segStart;
      if (glideSamples > 0 && local < glideSamples) {
        const t = local / glideSamples;
        curve[s] = prevF + (f - prevF) * t;
      } else {
        curve[s] = f;
      }
    }
    cum += d;
  }
  return [curve, nTotal];
}

function bass808Line(notes, bpm, { sr = SAMPLE_RATE, glideTime = 0.12, drive = 3.0 } = {}) {
  const [curve, nTotal] = _freqCurve(notes, bpm, sr, glideTime);
  const out = new Float64Array(nTotal);
  let phase = 0.0;
  for (let i = 0; i < nTotal; i++) {
    out[i] = Math.tanh(drive * Math.sin(phase));
    phase += (2 * Math.PI * curve[i]) / sr;
  }
  const buf = new AudioBuffer(out, sr);
  applyEnvelope(buf, { attack: 0.005, decay: 0.05, sustain: 0.9, release: 0.08 });
  buf.normalize(0.9);
  return buf;
}

module.exports = { bassSynth, pluckSynth, padSynth, PIANO_HARMONICS, pianoSynth, bass808Line };
