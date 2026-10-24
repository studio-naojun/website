/**
 * Screen-space world behind the gameplay layer. Everything here is decoration:
 * it reads only camera height, display time and the run seed, never hold length,
 * release timing, landing quality or the target. The camera itself only moves in
 * the fixed post-release tween, so parallax can never become a release cue.
 */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const band = (c, a, b) => smooth((c - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1)})`;
const NONE = {strength: 0, progress: 0, slot: -1};

// Camera height (world units, 10 = 1 m) -> sky. The arc follows typical runs:
// rain forest floor, canopy, cloud pass, sea of clouds at dusk, then night.
const SKY = [
  // at, top, middle, horizon, sun/glow
  [0, [15, 41, 49], [23, 58, 62], [30, 68, 66], [236, 200, 150]],
  [300, [24, 56, 63], [38, 77, 78], [36, 74, 70], [242, 210, 162]],
  [720, [46, 82, 98], [88, 116, 118], [70, 102, 100], [255, 220, 172]],
  [1300, [52, 72, 112], [132, 120, 132], [206, 156, 124], [255, 200, 146]],
  [2200, [24, 32, 70], [76, 66, 104], [170, 112, 112], [250, 176, 138]],
  [3600, [8, 13, 36], [26, 30, 64], [72, 62, 98], [214, 168, 170]]
];
function skyAt(c) {
  if (c <= SKY[0][0]) return SKY[0].slice(1);
  for (let i = 1; i < SKY.length; i++) {
    if (c < SKY[i][0]) {
      const a = SKY[i - 1], b = SKY[i], t = smooth((c - a[0]) / (b[0] - a[0]));
      return [1, 2, 3, 4].map(k => mixRGB(a[k], b[k], t));
    }
  }
  return SKY.at(-1).slice(1);
}

function hash(n) {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
  x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function createWorld() {
  return {w: 0, h: 0, seed: -1, stars: [], trunks: [], fronds: [], ridge: [], info: {}};
}

function build(world, seed) {
  world.seed = seed;
  const r = i => hash(seed ^ Math.imul(i + 1, 0x9E3779B9));
  // Far trunks spread across the view; near trunks hug the edges so the play
  // column keeps a calm, low-contrast backdrop.
  world.trunks = [];
  for (let i = 0; i < 6; i++) {
    world.trunks.push({layer: 0, x: (i + .2 + .6 * r(i)) / 6, width: 9 + 7 * r(i + 20), crown: r(i + 40)});
  }
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    world.trunks.push({layer: 1, x: side < 0 ? .02 + .06 * r(i + 60) : .92 + .06 * r(i + 61), width: 26 + 10 * r(i + 62), crown: r(i + 64)});
  }
  world.fronds = [];
  for (let i = 0; i < 9; i++) {
    const left = i % 2 === 0;
    world.fronds.push({left, y: (i + r(i + 80)) / 9, size: .8 + .5 * r(i + 90), angle: (r(i + 100) - .5) * .7, phase: r(i + 110) * 6.28});
  }
  world.ridge = Array.from({length: 4}, (_, i) => ({phase: r(i + 130) * 6.28, amp: .5 + r(i + 140)}));
  world.stars = Array.from({length: 64}, (_, i) => ({x: r(i + 200), y: r(i + 300) ** 1.4 * .62, s: .5 + 1.1 * r(i + 400) ** 3, phase: r(i + 500) * 6.28}));
  world.peak = .18 + .64 * r(600);
  world.torii = .44 + .12 * r(601);
}

export function resizeWorld(world, w, h) { world.w = w; world.h = h; }

function ambientEvent(seed, at, channel, slotMs, durationMin, durationSpan) {
  const slot = Math.floor(at / slotMs);
  let best = NONE;
  for (let s = slot - 1; s <= slot; s++) {
    if (s < 0) continue;
    const h1 = hash(seed ^ ((channel + 1) * 0x9E3779B9 ^ s));
    const h2 = hash(seed ^ ((channel + 7) * 0x85EBCA6B ^ s));
    const start = s * slotMs + slotMs * (.08 + .58 * h1);
    const u = (at - start) / (durationMin + durationSpan * h2);
    if (u > 0 && u < 1) {
      const strength = Math.sin(Math.PI * u) ** 2;
      if (strength > best.strength) best = {strength, progress: u, slot: s};
    }
  }
  return best;
}

function cedar(ctx, x, top, width, tiers, color) {
  // Stacked drooping tiers: a Japanese cedar crown silhouette.
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < tiers; i++) {
    const j = Math.sin(x * .37 + i * 2.1), y = top + i * width * .34;
    const half = width * (.24 + .24 * i / Math.max(1, tiers - 1)) * (1 + .12 * j), cx = x + j * width * .05;
    ctx.moveTo(cx, y - width * .14);
    ctx.bezierCurveTo(cx + half * .3, y - width * .02, cx + half * .8, y + width * .2, cx + half, y + width * .34);
    ctx.bezierCurveTo(cx + half * .55, y + width * .27, cx + half * .25, y + width * .33, cx, y + width * .28);
    ctx.bezierCurveTo(cx - half * .25, y + width * .33, cx - half * .55, y + width * .27, cx - half, y + width * .34);
    ctx.bezierCurveTo(cx - half * .8, y + width * .2, cx - half * .3, y - width * .02, cx, y - width * .14);
  }
  ctx.fill();
}

function drawTrunks(ctx, world, c, scale, layer, alpha, color, mossColor) {
  if (alpha <= .002) return;
  const {w, h} = world;
  const f = layer ? .78 : .42, k = scale * f;
  const top = layer ? 470 : 680;               // canopy height for this depth
  const yTop = h * .3 + (c - top) * k;         // descends as the camera rises
  if (yTop > h + 40) return;
  ctx.save(); ctx.globalAlpha = alpha;
  for (const [ti, t] of world.trunks.entries()) {
    if (t.layer !== layer) continue;
    const x = t.x * w, tw = t.width * (layer ? 1 : .9);
    const y0 = Math.max(-20, yTop);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - tw * .32, y0); ctx.lineTo(x + tw * .32, y0);
    ctx.lineTo(x + tw * .5, h + 20); ctx.lineTo(x - tw * .5, h + 20); ctx.closePath(); ctx.fill();
    // Branch stubs and moss scroll with the layer, so climbing reads as motion.
    const spacing = layer ? 70 : 95, lo = Math.floor((c - (h - h * .3) / k) / spacing) - 1;
    const hi = Math.ceil((c + h * .3 / k) / spacing) + 1;
    for (let n = Math.max(-4, lo); n <= hi; n++) {
      const hv = hash(world.seed ^ Math.imul(ti + 1, 0x27D4EB2F) ^ Math.imul(n + 99, 0x165667B1));
      const ch = n * spacing + hv * spacing * .6;
      if (ch > top - 30) continue;
      const y = h * .3 + (c - ch) * k;
      if (y < -30 || y > h + 30) continue;
      const side = hv < .5 ? -1 : 1, len = (layer ? 16 : 9) + 14 * hv;
      ctx.strokeStyle = color; ctx.lineWidth = layer ? 3.2 : 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + side * tw * .3, y);
      ctx.quadraticCurveTo(x + side * (tw * .3 + len * .6), y - len * .15, x + side * (tw * .3 + len), y - len * .45); ctx.stroke();
      if (mossColor && hv > .3) {
        ctx.fillStyle = mossColor;
        ctx.beginPath(); ctx.ellipse(x - side * tw * .18, y + 10 * hv, tw * .22, 3 + 4 * hv, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (yTop > -tw * 4) cedar(ctx, x, yTop - tw * (layer ? 2.4 : 2.8), tw * (layer ? 2.6 : 3.2), 5, color);
  }
  ctx.restore();
}

function drawShrine(ctx, world, c, scale, alpha, sky) {
  // A single torii and two stone lanterns at the foot of the climb. They are
  // passed once, early, and never repeat.
  const {w, h} = world, k = scale * .35;
  const base = h * .92 + c * k;
  if (base - 120 > h || alpha <= .002) return;
  const x = w * world.torii, s = Math.min(1.25, w / 330);
  const col = rgba(mixRGB([14, 38, 42], sky[2], .35), .92);
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col;
  const pillarH = 92 * s, span = 38 * s;
  ctx.fillRect(x - span - 3 * s, base - pillarH, 6 * s, pillarH + 60);
  ctx.fillRect(x + span - 3 * s, base - pillarH, 6 * s, pillarH + 60);
  ctx.fillRect(x - span - 8 * s, base - pillarH + 16 * s, 2 * span + 16 * s, 4.5 * s);
  ctx.beginPath();
  ctx.moveTo(x - span - 18 * s, base - pillarH - 4 * s);
  ctx.quadraticCurveTo(x, base - pillarH + 3 * s, x + span + 18 * s, base - pillarH - 4 * s);
  ctx.lineTo(x + span + 14 * s, base - pillarH + 4 * s);
  ctx.quadraticCurveTo(x, base - pillarH + 10 * s, x - span - 14 * s, base - pillarH + 4 * s);
  ctx.closePath(); ctx.fill();
  for (const lx of [x - span - 34 * s, x + span + 34 * s]) {
    ctx.fillStyle = col;
    ctx.fillRect(lx - 2.5 * s, base - 22 * s, 5 * s, 40 * s);
    ctx.fillRect(lx - 7 * s, base - 30 * s, 14 * s, 9 * s);
    ctx.beginPath(); ctx.moveTo(lx - 10 * s, base - 30 * s); ctx.lineTo(lx, base - 37 * s); ctx.lineTo(lx + 10 * s, base - 30 * s); ctx.fill();
    const g = ctx.createRadialGradient(lx, base - 26 * s, 0, lx, base - 26 * s, 26 * s);
    g.addColorStop(0, 'rgba(255,214,150,.55)'); g.addColorStop(.25, 'rgba(240,180,110,.18)'); g.addColorStop(1, 'rgba(240,180,110,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 26 * s, base - 52 * s, 52 * s, 52 * s);
    ctx.fillStyle = 'rgba(255,224,170,.8)'; ctx.fillRect(lx - 2.5 * s, base - 28.5 * s, 5 * s, 4 * s);
  }
  ctx.restore();
}

function frond(ctx, x, y, size, angle, alpha, flip, light) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(flip * size, size); ctx.globalAlpha = alpha;
  // A drooping three-leaf spray on a thin stem.
  ctx.strokeStyle = '#0C2A2D'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(14, -4, 40, 8); ctx.stroke();
  for (const [px, py, rx, ry, rot] of [[14, -2, 17, 6.5, -.5], [27, 3, 19, 7, .35], [40, 9, 22, 8, .1]]) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, light); g.addColorStop(.45, '#0F3033'); g.addColorStop(1, '#071C21');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(rx * .3, -ry, rx * .8, -ry * .7, rx, 0);
    ctx.bezierCurveTo(rx * .7, ry * .8, rx * .3, ry * .7, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(150,196,168,.22)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(rx * .9, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawRidges(ctx, world, c, scale, alpha, sky) {
  if (alpha <= .002) return;
  const {w, h} = world;
  const base = Math.min(h * .84, h * .7 + (c - 1200) * scale * .035);
  ctx.save();
  for (let layer = 0; layer < 2; layer++) {
    const y0 = base + layer * 26, col = mixRGB(sky[2], [30, 42, 70], .28 + .26 * layer);
    ctx.globalAlpha = alpha * (.55 + .3 * layer);
    ctx.fillStyle = rgba(col);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      let y = y0;
      for (const [j, r] of world.ridge.entries()) y -= Math.sin(u * (3 + j * 2.3) + r.phase + layer) * r.amp * (9 - j * 1.6);
      if (!layer) y -= 70 * Math.exp(-(((u - world.peak) / .11) ** 2));
      ctx.lineTo(u * w, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawCloudSea(ctx, world, c, scale, at, alpha, sky, reduced) {
  if (alpha <= .002) return;
  const {w, h} = world;
  const top = Math.min(h * .9, h * .8 + (c - 1350) * scale * .05);
  const drift = reduced ? 0 : at * .004;
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const y = top + layer * 34, lit = mixRGB(sky[3], [236, 228, 220], .35 - .1 * layer);
    const body = mixRGB(sky[2], sky[1], .4 + .2 * layer);
    const g = ctx.createLinearGradient(0, y - 30, 0, y + 70);
    g.addColorStop(0, rgba(lit, .9)); g.addColorStop(.45, rgba(body, .95)); g.addColorStop(1, rgba(body, .98));
    ctx.globalAlpha = alpha * (.62 + .14 * layer); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-40, h + 10);
    // Irregular puffs keyed to a drifting world index, so the edge never pops.
    const step = 40 + layer * 14, shift = drift * (1 + layer * .6) + layer * 157;
    const first = Math.floor((-60 + shift) / step);
    ctx.lineTo(first * step - shift, y);
    for (let n = first; n * step - shift < w + 60; n++) {
      const x = n * step - shift, hv = hash(world.seed ^ Math.imul(n + 7, 0x2C1B3C6D) ^ layer * 0x9E37);
      const bump = (6 + 18 * hv) * (1 - .2 * layer), lean = (hash(n * 7919 ^ layer) - .5) * step * .5;
      ctx.bezierCurveTo(x + step * .12 + lean, y - bump, x + step * .88 + lean, y - bump, x + step, y);
    }
    ctx.lineTo(w + 60, h + 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawShafts(ctx, world, at, sx, sy, alpha, glow, reduced) {
  if (alpha <= .002) return;
  const {w, h} = world, sway = reduced ? 0 : Math.sin(at / 9000) * .05;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const a = 1.9 + i * .23 + sway + (i % 2 ? .04 : 0), len = h * 1.15, spread = .05 + .025 * (i % 3);
    const x1 = sx + Math.cos(a - spread) * len, y1 = sy + Math.sin(a - spread) * len;
    const x2 = sx + Math.cos(a + spread) * len, y2 = sy + Math.sin(a + spread) * len;
    const g = ctx.createLinearGradient(sx, sy, (x1 + x2) / 2, (y1 + y2) / 2);
    g.addColorStop(0, rgba(glow, .085 * alpha)); g.addColorStop(.5, rgba(glow, .03 * alpha)); g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawRainbow(ctx, world, alpha) {
  if (alpha <= .002) return;
  const {w, h} = world, cx = w * .28, cy = h * .78, r = Math.max(w, h * .55) * .92;
  const g = ctx.createRadialGradient(cx, cy, r - 13, cx, cy, r + 13);
  const bands = [[220, 120, 130], [236, 182, 120], [232, 222, 140], [140, 214, 150], [120, 170, 220], [160, 130, 210]];
  g.addColorStop(0, 'rgba(160,130,210,0)');
  bands.slice().reverse().forEach((b, i) => g.addColorStop(.1 + i * .16, rgba(b, alpha)));
  g.addColorStop(1, 'rgba(220,120,130,0)');
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, Math.PI * 1.04, Math.PI * 1.9); ctx.arc(cx, cy, r - 14, Math.PI * 1.9, Math.PI * 1.04, true); ctx.fill();
  ctx.restore();
}

function drawBirds(ctx, world, at, event, count, color, seed) {
  if (event.strength <= .001) return;
  const {w, h} = world, {strength, progress, slot} = event;
  const dir = hash(seed ^ 0x51ED270B ^ slot) < .5 ? 1 : -1;
  const x = (dir > 0 ? -40 : w + 40) + dir * (w + 80) * progress;
  const y = h * (.14 + .1 * hash(seed ^ 0xA24BAED5 ^ slot)) - progress * 18;
  ctx.save(); ctx.globalAlpha = .34 * strength; ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    const bx = x - dir * row * 15, by = y + (i ? side * row * 7 : 0) + row * 2;
    const flap = Math.sin(at / 160 + i * 1.7) * 2.2;
    ctx.beginPath(); ctx.moveTo(bx - 6, by + flap); ctx.quadraticCurveTo(bx, by - 4 - flap, bx + 6, by + flap); ctx.stroke();
  }
  ctx.restore();
}

/** Draws sky, distant world, forest, weather. Returns the scenic state for diagnostics. */
export function drawWorld(ctx, world, {at, camera, scale, seed, reduced}) {
  if (world.seed !== seed) build(world, seed);
  const {w, h} = world, c = Math.max(0, camera);
  const sky = skyAt(c), [top, mid, low, glow] = sky;
  const forest = 1 - band(c, 560, 1150);
  const cloudSea = band(c, 900, 1450);
  const mountains = band(c, 800, 1400);
  const cloudPass = band(c, 600, 900) * (1 - band(c, 1000, 1350));
  const stars = band(c, 1900, 3000);
  const rain = (1 - band(c, 700, 1250)) * (1 - .55 * band(c, 250, 700));
  const shafts = .3 + .7 * band(c, 120, 480) * (1 - band(c, 1100, 1700));

  const ev = (ch, slot, a, b) => reduced ? NONE : ambientEvent(seed, at, ch, slot, a, b);
  const lullEvent = ev(1, 13000, 1600, 1100), gustEvent = ev(2, 11000, 900, 900);
  const birdEvent = ev(3, 19000, 2200, 1400), lightEvent = ev(4, 23000, 2600, 1800);
  const rainLull = lullEvent.strength, gust = gustEvent.strength, light = lightEvent.strength;
  // Rare scenic moment: some rain lulls in the lower world leave a faint rainbow.
  const rainbowChance = lullEvent.slot >= 0 && hash(seed ^ 0x7F4A7C15 ^ lullEvent.slot) < .4;
  const rainbow = rainbowChance ? rainLull * band(c, 100, 320) * (1 - band(c, 1000, 1400)) : 0;

  // Sky body.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(top)); g.addColorStop(.55, rgba(mid)); g.addColorStop(1, rgba(low));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // Stars and a thin moon only once the climb has left the weather behind.
  if (stars > .002) {
    ctx.save(); ctx.fillStyle = '#F4EEDC';
    for (const s of world.stars) {
      const tw = reduced ? 1 : .65 + .35 * Math.sin(at / 900 + s.phase);
      ctx.globalAlpha = stars * tw * (.35 + .5 * s.s / 1.6);
      ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2); ctx.fill();
    }
    const mx = w * .2, my = h * .13;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
    halo.addColorStop(0, 'rgba(246,234,208,.22)'); halo.addColorStop(1, 'rgba(246,234,208,0)');
    ctx.globalAlpha = stars; ctx.fillStyle = halo; ctx.fillRect(mx - 46, my - 46, 92, 92);
    ctx.globalAlpha = stars * .92; ctx.fillStyle = '#F6EAD0';
    ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = rgba(mixRGB(top, mid, .22));
    ctx.beginPath(); ctx.arc(mx + 4.5, my - 2.5, 9.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Sun / rainbreak glow sinks toward the horizon as the run climbs into dusk.
  // It sets behind the cloud-pass mist, so it never crosses the play column bright.
  const sunT = band(c, 650, 1050);
  const gx = w * lerp(.7, .64, sunT), gy = h * lerp(.15, .82, sunT), gr = Math.max(w, h) * lerp(.4, .66, sunT);
  const sun = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  const glowA = (.34 + .16 * band(c, 250, 1300) - .2 * stars) * (1 + .3 * rainLull + .25 * light) * (1 - .75 * cloudPass);
  sun.addColorStop(0, rgba(mixRGB(glow, [255, 246, 226], .35), glowA * 1.15));
  sun.addColorStop(.12, rgba(glow, glowA * .75)); sun.addColorStop(.42, rgba(glow, glowA * .25)); sun.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  drawShafts(ctx, world, at, gx, gy, shafts * (1 + .6 * light + .4 * rainLull) * (1 - stars), glow, reduced);

  // Moving warm patch of canopy light (time-driven, never gameplay-driven).
  if (light > .001) {
    const dir = hash(seed ^ 0xC2B2AE35 ^ lightEvent.slot) < .5 ? 1 : -1;
    const lx = dir > 0 ? -w * .15 + lightEvent.progress * w * 1.3 : w * 1.15 - lightEvent.progress * w * 1.3;
    const lg = ctx.createRadialGradient(lx, h * .24, 0, lx, h * .24, w * .4);
    lg.addColorStop(0, rgba([255, 234, 192], .14 * light)); lg.addColorStop(1, 'rgba(255,234,192,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h * .6);
  }
  drawRainbow(ctx, world, .16 * rainbow);
  drawBirds(ctx, world, at, birdEvent, 2 + Math.round(3 * band(c, 400, 2000)), rgba(mixRGB(top, [6, 14, 20], .7)), seed);

  // Distant world opens up above the canopy.
  drawRidges(ctx, world, c, scale, mountains, sky);
  drawCloudSea(ctx, world, c, scale, at, cloudSea, sky, reduced);

  // Forest depth: far trunks, the shrine at the foot of the climb, near trunks.
  const farCol = rgba(mixRGB(mid, [20, 52, 54], .55)), nearCol = rgba(mixRGB(top, [7, 26, 30], .7));
  drawTrunks(ctx, world, c, scale, 0, .5 * forest, farCol, null);
  drawShrine(ctx, world, c, scale, forest, sky);
  drawTrunks(ctx, world, c, scale, 1, .8 * forest, nearCol, 'rgba(70,110,82,.35)');

  // Mist: a soft forest-floor haze, then a thick pass through the cloud layer.
  ctx.save();
  const mistA = .1 + .08 * (1 - forest) + .24 * cloudPass;
  for (let i = 0; i < 3; i++) {
    const drift = reduced ? 0 : ((at * (.006 + .003 * i) + i * 170) % (w + 400)) - 200;
    const my = h * (.36 + .22 * i) + (reduced ? 0 : Math.sin(at / 7000 + i) * 8);
    const mg = ctx.createRadialGradient(drift + w * .2, my, 0, drift + w * .2, my, w * .75);
    mg.addColorStop(0, rgba(mixRGB(mid, [214, 228, 220], .55), mistA)); mg.addColorStop(1, rgba(mid, 0));
    ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
  }
  if (cloudPass > .002) { ctx.fillStyle = rgba(mixRGB(mid, [220, 228, 224], .5), .16 * cloudPass); ctx.fillRect(0, 0, w, h); }
  ctx.restore();

  // Edge fronds frame the canopy and thin out with altitude; they scroll a little
  // faster than the world, which sells height during the post-release camera move.
  const frondA = .9 * (1 - band(c, 380, 1000));
  if (frondA > .002) {
    const gustSway = gust * Math.sin(at / 125) * .1;
    const k = scale * 1.1, span = h + 160;
    for (const fr of world.fronds) {
      const y = ((fr.y * span + c * k) % span + span) % span - 80;
      const sway = reduced ? 0 : Math.sin(at / 8000 + fr.phase) * .04 + gustSway;
      const x = fr.left ? -4 : w + 4;
      frond(ctx, x, y, fr.size * Math.min(1.15, w / 360), (fr.left ? .25 : -.25) + fr.angle * .5 + sway * (fr.left ? 1 : -1), frondA, fr.left ? 1 : -1, rgba(mixRGB(glow, [40, 90, 80], .7)));
    }
  }

  // Rain in two depths, thinning with altitude and easing in occasional lulls.
  if (!reduced && rain > .002) {
    const strength = rain * (1 - .74 * rainLull);
    ctx.save(); ctx.lineCap = 'round';
    for (const [n, alpha, len, width, speedK] of [[26, .1, 14, .6, .7], [14, .19, 26, 1, 1.25]]) {
      ctx.strokeStyle = rgba([215, 238, 235], alpha * strength); ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = (13 + (i % 5) * 4) * speedK;
        const x = ((i * 67 + n * 31 + at * .018 * sp) % (w + 120)) - 60;
        const y = ((i * 113 + n * 17 + at * .026 * sp) % (h + 160)) - 80;
        ctx.moveTo(x, y); ctx.lineTo(x - len * .29, y + len);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  world.info = {rainLull, gust, bird: birdEvent.strength, light, rainbow, forest, cloudSea, cloudPass, mountains, stars, rain, shafts};
  return world.info;
}
