'use strict';

const { AudioBuffer, mixBuffers, whiteNoise, SAMPLE_RATE, seedRandom } = require('./buffer');
const {
  sineWave, squareWave, sawWave, triangleWave,
  noteFreq, applyEnvelope, envelopeAdsr,
  resampleLinear, changeSpeed, pitchShiftSemitones,
} = require('./synth');
const drums = require('./drums');
const { bassSynth, pluckSynth, padSynth, pianoSynth, bass808Line } = require('./instruments');
const { StepSequencer, MelodySequencer, Song } = require('./sequencer');
const { Mixer, AdvancedMixer, Track, Bus } = require('./mixer');
const effects = require('./effects');
const { masterChain, masterChainAdvanced, masterWithPreset, MASTER_PRESETS } = require('./mastering');
const {
  saveWavMono, saveWavStereo, loadWav, loadAudio, resolveSource, isUrl,
  saveWavMonoBytes, saveWavStereoBytes,
} = require('./audioIo');
const { AudioFile } = require('./audioFile');
const { Sampler } = require('./sampler');
const { vocalChain, mixVocalWithBeat } = require('./vocal');
const { BeatBuilder, listStyles, listProgressions, buildMany } = require('./beatBuilder');
const { playBuffer, playStereo } = require('./player');
const { loadMidiNotes } = require('./midi');

const VERSION = '1.0.0';
const AUTHOR = 'J Code (ported to JS)';
const LICENSE = 'Apache-2.0';

module.exports = {
  VERSION, AUTHOR, LICENSE,
  AudioFile,
  AudioBuffer, mixBuffers, whiteNoise, SAMPLE_RATE, seedRandom,
  sineWave, squareWave, sawWave, triangleWave, noteFreq,
  applyEnvelope, envelopeAdsr,
  resampleLinear, changeSpeed, pitchShiftSemitones,
  drums, bassSynth, pluckSynth, padSynth, pianoSynth, bass808Line,
  StepSequencer, MelodySequencer, Song, Mixer, AdvancedMixer, Track, Bus, effects,
  masterChain, masterChainAdvanced, masterWithPreset, MASTER_PRESETS,
  saveWavMono, saveWavStereo, loadWav, loadAudio, resolveSource, isUrl,
  saveWavMonoBytes, saveWavStereoBytes,
  Sampler,
  vocalChain, mixVocalWithBeat,
  BeatBuilder, listStyles, listProgressions, buildMany,
  playBuffer, playStereo,
  loadMidiNotes,
};
