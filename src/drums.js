'use strict';

const { AudioBuffer, whiteNoise, SAMPLE_RATE } = require('./buffer');
const { applyEnvelope, sineWave } = require('./synth');

function _diffNoise(duration, sr) {
  const buf = whiteNoise(duration, { sr });
  const s = buf.samples;
  let prev = 0.0;
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    out[i] = s[i] - prev;
    prev = s[i];
  }
  buf.samples = out;
  return buf;
}

function _sweptTone(n, sr, startFreq, endFreq) {
  const out = new Float64Array(n);
  let phase = 0.0;
  for (let i = 0; i < n; i++) {
    const t = n ? i / n : 0.0;
    const freq = startFreq + (endFreq - startFreq) * t;
    out[i] = phase;
    phase += (2 * Math.PI * freq) / sr;
  }
  return out;
}

function kick(opts = {}) {
  const { duration = 0.4, startFreq = 150, endFreq = 45, sr = SAMPLE_RATE, click = true, drive = 1.0 } = opts;
  const n = Math.trunc(duration * sr);
  const phase = _sweptTone(n, sr, startFreq, endFreq);
  const wave = new Float64Array(n);
  for (let i = 0; i < n; i++) wave[i] = Math.tanh(drive * Math.sin(phase[i]));
  const buf = new AudioBuffer(wave, sr);
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.6, sustain: 0.0, release: duration * 0.3 });
  if (click) buf.mix(whiteNoise(0.004, { sr, amp: 0.3 }), { at: 0.0 });
  buf.normalize();
  return buf;
}

const kick808 = (o = {}) => kick({ duration: 0.9, startFreq: 120, endFreq: 35, ...o, click: false, drive: 1.4 });
const kickSub = ({ duration = 0.6, freq = 45, sr = SAMPLE_RATE } = {}) => {
  const buf = sineWave(freq, duration, { sr, amp: 0.9 });
  applyEnvelope(buf, { attack: 0.002, decay: duration * 0.5, sustain: 0.2, release: duration * 0.4 });
  buf.normalize();
  return buf;
};
const kickAcoustic = (o = {}) => kick({ duration: 0.35, startFreq: 180, endFreq: 60, ...o, click: true, drive: 1.0 });
const kickPunchy = (o = {}) => kick({ duration: 0.25, startFreq: 200, endFreq: 55, ...o, click: true, drive: 1.8 });

function snare({ duration = 0.2, sr = SAMPLE_RATE, toneFreq = 180, noiseAmt = 1.0 } = {}) {
  const tone = sineWave(toneFreq, duration, { sr, amp: 0.5 });
  tone.mix(whiteNoise(duration, { sr, amp: noiseAmt }), { at: 0.0 });
  applyEnvelope(tone, { attack: 0.001, decay: duration * 0.5, sustain: 0.05, release: duration * 0.3 });
  tone.normalize();
  return tone;
}
const snareTight = ({ duration = 0.12, sr = SAMPLE_RATE } = {}) => snare({ duration, sr, toneFreq: 220, noiseAmt: 0.8 });
const snareFat = ({ duration = 0.28, sr = SAMPLE_RATE } = {}) => snare({ duration, sr, toneFreq: 150, noiseAmt: 1.1 });

function snareElectro({ duration = 0.18, sr = SAMPLE_RATE } = {}) {
  const n = Math.trunc(duration * sr);
  const buf = snare({ duration, sr, toneFreq: 200, noiseAmt: 0.9 });
  const period = Math.trunc(sr / 90) || 1;
  const duty = Math.trunc(sr / 180) || 1;
  const square = new Float64Array(n);
  for (let i = 0; i < n; i++) square[i] = i % period < duty ? 0.25 : -0.25;
  buf.mix(new AudioBuffer(square, sr), { at: 0.0 });
  buf.normalize();
  return buf;
}

function rimshot({ duration = 0.1, sr = SAMPLE_RATE } = {}) {
  const tone = sineWave(400, duration, { sr, amp: 0.6 });
  tone.mix(whiteNoise(duration, { sr, amp: 0.4 }), { at: 0.0 });
  applyEnvelope(tone, { attack: 0.001, decay: duration * 0.3, sustain: 0.0, release: duration * 0.1 });
  tone.normalize();
  return tone;
}

