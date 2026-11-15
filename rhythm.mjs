export class RhythmRound {
  constructor({ start, bpm = 60, windowMs = 150, beats = 32 }) {
    if (![start, bpm, windowMs, beats].every(Number.isFinite) || bpm <= 0 || windowMs <= 0 || !Number.isInteger(beats) || beats <= 0 || windowMs >= 30000 / bpm) {
      throw new RangeError('Invalid rhythm settings');
    }
    this.start = start;
    this.interval = 60000 / bpm;
    this.windowMs = windowMs;
    this.beats = beats;
    this.results = new Map();
    this.hits = 0;
    this.misses = 0;
    this.offbeats = 0;
    this.nextExpiry = 0;
  }

  complete(now) {
    return now > this.start + (this.beats - 1) * this.interval + this.windowMs;
  }

  advance(now) {
    const missed = [];
    while (this.nextExpiry < this.beats && now > this.start + this.nextExpiry * this.interval + this.windowMs) {
      const beat = this.nextExpiry++;
      if (!this.results.has(beat)) {
        this.results.set(beat, 'miss');
        this.misses++;
        missed.push(beat);
      }
    }
    return missed;
  }

  hit(now) {
    this.advance(now);
    if (now < this.start - this.windowMs) return { kind: 'waiting' };
    if (this.complete(now)) return { kind: 'finished' };
    const beat = Math.max(0, Math.round((now - this.start) / this.interval));
    const offset = now - this.start - beat * this.interval;
    if (beat < 0 || beat >= this.beats || Math.abs(offset) > this.windowMs) {
      this.offbeats++;
      return { kind: 'offbeat', offset };
    }
    if (this.results.has(beat)) return { kind: 'duplicate' };
    this.results.set(beat, 'hit');
    this.hits++;
    return { kind: 'hit', beat, offset };
  }
}
