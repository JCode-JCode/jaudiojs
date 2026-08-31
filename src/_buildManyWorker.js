'use strict';

const fs = require('fs');
const { _buildOne } = require('./beatBuilder');

function main() {
  const [, , inFile, outHeaderFile, outBinFile] = process.argv;
  const specs = JSON.parse(fs.readFileSync(inFile, 'utf8'));

  const header = [];
  const binChunks = [];
  let offset = 0;

  const pushSamples = (float64arr) => {
    const buf = Buffer.from(float64arr.buffer, float64arr.byteOffset, float64arr.byteLength);
    binChunks.push(buf);
    const entry = { byteOffset: offset, length: float64arr.length };
    offset += buf.length;
    return entry;
  };

  for (const spec of specs) {
    try {
      const result = _buildOne(spec);
      if (typeof result === 'string') {
        header.push({ kind: 'path', value: result });
      } else {
        const [left, right] = result;
        header.push({
          kind: 'buffers',
          left: { sr: left.sr, ...pushSamples(left.samples) },
          right: { sr: right.sr, ...pushSamples(right.samples) },
        });
      }
    } catch (err) {
      header.push({ kind: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  fs.writeFileSync(outBinFile, Buffer.concat(binChunks));

  const tmpHeader = outHeaderFile + '.tmp';
  fs.writeFileSync(tmpHeader, JSON.stringify(header));
  fs.renameSync(tmpHeader, outHeaderFile);
}

main();
