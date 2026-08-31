'use strict';

const { AudioBuffer } = require('./buffer');
const { _panGains } = require('./effects');
const { masterWithPreset } = require('./mastering');

class Track {
  constructor(name, buf, { volume = 1.0, pan = 0.0, mute = false, solo = false } = {}) {
    this.name = name;
    this.buf = buf;
    this.volume = volume;
    this.pan = pan;
    this.mute = mute;
    this.solo = solo;
  }
}

class Bus {
  constructor(name, trackNames, { volume = 1.0, pan = 0.0 } = {}) {
    this.name = name;
    this.trackNames = trackNames;
    this.volume = volume;
    this.pan = pan;
  }
}

class Mixer {
  constructor(sr = 44100) {
    this.sr = sr;
    this.tracks = [];
  }

  addTrack(name, buf, { volume = 1.0, pan = 0.0 } = {}) {
    this.tracks.push(new Track(name, buf, { volume, pan }));
    return this;
  }

  getTrack(name) {
    return this.tracks.find((t) => t.name === name) ?? null;
  }

  _activeTracks() {
    let active = this.tracks;
    if (this.tracks.some((t) => t.solo)) active = this.tracks.filter((t) => t.solo);
    return active.filter((t) => !t.mute);
  }

  _effectiveVolumePan(track) {
    return [track.volume, track.pan];
  }

  render() {
    const active = this._activeTracks();
    if (active.length === 0) return [AudioBuffer.silence(0, this.sr), AudioBuffer.silence(0, this.sr)];
    const maxLen = Math.max(...active.map((t) => t.buf.samples.length));
    const left = new Float64Array(maxLen);
    const right = new Float64Array(maxLen);
    for (const t of active) {
      const [volume, pan] = this._effectiveVolumePan(t);
      const b = t.buf.copy().gain(volume);
      b.padTo(maxLen);
      for (let i = 0; i < maxLen; i++) {
        const [l, r] = _panGains(b.samples[i], pan);
        left[i] += l;
        right[i] += r;
      }
    }
    return [new AudioBuffer(left, this.sr), new AudioBuffer(right, this.sr)];
  }
}

class AdvancedMixer extends Mixer {
  constructor(sr = 44100) {
    super(sr);
    this.buses = [];
  }

  addBus(name, trackNames, { volume = 1.0, pan = 0.0 } = {}) {
    this.buses.push(new Bus(name, trackNames, { volume, pan }));
    return this;
  }

  setTrackFx(name, fxFn) {
    const t = this.getTrack(name);
    if (t != null) fxFn(t.buf);
    return this;
  }

  _busForTrack(name) {
    return this.buses.find((bus) => bus.trackNames.includes(name)) ?? null;
  }

  _effectiveVolumePan(track) {
    const bus = this._busForTrack(track.name);
    if (bus == null) return [track.volume, track.pan];
    const combinedPan = Math.max(-1.0, Math.min(1.0, track.pan + bus.pan));
    return [track.volume * bus.volume, combinedPan];
  }

  renderAndMaster({ preset = 'balanced', ...overrides } = {}) {
    const [left, right] = this.render();
    return masterWithPreset(left, right, { preset, ...overrides });
  }
}

module.exports = { Track, Bus, Mixer, AdvancedMixer };
