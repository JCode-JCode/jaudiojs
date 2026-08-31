'use strict';

const { saveWavStereo } = require('./audioIo');
const { seedRandom } = require('./buffer');
const drums = require('./drums');
const inst = require('./instruments');
const fx = require('./effects');
const { StepSequencer, MelodySequencer } = require('./sequencer');
const { AdvancedMixer } = require('./mixer');

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transpose(root, semitones) {
  const idx = CHROMATIC.indexOf(root);
  const total = idx + semitones;
  return [CHROMATIC[((total % 12) + 12) % 12], Math.floor(total / 12)];
}

const PROGRESSIONS = {
  minor_epic: [0, 8, 10, 5],
  minor_simple: [0, 5, 8, 7],
  trap_dark: [0, 3, 8, 5],
  single_root: [0, 0, 0, 0],
};
const MINOR_TRIAD = [0, 3, 7];

const STYLES = {
  trap_808: {
    kickVariant: '808', snareVariant: null, clapVariant: 'default', hatVariant: 'trap',
    masterPreset: 'loud_edm', bass: '808', melody: null, swing: 0.0, stepsPerBeat: 8,
    kickPattern: 'X.......x.......X.......x......',
    clapPattern: '.'.repeat(16) + 'X' + '.'.repeat(15),
    hatPattern: 'X.XxX.XxXXXxX.XxX.XxX.XxXXXxX.Xx',
    openPattern: '.'.repeat(31) + 'X',
  },
  boombap_piano: {
    kickVariant: 'acoustic', snareVariant: 'tight', clapVariant: null, hatVariant: 'closed',
    masterPreset: 'warm', bass: null, melody: 'piano', swing: 0.06, stepsPerBeat: 4,
    kickPattern: 'X.......x..X....',
    snarePattern: '....X.......X...',
    hatPattern: 'X.X.X.X.X.X.X.X.',
    openPattern: '.'.repeat(14) + 'X.',
  },
  street_hiphop: {
    kickVariant: 'punchy', snareVariant: 'fat', clapVariant: 'default', hatVariant: 'closed',
    masterPreset: 'balanced', bass: 'synth', melody: 'pluck', swing: 0.08, stepsPerBeat: 8,
    kickPattern: 'X..x..X...x.X...X..x..X...x.X.x.',
    snarePattern: '....X.......X.......X.......X...',
    clapPattern: '....X.......X.......X.......X...',
    hatPattern: 'X.XxX.XxX.XxX.XxX.XxX.XxX.XxX.Xx',
  },
  dark_melodic: {
    kickVariant: 'sub', snareVariant: 'fat', clapVariant: null, hatVariant: 'pedal',
    masterPreset: 'warm', bass: '808', melody: 'piano', swing: 0.03, stepsPerBeat: 8,
    kickPattern: 'X.......x.......X.......x......',
    snarePattern: '.'.repeat(16) + 'X' + '.'.repeat(15),
    hatPattern: 'X...X...X...X...X...X...X...X..',
  },
  minimal_bounce: {
    kickVariant: 'default', snareVariant: 'tight', clapVariant: null, hatVariant: 'closed',
    masterPreset: 'bright', bass: 'synth', melody: null, swing: 0.0, stepsPerBeat: 4,
    kickPattern: 'X.......x...X...',
    snarePattern: '....X.......X...',
    hatPattern: 'X.X.X.X.X.X.X.X.',
  },
};

class BeatBuilder {

  constructor({
    style = 'trap_808', bpm = 140, key = 'C', progression = 'minor_epic',
    loopBars = 4, sr = 44100, changeToNumpy = false, seed = null,
  } = {}) {
    if (!(style in STYLES)) throw new RangeError(`unknown style '${style}'. available: ${Object.keys(STYLES)}`);
    if (!(progression in PROGRESSIONS)) throw new RangeError(`unknown progression '${progression}'. available: ${Object.keys(PROGRESSIONS)}`);
    if (!CHROMATIC.includes(key)) throw new RangeError(`unknown key '${key}'. valid keys: ${CHROMATIC}`);
    this.styleName = style;
    this.style = STYLES[style];
    this.bpm = bpm;
    this.key = key;
    this.progression = PROGRESSIONS[progression];
    this.loopBars = loopBars;
    this.sr = sr;
    this.changeToNumpy = Boolean(changeToNumpy);
    this.seed = seed;
  }

