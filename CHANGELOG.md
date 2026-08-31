# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-31

### Added
- Initial release: JavaScript/Node.js port of [jaudiopy](https://github.com/JCode-JCode/jaudiopy).
- Waveform synthesis (`sineWave`, `squareWave`, `sawWave`, `triangleWave`) and ADSR envelopes.
- Drum machine (`drums`) with kick, snare, hi-hat, clap, tom, cowbell, shaker and more.
- Melodic instruments: `bassSynth`, `pluckSynth`, `padSynth`, `pianoSynth`, `bass808Line`.
- Step sequencing and song arrangement (`StepSequencer`, `MelodySequencer`, `Song`).
- Mixing (`Mixer`, `AdvancedMixer`, `Track`, `Bus`).
- A full effects rack (`effects`): filters, distortion, bitcrush, delay, reverb, chorus,
  tremolo, compressor, limiter, vibrato, phaser, autopan, noise gate, saturation, wah,
  exciter, sidechain, de-esser, ducking, Haas widening, and a loudness maximizer.
- Mastering chains (`masterChain`, `masterChainAdvanced`, `masterWithPreset`) with presets.
- Audio file I/O (`AudioFile`, `saveWavMono/Stereo`, `loadWav`, `loadAudio`) with optional
  `ffmpeg`/`curl` support for non-WAV formats and remote URLs.
- Sampler (`Sampler`) for pitch-shifted playback of loaded samples.
- Vocal processing chain (`vocalChain`, `mixVocalWithBeat`).
- One-call full beat generation (`BeatBuilder`, `listStyles`, `listProgressions`, `buildMany`).
- Local playback helpers (`playBuffer`, `playStereo`) and MIDI note import (`loadMidiNotes`).
- Zero required runtime dependencies; synchronous API mirroring the original Python calls.
