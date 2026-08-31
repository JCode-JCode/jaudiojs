'use strict';

const fs = require('fs');
const audioIo = require('./audioIo');
const player = require('./player');
const effects = require('./effects');
const synth = require('./synth');
const mastering = require('./mastering');

class AudioFile {

  constructor() {
    this.source = null;
    this.changeToNumpy = false;
    this.repeatBeforeSave = 0;
    this.repeatAfterSave = 0;
    this.sr = null;
    this.buf = null;
    this.left = null;
    this.right = null;
    this.isStereo = false;
  }

  static load(source, { changeToNumpy = false } = {}) {
    const file = new AudioFile();
    file.source = source;
    file.changeToNumpy = changeToNumpy;
    const [wavPath, cleanup] = audioIo.resolveSource(source);
    try {
      const [channels, sr] = audioIo.loadWavRaw(wavPath);
      file.sr = sr;
      if (channels.length === 2) {
        file.isStereo = true;
        file.left = new (require('./buffer').AudioBuffer)(channels[0], sr);
        file.right = new (require('./buffer').AudioBuffer)(channels[1], sr);
      } else {
        file.isStereo = false;
        file.buf = new (require('./buffer').AudioBuffer)(channels[0], sr);
      }
    } finally {
      for (const p of cleanup) {
        try { fs.unlinkSync(p); } catch {  }
      }
    }
    return file;
  }

  get duration() {
    if (this.isStereo) return this.left ? this.left.duration : 0.0;
    return this.buf ? this.buf.duration : 0.0;
  }

  _resolveSavePath(saveAs) {
    if (!saveAs) throw new RangeError("'saveAs' (output file name) is required.");
    return saveAs.toLowerCase().endsWith('.wav') ? saveAs : `${saveAs}.wav`;
  }

  _finalize(saveAs, playAfter) {
    const p = this._resolveSavePath(saveAs);
    if (this.isStereo) {
      if (this.repeatAfterSave > 0) {
        this.left.repeat(this.repeatAfterSave);
        this.right.repeat(this.repeatAfterSave);
      }
      audioIo.saveWavStereo(p, this.left, this.right);
      if (playAfter) {
        let pl = this.left, pr = this.right;
        if (this.repeatBeforeSave > 0) {
          pl = this.left.copy().repeat(this.repeatBeforeSave);
          pr = this.right.copy().repeat(this.repeatBeforeSave);
        }
        player.playStereo(pl, pr);
      }
    } else {
      if (this.repeatAfterSave > 0) this.buf.repeat(this.repeatAfterSave);
      audioIo.saveWavMono(p, this.buf);
      if (playAfter) {
        let pb = this.buf;
        if (this.repeatBeforeSave > 0) pb = this.buf.copy().repeat(this.repeatBeforeSave);
        player.playBuffer(pb);
      }
    }
    return p;
  }

  play() {
    if (this.isStereo) {
      let pl = this.left, pr = this.right;
      if (this.repeatBeforeSave > 0) {
        pl = this.left.copy().repeat(this.repeatBeforeSave);
        pr = this.right.copy().repeat(this.repeatBeforeSave);
      }
      player.playStereo(pl, pr);
    } else {
      let pb = this.buf;
      if (this.repeatBeforeSave > 0) pb = this.buf.copy().repeat(this.repeatBeforeSave);
      player.playBuffer(pb);
    }
    return this;
  }

  addEffect(effectName, saveAs, { playAfter = false, ...params } = {}) {
    const fn = effects[effectName];
    if (typeof fn !== 'function') throw new RangeError(`effect '${effectName}' does not exist.`);
    if (this.isStereo) {
      fn(this.left, params);
      fn(this.right, params);
    } else {
      fn(this.buf, params);
    }
    return this._finalize(saveAs, playAfter);
  }