  _kit() {
    const s = this.style;
    const mapping = { K: ['kick', s.kickVariant] };
    if (s.snareVariant) mapping.S = ['snare', s.snareVariant];
    if (s.clapVariant) mapping.C = ['clap', s.clapVariant];
    mapping.H = ['hihat', s.hatVariant];
    if (s.openPattern) mapping.O = ['hihat', 'open'];
    return drums.buildKit(mapping);
  }

  _chordNotes(rootSemitoneOffset, octave) {
    return MINOR_TRIAD.map((off) => {
      const [note, octShift] = transpose(this.key, rootSemitoneOffset + off);
      return [note, octave + octShift];
    });
  }

  _buildDrumBus() {
    const s = this.style;
    const kit = this._kit();
    const patterns = {};
    const sounds = {};
    patterns.K = s.kickPattern;
    sounds.K = { X: kit.K, x: [kit.K, 0.55] };
    if (s.snareVariant && s.snarePattern) {
      patterns.S = s.snarePattern;
      sounds.S = { X: kit.S };
    }
    if (s.clapVariant && s.clapPattern) {
      patterns.C = s.clapPattern;
      sounds.C = { X: kit.C };
    }
    patterns.H = s.hatPattern;
    sounds.H = { X: kit.H, x: [kit.H, 0.45] };
    if (s.openPattern) {
      patterns.O = s.openPattern;
      sounds.O = { X: kit.O };
    }
    const seq = new StepSequencer({ bpm: this.bpm, stepsPerBeat: s.stepsPerBeat });
    return seq.renderKit(patterns, sounds, { bars: this.loopBars, swing: s.swing });
  }

  _beatsPerChord() {
    return (this.loopBars * 4) / this.progression.length;
  }

  _buildBass() {
    const s = this.style;
    if (!s.bass) return null;
    const beatsPerChord = this._beatsPerChord();
    if (s.bass === '808') {
      const notes = this.progression.map((offset) => {
        const [note, octShift] = transpose(this.key, offset);
        return [note, 1 + octShift, beatsPerChord];
      });
      const bassLine = inst.bass808Line(notes, this.bpm, { glideTime: 0.09, drive: 3.2 });
      const fullKickPattern = s.kickPattern.repeat(this.loopBars);
      fx.sidechain(bassLine, fullKickPattern, { bpm: this.bpm, stepsPerBeat: s.stepsPerBeat, depth: 0.5, release: 0.12 });
      return bassLine;
    }
    const mel = new MelodySequencer({ bpm: this.bpm });
    const events = this.progression.map((offset) => {
      const [note, octShift] = transpose(this.key, offset);
      return [note, 2 + octShift, beatsPerChord, 0.85];
    });
    return mel.render(events, inst.bassSynth);
  }

  _buildMelody() {
    const s = this.style;
    if (!s.melody) return null;
    const beatsPerChord = this._beatsPerChord();
    const mel = new MelodySequencer({ bpm: this.bpm });
    if (s.melody === 'piano') {
      const events = this.progression.map((offset) => {
        const triad = this._chordNotes(offset, 3);
        return [triad.map((t) => t[0]), triad.map((t) => t[1]), beatsPerChord, 0.5];
      });
      return mel.render(events, inst.pianoSynth);
    }
    if (s.melody === 'pluck') {
      const events = this.progression.map((offset) => {
        const [note, octShift] = transpose(this.key, offset);
        return [note, 4 + octShift, beatsPerChord, 0.6];
      });
      return mel.render(events, inst.pluckSynth);
    }
    return null;
  }

  _applySeed() {
    if (this.seed == null) return;
    seedRandom(this.seed);
  }

  buildLoop() {
    this._applySeed();
    const drumBus = this._buildDrumBus();
    const bassLine = this._buildBass();
    const melodyLine = this._buildMelody();
    const mixer = new AdvancedMixer();
    mixer.addTrack('drums', drumBus, { volume: 1.0 });
    if (bassLine != null) {
      mixer.addTrack('bass', bassLine, { volume: 0.9 });
      mixer.addBus('low_end', ['bass'], { volume: 1.1, pan: 0.0 });
    }
    if (melodyLine != null) {
      mixer.addTrack('melody', melodyLine, { volume: 0.7 });
      mixer.addBus('melodics', ['melody'], { volume: 1.0, pan: 0.08 });
    }
    return mixer.renderAndMaster({ preset: this.style.masterPreset });
  }

