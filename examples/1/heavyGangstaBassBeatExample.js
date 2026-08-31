'use strict';

const {
  drums, StepSequencer, MelodySequencer, AdvancedMixer,
  padSynth, pianoSynth, bass808Line, effects,
  saveWavStereo, masterWithPreset,
} = require('../../src/index');

const BPM = 140;
const STEPS_PER_BEAT = 8;
const BARS = 4;
const SR = 44100;
const LOOP_DURATION = BARS * 4 * (60 / BPM);

const kit = drums.buildKit({
  K: ['kick', '808'],
  C: ['clap', 'tight'],
  H: ['hihat', 'trap'],
  O: ['hihat', 'open'],
  R: ['snare', 'rimshot'],
});

const drumPatterns = {
  K: 'X.......' + '....x...' + '..X.....' + 'X.......',
  C: '........' + '........' + 'X.......' + '........',
  H: 'x.x.x.x.' + 'x.x.x.x.' + 'x.x.x.x.' + 'x.x.xx.x',
  O: '........' + '........' + '........' + '.......X',
  R: '....x...' + '........' + '........' + '........',
};

const drumSounds = {
  K: { X: kit.K, x: [kit.K, 0.7] },
  C: { X: kit.C },
  H: { X: kit.H, x: [kit.H, 0.35] },
  O: { X: [kit.O, 0.8] },
  R: { x: [kit.R, 0.6] },
};

const seq = new StepSequencer({ bpm: BPM, stepsPerBeat: STEPS_PER_BEAT, sr: SR });
let drumBus = seq.renderKit(drumPatterns, drumSounds, { bars: BARS, swing: 0.03 });

drumBus = drumBus.slice(0.0, LOOP_DURATION);
drumBus.fadeOut(0.01);

effects.highShelf(drumBus, { freq: 6000, gainDb: -4.0 });

drumBus.normalize(0.9);

const mel = new MelodySequencer({ bpm: BPM, sr: SR });
const chords = [
  [['E', 'G', 'B'], 2, 4, 0.35],
  [['C', 'E', 'G'], 2, 4, 0.32],
  [['G', 'B', 'D'], 2, 4, 0.32],
  [['D', 'F#', 'A'], 2, 4, 0.30],
];
let droneLine = mel.render(chords, padSynth);
droneLine = droneLine.slice(0.0, LOOP_DURATION);
droneLine.fadeOut(0.01);

const stabEvents = chords.map(([chordNotes, octave, chordBeats, baseVel]) => {
  const rootNote = chordNotes[0];
  return [rootNote, octave + 1, chordBeats, baseVel * 0.8];
});
let stabLine = mel.render(stabEvents, pianoSynth);
stabLine = stabLine.slice(0.0, LOOP_DURATION);
stabLine.fadeOut(0.01);

const bassNotes = [
  ['E', 0, 4], ['C', 0, 4], ['G', 0, 4], ['D', 0, 4],
];
let bassLine = bass808Line(bassNotes, BPM, { sr: SR, glideTime: 0.18, drive: 3.0 });
bassLine = bassLine.slice(0.0, LOOP_DURATION);
bassLine.fadeOut(0.01);

const fullKickPattern = drumPatterns.K.repeat(BARS);
effects.sidechain(droneLine, fullKickPattern, { bpm: BPM, stepsPerBeat: STEPS_PER_BEAT, depth: 0.5, release: 0.18 });
effects.sidechain(stabLine, fullKickPattern, { bpm: BPM, stepsPerBeat: STEPS_PER_BEAT, depth: 0.4, release: 0.16 });
effects.sidechain(bassLine, fullKickPattern, { bpm: BPM, stepsPerBeat: STEPS_PER_BEAT, depth: 0.5, release: 0.14 });

const mixer = new AdvancedMixer(SR);
mixer.addTrack('drums', drumBus, { volume: 0.9, pan: 0.0 });
mixer.addTrack('drone', droneLine, { volume: 0.55, pan: 0.0 });
mixer.addTrack('stab', stabLine, { volume: 0.4, pan: 0.0 });
mixer.addTrack('bass808', bassLine, { volume: 1.1, pan: 0.0 });
mixer.addBus('atmosphere', ['drone', 'stab'], { volume: 1.0, pan: 0.0 });
mixer.addBus('low_end', ['bass808'], { volume: 1.25, pan: 0.0 });

const [rawLeft, rawRight] = mixer.render();
rawLeft.normalize(0.9);
rawRight.normalize(0.9);

let [left, right] = masterWithPreset(rawLeft, rawRight, {
  preset: 'warm',
  bassGain: 5.0,
  presenceGain: 1.0,
  compThreshold: -17,
  targetCrestDb: 10,
  addSaturation: 0.08,
});

const XFADE = 0.015;
const repeatsNeeded = Math.trunc(60 / LOOP_DURATION) + 2;
const totalLen = LOOP_DURATION * repeatsNeeded + 1.0;

function buildCrossfadedLoop(singleLoop) {
  const { AudioBuffer } = require('../../src/buffer');
  const target = AudioBuffer.silence(totalLen, singleLoop.sr);
  let cursor = 0.0;
  for (let i = 0; i < repeatsNeeded; i++) {
    const seg = singleLoop.copy();
    if (i > 0) seg.fadeIn(XFADE);
    if (i < repeatsNeeded - 1) seg.fadeOut(XFADE);
    target.mix(seg, { at: cursor });
    cursor += LOOP_DURATION - XFADE;
  }
  return target;
}

left = buildCrossfadedLoop(left);
right = buildCrossfadedLoop(right);

const TARGET_SECONDS = 60.0;
left = left.slice(0.0, TARGET_SECONDS);
right = right.slice(0.0, TARGET_SECONDS);

left.fadeIn(0.02).fadeOut(1.5);
right.fadeIn(0.02).fadeOut(1.5);

const OUTPUT_PATH = 'heavy_gangsta_bass_beat.wav';
saveWavStereo(OUTPUT_PATH, left, right);
console.log(`saved: ${OUTPUT_PATH}  |  duration: ${left.duration.toFixed(2)} seconds`);
