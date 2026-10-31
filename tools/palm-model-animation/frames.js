// Export every frame of the palm-model player: node frames.js <lang> <fps> <out.jsonl>
const fs = require('fs');
const [lang, fps, outPath] = process.argv.slice(2);
const vdata = fs.readFileSync('vdata.json', 'utf8');
const els = {};
const mk = (id) => ({
  id, value: '', max: 0, step: 1, innerHTML: '', textContent: id === 'vdata' ? vdata : '', dataset: {}, listeners: {},
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, querySelectorAll() { return []; }, setAttribute() {},
});
const docL = {};
globalThis.Event = class { constructor(t) { this.type = t; } };
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 0;
globalThis.document = {
  body: { dataset: { lang } },
  getElementById: (id) => (els[id] ||= mk(id)),
  addEventListener: (t, f) => (docL[t] ||= []).push(f),
  dispatchEvent: (e) => (docL[e.type] || []).forEach((f) => f(e)),
};
(0, eval)(fs.readFileSync('video2.js', 'utf8'));
document.dispatchEvent(new Event('langchange'));
const total = +els.vSeek.max, n = Math.round(total * +fps) + 1;
const out = fs.openSync(outPath, 'w');
for (let k = 0; k < n; k++) {
  const t = Math.min(total, k / +fps);
  els.vSeek.value = String(t); els.vSeek.listeners.input[0]();
  fs.writeSync(out, JSON.stringify({ t, pad: els.vPad.innerHTML, tree: els.vTree.innerHTML }) + '\n');
}
fs.closeSync(out);
console.log('frames', n, 'total', total);