  build({ durationSeconds = null, durationMinutes = null } = {}) {
    let [left, right] = this.buildLoop();
    if (durationSeconds == null && durationMinutes == null) return [left, right];
    const target = durationSeconds != null ? durationSeconds : durationMinutes * 60;
    const targetSamples = Math.trunc(target * this.sr);
    const loopSamples = left.samples.length;
    if (loopSamples === 0) return [left, right];
    if (targetSamples <= loopSamples) {
      left.samples = left.samples.slice(0, targetSamples);
      right.samples = right.samples.slice(0, targetSamples);
      return [left, right];
    }
    const nRepeats = Math.ceil(targetSamples / loopSamples);
    left.repeat(nRepeats);
    right.repeat(nRepeats);
    left.samples = left.samples.slice(0, targetSamples);
    right.samples = right.samples.slice(0, targetSamples);
    return [left, right];
  }

  buildAndSave(filePath, opts = {}) {
    const [left, right] = this.build(opts);
    saveWavStereo(filePath, left, right);
    return filePath;
  }
}

function listStyles() {
  return Object.keys(STYLES);
}

function listProgressions() {
  return Object.keys(PROGRESSIONS);
}

function _buildOne(spec) {
  const { durationSeconds = null, durationMinutes = null, saveAs = null, ...ctorOpts } = spec;
  const builder = new BeatBuilder(ctorOpts);
  const [left, right] = builder.build({ durationSeconds, durationMinutes });
  if (saveAs) {
    saveWavStereo(saveAs, left, right);
    return saveAs;
  }
  return [left, right];
}

function _chunk(arr, n) {
  const out = [];
  const size = Math.ceil(arr.length / n);
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function _sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function _buildManyParallel(specs, jobs) {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');
  const { AudioBuffer } = require('./buffer');

  const chunks = _chunk(specs, jobs).filter((c) => c.length > 0);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaudiojs-buildmany-'));
  const workerScript = path.join(__dirname, '_buildManyWorker.js');

  let children;
  try {
    children = chunks.map((chunk, i) => {
      const inFile = path.join(tmpDir, `in-${i}.json`);
      const headerFile = path.join(tmpDir, `out-${i}.json`);
      const binFile = path.join(tmpDir, `out-${i}.bin`);
      fs.writeFileSync(inFile, JSON.stringify(chunk));
      const child = spawn(process.execPath, [workerScript, inFile, headerFile, binFile], {
        stdio: 'ignore',
      });
      let spawnError = null;
      child.on('error', (e) => { spawnError = e; });
      return { child, headerFile, binFile, get spawnError() { return spawnError; } };
    });

    for (const c of children) {
      while (!fs.existsSync(c.headerFile)) {
        if (c.spawnError) throw c.spawnError;
        if (c.child.exitCode != null && c.child.exitCode !== 0) {
          throw new Error(`buildMany worker exited with code ${c.child.exitCode}`);
        }
        _sleepSync(5);
      }
    }

    const out = [];
    for (const c of children) {
      const header = JSON.parse(fs.readFileSync(c.headerFile, 'utf8'));
      const bin = fs.readFileSync(c.binFile);
      for (const item of header) {
        if (item.kind === 'error') throw new Error(item.message);
        if (item.kind === 'path') { out.push(item.value); continue; }
        const readSamples = ({ sr, byteOffset, length }) => {
          const dv = new DataView(bin.buffer, bin.byteOffset + byteOffset, length * 8);
          const samples = new Float64Array(length);
          for (let k = 0; k < length; k++) samples[k] = dv.getFloat64(k * 8, true);
          return new AudioBuffer(samples, sr);
        };
        out.push([readSamples(item.left), readSamples(item.right)]);
      }
    }
    return out;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildMany(specs, { nJobs = null, parallel = true } = {}) {
  if (!specs || specs.length === 0) return [];
  if (!parallel || specs.length === 1) return specs.map(_buildOne);
  const os = require('os');
  const jobs = Math.max(1, Math.min(nJobs || os.cpus().length || 1, specs.length));
  try {
    return _buildManyParallel(specs, jobs);
  } catch {
    return specs.map(_buildOne);
  }
}

module.exports = {
  CHROMATIC, transpose, PROGRESSIONS, MINOR_TRIAD, STYLES,
  BeatBuilder, listStyles, listProgressions, buildMany,
  _buildOne,
};
