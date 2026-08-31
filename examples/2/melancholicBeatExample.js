'use strict';

const { drums, StepSequencer, MelodySequencer, AdvancedMixer, pianoSynth, effects, saveWavStereo } = require('../../src/index');

const BPM = 85;

const kit = drums.buildKit({
  K: ['kick', 'acoustic'],
  S: ['snare', 'tight'],
  H: ['hihat', 'closed'],
  O: ['hihat', 'open'],
});

const drumPatterns = {
  K: 'X.......x..X....',
  S: '....X.......X...',
  H: 'X.X.X.X.X.X.X.X.',
  O: '..............X.',
};
const drumSounds = {
  K: { X: kit.K, x: [kit.K, 0.6] },
  S: { X: kit.S },
  H: { X: kit.H, x: [kit.H, 0.4] },
  O: { X: kit.O },
};

const seq = new StepSequencer({ bpm: BPM, stepsPerBeat: 4 });
const drumBus = seq.renderKit(drumPatterns, drumSounds, { bars: 4, swing: 0.05 });

const mel = new MelodySequencer({ bpm: BPM });
const _progressionOneLoop = [
  [['C', 'D#', 'G'], 3, 2, 0.55],
  [['G#', 'C', 'D#'], 2, 2, 0.55],
  [['A#', 'D', 'F'], 2, 2, 0.55],
  [['G', 'A#', 'D'], 2, 2, 0.55],
];
const progression = _progressionOneLoop.concat(_progressionOneLoop);
const pianoLine = mel.render(progression, pianoSynth);

effects.sidechain(pianoLine, drumPatterns.K.repeat(4), { bpm: BPM, stepsPerBeat: 4, depth: 0.55, release: 0.18 });

const mixer = new AdvancedMixer();
mixer.addTrack('drums', drumBus, { volume: 1.0 });
mixer.addTrack('piano', pianoLine, { volume: 0.8 });
mixer.addBus('melodics', ['piano'], { volume: 1.0, pan: 0.0 });

const [left, right] = mixer.renderAndMaster({ preset: 'warm', addSaturation: 0.15 });

saveWavStereo('melancholic_beat.wav', left, right);
console.log('saved: melancholic_beat.wav');