function hihat({ duration = 0.08, closed = true, sr = SAMPLE_RATE } = {}) {
  const buf = _diffNoise(duration, sr);
  const decay = duration * (closed ? 0.3 : 0.9);
  applyEnvelope(buf, { attack: 0.001, decay, sustain: 0.0, release: duration * 0.2 });
  buf.normalize();
  return buf;
}
const hihatClosed = ({ duration = 0.06, sr = SAMPLE_RATE } = {}) => hihat({ duration, closed: true, sr });
const hihatOpen = ({ duration = 0.35, sr = SAMPLE_RATE } = {}) => hihat({ duration, closed: false, sr });

function hihatTrap({ duration = 0.05, sr = SAMPLE_RATE } = {}) {
  const buf = _diffNoise(duration, sr);
  applyEnvelope(buf, { attack: 0.0005, decay: duration * 0.2, sustain: 0.0, release: duration * 0.1 });
  buf.normalize();
  return buf;
}

function hihatPedal({ duration = 0.1, sr = SAMPLE_RATE } = {}) {
  const buf = _diffNoise(duration, sr);
  applyEnvelope(buf, { attack: 0.005, decay: duration * 0.5, sustain: 0.0, release: duration * 0.4 });
  buf.gain(0.6);
  buf.normalize(0.6);
  return buf;
}

function ride({ duration = 0.9, sr = SAMPLE_RATE } = {}) {
  const buf = AudioBuffer.silence(duration, sr);
  for (const f of [410, 630, 890, 1230]) buf.mix(sineWave(f, duration, { sr, amp: 0.15 }), { at: 0.0 });
  buf.mix(_diffNoise(duration, sr).gain(0.3), { at: 0.0 });
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.7, sustain: 0.05, release: duration * 0.3 });
  buf.normalize(0.8);
  return buf;
}

function crash({ duration = 1.4, sr = SAMPLE_RATE } = {}) {
  const buf = AudioBuffer.silence(duration, sr);
  for (const f of [350, 520, 710, 990, 1400]) buf.mix(sineWave(f, duration, { sr, amp: 0.12 }), { at: 0.0 });
  buf.mix(_diffNoise(duration, sr).gain(0.5), { at: 0.0 });
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.85, sustain: 0.0, release: duration * 0.4 });
  buf.normalize();
  return buf;
}

function clap({ duration = 0.25, sr = SAMPLE_RATE } = {}) {
  const buf = AudioBuffer.silence(duration, sr);
  for (const offset of [0, 0.01, 0.02, 0.035]) {
    const burst = whiteNoise(0.05, { sr });
    applyEnvelope(burst, { attack: 0.001, decay: 0.04, sustain: 0.0, release: 0.02 });
    buf.mix(burst, { at: offset });
  }
  buf.normalize();
  return buf;
}

function clapTight({ duration = 0.15, sr = SAMPLE_RATE } = {}) {
  const buf = AudioBuffer.silence(duration, sr);
  for (const offset of [0, 0.008, 0.016]) {
    const burst = whiteNoise(0.035, { sr });
    applyEnvelope(burst, { attack: 0.001, decay: 0.025, sustain: 0.0, release: 0.015 });
    buf.mix(burst, { at: offset });
  }
  buf.normalize();
  return buf;
}

function tom({ pitch = 120, duration = 0.3, sr = SAMPLE_RATE } = {}) {
  const n = Math.trunc(duration * sr);
  const out = new Float64Array(n);
  let phase = 0.0;
  for (let i = 0; i < n; i++) {
    const t = n ? i / n : 0.0;
    const freq = pitch * (1 - 0.3 * t);
    out[i] = Math.sin(phase);
    phase += (2 * Math.PI * freq) / sr;
  }
  const buf = new AudioBuffer(out, sr);
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.7, sustain: 0.0, release: duration * 0.2 });
  buf.normalize();
  return buf;
}
const tomLow = ({ duration = 0.4, sr = SAMPLE_RATE } = {}) => tom({ pitch: 90, duration, sr });
const tomMid = ({ duration = 0.32, sr = SAMPLE_RATE } = {}) => tom({ pitch: 140, duration, sr });
const tomHigh = ({ duration = 0.22, sr = SAMPLE_RATE } = {}) => tom({ pitch: 210, duration, sr });

function cowbell({ duration = 0.3, sr = SAMPLE_RATE } = {}) {
  const buf = AudioBuffer.silence(duration, sr);
  for (const f of [587.0, 845.0]) buf.mix(sineWave(f, duration, { sr, amp: 0.5 }), { at: 0.0 });
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.4, sustain: 0.1, release: duration * 0.3 });
  buf.normalize();
  return buf;
}

