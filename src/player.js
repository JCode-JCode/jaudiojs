'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { saveWavMono, saveWavStereo } = require('./audioIo');

function _toolExists(name) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(finder, [name], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function _playWithNativeModule(wavPath) {
  const workerPath = path.join(__dirname, '_playWorker.js');
  const r = spawnSync(process.execPath, [workerPath, wavPath], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function _playWithSystemTool(wavPath) {
  const platform = os.platform();
  let result;
  if (platform === 'darwin') {
    result = spawnSync('afplay', [wavPath], { stdio: 'ignore' });
  } else if (platform === 'win32') {
    const psCmd = `(New-Object Media.SoundPlayer '${wavPath}').PlaySync();`;
    result = spawnSync('powershell', ['-c', psCmd], { stdio: 'ignore' });
  } else {
    for (const tool of ['paplay', 'aplay', 'ffplay']) {
      if (_toolExists(tool)) {
        const args = tool === 'ffplay' ? ['-nodisp', '-autoexit', '-loglevel', 'quiet', wavPath] : [wavPath];
        result = spawnSync(tool, args, { stdio: 'ignore' });
        break;
      }
    }
    if (!result) throw new Error('none of paplay/aplay/ffplay were found on this system.');
  }
  if (!result || result.error || result.status !== 0) {
    throw new Error(`playback with a system tool failed: ${result && result.error ? result.error : `exit ${result && result.status}`}`);
  }
}

function _play(wavPath) {
  if (_playWithNativeModule(wavPath)) return;
  _playWithSystemTool(wavPath);
}

function playBuffer(buf) {
  const tmpPath = path.join(os.tmpdir(), `jaudiojs-play-${process.pid}-${Date.now()}.wav`);
  try {
    saveWavMono(tmpPath, buf);
    _play(tmpPath);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {  }
  }
}

function playStereo(left, right) {
  const tmpPath = path.join(os.tmpdir(), `jaudiojs-play-${process.pid}-${Date.now()}.wav`);
  try {
    saveWavStereo(tmpPath, left, right);
    _play(tmpPath);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {  }
  }
}

module.exports = { playBuffer, playStereo };
