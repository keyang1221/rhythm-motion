function vectorMagnitude(vector, keys) {
  if (!vector) return null;
  const values = keys.map(key => vector[key]).filter(value => typeof value === 'number' && Number.isFinite(value));
  return values.length ? Math.hypot(...values) : null;
}

export class MotionGate {
  constructor(sensitivity = 6) {
    this.sensitivity = Math.max(1, Math.min(10, sensitivity));
    this.armed = true;
    this.lastHit = -Infinity;
    this.gravity = null;
  }

  read(event, now) {
    const rotation = vectorMagnitude(event.rotationRate, ['alpha', 'beta', 'gamma']);
    let acceleration = vectorMagnitude(event.acceleration, ['x', 'y', 'z']);
    if (acceleration === null) {
      const raw = event.accelerationIncludingGravity;
      if (raw && ['x', 'y', 'z'].every(key => typeof raw[key] === 'number' && Number.isFinite(raw[key]))) {
        const values = [raw.x, raw.y, raw.z];
        if (!this.gravity) this.gravity = [...values];
        acceleration = Math.hypot(...values.map((v, i) => v - this.gravity[i]));
        this.gravity = this.gravity.map((v, i) => v * 0.9 + values[i] * 0.1);
      }
    }
    const valid = rotation !== null || acceleration !== null;
    const strength = Math.max((rotation ?? 0) / (280 - this.sensitivity * 20), (acceleration ?? 0) / (18 - this.sensitivity * 1.4));
    if (valid && strength < 0.45) this.armed = true;
    const trigger = valid && this.armed && strength >= 1 && now - this.lastHit >= 180;
    if (trigger) {
      this.armed = false;
      this.lastHit = now;
    }
    return { valid, trigger, strength };
  }
}
