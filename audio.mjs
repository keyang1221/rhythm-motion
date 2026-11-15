export class DrumAudio {
  constructor() {
    this.context = null;
    this.loading = null;
    this.buffers = {};
    this.voices = new Set();
    this.volume = 0.7;
  }

  // Invoke directly from a click, before awaiting network work.
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return Promise.reject(new Error('当前浏览器不支持音频'));
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.context.addEventListener('statechange', () => {
        if (['suspended', 'interrupted', 'closed'].includes(this.context.state)) this.onInterrupted?.();
      });
    }
    const resume = this.context.resume();
    if (!this.loading) {
      this.loading = Promise.all(['example', 'true', 'false'].map(async name => {
        const response = await fetch(new URL(`./${name}.wav`, import.meta.url));
        if (!response.ok) throw new Error('音效加载失败，请重试');
        this.buffers[name] = await this.context.decodeAudioData(await response.arrayBuffer());
      })).catch(error => { this.loading = null; throw error; });
    }
    return Promise.all([resume, this.loading]).then(() => {
      if (this.context.state !== 'running') throw new Error('请再次点击以开启声音');
    });
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  play(name, when = this.context.currentTime, gain = 1) {
    if (!this.buffers[name] || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    const level = this.context.createGain();
    source.buffer = this.buffers[name];
    level.gain.value = gain;
    source.connect(level).connect(this.master);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); level.disconnect(); };
    source.start(Math.max(when, this.context.currentTime));
  }

  stop() {
    for (const source of this.voices) source.stop();
    this.voices.clear();
  }
}
