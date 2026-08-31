'use strict';

const fs = require('fs');

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function _noteNumToName(noteNum) {
  const octave = Math.floor(noteNum / 12) - 1;
  const note = NOTES[noteNum % 12];
  return [note, octave];
}

class _Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  u8() { return this.buf[this.pos++]; }
  u16() { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v; }
  u32() { const v = this.buf.readUInt32BE(this.pos); this.pos += 4; return v; }
  bytes(n) { const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  ascii(n) { return this.bytes(n).toString('ascii'); }
  varLen() {
    let value = 0;
    let b;
    do {
      b = this.u8();
      value = (value << 7) | (b & 0x7f);
    } while (b & 0x80);
    return value;
  }
  eof() { return this.pos >= this.buf.length; }
}

function _parseTrackEvents(trackBuf) {
  const r = new _Reader(trackBuf);
  const events = [];
  let runningStatus = null;
  while (!r.eof()) {
    const deltaTime = r.varLen();
    let status = r.buf[r.pos];
    if (status & 0x80) { r.pos++; runningStatus = status; } else { status = runningStatus; }
    const type = status & 0xf0;
    if (status === 0xff) {
      const metaType = r.u8();
      const len = r.varLen();
      const data = r.bytes(len);
      if (metaType === 0x51 && len === 3) {
        events.push({ deltaTime, type: 'set_tempo', tempo: (data[0] << 16) | (data[1] << 8) | data[2] });
      } else if (metaType === 0x2f) {
        events.push({ deltaTime, type: 'end_of_track' });
      } else {
        events.push({ deltaTime, type: 'meta', metaType });
      }
    } else if (status === 0xf0 || status === 0xf7) {
      const len = r.varLen();
      r.bytes(len);
      events.push({ deltaTime, type: 'sysex' });
    } else if (type === 0x90) {
      const note = r.u8();
      const velocity = r.u8();
      events.push({ deltaTime, type: velocity > 0 ? 'note_on' : 'note_off', note, velocity });
    } else if (type === 0x80) {
      const note = r.u8();
      const velocity = r.u8();
      events.push({ deltaTime, type: 'note_off', note, velocity });
    } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
      r.u8(); r.u8();
      events.push({ deltaTime, type: 'other' });
    } else if (type === 0xc0 || type === 0xd0) {
      r.u8();
      events.push({ deltaTime, type: 'other' });
    } else {

      break;
    }
  }
  return events;
}

function _parseMidiFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const r = new _Reader(buf);
  if (r.ascii(4) !== 'MThd') throw new Error('not a valid MIDI file (missing MThd header)');
  const headerLen = r.u32();
  const headerEnd = r.pos + headerLen;
  r.u16();
  const nTracks = r.u16();
  const division = r.u16();
  r.pos = headerEnd;
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  const ticksPerBeat = division;
  const tracks = [];
  for (let i = 0; i < nTracks && !r.eof(); i++) {
    const id = r.ascii(4);
    const len = r.u32();
    if (id !== 'MTrk') { r.pos += len; continue; }
    tracks.push(_parseTrackEvents(r.bytes(len)));
  }
  return { ticksPerBeat, tracks };
}

function loadMidiNotes(midiPath, { track = 0 } = {}) {
  const { ticksPerBeat, tracks } = _parseMidiFile(midiPath);
  if (track >= tracks.length) {
    throw new RangeError(`Track ${track} not found. Available tracks: 0..${tracks.length - 1}`);
  }
  let tempo = 500000;
  for (const msg of tracks[track]) {
    if (msg.type === 'set_tempo') { tempo = msg.tempo; break; }
  }
  if (tempo === 500000 && tracks[0]) {
    for (const msg of tracks[0]) {
      if (msg.type === 'set_tempo') { tempo = msg.tempo; break; }
    }
  }
  const notes = [];
  const pending = new Map();
  let absTime = 0;
  for (const msg of tracks[track]) {
    absTime += msg.deltaTime;
    if (msg.type === 'note_on') {
      pending.set(msg.note, absTime);
    } else if (msg.type === 'note_off') {
      if (pending.has(msg.note)) {
        const start = pending.get(msg.note);
        pending.delete(msg.note);
        notes.push([start, msg.note, absTime - start]);
      }
    }
  }
  let endTime = absTime;
  for (const [, start] of pending) endTime = Math.max(endTime, start);
  for (const [noteNum, start] of pending) notes.push([start, noteNum, endTime - start]);
  notes.sort((a, b) => a[0] - b[0]);
  return notes.map(([, noteNum, durTicks]) => {
    const [noteName, octave] = _noteNumToName(noteNum);
    return [noteName, octave, durTicks / ticksPerBeat];
  });
}

module.exports = { loadMidiNotes };
