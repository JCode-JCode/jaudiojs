'use strict';

const { AudioBuffer, mixBuffers } = require('./buffer');

const DEFAULT_VELOCITY = { X: 1.0, x: 0.6 };

class StepSequencer {
  constructor({ bpm = 120, stepsPerBeat = 4, sr = 44100 } = {}) {
    this.bpm = bpm;
    this.stepsPerBeat = stepsPerBeat;
    this.sr = sr;
  }

  get stepDuration() {
    return 60 / this.bpm / this.stepsPerBeat;
  }

  _resolve(ch, soundFn) {
    if (ch === '.') return [null, 0.0];
    if (typeof soundFn === 'function') {

      const vel = ch === ch.toUpperCase() ? 1.0 : 0.6;
      return [soundFn, vel];
    }

    const entry = soundFn[ch];
    if (entry == null) return [null, 0.0];
    if (Array.isArray(entry)) return [entry[0], entry[1]];
    const vel = DEFAULT_VELOCITY[ch] ?? (ch === ch.toUpperCase() ? 1.0 : 0.6);
    return [entry, vel];
  }

  renderPattern(pattern, soundFn, { swing = 0.0 } = {}) {
    const stepDur = this.stepDuration;
    const totalLen = Math.trunc(pattern.length * stepDur * this.sr);
    const track = AudioBuffer.silence(totalLen / this.sr, this.sr);
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      const [fn, velocity] = this._resolve(ch, soundFn);
      if (fn == null) continue;
      const offset = i % 2 === 1 ? stepDur * swing : 0.0;
      const t = i * stepDur + offset;
      const sample = fn();
      sample.gain(velocity);
      track.mix(sample, { at: t });
    }
    return track;
  }

  renderKit(patterns, sounds, { bars = 1, volumes = null, swing = 0.0 } = {}) {
    const tracks = [];
    const names = [];
    for (const [name, pattern] of Object.entries(patterns)) {
      const fullPattern = pattern.repeat(bars);
      tracks.push(this.renderPattern(fullPattern, sounds[name], { swing }));
      names.push(name);
    }
    volumes = volumes || {};
    return mixBuffers(tracks, names.map((n) => volumes[n] ?? 1.0));
  }
}

class MelodySequencer {
  constructor({ bpm = 120, sr = 44100 } = {}) {
    this.bpm = bpm;
    this.sr = sr;
  }

  beatSeconds(beats) {
    return (beats * 60) / this.bpm;
  }

  render(events, instrumentFn) {
    const totalBeats = events.reduce((acc, e) => acc + e[2], 0);
    const totalLen = Math.trunc(this.beatSeconds(totalBeats) * this.sr) + 1;
    const track = AudioBuffer.silence(totalLen / this.sr, this.sr);
    let t = 0.0;
    for (const [notes, octave, beats, velocity] of events) {
      const dur = this.beatSeconds(beats);
      if (notes != null) {
        const noteList = Array.isArray(notes) ? notes : [notes];
        const octList = Array.isArray(octave) ? octave : noteList.map(() => octave);
        for (let i = 0; i < noteList.length; i++) {
          const sample = instrumentFn(noteList[i], octList[i], dur);
          sample.gain(velocity);
          track.mix(sample, { at: t });
        }
      }
      t += dur;
    }
    return track;
  }
}

class Song {
  constructor(sr = 44100) {
    this.sr = sr;
    this.sections = [];
  }

  addSection(buf) {
    this.sections.push(buf);
    return this;
  }

  render() {
    const out = AudioBuffer.silence(0, this.sr);
    for (const section of this.sections) out.append(section);
    return out;
  }
}

module.exports = { DEFAULT_VELOCITY, StepSequencer, MelodySequencer, Song };
