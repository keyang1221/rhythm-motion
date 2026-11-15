import test from 'node:test';
import assert from 'node:assert/strict';

// Browser APIs are unavailable in Node. Exercise the actual controller against
// a small DOM/audio boundary, controlling clock and resource-loading events.
class Element extends EventTarget {
  constructor(value = '') {
    super(); this.value = value; this.textContent = ''; this.disabled = false;
    this.hidden = false; this.open = false; this.checked = false;
    this.attributes = new Map(); this.classes = new Set(); this.dataset = {};
    this.classList = {
      add: x => this.classes.add(x), remove: x => this.classes.delete(x),
      toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x)
    };
    this.span = { textContent: '' };
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  querySelector() { return this.span; }
  showModal() { this.open = true; }
}
class Button extends Element {}
class Input extends Element {}
function event(type, fields = {}) {
  const result = new Event(type, { cancelable: true });
  for (const [name, value] of Object.entries(fields)) Object.defineProperty(result, name, { value });
  return result;
}

let sequence = 0;
async function setup(t, deferred = false) {
  const saved = new Map();
  const replace = (name, value) => { saved.set(name, globalThis[name]); globalThis[name] = value; };
  const elements = new Map();
  for (const id of ['pad','start','motion','settings-open','slower','faster']) elements.set(id, new Button());
  for (const [id, value] of Object.entries({bpm:'60',window:'150',sensitivity:'6',volume:'70',metronome:''})) elements.set(id, new Input(value));
  for (const id of ['settings','notice','score','feedback','pad-text','beat-lights','window-value','sensitivity-value','volume-value']) elements.set(id, new Element());
  elements.get('beat-lights').children = Array.from({length:4}, () => new Element());
  const document = new EventTarget();
  document.hidden = false;
  document.getElementById = id => elements.get(id);
  const window = new EventTarget();
  window.isSecureContext = true;
  let context;
  let plays = 0;
  class AudioContext extends EventTarget {
    constructor() { super(); this.currentTime = 0; this.state = 'suspended'; this.destination = {}; context = this; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return {gain:{value:1,setTargetAtTime(){}},connect(){return this;},disconnect(){}}; }
    createBufferSource() { return {connect(){return this;},disconnect(){},start(){plays++;},stop(){}}; }
    decodeAudioData() { return Promise.resolve({}); }
  }
  window.AudioContext = AudioContext;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const fetch = async () => { if (deferred) await ready; return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}; };
  replace('document', document); replace('window', window); replace('fetch', fetch);
  replace('HTMLInputElement', Input); replace('HTMLTextAreaElement', Input); replace('HTMLButtonElement', Button);
  replace('requestAnimationFrame', () => 1); replace('cancelAnimationFrame', () => {});
  await import(`./app.js?controller-test=${++sequence}`);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  t.after(() => {
    window.dispatchEvent(event('pagehide'));
    for (const [name, original] of saved) {
      if (original === undefined) delete globalThis[name]; else globalThis[name] = original;
    }
  });
  return { elements, window, document, flush, release,
    get context(){return context;}, get plays(){return plays;},
    async start(){ elements.get('start').dispatchEvent(event('click')); await flush(); },
  };
}

test('Space strikes even while the Start button retains focus', async t => {
  const browser = await setup(t);
  await browser.start();
  browser.context.currentTime = 4.12;
  const key = event('keydown', {code:'Space',repeat:false,target:browser.elements.get('start')});
  browser.window.dispatchEvent(key);
  // Model native button Space activation if the controller did not prevent it.
  if (!key.defaultPrevented) browser.elements.get('start').dispatchEvent(event('click'));
  assert.equal(browser.elements.get('score').value, '1 / 32');
  assert.equal(browser.elements.get('start').textContent, '停止');
});

test('pointer contact judges immediately and release cannot add another strike', async t => {
  const browser = await setup(t);
  await browser.start();
  browser.context.currentTime = 4.12;
  browser.elements.get('pad').dispatchEvent(event('pointerdown', {button:0}));
  assert.equal(browser.elements.get('score').value, '1 / 32');
  browser.context.currentTime = 4.32;
  browser.elements.get('pad').dispatchEvent(event('click', {detail:1}));
  assert.equal(browser.elements.get('pad-text').textContent, '准');
});

test('an audio interruption ends the frozen round and permits restart', async t => {
  const browser = await setup(t);
  await browser.start();
  browser.context.state = 'interrupted';
  browser.context.dispatchEvent(event('statechange'));
  assert.equal(browser.elements.get('start').textContent, '开始');
  assert.equal(browser.elements.get('bpm').disabled, false);
  assert.equal(browser.elements.get('notice').hidden, false);
  await browser.start();
  assert.equal(browser.context.state, 'running');
  assert.equal(browser.elements.get('start').textContent, '停止');
});

test('backgrounding cancels free-play strikes that are still loading', async t => {
  const browser = await setup(t, true);
  browser.elements.get('pad').dispatchEvent(event('click', {detail:0}));
  browser.document.hidden = true;
  browser.document.dispatchEvent(event('visibilitychange'));
  browser.document.hidden = false;
  browser.release();
  await browser.flush();
  assert.equal(browser.plays, 0);
});
