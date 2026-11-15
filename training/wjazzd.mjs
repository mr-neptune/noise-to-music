// Converts the Weimar Jazz Database (WJazzD, ODbL) into the same JSONL
// feature records that extract.mjs writes: solo melody, beat-level bass line
// and chord changes on a 16th-note grid, with genre "wjazz".
// Usage: node wjazzd.mjs <wjazzd.db> <out.jsonl>
// The database already has bar/beat/tatum positions and chord symbols, so no
// beat tracking or chord detection is needed.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [dbPath, outPath] = process.argv.slice(2);
const db = new DatabaseSync(dbPath, { readOnly: true });

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (s) => (PC[s[0]] + (s[1] === 'b' ? -1 : s[1] === '#' ? 1 : 0) + 12) % 12;
// Swing-aware snapping of a position inside a beat to a 16th step (as in extract.mjs).
const GRID = [[0, 0], [0.25, 1], [1 / 3, 1], [0.5, 2], [2 / 3, 2], [0.75, 3], [1, 4]];
const snap = (x) => GRID.reduce((b, g) => (Math.abs(g[0] - x) < Math.abs(b[0] - x) ? g : b))[1];

// WJazzD chord symbols -> the engine's 11 qualities:
// '', m, 5, 7, maj7, m7, 9, m9, maj9, dim, sus4.
function quality(q) {
  q = q.split('/')[0];
  if (q.startsWith('m7b5') || q.startsWith('o')) return 9;
  if (q.startsWith('sus')) return 10;
  if (q.startsWith('-')) {
    if (q.startsWith('-j7')) return 1;
    if (q.startsWith('-7')) return q.includes('9') ? 7 : 5;
    return 1;
  }
  if (q.startsWith('j7')) return q.includes('9') ? 8 : 4;
  if (q.startsWith('+')) return q.includes('7') ? 3 : 0;
  // A natural ninth makes a 9 chord; altered ninths stay a plain 7.
  if (q.startsWith('7')) return /^79(?![b#])/.test(q) ? 6 : 3;
  return 0;
}
function parseChord(sym) {
  const m = /^([A-G][b#]?)(.*)$/.exec(sym);
  return m ? [pcOf(m[1]), quality(m[2])] : null;
}

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) {
  const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; dbb += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * dbb || 1);
}
// Key from the annotation, or estimated from the melody (Krumhansl) when it
// is missing or chromatic.
function keyOf(label, mel) {
  const m = /^([A-G][b#]?)-(maj|min|dor|mix|blues)/.exec(label || '');
  if (m) return { tonic: pcOf(m[1]), minor: m[2] === 'min' || m[2] === 'dor' };
  const h = new Array(12).fill(0);
  for (const [, len, p] of mel) h[p % 12] += len;
  let best = { r: -2 };
  for (let t = 0; t < 12; t++) {
    const rot = h.slice(t).concat(h.slice(0, t));
    const rM = corr(rot, MAJOR), rm = corr(rot, MINOR);
    if (rM > best.r) best = { r: rM, tonic: t, minor: false };
    if (rm > best.r) best = { r: rm, tonic: t, minor: true };
  }
  return { tonic: best.tonic, minor: best.minor };
}

const solos = db.prepare("SELECT melid, performer, title, key, avgtempo, style, signature FROM solo_info WHERE signature = '4/4' AND style != 'FREE'").all();
const beatsQ = db.prepare('SELECT onset, bar, beat, chord, bass_pitch FROM beats WHERE melid = ? ORDER BY onset');
const melQ = db.prepare('SELECT onset, pitch, duration, bar, beat, tatum, division FROM melody WHERE melid = ? ORDER BY onset');

const out = fs.createWriteStream(outPath);
let kept = 0, skipped = 0;
for (const s of solos) {
  const beats = beatsQ.all(s.melid);
  if (beats.length < 32 || beats.some((b) => b.beat < 1 || b.beat > 4)) { skipped++; continue; }
  const first = beats[0].bar, last = beats[beats.length - 1].bar;
  const end = (last - first + 1) * 16;
  const stepOfBeat = (b) => (b.bar - first) * 16 + (b.beat - 1) * 4;

  // Melody: positions from bar/beat/tatum; ends located on the beat grid.
  const on = beats.map((b) => b.onset);
  const stepAtTime = (t) => {
    let lo = 0, hi = on.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (on[mid] <= t) lo = mid; else hi = mid - 1; }
    const dur = lo + 1 < on.length ? on[lo + 1] - on[lo] : on[lo] - on[lo - 1];
    return stepOfBeat(beats[lo]) + Math.max(0, Math.round(((t - on[lo]) / dur) * 4));
  };
  const raw = [];
  for (const n of melQ.all(s.melid)) {
    if (n.bar < first || n.bar > last || n.beat < 1 || n.beat > 4 || !n.division) continue;
    const start = (n.bar - first) * 16 + (n.beat - 1) * 4 + snap((n.tatum - 1) / n.division);
    const stop = stepAtTime(n.onset + n.duration);
    raw.push([start, Math.max(1, stop - start), Math.round(n.pitch)]);
  }
  raw.sort((a, b) => a[0] - b[0] || b[2] - a[2]);
  const mel = [];
  for (const n of raw) {
    if (mel.length && mel[mel.length - 1][0] === n[0]) continue; // keep the higher note
    if (mel.length) { const p = mel[mel.length - 1]; p[1] = Math.max(1, Math.min(p[1], n[0] - p[0])); }
    if (n[0] < end) mel.push(n);
  }
  if (mel.length < 16) { skipped++; continue; }

  // Bass: one note per beat from the annotated bass pitch.
  const bass = [];
  for (const b of beats) if (b.bass_pitch > 0) bass.push([stepOfBeat(b), 4, b.bass_pitch]);

  // Chords: carried forward from each change, sampled at every half bar.
  const chords = new Array(end / 8).fill(null);
  let cur = null;
  const atStep = new Map();
  for (const b of beats) {
    if (b.chord) cur = b.chord === 'NC' ? null : parseChord(b.chord);
    atStep.set(stepOfBeat(b), cur);
  }
  for (let k = 0; k < chords.length; k++) chords[k] = atStep.has(k * 8) ? atStep.get(k * 8) : k ? chords[k - 1] : null;

  const key = keyOf(s.key, mel);
  out.write(JSON.stringify({
    genre: 'wjazz', path: `wjazzd:${s.melid} ${s.performer} - ${s.title}`,
    tempo: Math.round(s.avgtempo), tonic: key.tonic, minor: key.minor, end, mel, bass, chords,
  }) + '\n');
  kept++;
}
out.end(() => console.log(`kept ${kept}, skipped ${skipped}`));
