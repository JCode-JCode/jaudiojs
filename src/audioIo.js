'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { AudioBuffer } = require('./buffer');

function _isNodeBuffer(x) {
  return Buffer.isBuffer(x) || x instanceof Uint8Array;
}

function _toInt16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-32767, Math.min(32767, Math.trunc(samples[i] * 32767.0)));
  }
  return out;
}

function _wavHeader({ nChannels, sampleRate, dataBytes }) {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(nChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  const blockAlign = nChannels * 2;
  buf.writeUInt32LE(sampleRate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

function saveWavMonoBytes(buf) {
  const int16 = _toInt16(buf.samples);
  const data = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength);
  const header = _wavHeader({ nChannels: 1, sampleRate: buf.sr, dataBytes: data.length });
  return Buffer.concat([header, data]);
}

function saveWavStereoBytes(left, right) {
  const n = Math.min(left.samples.length, right.samples.length);
  const li = _toInt16(left.samples.slice(0, n));
  const ri = _toInt16(right.samples.slice(0, n));
  const interleaved = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    interleaved[2 * i] = li[i];
    interleaved[2 * i + 1] = ri[i];
  }
  const data = Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength);
  const header = _wavHeader({ nChannels: 2, sampleRate: left.sr, dataBytes: data.length });
  return Buffer.concat([header, data]);
}

function saveWavMono(filePath, buf) {
  fs.writeFileSync(filePath, saveWavMonoBytes(buf));
  return filePath;
}

function saveWavStereo(filePath, left, right) {
  fs.writeFileSync(filePath, saveWavStereoBytes(left, right));
  return filePath;
}

function _parseWavBuffer(fileBuf) {
  if (fileBuf.toString('ascii', 0, 4) !== 'RIFF' || fileBuf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a valid WAV file (missing RIFF/WAVE header)');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= fileBuf.length) {
    const chunkId = fileBuf.toString('ascii', offset, offset + 4);
    const chunkSize = fileBuf.readUInt32LE(offset + 4);
    const body = fileBuf.subarray(offset + 8, offset + 8 + chunkSize);
    if (chunkId === 'fmt ') {
      fmt = {
        audioFormat: body.readUInt16LE(0),
        nChannels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bitsPerSample: body.readUInt16LE(14),
      };
    } else if (chunkId === 'data') {
      data = body;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (!fmt || !data) throw new Error('WAV file is missing fmt or data chunk');
  return { fmt, data };
}

function loadWavRaw(filePath) {
  const fileBuf = fs.readFileSync(filePath);
  const { fmt, data } = _parseWavBuffer(fileBuf);
  if (fmt.bitsPerSample !== 16) {
    throw new Error(`only 16-bit PCM WAV files are supported (got ${fmt.bitsPerSample}-bit)`);
  }
  const nChannels = fmt.nChannels;
  const nFrames = Math.floor(data.length / 2 / nChannels);
  const ints = new Int16Array(data.buffer, data.byteOffset, nFrames * nChannels);
  if (nChannels === 1) {
    const floats = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) floats[i] = ints[i] / 32767;
    return [[floats], fmt.sampleRate];
  }
  const left = new Float64Array(nFrames);
  const right = new Float64Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    left[i] = ints[2 * i] / 32767;
    right[i] = ints[2 * i + 1] / 32767;
  }
  return [[left, right], fmt.sampleRate];
}

function loadWav(filePath) {
  const [channels, sr] = loadWavRaw(filePath);
  if (channels.length === 1) return new AudioBuffer(channels[0], sr);
  return [new AudioBuffer(channels[0], sr), new AudioBuffer(channels[1], sr)];
}

function isUrl(pathOrUrl) {
  try {
    const u = new URL(pathOrUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function _tempPath(ext) {
  return path.join(os.tmpdir(), `jaudiojs-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function _curlAvailable() {
  const r = spawnSync('curl', ['--version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function _powershellAvailable() {
  const r = spawnSync('powershell', ['-Command', 'exit 0'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function downloadToTemp(url) {
  const ext = path.extname(new URL(url).pathname) || '.wav';
  const tmpPath = _tempPath(ext);
  if (_curlAvailable()) {
    const r = spawnSync(
      'curl',
      ['-fsSL', '-A', 'jaudiojs/1.0.0', '-o', tmpPath, '--', url],
      { stdio: 'ignore' }
    );
    if (r.error || r.status !== 0) {
      throw new Error(`failed to download '${url}' (curl exit code ${r.status})`);
    }
    return tmpPath;
  }
  if (_powershellAvailable()) {
    const r = spawnSync('powershell', [
      '-Command',
      `Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${tmpPath.replace(/'/g, "''")}' -UserAgent 'jaudiojs/1.0.0'`,
    ], { stdio: 'ignore' });
    if (r.error || r.status !== 0) {
      throw new Error(`failed to download '${url}' (PowerShell exit code ${r.status})`);
    }
    return tmpPath;
  }
  throw new Error(
    `cannot download '${url}': no 'curl' or PowerShell found on PATH. ` +
      `install curl (e.g. 'apt install curl' / 'brew install curl') to load audio from a URL, ` +
      `or download the file yourself and pass a local path instead.`
  );
}

function _ffmpegAvailable() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function _ensureWav(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.wav') return [filePath, false];
  if (!_ffmpegAvailable()) {
    throw new Error(
      `format '${ext}' is not supported directly. install ffmpeg on your system to support ` +
        `mp3/ogg/flac/... (e.g. 'apt install ffmpeg' / 'brew install ffmpeg') -- or use a wav file instead.`
    );
  }
  const outPath = _tempPath('.wav');
  const r = spawnSync('ffmpeg', ['-y', '-i', filePath, outPath], { stdio: 'ignore' });
  if (r.status !== 0) throw new Error(`ffmpeg failed to convert '${filePath}' to WAV`);
  return [outPath, true];
}

function _ensureWavFromTemp(tmpPath) {
  try {
    loadWavRaw(tmpPath);
    return [tmpPath, false];
  } catch {
    return _ensureWav(tmpPath);
  }
}

function _bytesFromSource(source) {
  if (_isNodeBuffer(source)) return Buffer.from(source);
  return null;
}

function resolveSource(source) {
  const cleanup = [];
  const inMemory = _bytesFromSource(source);
  if (inMemory != null) {
    const tmpPath = _tempPath('.wav');
    fs.writeFileSync(tmpPath, inMemory);
    cleanup.push(tmpPath);
    const [wavPath, converted] = _ensureWavFromTemp(tmpPath);
    if (converted) cleanup.push(wavPath);
    return [wavPath, cleanup];
  }
  if (isUrl(source)) {
    const downloaded = downloadToTemp(source);
    cleanup.push(downloaded);
    const [wavPath, converted] = _ensureWav(downloaded);
    if (converted) cleanup.push(wavPath);
    return [wavPath, cleanup];
  }
  if (!fs.existsSync(source)) {
    throw new Error(`file or link not found: ${source}`);
  }
  const [wavPath, converted] = _ensureWav(source);
  if (converted) cleanup.push(wavPath);
  return [wavPath, cleanup];
}

function loadAudio(pathOrUrl) {
  const [wavPath, cleanup] = resolveSource(pathOrUrl);
  try {
    return loadWav(wavPath);
  } finally {
    for (const p of cleanup) {
      try { fs.unlinkSync(p); } catch {  }
    }
  }
}

module.exports = {
  saveWavMono, saveWavStereo, saveWavMonoBytes, saveWavStereoBytes,
  loadWavRaw, loadWav, isUrl, downloadToTemp, resolveSource, loadAudio,
};
