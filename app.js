import { RhythmRound } from './rhythm.mjs';
import { MotionGate } from './motion.mjs';
import { DrumAudio } from './audio.mjs';

const $ = id => document.getElementById(id);
const pad = $('pad');
const audio = new DrumAudio();
const lights = [...$('beat-lights').children];
let round = null;
let running = false;
let loading = false;
let generation = 0;
let scheduler = null;
let animation = null;
let nextSound = 0;
let origin = 0;
let displayedBeat = -1;
let flashTimer;
let sensorEnabled = false;
let sensorPending = false;
let sensorTimer;
let sensorGeneration = 0;
let motionGate = new MotionGate();

audio.onInterrupted = () => {
  if (running || loading) { finish(); notify('声音已暂停，点击开始继续'); }
};

function notify(message = '') {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}

function lockSettings(locked) {
  for (const id of ['bpm', 'slower', 'faster', 'window']) $(id).disabled = locked;
}

function setTempo(value) {
  $('bpm').value = Math.max(40, Math.min(180, Math.round(Number(value) || 60)));
}
$('bpm').addEventListener('change', () => setTempo($('bpm').value));
$('slower').addEventListener('click', () => setTempo(Number($('bpm').value) - 5));
$('faster').addEventListener('click', () => setTempo(Number($('bpm').value) + 5));
$('settings-open').addEventListener('click', () => $('settings').showModal());
$('window').addEventListener('input', () => { $('window-value').value = `±${$('window').value} ms`; });
$('sensitivity').addEventListener('input', () => {
  $('sensitivity-value').value = $('sensitivity').value;
  motionGate = new MotionGate(Number($('sensitivity').value));
});
$('volume').addEventListener('input', () => {
  $('volume-value').value = `${$('volume').value}%`;
  audio.setVolume(Number($('volume').value) / 100);
});

function flash(text, tone = '') {
  clearTimeout(flashTimer);
  $('pad-text').textContent = text;
  pad.dataset.tone = tone;
  pad.classList.add('struck');
  flashTimer = setTimeout(() => pad.classList.remove('struck'), 100);
}

function updateScore() {
  $('score').value = `${round?.hits ?? 0} / 32`;
}

function finish(completed = false) {
  generation++;
  running = false;
  loading = false;
  clearInterval(scheduler);
  cancelAnimationFrame(animation);
  clearTimeout(flashTimer);
  audio.stop();
  pad.classList.remove('struck');
  $('start').disabled = false;
  $('start').textContent = '开始';
  lockSettings(false);
  lights.forEach(light => light.classList.remove('active'));
  if (completed && round) {
    $('pad-text').textContent = `${Math.round(round.hits / round.beats * 100)}%`;
    pad.dataset.tone = 'hit';
    $('feedback').value = `${round.hits} 命中 · ${round.misses} 漏拍 · ${round.offbeats} 偏拍`;
  } else {
    $('pad-text').textContent = '敲击';
    pad.dataset.tone = '';
    $('feedback').value = '';
  }
}

function schedule() {
  if (!running || audio.context.state !== 'running') return;
  const interval = round.interval / 1000;
  // Schedule against the audio clock; UI timers never decide hit accuracy.
  while (nextSound < round.beats + 4 && origin + nextSound * interval < audio.context.currentTime + 0.12) {
    const when = origin + nextSound * interval;
    const countIn = nextSound < 4;
    if (when >= audio.context.currentTime - 0.02 && (countIn || $('metronome').checked)) {
      audio.play('example', when, countIn ? 0.55 : 0.22);
    }
    nextSound++;
  }
}

function draw() {
  if (!running) return;
  const now = audio.context.currentTime * 1000;
  const beat = Math.floor((now - origin * 1000) / round.interval);
  if (beat !== displayedBeat && beat >= 0) {
    displayedBeat = beat;
    lights.forEach((light, index) => light.classList.toggle('active', index === beat % 4));
    if (beat < 4) {
      $('pad-text').textContent = String(4 - beat);
      pad.dataset.tone = 'count';
    } else if (beat === 4) {
      $('pad-text').textContent = '敲击';
      pad.dataset.tone = '';
    }
  }
  round.advance(now);
  updateScore();
  if (round.complete(now)) { finish(true); return; }
  animation = requestAnimationFrame(draw);
}

