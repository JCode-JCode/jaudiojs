'use strict';

const fs = require('fs');

function _parseWav(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a valid WAV file (missing RIFF/WAVE header)');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + chunkSize);
    if (chunkId === 'fmt ') {
      fmt = {
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

function main() {
  const wavPath = process.argv[2];

  let Speaker;
  try {

    Speaker = require('speaker');
  } catch {
    process.exit(2);
    return;
  }

  let fmt;
  let data;
  try {
    ({ fmt, data } = _parseWav(wavPath));
  } catch (err) {
    process.stderr.write(String((err && err.message) || err));
    process.exit(1);
    return;
  }

  let speaker;
  try {
    speaker = new Speaker({
      channels: fmt.nChannels,
      bitDepth: fmt.bitsPerSample,
      sampleRate: fmt.sampleRate,
      signed: true,
      float: false,
    });
  } catch (err) {
    process.stderr.write(String((err && err.message) || err));
    process.exit(1);
    return;
  }

  speaker.on('close', () => process.exit(0));
  speaker.on('error', (err) => {
    process.stderr.write(String((err && err.message) || err));
    process.exit(1);
  });

  speaker.end(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
}

main();
