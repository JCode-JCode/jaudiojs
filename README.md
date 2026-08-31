[![Node.js Version](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![npm version](https://img.shields.io/npm/v/jaudiojs)](https://www.npmjs.com/package/jaudiojs)
[![npm project](https://img.shields.io/badge/npm-jaudiojs-blue)](https://www.npmjs.com/package/jaudiojs)

<br>

<img src="docs/images/jaudiojs-logo.png" alt="jaudiojs">

<br>

**jaudiojs** is a JavaScript/Node.js library for beat making, sound synthesis, mixing, mastering, and processing existing audio files. It ships with drum machines, step sequencers, melodic synths, samplers, a vocal-mixing chain, a one-call full-beat builder, and MIDI import — all through a simple, consistent, fully synchronous API and with **zero required dependencies**.

It is a faithful JavaScript port of the Python [**jaudiopy**](https://github.com/JCode-JCode/jaudiopy) library: every class and function shape mirrors the Python original (renamed to normal JS `camelCase` conventions), so anything you already know from jaudiopy transfers mechanically to jaudiojs.

---

## Quick Start – Build and Save a Beat in a Few Lines

```javascript
const { AudioFile, BeatBuilder } = require('jaudiojs');

// One-call full beat
const bb = new BeatBuilder({ style: 'trap_808', bpm: 140, key: 'E' });
bb.buildAndSave('my_beat.wav', { durationMinutes: 2.5 });

// Process an existing audio file
const song = AudioFile.load('song.wav');
song.addEffect('reverb', 'song_reverb.wav', { roomSize: 0.7, mix: 0.4 });
```

Every call in jaudiojs — including loading audio from a URL — is **synchronous**, exactly like the Python original. No `async`/`await` anywhere in this library.

---

## Main Capabilities

· **Synthesis** – `sineWave`, `squareWave`, `sawWave`, `triangleWave`, ADSR envelopes (`envelopeAdsr`, `applyEnvelope`), and note-name-to-frequency resolution (`noteFreq`).

· **Drum Machine** – `drums` ships kick (including 808/sub/acoustic/punchy variants), snare, hi-hat (closed/open/trap/pedal), rimshot, ride, crash, clap, tom, cowbell, shaker, tambourine, conga, clave, woodblock, and triangle — each independently tunable.

· **Melodic Instruments** – `bassSynth`, `pluckSynth`, `padSynth`, `pianoSynth`, and a glide-enabled `bass808Line` for trap-style 808 basslines.

· **Sequencing & Arrangement** – `StepSequencer` and `MelodySequencer` render `X`/`x`/`.` pattern strings (with swing) into audio; `Song` arranges sections into a full track.

· **Mixing** – `Mixer` and `AdvancedMixer` with `Track`/`Bus` support volume, pan, mute, and solo across many simultaneous tracks.

· **Effects Rack** – filters (lowpass/highpass/EQ band/shelves), distortion, bitcrush, delay, reverb, chorus, tremolo, vibrato, phaser, autopan, wah, exciter, saturation, compressor, limiter, noise gate, de-esser, sidechain ducking, Haas stereo widening, and a loudness maximizer — all in `effects`.

· **Mastering** – `masterChain`, `masterChainAdvanced`, and `masterWithPreset` (with `MASTER_PRESETS` like `balanced`, `warm`, `bright`, `loud_edm`, `vocal_pop`) turn a raw stereo mix into a finished master in one call.

· **Beat Builder** – `BeatBuilder` generates a complete, styled beat (drums, bass, chords, arrangement) from a handful of options; `buildMany` renders several specs in parallel across real OS processes.

· **Audio File I/O** – `AudioFile`, `saveWavMono`/`saveWavStereo`, `loadWav`, and `loadAudio` read/write 16-bit PCM WAV natively, with optional `ffmpeg` support for other formats and optional `curl`/PowerShell support for loading from `http(s)://` URLs.

· **Sampler & Vocals** – `Sampler` for pitch-shifted playback and chopping of loaded samples; `vocalChain` and `mixVocalWithBeat` for mixing vocals over an instrumental.

· **MIDI Import** – `loadMidiNotes` reads tempo and note on/off events from a MIDI file with a small built-in parser (no external MIDI dependency).

· **Bit-Identical RNG with Python** – `seedRandom`/`Random` is a direct port of CPython's MT19937, so seeded noise generation produces the exact same output in both languages.

· **Local Playback** – `playBuffer`/`playStereo` try the optional [`speaker`](https://www.npmjs.com/package/speaker) package first, then fall back to a system audio tool (`afplay`/`paplay`/`aplay`/`ffplay`/PowerShell).

---

## Installation

```bash
npm install jaudiojs
```

The core library (local files, synthesis, effects, mixing, mastering, the beat builder) has **zero required dependencies**. Two optional pieces unlock extra features, exactly like jaudiopy's own optional dependencies:

- **`ffmpeg`** on `PATH` — for reading/writing non-WAV formats (mp3/ogg/flac/...).
- **`curl`** on `PATH` (or PowerShell on Windows) — for loading audio from an `http(s)://` URL. Local files and in-memory bytes never need this.
- **[`speaker`](https://www.npmjs.com/package/speaker)** (optional peer dependency) — for native local playback via `playBuffer`/`playStereo`; without it, playback falls back to a system tool.

Without them you still get the full library minus those specific features — you'll get a clear error naming what to install only if you actually hit a non-WAV file, a URL, or playback with no system tool available.

---

## More Examples

### Drums and the X/x/. pattern language

```javascript
const { drums, StepSequencer } = require('jaudiojs');

const kit = drums.buildKit({
  K: ['kick', '808'],
  S: ['snare', 'fat'],
  H: ['hihat', 'trap'],
});
const seq = new StepSequencer({ bpm: 140 });
const track = seq.renderKit(
  { K: 'X...x...X...x...', S: '....X.......X...', H: 'X.X.X.X.X.X.X.X.' },
  {
    K: { X: kit.K, x: [kit.K, 0.5] },
    S: { X: kit.S },
    H: { X: kit.H, x: [kit.H, 0.4] },
  },
);
```

### Sampling

```javascript
const { Sampler } = require('jaudiojs');

const sampler = Sampler.load('piano_note_C4.wav', { baseNote: 'C', baseOctave: 4 });
const note = sampler.playNote('D#', 4, 1.0);
const loop = sampler.loopTo(8.0);
const chops = sampler.chop(8);
```

### Adding vocals over a beat

```javascript
const { mixVocalWithBeat } = require('jaudiojs');

const [finalLeft, finalRight] = mixVocalWithBeat(beatLeft, beatRight, vocalBuffer, { vocalAt: 8.0 });
```

### Mastering with a preset

```javascript
const { masterWithPreset } = require('jaudiojs');

const [left, right] = masterWithPreset(rawLeft, rawRight, {
  preset: 'loud_edm', targetCrestDb: 7.0, haasMix: 0.4,
});
```

### List available beat styles and chord progressions

```javascript
const { listStyles, listProgressions } = require('jaudiojs');

console.log(listStyles());
console.log(listProgressions());
```

---

## Bundled Examples

`examples/` contains four full, runnable beats:

| File | What it builds |
|---|---|
| `examples/1/heavyGangstaBassBeatExample.js` | A hand-built 1-minute dark trap/gangsta beat — full library walkthrough (drums, drone, stab, 808, sidechain, bus mixing, mastering-preset reasoning, seamless loop crossfading). |
| `examples/2/melancholicBeatExample.js` | An 85 BPM piano beat with sidechained chords. |
| `examples/3/beatbuilderExample.js` | The one-call `BeatBuilder` shortcut. |
| `examples/4/trap808BeatExample.js` | A hihat-roll-heavy 140 BPM trap beat with a glide 808 bass. |

Run any of them with:

```bash
node examples/1/heavyGangstaBassBeatExample.js
```

or via the matching npm script (`npm run example:1`, `example:2`, `example:3`, `example:4`).

---

## The One Calling-Convention Difference from jaudiopy

JavaScript has no keyword-argument syntax, so `fn(x, freq=800, q=0.9)` from Python becomes a trailing **options object** in jaudiojs: `fn(x, { freq: 800, q: 0.9 })`. A few other mechanical rules carry over the same way:

- Python `snake_case` → JS `camelCase` for every function, method, and variable name.
- Python `PascalCase` classes stay `PascalCase` (`AudioBuffer`, `StepSequencer`, `AdvancedMixer`, `BeatBuilder`, ...).
- A Python function returning a `tuple` (e.g. `(left, right)`) returns a JS **array** you destructure the same way: `const [left, right] = ...`.
- `len(buf)` / `buf.samples` → `buf.length` / `buf.samples` (a `Float64Array`).
- `buf.to_list()` → `buf.toArray()`.

Everything else — RNG, `buildMany` parallelism, and every I/O call being synchronous — is a bit-for-bit or behavior-for-behavior match with the Python original.

---

## Running Tests

```bash
npm test
```

---

## Issues and Contributions

Bug reports and feature requests are welcome via GitHub Issues. Pull requests should maintain the existing code style and include tests where appropriate.

---

## Links

· **Original Python library (jaudiopy):**
https://github.com/JCode-JCode/jaudiopy

· **GitHub repository (jaudiojs):**


· **npm page:**
https://www.npmjs.com/package/jaudiojs

---

## License

This project is licensed under the Apache License 2.0 – see the LICENSE file for details.

---

Designed and built with love by **J Code**
