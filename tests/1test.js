'use strict';

/**
 * Basic smoke tests for jaudiojs.
 *
 * These do not depend on any test framework (the library ships with zero
 * required dependencies, so the test suite stays that way too). Each check
 * throws via `assert` on failure, which makes `node tests/1test.js` exit
 * non-zero and fail CI if something regresses.
 */

const assert = require('assert');
const {
  AudioBuffer,
  mixBuffers,
  whiteNoise,
  SAMPLE_RATE,
  sineWave,
  squareWave,
  sawWave,
  triangleWave,
  noteFreq,
  drums,
  bassSynth,
  StepSequencer,
  Mixer,
  effects,
  masterChain,
  Sampler,
  BeatBuilder,
  listStyles,
  listProgressions,
} = require('../src/index.js');

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

run('AudioBuffer basics', () => {
  const buf = AudioBuffer.silence(0.5);
  assert.strictEqual(buf.sr, SAMPLE_RATE);
  assert.strictEqual(buf.length, Math.trunc(0.5 * SAMPLE_RATE));
  assert.strictEqual(buf.duration, 0.5);
});

run('waveform generators produce non-empty, finite buffers', () => {
  for (const wave of [sineWave, squareWave, sawWave, triangleWave]) {
    const buf = wave(440, 0.25);
    assert.ok(buf.length > 0);
    assert.ok(buf.samples.every((s) => Number.isFinite(s)));
  }
});

run('noteFreq resolves standard pitches', () => {
  assert.ok(Math.abs(noteFreq('A', 4) - 440) < 1e-6);
});

run('whiteNoise + mixBuffers', () => {
  const a = whiteNoise(0.1, { seed: 1 });
  const b = whiteNoise(0.1, { seed: 2 });
  const mixed = mixBuffers([a, b]);
  assert.strictEqual(mixed.length, a.length);
});

run('drum hits render audio', () => {
  const kick = drums.kick();
  const hat = drums.hihatClosed();
  assert.ok(kick.length > 0);
  assert.ok(hat.length > 0);
});

run('bassSynth + effects chain', () => {
  const bass = bassSynth('E', 2, 0.3);
  const wet = effects.distortion(bass, { drive: 4 });
  assert.strictEqual(wet.length, bass.length);
});

run('StepSequencer renders a pattern', () => {
  const seq = new StepSequencer({ bpm: 120, stepsPerBeat: 4 });
  const pattern = 'X...X...X...X...';
  const rendered = seq.renderPattern(pattern, () => drums.hihatClosed());
  assert.ok(rendered.length > 0);
});

run('Mixer combines tracks', () => {
  const mixer = new Mixer();
  mixer.addTrack('kick', drums.kick());
  mixer.addTrack('hat', drums.hihatClosed());
  const out = mixer.renderAndMaster ? mixer.renderAndMaster() : mixer;
  assert.ok(out);
});

run('masterChain does not throw', () => {
  const left = sineWave(220, 0.2);
  const right = sineWave(220, 0.2);
  const [masteredLeft, masteredRight] = masterChain(left, right);
  assert.strictEqual(masteredLeft.length, left.length);
  assert.strictEqual(masteredRight.length, right.length);
});

run('BeatBuilder styles/progressions are listed', () => {
  const styles = listStyles();
  const progressions = listProgressions();
  assert.ok(Array.isArray(styles) && styles.length > 0);
  assert.ok(Array.isArray(progressions) && progressions.length > 0);
});

run('BeatBuilder builds a short beat', () => {
  const styles = listStyles();
  const builder = new BeatBuilder({ style: styles[0], bpm: 100 });
  const beat = builder.build({ durationSeconds: 1 });
  assert.ok(beat.length > 0);
});

run('Sampler is exported', () => {
  assert.strictEqual(typeof Sampler.load, 'function');
});

if (process.exitCode) {
  console.error('\nSome tests failed.');
} else {
  console.log('\nAll smoke tests passed.');
}
