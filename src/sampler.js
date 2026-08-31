'use strict';

const { AudioBuffer } = require('./buffer');
const { noteFreq, resampleLinear } = require('./synth');

class Sampler {
  constructor(buf, baseNote = 'C', baseOctave = 4) {
    this.buf = buf;
    this.baseFreq = noteFreq(baseNote, baseOctave);
  }

  static load(pathOrUrl, { baseNote = 'C', baseOctave = 4 } = {}) {
    const { loadAudio } = require('./audioIo');
    const loaded = loadAudio(pathOrUrl);
    const buf = Array.isArray(loaded) ? loaded[0] : loaded;
    return new Sampler(buf, baseNote, baseOctave);
  }

  _fitTo(shifted, duration) {
    if (duration == null) return shifted;
    const n = Math.trunc(duration * shifted.sr);
    if (shifted.samples.length > n) shifted.samples = shifted.samples.slice(0, n);
    else shifted.padTo(n);
    return shifted;
  }

  playNote(note, octave, duration = null) {
    const ratio = noteFreq(note, octave) / this.baseFreq;
    const shifted = resampleLinear(this.buf, ratio);
    return this._fitTo(shifted, duration);
  }

  playSemitones(semitones, duration = null) {
    const ratio = 2 ** (semitones / 12);
    const shifted = resampleLinear(this.buf, ratio);
    return this._fitTo(shifted, duration);
  }

  loopTo(duration) {
    const nTarget = Math.trunc(duration * this.buf.sr);
    const out = this.buf.copy();
    if (out.samples.length === 0) return out;
    while (out.samples.length < nTarget) out.append(this.buf);
    out.samples = out.samples.slice(0, nTarget);
    return out;
  }

  chop(nSlices) {
    if (nSlices <= 0) throw new RangeError("'nSlices' must be > 0");
    const n = this.buf.samples.length;
    const size = Math.max(Math.trunc(n / nSlices), 1);
    const slices = [];
    for (let i = 0; i < nSlices; i++) {
      const start = i * size;
      const end = i === nSlices - 1 ? n : start + size;
      slices.push(new AudioBuffer(this.buf.samples.slice(start, end), this.buf.sr));
    }
    return slices;
  }

  sliceSeconds(startSec, endSec) {
    return this.buf.slice(startSec, endSec);
  }
}

module.exports = { Sampler };