  changeSpeed(factor, saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left = synth.changeSpeed(this.left, factor);
      this.right = synth.changeSpeed(this.right, factor);
    } else {
      this.buf = synth.changeSpeed(this.buf, factor);
    }
    return this._finalize(saveAs, playAfter);
  }

  tune(semitones, saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left = synth.pitchShiftSemitones(this.left, semitones);
      this.right = synth.pitchShiftSemitones(this.right, semitones);
    } else {
      this.buf = synth.pitchShiftSemitones(this.buf, semitones);
    }
    return this._finalize(saveAs, playAfter);
  }

  trim(startSec, endSec, saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left = this.left.slice(startSec, endSec);
      this.right = this.right.slice(startSec, endSec);
    } else {
      this.buf = this.buf.slice(startSec, endSec);
    }
    return this._finalize(saveAs, playAfter);
  }

  normalize(saveAs, { peak = 0.95, playAfter = false } = {}) {
    if (this.isStereo) {
      this.left.normalize(peak);
      this.right.normalize(peak);
    } else {
      this.buf.normalize(peak);
    }
    return this._finalize(saveAs, playAfter);
  }

  reverse(saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left.reverse();
      this.right.reverse();
    } else {
      this.buf.reverse();
    }
    return this._finalize(saveAs, playAfter);
  }

  fade(saveAs, { fadeIn = 0.0, fadeOut = 0.0, playAfter = false } = {}) {
    if (this.isStereo) {
      if (fadeIn) { this.left.fadeIn(fadeIn); this.right.fadeIn(fadeIn); }
      if (fadeOut) { this.left.fadeOut(fadeOut); this.right.fadeOut(fadeOut); }
    } else {
      if (fadeIn) this.buf.fadeIn(fadeIn);
      if (fadeOut) this.buf.fadeOut(fadeOut);
    }
    return this._finalize(saveAs, playAfter);
  }

  gainDb(db, saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left.gainDb(db);
      this.right.gainDb(db);
    } else {
      this.buf.gainDb(db);
    }
    return this._finalize(saveAs, playAfter);
  }

  repeat(times, saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      this.left.repeat(times);
      this.right.repeat(times);
    } else {
      this.buf.repeat(times);
    }
    return this._finalize(saveAs, playAfter);
  }

  mixWith(other, saveAs, { at = 0.0, volume = 1.0, playAfter = false } = {}) {
    const otherFile = other instanceof AudioFile ? other : AudioFile.load(other, { changeToNumpy: this.changeToNumpy });
    if (this.isStereo && otherFile.isStereo) {
      this.left.mix(otherFile.left, { at, volume });
      this.right.mix(otherFile.right, { at, volume });
    } else if (!this.isStereo && !otherFile.isStereo) {
      this.buf.mix(otherFile.buf, { at, volume });
    } else {
      throw new Error('to mix, both files must be either mono or stereo.');
    }
    return this._finalize(saveAs, playAfter);
  }

  master(saveAs, { preset = 'balanced', playAfter = false, ...overrides } = {}) {
    if (!this.isStereo) {
      this.left = this.buf.copy();
      this.right = this.buf.copy();
      this.buf = null;
      this.isStereo = true;
    }
    [this.left, this.right] = mastering.masterWithPreset(this.left, this.right, { preset, ...overrides });
    return this._finalize(saveAs, playAfter);
  }

  toMono(saveAs, { playAfter = false } = {}) {
    if (this.isStereo) {
      const { AudioBuffer } = require('./buffer');
      const l = this.left.samples, r = this.right.samples;
      const n = Math.min(l.length, r.length);
      const merged = new Float64Array(n);
      for (let i = 0; i < n; i++) merged[i] = (l[i] + r[i]) / 2;
      this.buf = new AudioBuffer(merged, this.sr);
      this.left = this.right = null;
      this.isStereo = false;
    }
    return this._finalize(saveAs, playAfter);
  }

  toWavBytes() {
    if (this.isStereo) return audioIo.saveWavStereoBytes(this.left, this.right);
    return audioIo.saveWavMonoBytes(this.buf);
  }

  toString() {
    const kind = this.isStereo ? 'stereo' : 'mono';
    return `<AudioFile source=${JSON.stringify(this.source)} sr=${this.sr} ${kind} dur=${this.duration.toFixed(2)}s>`;
  }
}

module.exports = { AudioFile };
