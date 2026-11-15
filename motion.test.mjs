import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionGate } from './motion.mjs';

test('ignores unavailable sensors and static gravity', () => {
  const gate = new MotionGate();
  assert.equal(gate.read({}, 0).valid, false);
  assert.equal(gate.read({ rotationRate: { alpha: null, beta: null, gamma: null } }, 1).valid, false);
  assert.equal(gate.read({ accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } }, 2).trigger, false);
  assert.equal(gate.read({ acceleration: { x: null, y: null, z: null } }, 3).valid, false);
});

test('requires release and cooldown between movement peaks', () => {
  const gate = new MotionGate();
  const peak = { rotationRate: { beta: 300 } };
  const rest = { rotationRate: { beta: 0 } };
  assert.equal(gate.read(peak, 0).trigger, true);
  assert.equal(gate.read(peak, 250).trigger, false);
  gate.read(rest, 260);
  assert.equal(gate.read(peak, 270).trigger, true);
  gate.read(rest, 280);
  assert.equal(gate.read(peak, 300).trigger, false);
});

test('uses acceleration when rotation is unavailable and sensitivity is adjustable', () => {
  const low = new MotionGate(1);
  const high = new MotionGate(10);
  const movement = { acceleration: { x: 8, y: 0, z: 0 } };
  assert.equal(low.read(movement, 0).trigger, false);
  assert.equal(high.read(movement, 0).trigger, true);
});
