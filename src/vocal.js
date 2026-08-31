'use strict';

const { AudioBuffer } = require('./buffer');
const { highpass, eqBand, deEsser, compressor, limiter, duckUnder } = require('./effects');

function vocalChain(buf, {
  hpFreq = 90, presenceFreq = 3500, presenceDb = 3.0, deessFreq = 6500,
  compThreshold = -20, compRatio = 3.0, targetPeak = 0.9,
} = {}) {
  highpass(buf, { freq: hpFreq, q: 0.7 });
  eqBand(buf, { freq: presenceFreq, gainDb: presenceDb, q: 1.0 });
  deEsser(buf, { freq: deessFreq });
  compressor(buf, { thresholdDb: compThreshold, ratio: compRatio, attack: 0.005, release: 0.12, makeupDb: 2.0 });
  limiter(buf, { ceilingDb: -0.5 });
  buf.normalize(targetPeak);
  return buf;
}

function mixVocalWithBeat(beatLeft, beatRight, vocal, {
  vocalVolume = 1.0, duckDepth = 0.5, applyChain = true, vocalAt = 0.0, ...chainKwargs
} = {}) {
  if (![beatLeft, beatRight, vocal].every((b) => b instanceof AudioBuffer)) {
    throw new TypeError('All buffers must be AudioBuffer instances.');
  }
  if (vocalAt < 0) throw new RangeError("'vocalAt' must be >= 0");
  const v = vocal.copy();
  if (applyChain) vocalChain(v, chainKwargs);
  const sr = v.sr;
  const n = Math.max(beatLeft.samples.length, beatRight.samples.length, Math.trunc(vocalAt * sr) + v.samples.length);
  const bl = beatLeft.copy();
  const br = beatRight.copy();
  bl.padTo(n);
  br.padTo(n);
  const vPlaced = AudioBuffer.silence(n / sr, sr);
  vPlaced.mix(v, { at: vocalAt });
  duckUnder(bl, vPlaced, { depth: duckDepth });
  duckUnder(br, vPlaced, { depth: duckDepth });
  bl.mix(vPlaced, { at: 0.0, volume: vocalVolume });
  br.mix(vPlaced, { at: 0.0, volume: vocalVolume });
  const peak = Math.max(bl.peak(), br.peak());
  if (peak > 0.98) {
    const scale = 0.98 / peak;
    bl.gain(scale);
    br.gain(scale);
  }
  return [bl, br];
}

module.exports = { vocalChain, mixVocalWithBeat };
