'use strict';

const { lowShelf, highShelf, eqBand, compressor, limiter } = require('./effects');
const { stereoWidener, haasWiden, loudnessMaximizer, exciter, saturation } = require('./effects');

const MASTER_PRESETS = {
  balanced: { bassGain: 1.5, presenceGain: 1.0, airGain: 0.5,
    compThreshold: -16, compRatio: 3.0, limiterCeiling: -0.3, width: 1.0,
    targetCrestDb: 11.0, haasMix: 0.18, haasDelayMs: 14 },
  warm: { bassGain: 3.0, presenceGain: 0.5, airGain: 0.0,
    compThreshold: -18, compRatio: 2.5, limiterCeiling: -0.5, width: 1.05,
    targetCrestDb: 12.0, haasMix: 0.15, haasDelayMs: 16 },
  bright: { bassGain: 0.5, presenceGain: 2.0, airGain: 2.5,
    compThreshold: -15, compRatio: 3.5, limiterCeiling: -0.2, width: 1.15,
    targetCrestDb: 10.0, haasMix: 0.22, haasDelayMs: 12 },
  loud_edm: { bassGain: 4.0, presenceGain: 1.5, airGain: 2.0,
    compThreshold: -20, compRatio: 6.0, limiterCeiling: -0.1, width: 1.3,
    targetCrestDb: 8.0, haasMix: 0.3, haasDelayMs: 10 },
  vocal_pop: { bassGain: 1.0, presenceGain: 3.0, airGain: 1.5,
    compThreshold: -14, compRatio: 3.0, limiterCeiling: -0.3, width: 1.0,
    targetCrestDb: 9.5, haasMix: 0.2, haasDelayMs: 13 },
};

function masterChain(left, right, {
  bassGain = 1.5, presenceGain = 1.0, airGain = 0.5,
  compThreshold = -16, compRatio = 3.0, limiterCeiling = -0.3, targetPeak = 0.98,
} = {}) {
  for (const buf of [left, right]) {
    lowShelf(buf, { freq: 100, gainDb: bassGain });
    eqBand(buf, { freq: 2500, gainDb: presenceGain, q: 1.0 });
    highShelf(buf, { freq: 10000, gainDb: airGain });
    compressor(buf, { thresholdDb: compThreshold, ratio: compRatio, attack: 0.01, release: 0.15, makeupDb: 2.0 });
    limiter(buf, { ceilingDb: limiterCeiling });
  }
  const peak = Math.max(left.peak(), right.peak());
  if (peak > 0) {
    const scale = targetPeak / peak;
    left.gain(scale);
    right.gain(scale);
  }
  return [left, right];
}

function masterChainAdvanced(left, right, {
  bassGain = 1.5, presenceGain = 1.0, airGain = 0.5,
  compThreshold = -16, compRatio = 3.0, limiterCeiling = -0.3, targetPeak = 0.98,
  width = 1.0, addExciter = false, addSaturation = 0.0,
  targetCrestDb = null, haasMix = 0.0, haasDelayMs = 15,
} = {}) {
  for (const buf of [left, right]) {
    lowShelf(buf, { freq: 100, gainDb: bassGain });
    eqBand(buf, { freq: 2500, gainDb: presenceGain, q: 1.0 });
    highShelf(buf, { freq: 10000, gainDb: airGain });
    if (addSaturation > 0) saturation(buf, { amount: addSaturation });
    if (addExciter) exciter(buf);
    compressor(buf, { thresholdDb: compThreshold, ratio: compRatio, attack: 0.01, release: 0.15, makeupDb: 2.0 });
    limiter(buf, { ceilingDb: limiterCeiling });
  }
  if (width !== 1.0) [left, right] = stereoWidener(left, right, width);
  if (haasMix > 0) [left, right] = haasWiden(left, right, { delayMs: haasDelayMs, mix: haasMix });
  if (targetCrestDb !== null) {
    loudnessMaximizer(left, { targetCrestDb, ceilingDb: limiterCeiling });
    loudnessMaximizer(right, { targetCrestDb, ceilingDb: limiterCeiling });
  }
  const peak = Math.max(left.peak(), right.peak());
  if (peak > 0) {
    const scale = targetPeak / peak;
    left.gain(scale);
    right.gain(scale);
  }
  return [left, right];
}

function masterWithPreset(left, right, { preset = 'balanced', ...overrides } = {}) {
  if (!(preset in MASTER_PRESETS)) {
    throw new RangeError(`unknown preset '${preset}'. available: ${Object.keys(MASTER_PRESETS)}`);
  }
  const params = { ...MASTER_PRESETS[preset], ...overrides };
  return masterChainAdvanced(left, right, params);
}

module.exports = { MASTER_PRESETS, masterChain, masterChainAdvanced, masterWithPreset };
