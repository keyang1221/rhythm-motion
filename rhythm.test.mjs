import test from 'node:test';
import assert from 'node:assert/strict';
import { RhythmRound } from './rhythm.mjs';

test('judges early and late strikes around the closest beat', () => {
  const round = new RhythmRound({ start: 5000, bpm: 60, windowMs: 150, beats: 4 });
  assert.equal(round.hit(4849).kind, 'waiting');
  assert.deepEqual(round.hit(4850), { kind: 'hit', beat: 0, offset: -150 });
  assert.equal(round.hit(5000).kind, 'duplicate');
  assert.deepEqual(round.hit(6150), { kind: 'hit', beat: 1, offset: 150 });
  assert.equal(round.hit(6500).kind, 'offbeat');
  assert.deepEqual(round.hit(7000), { kind: 'hit', beat: 2, offset: 0 });
  assert.equal(round.hits, 3);
});

test('settles each unanswered beat once and preserves on-boundary input', () => {
  const round = new RhythmRound({ start: 0, bpm: 60, windowMs: 150, beats: 3 });
  assert.deepEqual(round.advance(150), []);
  assert.deepEqual(round.advance(151), [0]);
  assert.deepEqual(round.advance(999), []);
  assert.equal(round.hit(1000).kind, 'hit');
  assert.deepEqual(round.advance(2151), [2]);
  assert.equal(round.misses, 2);
  assert.equal(round.complete(2151), true);
  assert.equal(round.hit(2151).kind, 'finished');
});

test('only accepts the final beat within its window', () => {
  const round = new RhythmRound({ start: 1000, bpm: 120, windowMs: 100, beats: 2 });
  assert.equal(round.hit(1600).kind, 'hit');
  assert.equal(round.hit(1601).kind, 'finished');
});

test('rejects ambiguous overlapping timing windows', () => {
  assert.throws(() => new RhythmRound({ start: 0, bpm: 240, windowMs: 150, beats: 32 }), RangeError);
});