function shaker({ duration = 0.12, sr = SAMPLE_RATE } = {}) {
  const buf = _diffNoise(duration, sr);
  applyEnvelope(buf, { attack: 0.005, decay: duration * 0.4, sustain: 0.1, release: duration * 0.4 });
  buf.normalize(0.7);
  return buf;
}

function tambourine({ duration = 0.2, sr = SAMPLE_RATE } = {}) {
  const buf = _diffNoise(duration, sr).gain(0.6);
  for (const f of [2600, 3200, 4100]) buf.mix(sineWave(f, duration, { sr, amp: 0.08 }), { at: 0.0 });
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.5, sustain: 0.05, release: duration * 0.3 });
  buf.normalize(0.8);
  return buf;
}

function conga({ pitch = 300, duration = 0.22, sr = SAMPLE_RATE } = {}) {
  const buf = sineWave(pitch, duration, { sr, amp: 1.0 });
  applyEnvelope(buf, { attack: 0.002, decay: duration * 0.6, sustain: 0.05, release: duration * 0.2 });
  buf.normalize();
  return buf;
}

function clave({ pitch = 2500, duration = 0.09, sr = SAMPLE_RATE } = {}) {
  const buf = sineWave(pitch, duration, { sr, amp: 1.0 });
  applyEnvelope(buf, { attack: 0.0005, decay: duration * 0.4, sustain: 0.0, release: duration * 0.2 });
  buf.normalize();
  return buf;
}

function woodblock({ pitch = 1200, duration = 0.1, sr = SAMPLE_RATE } = {}) {
  const buf = sineWave(pitch, duration, { sr, amp: 1.0 });
  applyEnvelope(buf, { attack: 0.0005, decay: duration * 0.3, sustain: 0.0, release: duration * 0.15 });
  buf.normalize();
  return buf;
}

function trianglePerc({ pitch = 3800, duration = 0.6, sr = SAMPLE_RATE } = {}) {
  const buf = sineWave(pitch, duration, { sr, amp: 0.6 });
  applyEnvelope(buf, { attack: 0.001, decay: duration * 0.8, sustain: 0.05, release: duration * 0.3 });
  buf.normalize(0.7);
  return buf;
}

const VARIANTS = {
  kick: { default: kick, '808': kick808, sub: kickSub, acoustic: kickAcoustic, punchy: kickPunchy },
  snare: { default: snare, tight: snareTight, fat: snareFat, electro: snareElectro, rimshot },
  hihat: { closed: hihatClosed, open: hihatOpen, trap: hihatTrap, pedal: hihatPedal },
  cymbal: { ride, crash },
  clap: { default: clap, tight: clapTight },
  tom: { low: tomLow, mid: tomMid, high: tomHigh },
  perc: { cowbell, shaker, tambourine, conga, clave, woodblock, triangle: trianglePerc },
};

function getSound(family, variant = 'default') {
  const fam = VARIANTS[family];
  if (!fam) throw new RangeError(`unknown drum family '${family}'. available: ${Object.keys(VARIANTS)}`);
  const fn = fam[variant];
  if (!fn) throw new RangeError(`unknown variant '${variant}' for '${family}'. available: ${Object.keys(fam)}`);
  return fn;
}

function listSounds() {
  const out = {};
  for (const [fam, v] of Object.entries(VARIANTS)) out[fam] = Object.keys(v);
  return out;
}

function buildKit(mapping) {
  const out = {};
  for (const [sym, spec] of Object.entries(mapping)) out[sym] = getSound(...spec);
  return out;
}

const DEFAULT_KIT = {
  K: kick, S: snare,
  H: () => hihat({ closed: true }),
  O: () => hihat({ duration: 0.25, closed: false }),
  C: clap, T: tom, B: cowbell, R: rimshot,
  Y: ride, Z: crash, A: shaker, M: tambourine,
  G: conga, V: clave, W: woodblock,
};

module.exports = {
  kick, kick808, kickSub, kickAcoustic, kickPunchy,
  snare, snareTight, snareFat, snareElectro, rimshot,
  hihat, hihatClosed, hihatOpen, hihatTrap, hihatPedal,
  ride, crash, clap, clapTight,
  tom, tomLow, tomMid, tomHigh,
  cowbell, shaker, tambourine, conga, clave, woodblock, trianglePerc,
  VARIANTS, getSound, listSounds, buildKit, DEFAULT_KIT,
};
