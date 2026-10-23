import {Game, clamp, CONTACT_MS, PLATFORM_WIDTH_SCALE} from './core.mjs';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const heightEl = document.querySelector('#height'), pbEl = document.querySelector('#pb');
const saveEl = document.querySelector('#save');
const gameoverEl = document.querySelector('#gameover'), gameoverCauseEl = document.querySelector('#gameover-cause');
const runResultEl = document.querySelector('#run-result'), recordStatusEl = document.querySelector('#record-status');
const recordGapEl = document.querySelector('#record-gap');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
let pb = 0;
try {
  const saved = Number(localStorage.getItem('ametsuta-v3-pb'));
  pb = Number.isFinite(saved) ? Math.max(0, saved) : 0;
} catch { saveEl.hidden = false; }
const game = new Game(seed, pb);
let w = 0, h = 0, scale = 1, dpr = 1, pointer = null;
let lastFrame = performance.now(), stalls = [], lastSaved = pb;
const hint = document.querySelector('footer'), brand = document.querySelector('header > span');
const hud = document.querySelector('header'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
const visual = {
  run: game.runIndex, phase: game.phase, hintDismissed: false, pbAt: null, dewAt: null,
  runPbStart: game.pb
};
const ambientVisual = {rainLull: 0, gust: 0, bird: 0, light: 0};
const preview = {valid: false, run: -1, index: -1, release: null, next: -1, width: 0};
const contact = {
  active: false, at: null, droplet: false, reward: false, x: 0, y: 0, index: -1, delta: 0,
  fromX: 0, fromY: 0, leafX: 0, leafY: 0, width: 0, r: 0, quality: 'normal', edgeRatio: 0
};
const support = {x: game.pivot.x, y: game.pivot.y, width: game.width};
const active = {}, following = {}, settled = {}, supportView = {}, tip = {x: 0, y: 0};
const layout = {hint: {}, brand: {}, hud: {}};
const audio = {
  ctx: null, master: null, sfx: null, music: null, noise: null, supported: true, unlocked: false,
  lastCue: null, cueCount: 0, missRelease: null, musicTimer: null, musicStep: 0,
  growOsc: null, growGain: null, growNoise: null, growNoiseGain: null, growFilter: null,
  growPitchHz: 88, growFilterHz: 480
};
const GROW_AUDIO_WORLD_REF = 80;
let mist, afterglow, lowMist, vignette, rainbreak;
const sx = x => w / 2 + x * scale;
const sy = y => h * .64 - (y - game.camera) * scale;
function measureBox(el, out, origin) {
  const r = el.getBoundingClientRect();
  Object.assign(out, {x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height});
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  w = rect.width; h = rect.height;
  dpr = Math.min(devicePixelRatio || 1, 2);
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  scale = Math.max(.1, Math.min(w / 120, (h - 190) / 155));
  mist = ctx.createRadialGradient(w * .72, h * .26, 0, w * .72, h * .26, w * .8);
  mist.addColorStop(0, '#CFE2D724'); mist.addColorStop(.42, '#8FB9AD0E'); mist.addColorStop(1, '#B7D0C300');
  afterglow = ctx.createRadialGradient(w * .62, h * .06, 0, w * .62, h * .06, Math.max(w, h) * .72);
  afterglow.addColorStop(0, '#E6B48D1C'); afterglow.addColorStop(.3, '#C9957710'); afterglow.addColorStop(1, '#C9957700');
  lowMist = ctx.createRadialGradient(w * .15, h * .72, 0, w * .15, h * .72, Math.max(w, h) * .56);
  lowMist.addColorStop(0, '#A9CEC515'); lowMist.addColorStop(.5, '#7AA79F09'); lowMist.addColorStop(1, '#7AA79F00');
  vignette = ctx.createRadialGradient(w * .5, h * .48, Math.min(w, h) * .18, w * .5, h * .48, Math.max(w, h) * .72);
  vignette.addColorStop(.42, '#081F2400'); vignette.addColorStop(1, '#081F2433');
  rainbreak = ctx.createRadialGradient(w * .78, h * .15, 0, w * .78, h * .15, Math.max(110, w * .42));
  rainbreak.addColorStop(0, '#FFF0D28A');
  rainbreak.addColorStop(.12, '#EEC99B54');
  rainbreak.addColorStop(.38, '#D9AA7B24');
  rainbreak.addColorStop(1, '#D9AA7B00');
  // Hidden text keeps its layout box; no layout reads in the animation loop.
  measureBox(hint, layout.hint, rect); measureBox(brand, layout.brand, rect); measureBox(hud, layout.hud, rect);
}
new ResizeObserver(resize).observe(canvas);
resize();
function project(out, target, width, r = 0) {
  out.x = sx(target.x); out.y = sy(target.y); out.half = width * scale / 2;
  out.depth = clamp(.23 * width * scale, 7, 16); out.r = r * scale;
  out.t = r ? clamp(1.9 * out.r, 10, 17) : 0;
}
function circleHole(x, y, r) {
  ctx.beginPath(); ctx.rect(-100, -100, w + 200, h + 200);
  ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip('evenodd');
}
function boxHole(x, y, width, height) {
  ctx.beginPath(); ctx.rect(-100, -100, w + 200, h + 200); ctx.rect(x, y, width, height); ctx.clip('evenodd');
}
function rimMask(l) {
  boxHole(l.x - l.half - 2, l.y - 2, 2 * l.half + 4, 4);
  circleHole(l.x - l.half, l.y, 3); circleHole(l.x + l.half, l.y, 3);
}
function protect(hasNext, miss) {
  circleHole(sx(tip.x), sy(tip.y), 2.5); rimMask(active);
  if (hasNext) rimMask(following);
  boxHole(active.x - active.r - 1, active.y - active.t - 1, 2 * active.r + 2, active.t + 2);
  if (miss) {
    const x = sx(tip.x), y = sy(tip.y);
    const ex = x < active.x ? active.x - active.half : active.x + active.half;
    const len = Math.hypot(ex - x, active.y - y);
    if (len <= 12 && len > 0) {
      ctx.beginPath(); ctx.rect(-100, -100, w + 200, h + 200);
      const a = Math.atan2(active.y - y, ex - x);
      ctx.moveTo(x + Math.cos(a - Math.PI / 2) * 2, y + Math.sin(a - Math.PI / 2) * 2);
      ctx.arc(ex, active.y, 2, a - Math.PI / 2, a + Math.PI / 2);
      ctx.arc(x, y, 2, a + Math.PI / 2, a + Math.PI * 1.5); ctx.closePath(); ctx.clip('evenodd');
    }
  }
}
function outline(l, depth, narrow = 1) {
  const H = l.half, x = l.x, y = l.y;
  ctx.beginPath(); ctx.moveTo(x - H, y); ctx.lineTo(x + H, y);
  ctx.bezierCurveTo(x + .91 * H * narrow, y + .32 * depth, x + .68 * H * narrow, y + .91 * depth, x + .38 * H * narrow, y + depth);
  ctx.bezierCurveTo(x - .12 * H * narrow, y + .97 * depth, x - .78 * H * narrow, y + .56 * depth, x - H, y); ctx.closePath();
}
function rim(l, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#D9F0B4'; ctx.lineWidth = 1.7; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(l.x - l.half, l.y); ctx.lineTo(l.x + l.half, l.y); ctx.stroke(); ctx.restore();
}
function leaf(l, alpha, dent, delta, age, hasNext, miss) {
  const u = clamp(age / 150, 0, 1), E = reduced.matches ? 0 : Math.sin(Math.PI * u) * (1 - u);
  const A = Math.abs(delta) < 1e-9 ? 0 : Math.min(1.25, .16 * l.half, .35 * Math.abs(delta) * scale);
  const flex = A * E, depth = Math.max(0, l.depth - dent + Math.sign(delta) * flex);
  const narrow = delta < 0 ? 1 - Math.min(.06, flex / Math.max(l.half, 1)) : 1;
  ctx.save(); ctx.globalAlpha = alpha; outline(l, depth, narrow);
  const leafGrad = ctx.createLinearGradient(l.x, l.y, l.x, l.y + depth);
  leafGrad.addColorStop(0, '#6FAE78');
  leafGrad.addColorStop(.42, '#4F8B68');
  leafGrad.addColorStop(1, '#27584B');
  ctx.fillStyle = leafGrad; ctx.fill(); ctx.clip();
  protect(hasNext, miss);
  if (l.half * 2 >= 28) {
    ctx.fillStyle = '#234D43'; ctx.globalAlpha = alpha * (.48 + (delta < 0 ? .08 * E : 0));
    ctx.beginPath(); ctx.moveTo(l.x - l.half, l.y + depth * .3);
    ctx.quadraticCurveTo(l.x + l.half * .1, l.y + depth * .85, l.x + l.half, l.y + depth * .35);
    ctx.lineTo(l.x + l.half, l.y + depth); ctx.lineTo(l.x - l.half, l.y + depth); ctx.fill();
    ctx.strokeStyle = '#D3E9AD'; ctx.globalAlpha = alpha * .18; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(l.x - .64 * l.half, l.y + .2 * depth);
    ctx.quadraticCurveTo(l.x - .12 * l.half, l.y + .38 * depth, l.x + .56 * l.half, l.y + .22 * depth); ctx.stroke();
    ctx.strokeStyle = '#C9E6B1'; ctx.globalAlpha = alpha * .17; ctx.lineWidth = .55;
    ctx.beginPath(); ctx.moveTo(l.x - .72 * l.half, l.y + .42 * depth); ctx.lineTo(l.x - .15 * l.half, l.y + .56 * depth);
    ctx.moveTo(l.x + .62 * l.half, l.y + .38 * depth); ctx.lineTo(l.x + .08 * l.half, l.y + .58 * depth);
    ctx.stroke();
  }
  ctx.fillStyle = '#9CC69A'; ctx.globalAlpha = alpha * (.4 + (delta > 0 ? .12 * E : 0));
  ctx.beginPath(); ctx.ellipse(l.x - .24 * l.half, l.y + .29 * depth, .39 * l.half, .12 * depth, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); rim(l, alpha);
}
function droplet(l, alpha = 1, squash = 1) {
  squash = clamp(squash, 0, 1);
  if (alpha <= 0 || squash <= 0) return;
  const t = l.t * squash, base = 2 * squash;
  ctx.save(); ctx.fillStyle = '#8AD5DB'; ctx.globalAlpha = .68 * alpha;
  ctx.fillRect(l.x - l.r, l.y - base, l.r * 2, base);
  ctx.beginPath(); ctx.moveTo(l.x, l.y - t);
  ctx.bezierCurveTo(l.x - .2 * l.r, l.y - .72 * t, l.x - l.r, l.y - .42 * t, l.x - l.r, l.y - .3 * t);
  ctx.bezierCurveTo(l.x - l.r, l.y - base, l.x + l.r, l.y - base, l.x + l.r, l.y - .3 * t);
  ctx.bezierCurveTo(l.x + l.r, l.y - .42 * t, l.x + .2 * l.r, l.y - .72 * t, l.x, l.y - t); ctx.fill(); ctx.clip();
  ctx.fillStyle = '#244B48'; ctx.globalAlpha = .18 * alpha; ctx.fillRect(l.x - l.r, l.y - .3 * t, 2 * l.r, .3 * t);
  ctx.strokeStyle = '#E0F4E8'; ctx.globalAlpha = .8 * alpha; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(l.x - .22 * l.r, l.y - .65 * t); ctx.quadraticCurveTo(l.x - .6 * l.r, l.y - .47 * t, l.x - .55 * l.r, l.y - .34 * t); ctx.stroke(); ctx.restore();
}
function paintVine(px, py, tx, ty, alpha = 1, terminalOnly = false) {
  const length = Math.hypot(tx - px, ty - py);
  if (!length || alpha <= 0) return;
  const ux = (tx - px) / length, uy = (ty - py) / length, nx = -uy, ny = ux;
  const taper = Math.min(7, length), bx = tx - ux * taper, by = ty - uy * taper;
  const rootW = terminalOnly ? .9 : 2.4, neckW = terminalOnly ? .65 : 1.05;
  ctx.save(); ctx.globalAlpha = alpha;
  if (!terminalOnly) {
    ctx.strokeStyle = '#17382F'; ctx.lineWidth = 5.2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.beginPath();
  if (!terminalOnly && length > taper) {
    ctx.moveTo(px + nx * rootW, py + ny * rootW);
    ctx.lineTo(bx + nx * neckW, by + ny * neckW);
  } else ctx.moveTo(bx + nx * neckW, by + ny * neckW);
  ctx.lineTo(tx, ty);
  ctx.lineTo(bx - nx * neckW, by - ny * neckW);
  if (!terminalOnly && length > taper) ctx.lineTo(px - nx * rootW, py - ny * rootW);
  ctx.closePath();
  const vg = ctx.createLinearGradient(px, py, tx, ty);
  vg.addColorStop(0, '#284C39'); vg.addColorStop(.24, '#3E6B49');
  vg.addColorStop(.66, '#61905A'); vg.addColorStop(1, '#9AC781');
  ctx.fillStyle = vg; ctx.fill();
  ctx.strokeStyle = '#C1D99A'; ctx.globalAlpha = alpha * .62; ctx.lineWidth = .75; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(px + nx * .65, py + ny * .65); ctx.lineTo(tx, ty); ctx.stroke();
  if (!terminalOnly && length > 48) {
    const knots = [.23, .52, .78];
    for (let i = 0; i < knots.length; i++) {
      const f = knots[i], kx = px + (tx - px) * f, ky = py + (ty - py) * f;
      const band = 2.2 - i * .25;
      ctx.strokeStyle = '#1F4B37'; ctx.globalAlpha = alpha * .28; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(kx - nx * band, ky - ny * band); ctx.lineTo(kx + nx * band, ky + ny * band); ctx.stroke();
      if (i === 1) {
        ctx.fillStyle = '#6D9E63'; ctx.globalAlpha = alpha * .45;
        ctx.beginPath();
        ctx.ellipse(kx + nx * 2.4, ky + ny * 2.4, 2.2, 1.1, Math.atan2(uy, ux) + .35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
function vine(terminalOnly = false) {
  if (game.phase === 'WAIT') return;
  paintVine(sx(game.pivot.x), sy(game.pivot.y), sx(tip.x), sy(tip.y), 1, terminalOnly);
}
function settledVine(c, alpha) {
  paintVine(sx(c.fromX), sy(c.fromY), sx(c.x), sy(c.y), alpha, false);
}
function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function unlockAudio() {
  if (audio.ctx) {
    if (audio.ctx.state !== 'running' && audio.ctx.state !== 'closed') {
      audio.ctx.resume().then(() => activateAudio()).catch(() => {});
    } else activateAudio();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { audio.supported = false; return; }
  try {
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.sfx = audio.ctx.createGain();
    audio.music = audio.ctx.createGain();
    audio.master.gain.value = .2;
    audio.sfx.gain.value = .9;
    audio.music.gain.value = .85;
    audio.sfx.connect(audio.master);
    audio.music.connect(audio.master);
    audio.master.connect(audio.ctx.destination);
    const frames = Math.max(1, Math.round(audio.ctx.sampleRate * 1.7));
    audio.noise = audio.ctx.createBuffer(1, frames, audio.ctx.sampleRate);
    const data = audio.noise.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    if (audio.ctx.state === 'running') activateAudio();
    else audio.ctx.resume().then(() => activateAudio()).catch(() => {});
  } catch {
    audio.supported = false; audio.ctx = null; audio.master = null; audio.sfx = null; audio.music = null;
  }
}
function activateAudio() {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  audio.unlocked = true;
  startMusic();
  setupGrowSound();
}
function musicTone(freq, duration, gain, offset = 0, type = 'sine') {
  if (!audio.ctx || !audio.music || audio.ctx.state !== 'running') return;
  const t = audio.ctx.currentTime + offset;
  const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(), f = audio.ctx.createBiquadFilter();
  o.type = type; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = .25;
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(.9, duration * .28));
  g.gain.exponentialRampToValueAtTime(.0001, t + duration);
  o.connect(f); f.connect(g); g.connect(audio.music); o.start(t); o.stop(t + duration + .05);
}
function scheduleMusic() {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  const chords = [
    [146.83, 220.00, 293.66],
    [130.81, 196.00, 261.63],
    [174.61, 261.63, 349.23],
    [146.83, 220.00, 329.63]
  ];
  const bells = [587.33, 659.25, 440.00, 523.25];
  const step = audio.musicStep++ % chords.length;
  for (const f of chords[step]) musicTone(f, 5.2, .022, 0, 'sine');
  musicTone(bells[step], 2.4, .018, 1.2, 'triangle');
  musicTone(bells[(step + 2) % bells.length] * .5, 2.8, .011, 2.9, 'sine');
}
function startMusic() {
  if (audio.musicTimer || !audio.ctx || !audio.music) return;
  scheduleMusic();
  audio.musicTimer = setInterval(scheduleMusic, 4800);
}
function setupGrowSound() {
  if (!audio.ctx || !audio.sfx || audio.growOsc) return;
  const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain();
  const noise = audio.ctx.createBufferSource(), ng = audio.ctx.createGain(), filter = audio.ctx.createBiquadFilter();
  osc.type = 'triangle'; osc.frequency.value = 92; gain.gain.value = .0001;
  noise.buffer = audio.noise; noise.loop = true; ng.gain.value = .0001;
  filter.type = 'bandpass'; filter.frequency.value = 520; filter.Q.value = .8;
  osc.connect(gain); gain.connect(audio.sfx);
  noise.connect(filter); filter.connect(ng); ng.connect(audio.sfx);
  osc.start(); noise.start();
  Object.assign(audio, {growOsc: osc, growGain: gain, growNoise: noise, growNoiseGain: ng, growFilter: filter});
}
function updateGrowSound() {
  if (!audio.ctx || audio.ctx.state !== 'running' || !audio.growGain) return;
  const t = audio.ctx.currentTime, growing = game.phase === 'GROW';
  // Fixed world-length mapping: never normalize against the current target,
  // otherwise pitch becomes an audible "release now" cue.
  const amount = growing ? clamp(game.length / GROW_AUDIO_WORLD_REF, 0, 1.65) : 0;
  audio.growPitchHz = 88 + 72 * amount;
  audio.growFilterHz = 480 + 420 * amount;
  audio.growGain.gain.setTargetAtTime(growing ? .035 + .018 * amount : .0001, t, .035);
  audio.growNoiseGain.gain.setTargetAtTime(growing ? .018 + .012 * amount : .0001, t, .035);
  audio.growOsc.frequency.setTargetAtTime(audio.growPitchHz, t, .05);
  audio.growFilter.frequency.setTargetAtTime(audio.growFilterHz, t, .06);
}
function tone(freq, endFreq, duration, gain, type = 'sine', offset = 0) {
  if (!audio.ctx || !audio.sfx || audio.ctx.state !== 'running') return;
  const t = audio.ctx.currentTime + offset;
  const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + duration);
  o.connect(g); g.connect(audio.sfx); o.start(t); o.stop(t + duration + .02);
}
function air(duration, gain, highpass = 700) {
  if (!audio.ctx || !audio.sfx || !audio.noise || audio.ctx.state !== 'running') return;
  const t = audio.ctx.currentTime;
  const src = audio.ctx.createBufferSource(), filter = audio.ctx.createBiquadFilter(), g = audio.ctx.createGain();
  src.buffer = audio.noise; filter.type = 'highpass'; filter.frequency.value = highpass;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t + duration);
  src.connect(filter); filter.connect(g); g.connect(audio.sfx); src.start(t); src.stop(t + duration);
}
function cue(kind) {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  audio.lastCue = kind; audio.cueCount++;
  if (kind === 'release') {
    air(.075, .035, 950); tone(250, 170, .085, .035, 'triangle');
  } else if (kind === 'land') {
    tone(215, 180, .09, .055, 'triangle'); tone(430, 380, .07, .025, 'sine', .018);
  } else if (kind === 'land-clean') {
    tone(245, 215, .1, .052, 'triangle');
    tone(520, 465, .08, .03, 'sine', .016);
  } else if (kind === 'land-edge') {
    tone(176, 122, .13, .062, 'triangle');
    tone(104, 84, .11, .035, 'sine', .018);
    air(.07, .016, 520);
  } else if (kind === 'dew') {
    tone(740, 1040, .16, .085, 'sine');
    tone(1110, 1450, .2, .055, 'sine', .045);
    tone(1660, 1810, .12, .025, 'sine', .09);
  } else if (kind === 'miss') {
    tone(145, 78, .18, .06, 'triangle'); air(.09, .02, 450);
  }
}
function settleDent(age, quality = 'normal') {
  if (reduced.matches) return 0;
  const strength = quality === 'edge' ? 1.55 : quality === 'clean' ? .78 : 1;
  if (age < 90) return (-1.5 + 2 * smooth(age / 90)) * strength;
  return .5 * (1 - smooth((age - 90) / 90)) * strength;
}
function classifyLanding(offset, width, dropletReward) {
  if (dropletReward) return {quality: 'dew', edgeRatio: 0};
  const edgeRatio = clamp(Math.abs(offset) / Math.max(width / 2, 1e-9), 0, 1);
  if (edgeRatio >= .78) return {quality: 'edge', edgeRatio};
  if (edgeRatio <= .42) return {quality: 'clean', edgeRatio};
  return {quality: 'normal', edgeRatio};
}
function diagonalGrowTurn() {
  if (game.index < 3) return {active: false, angle: 0, slot: -1};
  const block = Math.floor(game.index / 10);
  const mixed = (game.seed ^ Math.imul(block + 1, 0x9E3779B9)) >>> 0;
  const slot = block * 10 + 4 + (mixed % 6);
  const active = game.index === slot;
  const dir = Math.sign(game.target.x - game.pivot.x) || 1;
  return {active, angle: active ? dir * .14 : 0, slot};
}
function dewBloom(l, age) {
  if (reduced.matches || age < 0 || age >= 220) return;
  const u = clamp(age / 220, 0, 1);
  const fade = 1 - smooth(u), r = 14 + 24 * smooth(clamp(age / 150, 0, 1));
  const cy = l.y - Math.max(4, l.t * .45);
  const glow = ctx.createRadialGradient(l.x, cy, 1, l.x, cy, r);
  glow.addColorStop(0, 'rgba(218,255,249,' + (.42 * fade) + ')');
  glow.addColorStop(.28, 'rgba(122,235,225,' + (.27 * fade) + ')');
  glow.addColorStop(1, 'rgba(122,220,214,0)');
  ctx.save(); ctx.fillStyle = glow; ctx.fillRect(l.x - r, cy - r, r * 2, r * 2);
  if (age < 135) {
    const s = 1 - smooth(age / 135);
    ctx.strokeStyle = 'rgba(224,255,245,' + (.75 * s) + ')'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.x - 10, cy - 7); ctx.lineTo(l.x - 6, cy - 4);
    ctx.moveTo(l.x + 7, cy - 9); ctx.lineTo(l.x + 10, cy - 13);
    ctx.moveTo(l.x + 10, cy + 2); ctx.lineTo(l.x + 14, cy + 3);
    ctx.stroke();
  }
  ctx.restore();
}
function dewCrest(l, age) {
  if (reduced.matches || age < 0 || age >= 150) return;
  const u = smooth(age / 150), fade = 1 - u;
  const cy = l.y - Math.max(4, l.t * .36), r = 8 + 8 * u;
  ctx.save(); ctx.strokeStyle = 'rgba(174,249,240,' + (.9 * fade) + ')';
  ctx.lineWidth = 1.35; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(l.x, cy, r, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(226,255,250,' + (.82 * fade) + ')'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(l.x - 9, cy - 8); ctx.lineTo(l.x - 12, cy - 12);
  ctx.moveTo(l.x, cy - 11); ctx.lineTo(l.x, cy - 16);
  ctx.moveTo(l.x + 9, cy - 8); ctx.lineTo(l.x + 12, cy - 12);
  ctx.stroke(); ctx.restore();
}
function dewSurface(l, age) {
  if (reduced.matches || age < 0 || age >= 150) return;
  const fade = 1 - smooth(age / 150);
  ctx.save();
  ctx.fillStyle = 'rgba(110,220,210,' + (.22 * fade) + ')';
  ctx.beginPath();
  ctx.ellipse(l.x, l.y + Math.max(3, l.depth * .28), l.half * .78, Math.max(2, l.depth * .22), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(169,250,240,' + (.96 * fade) + ')';
  ctx.lineWidth = 2.15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(l.x - l.half, l.y); ctx.lineTo(l.x + l.half, l.y); ctx.stroke();
  ctx.restore();
}
function recoveryHighlight(l, delta, age) {
  if (reduced.matches || delta <= .001 || age < 0 || age >= 520) return;
  const fade = 1 - smooth(age / 520);
  const gained = Math.min(l.half * .42, delta * scale / 2);
  const inner = Math.max(2, l.half - gained);
  ctx.save();
  ctx.strokeStyle = 'rgba(141,244,222,' + (.95 * fade) + ')';
  ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(l.x - l.half, l.y); ctx.lineTo(l.x - inner, l.y);
  ctx.moveTo(l.x + inner, l.y); ctx.lineTo(l.x + l.half, l.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(105,225,202,' + (.14 * fade) + ')';
  ctx.beginPath();
  ctx.ellipse(l.x - (l.half + inner) / 2, l.y + l.depth * .3, Math.max(2, gained * .7), Math.max(2, l.depth * .22), 0, 0, Math.PI * 2);
  ctx.ellipse(l.x + (l.half + inner) / 2, l.y + l.depth * .3, Math.max(2, gained * .7), Math.max(2, l.depth * .22), 0, 0, Math.PI * 2);
  ctx.fill();
  if (age < 380) {
    ctx.globalAlpha = 1 - smooth(age / 380);
    ctx.fillStyle = '#C8F2E4';
    ctx.textAlign = 'center'; ctx.font = '600 11px system-ui';
    ctx.fillText('葉幅回復', l.x, l.y - Math.max(18, l.t + 10));
    ctx.textAlign = 'left';
  }
  ctx.restore();
}
function landingAccent(l, age, quality, side = 0) {
  if (reduced.matches || age < 0 || age >= 170 || quality === 'normal' || quality === 'dew') return;
  const fade = 1 - smooth(age / 170);
  ctx.save();
  ctx.lineCap = 'round';
  if (quality === 'clean') {
    ctx.strokeStyle = 'rgba(207,239,199,' + (.7 * fade) + ')';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(l.x - l.half * .34, l.y);
    ctx.lineTo(l.x + l.half * .34, l.y);
    ctx.stroke();
  } else if (quality === 'edge') {
    const edgeX = l.x + (side || 1) * l.half;
    ctx.strokeStyle = 'rgba(235,205,145,' + (.82 * fade) + ')';
    ctx.lineWidth = 2.15;
    ctx.beginPath();
    ctx.moveTo(edgeX - (side || 1) * Math.min(9, l.half * .4), l.y);
    ctx.lineTo(edgeX, l.y);
    ctx.stroke();
  }
  ctx.restore();
}
function edgeLeaf(x, y, rx, ry, angle, alpha, flip = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(flip, 1); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
  g.addColorStop(0, '#173C3A'); g.addColorStop(.55, '#0E2D31'); g.addColorStop(1, '#081E24');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-rx, 0);
  ctx.bezierCurveTo(-rx * .38, -ry, rx * .48, -ry * .72, rx, 0);
  ctx.bezierCurveTo(rx * .42, ry * .92, -rx * .38, ry * .78, -rx, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(145,188,160,.26)'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(-rx * .72, 0); ctx.lineTo(rx * .78, 0); ctx.stroke();
  ctx.restore();
}
function ambientHash(n) {
  let x = (n ^ game.seed) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
  x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function ambientEvent(at, channel, slotMs, durationMin, durationSpan) {
  const slot = Math.floor(at / slotMs);
  let best = {strength: 0, progress: 0, slot: -1};
  for (let s = slot - 1; s <= slot; s++) {
    if (s < 0) continue;
    const base = s * slotMs;
    const h1 = ambientHash((channel + 1) * 0x9E3779B9 ^ s);
    const h2 = ambientHash((channel + 7) * 0x85EBCA6B ^ s);
    const start = base + slotMs * (.08 + .58 * h1);
    const duration = durationMin + durationSpan * h2;
    const u = (at - start) / duration;
    if (u > 0 && u < 1) {
      const strength = Math.sin(Math.PI * u) ** 2;
      if (strength > best.strength) best = {strength, progress: u, slot: s};
    }
  }
  return best;
}
function drawBirdPass(at, event) {
  if (event.strength <= .001) return;
  const {strength, progress, slot} = event;
  const dir = ambientHash(0x51ED270B ^ slot) < .5 ? 1 : -1;
  const startX = dir > 0 ? -30 : w + 30;
  const x = startX + dir * (w + 60) * progress;
  const y = h * (.16 + .09 * ambientHash(0xA24BAED5 ^ slot));
  ctx.save();
  ctx.globalAlpha = .28 * strength;
  ctx.strokeStyle = '#0A2228';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const bx = x - dir * i * 18, by = y + i * 7;
    const flap = Math.sin(at / 170 + i) * 2.2;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by + flap);
    ctx.quadraticCurveTo(bx, by - 4 - flap, bx + 6, by + flap);
    ctx.stroke();
  }
  ctx.restore();
}
function drawLightPass(at, event) {
  if (event.strength <= .001) return;
  const {strength, progress, slot} = event;
  const dir = ambientHash(0xC2B2AE35 ^ slot) < .5 ? 1 : -1;
  const x = dir > 0 ? -w * .15 + progress * w * 1.3 : w * 1.15 - progress * w * 1.3;
  ctx.save();
  const g = ctx.createRadialGradient(x, h * .22, 0, x, h * .22, w * .38);
  g.addColorStop(0, 'rgba(255,234,192,' + (.14 * strength) + ')');
  g.addColorStop(.45, 'rgba(231,220,174,' + (.06 * strength) + ')');
  g.addColorStop(1, 'rgba(231,220,174,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * .55);
  ctx.restore();
}
function drawBackdrop(at, altitude) {
  const drift = reduced.matches ? 0 : Math.sin(at / 14000) * 3;
  const pulse = reduced.matches ? 0 : Math.sin(at / 17000) * .04;
  const forestFade = 1 - .62 * altitude;
  const rainFade = 1 - .58 * altitude;
  const rainLullEvent = reduced.matches ? {strength:0,progress:0,slot:-1} : ambientEvent(at, 1, 13000, 1600, 1100);
  const gustEvent = reduced.matches ? {strength:0,progress:0,slot:-1} : ambientEvent(at, 2, 11000, 900, 900);
  const birdEvent = reduced.matches ? {strength:0,progress:0,slot:-1} : ambientEvent(at, 3, 19000, 2200, 1400);
  const lightEvent = reduced.matches ? {strength:0,progress:0,slot:-1} : ambientEvent(at, 4, 23000, 2600, 1800);
  const rainLull = rainLullEvent.strength, gust = gustEvent.strength;
  const bird = birdEvent.strength, light = lightEvent.strength;
  Object.assign(ambientVisual, {rainLull, gust, bird, light});
  ctx.save();

  // Diffuse rainbreak light. Screen-space only, with no hard circular edge.
  ctx.globalAlpha = .66 + .28 * altitude + pulse + .12 * rainLull + .1 * light;
  ctx.fillStyle = rainbreak;
  ctx.fillRect(0, 0, w, h * .48);
  drawLightPass(at, lightEvent);

  // Higher altitude gradually opens the sky without introducing world-space bands.
  ctx.globalAlpha = .04 + .15 * altitude;
  ctx.fillStyle = '#DDE7DC';
  ctx.beginPath();
  ctx.ellipse(w * .54, h * .18, w * (.34 + .08 * altitude), h * .12, -.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = .025 + .10 * altitude;
  ctx.fillStyle = '#F0D0A9';
  ctx.beginPath();
  ctx.ellipse(w * .78, h * .08, w * .22, h * .08, .05, 0, Math.PI * 2);
  ctx.fill();

  // Far forest layer: softer and lighter, clearly distinct from the foreground.
  ctx.globalAlpha = .34 * (.72 + .28 * forestFade);
  ctx.fillStyle = '#335C56';
  ctx.beginPath();
  ctx.moveTo(0, h); ctx.lineTo(0, h * .42);
  ctx.bezierCurveTo(w * .06, h * .39, w * .1, h * .46, w * .15, h * .48);
  ctx.bezierCurveTo(w * .21, h * .5, w * .22, h * .58, w * .3, h * .6);
  ctx.bezierCurveTo(w * .34, h * .65, w * .29, h * .78, w * .34, h);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, h); ctx.lineTo(w, h * .34);
  ctx.bezierCurveTo(w * .94, h * .37, w * .91, h * .45, w * .86, h * .48);
  ctx.bezierCurveTo(w * .8, h * .53, w * .81, h * .61, w * .73, h * .64);
  ctx.bezierCurveTo(w * .69, h * .7, w * .75, h * .8, w * .68, h);
  ctx.closePath(); ctx.fill();

  // Near forest layer: darker, taller, and more defined.
  ctx.globalAlpha = .5 * forestFade;
  ctx.fillStyle = '#102F31';
  ctx.beginPath();
  ctx.moveTo(0, h); ctx.lineTo(0, h * .57);
  ctx.bezierCurveTo(w * .08, h * .51, w * .12, h * .59, w * .18, h * .61);
  ctx.bezierCurveTo(w * .25, h * .65, w * .2, h * .76, w * .27, h);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, h); ctx.lineTo(w, h * .5);
  ctx.bezierCurveTo(w * .94, h * .49, w * .88, h * .57, w * .83, h * .61);
  ctx.bezierCurveTo(w * .76, h * .67, w * .82, h * .78, w * .74, h);
  ctx.closePath(); ctx.fill();

  // Authored pointed leaf silhouettes instead of flat ellipses.
  const gustSway = gust * Math.sin(at / 125) * .095;
  const sway = reduced.matches ? 0 : Math.sin(at / 9000) * .035 + gustSway;
  edgeLeaf(8, h * .18 + drift, 29, 10, .35 + sway, .72 * forestFade, 1);
  edgeLeaf(20, h * .31 - drift, 24, 9, -.26 + sway, .6 * forestFade, 1);
  edgeLeaf(5, h * .47 + drift, 31, 11, .16 - sway, .67 * forestFade, 1);
  edgeLeaf(w - 8, h * .22 - drift, 28, 10, -.32 - sway, .7 * forestFade, -1);
  edgeLeaf(w - 18, h * .4 + drift, 25, 9, .28 - sway, .6 * forestFade, -1);
  edgeLeaf(w - 4, h * .58 - drift, 32, 12, -.12 + sway, .68 * forestFade, -1);

  // Sparse diagonal rain: deliberately irregular, atmospheric, and not gameplay-timed.
  if (!reduced.matches) {
    const rainStrength = rainFade * (1 - .74 * rainLull);
    ctx.strokeStyle = 'rgba(215,241,235,' + (.17 * rainStrength) + ')'; ctx.lineWidth = .9;
    for (let i = 0; i < 18; i++) {
      const speed = 13 + (i % 5) * 4;
      const x = ((i * 67 + at * .018 * speed) % (w + 120)) - 60;
      const y = ((i * 113 + at * .026 * speed) % (h + 160)) - 80;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 24); ctx.stroke();
    }
  }
  drawBirdPass(at, birdEvent);
  ctx.restore();
}
function drawBestMarker(at, hasNext) {
  let markerVisible = false;
  if (visual.runPbStart > 0) {
    const y = sy(visual.runPbStart);
    const box = {x: w - 92, y: y - 12, w: 78, h: 18};
    if (y > 105 && y < h - 105 && !overlapsPlay(box, hasNext)) {
      markerVisible = true;
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = '600 9px system-ui';
      ctx.fillStyle = 'rgba(202,218,207,.72)';
      ctx.fillText('BEST ' + (visual.runPbStart / 10).toFixed(1), w - 24, y - 5);
      ctx.fillStyle = 'rgba(202,218,207,.52)';
      ctx.fillRect(w - 20, y, 16, 1);
      ctx.restore();
    }
  }
  const newBestAge = visual.pbAt === null ? Infinity : at - visual.pbAt;
  const newBestVisible = newBestAge >= 0 && newBestAge < 760;
  if (newBestVisible) {
    const fade = reduced.matches ? 1 : 1 - smooth(newBestAge / 760);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.font = '650 10px system-ui';
    ctx.fillStyle = '#A5E7CE';
    ctx.fillText('NEW BEST', w / 2, h * .17);
    ctx.restore();
  }
  return {markerVisible, newBestVisible};
}
function drawDiagonalGrowAccent(at, diagonalGrow) {
  if (!diagonalGrow.active || game.phase !== 'GROW' || reduced.matches || game.length < 8) return;
  const px = sx(game.pivot.x), py = sy(game.pivot.y);
  const tx = sx(tip.x), ty = sy(tip.y);
  const ux = tx - px, uy = ty - py;
  const length = Math.hypot(ux, uy) || 1;
  const nx = -uy / length, ny = ux / length;
  const pulse = .45 + .25 * Math.sin(at / 180);
  ctx.save();
  ctx.strokeStyle = 'rgba(210,236,224,' + pulse + ')';
  ctx.lineWidth = .7;
  ctx.lineCap = 'round';
  for (const [f, offset] of [[.36, 8], [.6, -7]]) {
    const x = px + ux * f + nx * offset;
    const y = py + uy * f + ny * offset;
    const drift = 7 * Math.sign(diagonalGrow.angle || 1);
    ctx.beginPath();
    ctx.moveTo(x - drift, y - 2);
    ctx.lineTo(x + drift * .35, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}
function miko(angle, age, collected, terminal, miss, elapsed) {
  const growing = game.phase === 'GROW', moving = game.phase === 'TOPPLE';
  let dip = growing ? (reduced.matches ? 1 : smooth((lastDrawAt - game.holdAt) / 60)) : 0;
  if (!reduced.matches && age >= 0 && age < 170) {
    dip = age < 40 ? .5 + 2 * smooth(age / 40) : 2.5 * (1 - smooth((age - 40) / 110));
    if (collected && age > 40) {
      dip -= age < 100 ? 2 * smooth((age - 40) / 60) : 2 * (1 - smooth((age - 100) / 70));
    }
  }
  const dir = Math.sign(game.target.x - game.pivot.x) || 1;
  const missStart = game.length < game.geom.h ? 0 : CONTACT_MS;
  const missLean = miss ? .314 * (reduced.matches ? 1 : smooth((elapsed - missStart) / 120)) : 0;
  const lean = terminal ? 0 : moving ? clamp(angle * .12, -.157, .157) * dir + missLean : 0;
  const armOpen = growing ? 0 : moving ? Math.min(3.2, Math.abs(angle) * 3.1) : 0;
  const wobble = miss ? (reduced.matches ? 3 : 3 * smooth((elapsed - missStart) / 80)) : 0;
  ctx.save(); ctx.translate(sx(tip.x), sy(tip.y)); ctx.scale(dir * 1.24, 1.24);
  // Tiny feet remain the exact anchor. Everything charming happens above them.
  ctx.fillStyle = '#20333A'; ctx.fillRect(-2.4, -2.6, 1.5, 2.6); ctx.fillRect(1, -2.6, 1.5, 2.6);
  ctx.scale(growing ? .9 : 1, 1); ctx.rotate(lean);

  // Rounded red skirt / rain cape silhouette.
  ctx.fillStyle = '#C55E58';
  ctx.beginPath(); ctx.moveTo(-4.8, -10 + dip); ctx.quadraticCurveTo(0, -12 + dip, 4.8, -10 + dip);
  ctx.lineTo(6.2, -2.5); ctx.quadraticCurveTo(0, -.8, -6.2, -2.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#E87A6C'; ctx.globalAlpha = .65;
  ctx.beginPath(); ctx.ellipse(-1.8, -7.3 + dip, 2.8, 1.1, -.18, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

  // Cream blouse with simple mitten-like arms.
  ctx.translate(0, dip);
  ctx.fillStyle = '#F2EBD7';
  ctx.beginPath(); ctx.roundRect(-4.5, -19.2, 9, 9.5, 3); ctx.fill();
  const leftReach = 6.5 + armOpen + wobble, rightReach = growing ? 5.2 : 6.6;
  ctx.strokeStyle = '#F2EBD7'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.2, -16.8); ctx.lineTo(-leftReach, -13.3 - wobble * .6);
  ctx.moveTo(3.2, -16.6); ctx.lineTo(rightReach, -13.5); ctx.stroke();

  // Big simple bob haircut and warm face.
  ctx.fillStyle = '#26343B';
  ctx.beginPath(); ctx.arc(-.2, -24.2, 7.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E8BFA2';
  ctx.beginPath(); ctx.arc(1.1, -23.4, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#26343B';
  ctx.beginPath(); ctx.moveTo(-3.8, -27.7); ctx.quadraticCurveTo(.2, -30.5, 4.7, -27.2);
  ctx.lineTo(3.2, -25.2); ctx.quadraticCurveTo(.2, -27.1, -3.8, -25.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#26343B'; ctx.beginPath(); ctx.arc(4, -23.4, .72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#D98979'; ctx.globalAlpha = .68; ctx.beginPath(); ctx.arc(3, -21.7, .8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

  // Signature ribbon.
  ctx.fillStyle = '#D75F58';
  ctx.beginPath(); ctx.moveTo(-4.7, -29); ctx.lineTo(-1.7, -27.1); ctx.lineTo(-5.3, -25.9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4.2, -28.2); ctx.lineTo(-7.1, -29.2); ctx.lineTo(-6.3, -26.1); ctx.closePath(); ctx.fill();
  if (collected && age >= 0 && age < 150 && !reduced.matches) {
    ctx.strokeStyle = 'rgba(224,255,245,' + (1 - age / 150) + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-11, -29); ctx.moveTo(8, -27); ctx.lineTo(11, -30); ctx.stroke();
  }
  ctx.restore();
}
function intersects(b, x, y, width, height, guard = 6) {
  return b.x < x + width + guard && b.x + b.w > x - guard && b.y < y + height + guard && b.y + b.h > y - guard;
}
function overlapsPlay(b, hasNext) {
  const tx = sx(tip.x), ty = sy(tip.y), px = sx(game.pivot.x), py = sy(game.pivot.y);
  return intersects(b, tx - 12, ty - 33, 24, 36) ||
    (game.phase !== 'WAIT' && intersects(b, Math.min(tx, px) - 2, Math.min(ty, py), Math.abs(tx - px) + 4, Math.abs(ty - py))) ||
    intersects(b, active.x - active.half - 3, active.y - active.t - 1, active.half * 2 + 6, active.t + active.depth + 2) ||
    (hasNext && intersects(b, following.x - following.half - 3, following.y - 3, following.half * 2 + 6, following.depth + 6));
}
let rendered = {}, lastDrawAt = 0;
function draw(at) {
  lastDrawAt = at;
  if (visual.run !== game.runIndex) {
    preview.valid = false; contact.active = false; visual.pbAt = null;
    visual.run = game.runIndex; visual.runPbStart = game.pb;
    Object.assign(support, {x: game.pivot.x, y: game.pivot.y, width: game.width});
  }
  if (game.phase === 'GROW') contact.active = false;
  game.advance(at);
  updateGrowSound();
  const phase = game.phase, index = game.index, run = game.runIndex, oldPB = game.pb, g = game.geom;
  const hasNext = phase === 'TOPPLE', elapsed = hasNext ? at - game.releaseAt : 0;
  const terminal = hasNext && elapsed >= CONTACT_MS && game.pending.success;
  const miss = hasNext && !game.pending.success && (game.length < g.h || elapsed >= CONTACT_MS);
  const dewUseful = game.width < game.target.base * PLATFORM_WIDTH_SCALE * .995;
  const terminalLandingQuality = terminal ?
    classifyLanding(game.pending.offset, game.width, game.pending.droplet && dewUseful) : null;
  const landing = terminal ? {
    fromX: game.pivot.x, fromY: game.pivot.y, leafX: game.target.x, leafY: game.target.y,
    width: game.width, r: g.r, x: game.pending.x, y: game.pending.y, droplet: game.pending.droplet,
    quality: terminalLandingQuality.quality, edgeRatio: terminalLandingQuality.edgeRatio
  } : null;
  if (hasNext) {
    visual.hintDismissed = true;
    const next = game.leaves[index + 1];
    Object.assign(preview, {valid: true, run, index, release: game.releaseAt, next: index + 1, width: next.base * (game.width / game.target.base)});
    project(following, next, preview.width);
  }
  project(active, game.target, game.width, g.r);
  tip.x = game.pivot.x; tip.y = game.pivot.y;
  let angle = 0;
  const diagonalGrow = diagonalGrowTurn();
  if (phase === 'GROW') {
    const lean = diagonalGrow.active ? diagonalGrow.angle * smooth(clamp(game.length / 16, 0, 1)) : 0;
    angle = lean;
    tip.x += Math.sin(lean) * game.length;
    tip.y += Math.cos(lean) * game.length;
  }
  if (hasNext) {
    const dir = Math.sign(game.target.x - game.pivot.x);
    const cross = game.length >= g.h ? Math.acos(g.h / game.length) : .7;
    const targetAngle = dir * cross;
    const fromAngle = diagonalGrow.active ? diagonalGrow.angle * smooth(clamp(game.length / 16, 0, 1)) : 0;
    const u = clamp(elapsed / CONTACT_MS, 0, 1) ** 2.2;
    angle = fromAngle + (targetAngle - fromAngle) * u;
    if (elapsed > CONTACT_MS && !game.pending.success) angle += dir * clamp((elapsed - CONTACT_MS) / 500, 0, 1) * .9;
    tip.x += Math.sin(angle) * game.length; tip.y += Math.cos(angle) * game.length;
  }
  const age = terminal ? 0 : contact.active && contact.index === index ? at - contact.at : -1;
  const collected = terminal ? game.pending.droplet && dewUseful : contact.active && contact.reward;
  const settling = phase === 'WAIT' && contact.active && contact.index === index && age >= 0 && age < 180;
  let settleAlpha = 0;
  if (settling) {
    settleAlpha = 1 - smooth(age / 180);
    project(settled, {x: contact.leafX, y: contact.leafY}, contact.width, contact.r);
  }
  project(supportView, {x: support.x, y: support.y}, support.width, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const a = 1 - Math.exp(-Math.max(0, game.camera) / 650);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `rgb(${15 + 34 * a} ${43 + 35 * a} ${52 + 28 * a})`);
  bg.addColorStop(.48, `rgb(${24 + 22 * a} ${61 + 24 * a} ${66 + 18 * a})`);
  bg.addColorStop(1, `rgb(${35 + 10 * a} ${73 + 10 * a} ${71 + 14 * a})`);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = .76 + .2 * a; ctx.fillStyle = afterglow; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1 - .34 * a; ctx.fillStyle = mist; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = .7 - .34 * a; ctx.fillStyle = lowMist; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1; ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  drawBackdrop(at, a);
  // The current foothold persists for the whole turn. Miko and the next vine
  // share the exact contact pivot on this visible leaf.
  const supportDent = settling ? settleDent(age, contact.quality) : 0;
  leaf(supportView, 1, supportDent, 0, -1, false, false);
  vine();
  if (settling) {
    settledVine(contact, settleAlpha);
    if (contact.reward) dewBloom(settled, age);
    if (contact.reward && age < 120) {
      const dissolve = 1 - smooth(age / 120);
      droplet(settled, settleAlpha, dissolve);
    }
    if (contact.reward) {
      dewSurface(settled, age);
      dewCrest(settled, age);
    }
    landingAccent(settled, age, contact.quality, Math.sign(contact.x - contact.leafX));
  }
  if (hasNext) leaf(following, .65, 0, 0, -1, hasNext, miss);
  leaf(active, 1, terminal && !reduced.matches ? Math.min(1.5, .2 * active.depth) : 0,
    !terminal && age >= 0 ? contact.delta : 0, age, hasNext, miss);
  if (dewUseful) droplet(active);
  if (phase === 'WAIT' && contact.reward) recoveryHighlight(active, contact.delta, age);
  ctx.save(); protect(hasNext, miss);
  if (phase === 'WAIT') {
    const flex = !reduced.matches && settling ? 1.2 * Math.sin(Math.PI * clamp(age / 150, 0, 1)) : 0;
    ctx.fillStyle = settling ? '#7EAE80' : '#659766'; ctx.globalAlpha = settling ? .85 : .7; ctx.beginPath();
    ctx.ellipse(sx(tip.x), sy(tip.y) + 3, 4, 1.2 + flex, -.1, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  miko(angle, age, collected, terminal, miss, elapsed);
  drawDiagonalGrowAccent(at, diagonalGrow);
  if (!reduced.matches && settling && contact.reward && age < 90) {
    ctx.globalAlpha = 1 - age / 90; ctx.fillStyle = '#E0F4E8';
    const gy = settled.y - settled.t * (1 - smooth(age / 120));
    ctx.beginPath(); ctx.moveTo(settled.x - 1.5, gy - 3); ctx.lineTo(settled.x + 1.5, gy - 2); ctx.lineTo(settled.x - .5, gy); ctx.fill();
  }
  ctx.restore();
  // Decoration is clipped, so authoritative surfaces need no second alpha composite.
  vine(true);
  const bestMarker = drawBestMarker(at, hasNext);
  if (miss && audio.missRelease !== game.releaseAt) {
    audio.missRelease = game.releaseAt;
    cue('miss');
  }
  const gameOver = miss;
  hint.classList.toggle('visually-hidden', gameOver || visual.hintDismissed || overlapsPlay(layout.hint, hasNext));
  brand.classList.toggle('visually-hidden', overlapsPlay(layout.brand, hasNext));
  heightEl.textContent = (game.height / 10).toFixed(1); pbEl.textContent = 'PB ' + (game.pb / 10).toFixed(1) + ' m';
  pbEl.classList.toggle('pb-emphasis', !reduced.matches && visual.pbAt !== null && at - visual.pbAt < 240);
  gameoverEl.hidden = !gameOver;
  if (gameOver) {
    const runMeters = game.height / 10, pbMeters = game.pb / 10;
    const newRecord = game.height > visual.runPbStart + 1e-9;
    const tiedBest = !newRecord && game.pb > 0 && Math.abs(game.height - game.pb) < 1e-9;
    gameoverCauseEl.textContent = game.pending?.reason === '短い' ? 'TOO SHORT' : 'TOO LONG';
    runResultEl.textContent = runMeters.toFixed(1) + ' m';
    recordStatusEl.classList.toggle('new-record', newRecord);
    if (newRecord) {
      recordStatusEl.textContent = 'NEW BEST';
      recordGapEl.hidden = true;
    } else if (tiedBest) {
      recordStatusEl.textContent = 'TIED BEST';
      recordGapEl.hidden = true;
    } else {
      recordStatusEl.textContent = 'BEST ' + pbMeters.toFixed(1) + ' m';
      recordGapEl.textContent = Math.max(0, pbMeters - runMeters).toFixed(1) + ' m TO BEST';
      recordGapEl.hidden = false;
    }
  }
  rendered = {at, phase, index, runIndex: run, visibleTargetCount: hasNext ? 2 : 1, tip: {...tip},
    visibleMiss: miss, width: game.width, camera: game.camera,
    viewport: {width: w, height: h, scale}, followingVisible: hasNext,
    visual: {dpr, backingBytes: canvas.width * canvas.height * 4, activeDropletRadius: g.r, previewDroplet: false,
      terminalContact: terminal, contactAge: age, widthDelta: age >= 0 && !terminal ? contact.delta : 0,
      activeDropletVisible: dewUseful, recoveryHighlight: phase === 'WAIT' && contact.reward && age >= 0 && age < 520,
      landingSettleVisible: settling, landingSettleAlpha: settleAlpha, dropletDissolving: settling && contact.reward && age < 120,
      landingQuality: terminalLandingQuality?.quality ?? (settling ? contact.quality : null),
      landingEdgeRatio: terminalLandingQuality?.edgeRatio ?? (settling ? contact.edgeRatio : null),
      supportVisible: true, supportCenter: {x: support.x, y: support.y}, supportWidth: support.width,
      supportContainsPivot: Math.abs(game.pivot.x - support.x) <= support.width / 2 + 1e-9 &&
        Math.abs(game.pivot.y - support.y) <= 1e-9,
      diagonalGrowTurn: diagonalGrow.active, diagonalGrowSlot: diagonalGrow.slot,
      diagonalGrowAngle: diagonalGrow.active ? diagonalGrow.angle : 0,
      ambient: {...ambientVisual},
      bestMarkerVisible: bestMarker.markerVisible, newBestVisible: bestMarker.newBestVisible, altitudeMood: a,
      hintDismissed: visual.hintDismissed, reducedMotion: reduced.matches}};
  game.painted(at);
  if (game.runIndex === run && game.index !== index) {
    const matched = preview.valid && preview.run === run && preview.index === index && preview.release === game.releaseAt && preview.next === game.index;
    const delta = matched ? game.width - preview.width : 0;
    const reward = game.impactDroplet && delta > .001;
    const landedQuality = landing?.quality ?? 'normal';
    Object.assign(contact, {active: game.phase !== 'GROW', at: game.impactAt, droplet: game.impactDroplet, reward,
      x: game.pivot.x, y: game.pivot.y, index: game.index, delta,
      fromX: landing?.fromX ?? game.pivot.x, fromY: landing?.fromY ?? game.pivot.y,
      leafX: landing?.leafX ?? game.pivot.x, leafY: landing?.leafY ?? game.pivot.y,
      width: landing?.width ?? game.width, r: landing?.r ?? 0,
      quality: landedQuality, edgeRatio: landing?.edgeRatio ?? 0});
    if (landing) Object.assign(support, {x: landing.leafX, y: landing.leafY, width: landing.width});
    visual.dewAt = reward ? game.impactAt : null;
    cue(reward ? 'dew' : landedQuality === 'edge' ? 'land-edge' : landedQuality === 'clean' ? 'land-clean' : 'land');
    preview.valid = false;
    if (game.pb > oldPB) visual.pbAt = game.impactAt;
  }
  visual.phase = game.phase;
  if (game.pb !== lastSaved) {
    lastSaved = game.pb;
    try { localStorage.setItem('ametsuta-v3-pb', String(game.pb)); }
    catch { document.querySelector('#save').hidden = false; }
  }
}

function stamp(e) { return e.timeStamp > 1e12 ? e.timeStamp - performance.timeOrigin : e.timeStamp; }
function releaseInput(at, cancel = false) {
  const releasingGrowth = game.phase === 'GROW' && !cancel;
  game.up(at, cancel);
  if (releasingGrowth) cue('release');
}
canvas.addEventListener('pointerdown', e => {
  if (pointer !== null || e.button !== 0) return;
  e.preventDefault(); unlockAudio(); pointer = e.pointerId; canvas.setPointerCapture(pointer); game.down(stamp(e));
});
function up(e, cancel = false) {
  if (e.pointerId !== pointer) return;
  e.preventDefault(); pointer = null; releaseInput(stamp(e), cancel);
}
canvas.addEventListener('pointerup', e => up(e));
canvas.addEventListener('pointercancel', e => up(e, true));
canvas.addEventListener('lostpointercapture', e => {
  if (e.pointerId === pointer) { pointer = null; releaseInput(stamp(e), true); }
});
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); unlockAudio(); game.down(stamp(e)); }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') { e.preventDefault(); releaseInput(stamp(e)); }
});
window.addEventListener('blur', () => { pointer = null; releaseInput(performance.now(), true); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pointer = null;
    releaseInput(performance.now(), true);
    if (audio.ctx?.state === 'running') audio.ctx.suspend().catch(() => {});
  } else if (audio.unlocked && audio.ctx && audio.ctx.state !== 'running' && audio.ctx.state !== 'closed') {
    audio.ctx.resume().then(() => activateAudio()).catch(() => {});
  }
});
window.addEventListener('pagehide', () => {
  if (audio.ctx?.state === 'running') audio.ctx.suspend().catch(() => {});
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
function frame(at) {
  if (at - lastFrame > 50) {
    stalls.push({at, gap: at - lastFrame});
    if (stalls.length > 200) stalls.shift();
  }
  lastFrame = at; draw(at); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
Object.defineProperty(window, 'ametsutaV3', {value: Object.freeze({read: () => ({...game.read(),
  rendered: structuredClone(rendered), stalls: structuredClone(stalls),
  audio: {
    supported: audio.supported, unlocked: audio.unlocked, lastCue: audio.lastCue, cueCount: audio.cueCount,
    contextState: audio.ctx?.state ?? null, musicPlaying: Boolean(audio.musicTimer),
    growSoundReady: Boolean(audio.growOsc), growSoundActive: game.phase === 'GROW',
    growAudioWorldReference: GROW_AUDIO_WORLD_REF, growPitchHz: audio.growPitchHz, growFilterHz: audio.growFilterHz
  },
  build: 'V3 R3.1 sensory finish'})})});
