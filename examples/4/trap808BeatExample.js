'use strict';

const { drums, StepSequencer, AdvancedMixer, bass808Line, effects, saveWavStereo } = require('../../src/index');

const BPM = 140;

const kit = drums.buildKit({
  K: ['kick', '808'],
  C: ['clap', 'default'],
  H: ['hihat', 'trap'],
  O: ['hihat', 'open'],
});

const kickPattern = 'X.......x.......X.......x......';
const patterns = {
  C: '................X...............',
  H: 'X.XxX.XxXXXxX.XxX.XxX.XxXXXxX.Xx',
  O: '................................X',
};
const sounds = {
  C: { X: kit.C },
  H: { X: kit.H, x: [kit.H, 0.4] },
  O: { X: kit.O },
};

const seq = new StepSequencer({ bpm: BPM, stepsPerBeat: 8 });

const kickTrack = seq.renderPattern(kickPattern.repeat(2), { X: kit.K, x: [kit.K, 0.55] });
const drumBus = seq.renderKit(patterns, sounds, { bars: 2 });
drumBus.mix(kickTrack, { at: 0.0 });

const _bassNotesOneLoop = [
  ['E', 1, 3], ['E', 1, 1], ['G', 1, 2], ['E', 1, 2],
  ['D', 1, 3], ['D', 1, 1], ['C', 1, 2], ['D', 1, 2],
];
const bassNotes = _bassNotesOneLoop.concat(_bassNotesOneLoop);
const bassLine = bass808Line(bassNotes, BPM, { glideTime: 0.09, drive: 3.5 });

const fullKickPattern = kickPattern.repeat(2);
effects.sidechain(bassLine, fullKickPattern, { bpm: BPM, stepsPerBeat: 8, depth: 0.5, release: 0.12 });

const mixer = new AdvancedMixer();
mixer.addTrack('drums', drumBus, { volume: 1.0 });
mixer.addTrack('bass808', bassLine, { volume: 0.95 });
mixer.addBus('low_end', ['bass808'], { volume: 1.15, pan: 0.0 });

const [left, right] = mixer.renderAndMaster({ preset: 'loud_edm', bassGain: 3.5, addSaturation: 0.1 });

saveWavStereo('trap_808_beat.wav', left, right);
console.log('saved: trap_808_beat.wav');
