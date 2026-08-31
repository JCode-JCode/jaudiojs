'use strict';

const { BeatBuilder } = require('../../src/index');

const t0 = Date.now();

const bb = new BeatBuilder({ style: 'trap_808', bpm: 144, key: 'F#', progression: 'trap_dark' });
bb.buildAndSave('samurai_style_beat.wav', { durationMinutes: 2 });

console.log(`saved: samurai_style_beat.wav in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