async function start() {
  if (running || loading) { finish(); return; }
  const current = ++generation;
  loading = true;
  $('start').disabled = true;
  $('start').textContent = '…';
  notify();
  lockSettings(true);
  try {
    await audio.unlock();
    if (current !== generation || document.hidden) return;
    setTempo($('bpm').value);
    origin = audio.context.currentTime + 0.12;
    const bpm = Number($('bpm').value);
    round = new RhythmRound({ start: (origin + 4 * 60 / bpm) * 1000, bpm, windowMs: Number($('window').value), beats: 32 });
    nextSound = 0;
    displayedBeat = -1;
    running = true;
    loading = false;
    $('start').disabled = false;
    $('start').textContent = '停止';
    $('feedback').value = '';
    updateScore();
    schedule();
    scheduler = setInterval(schedule, 25);
    animation = requestAnimationFrame(draw);
  } catch (error) {
    if (current === generation) { finish(); notify(error.message || '无法播放声音，请重试'); }
  }
}
$('start').addEventListener('click', start);

async function strike() {
  if (loading) return;
  if (!running) {
    const current = generation;
    try {
      await audio.unlock();
      if (current !== generation || document.hidden) return;
      audio.play('true');
      flash('敲击', 'hit');
    } catch (error) { notify(error.message || '无法播放声音，请重试'); }
    return;
  }
  const result = round.hit(audio.context.currentTime * 1000);
  if (result.kind === 'hit') {
    audio.play('true');
    flash('准', 'hit');
    const offset = Math.round(result.offset);
    $('feedback').value = `${offset > 0 ? '+' : ''}${offset} ms`;
    updateScore();
  } else if (result.kind === 'offbeat') {
    audio.play('false');
    flash(result.offset < 0 ? '早' : '晚', 'offbeat');
    $('feedback').value = `${Math.round(result.offset)} ms`;
  }
}

// Judge contact, rather than release; synthetic clicks keep keyboard/AT access.
pad.addEventListener('pointerdown', event => { if (event.button === 0) strike(); });
pad.addEventListener('click', event => { if (event.detail === 0) strike(); });
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || $('settings').open) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (!running && event.target instanceof HTMLButtonElement && event.target !== pad) return;
  event.preventDefault();
  if (!event.repeat) strike();
});

function disableMotion() {
  sensorGeneration++;
  clearTimeout(sensorTimer);
  window.removeEventListener('devicemotion', onMotion);
  sensorEnabled = false;
  sensorPending = false;
  $('motion').disabled = false;
  $('motion').setAttribute('aria-pressed', 'false');
  $('motion').querySelector('span').textContent = '动作';
}

function onMotion(event) {
  if (document.hidden) return;
  const sample = motionGate.read(event, performance.now());
  if (sample.valid && sensorPending) {
    sensorPending = false;
    clearTimeout(sensorTimer);
    $('motion').querySelector('span').textContent = '动作已开';
  }
  if (sample.trigger) strike();
}

$('motion').addEventListener('click', async () => {
  if (sensorEnabled) { disableMotion(); notify(); return; }
  if (!window.isSecureContext) { notify('动作触发需要 HTTPS 连接'); return; }
  if (!window.DeviceMotionEvent) { notify('此设备不支持动作触发，可直接点击'); return; }
  notify();
  const current = ++sensorGeneration;
  $('motion').disabled = true;
  // Both permission and audio resume start inside the original user gesture.
  let permission;
  try {
    permission = typeof DeviceMotionEvent.requestPermission === 'function'
      ? DeviceMotionEvent.requestPermission() : Promise.resolve('granted');
  } catch (error) { permission = Promise.reject(error); }
  const ready = audio.unlock();
  try {
    const [allowed] = await Promise.all([permission, ready]);
    if (current !== sensorGeneration || document.hidden) return;
    if (allowed !== 'granted') throw new Error('动作权限未开启，可直接点击');
    motionGate = new MotionGate(Number($('sensitivity').value));
    sensorEnabled = true;
    sensorPending = true;
    $('motion').setAttribute('aria-pressed', 'true');
    $('motion').disabled = false;
    $('motion').querySelector('span').textContent = '连接中';
    window.addEventListener('devicemotion', onMotion, { passive: true });
    sensorTimer = setTimeout(() => {
      if (sensorPending) { disableMotion(); notify('未收到传感器数据，可直接点击'); }
    }, 4000);
  } catch (error) {
    if (current === sensorGeneration) {
      disableMotion();
      notify(error.name === 'NotAllowedError' ? '动作权限未开启，可直接点击' : (error.message || '动作不可用，可直接点击'));
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    finish();
    disableMotion();
    audio.stop();
  }
});
window.addEventListener('pagehide', () => { finish(); disableMotion(); });
