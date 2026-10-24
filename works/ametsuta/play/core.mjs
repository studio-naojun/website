/** R3.1 geometry and timestamp state. World units; milliseconds. No stage dependencies. */
export const CONTACT_MS = 280;
export const CAMERA_MS = 220;
export const DROPLET_RECOVERY = .11;
export const PLATFORM_WIDTH_SCALE = .90;
export const WIDTH_SHRINK_MAX = .20;
export const WIDTH_FLOOR = .60;

// Odd 32-bit stride: initial run is the URL seed; retries form a reproducible sequence.
export function deriveRunSeed(baseSeed, runIndex) {
  return ((baseSeed >>> 0) + Math.imul(runIndex, 0x9E3779B9)) >>> 0;
}
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const anchors = [[0, 18, 60], [240, 16.5, 61], [720, 15, 65], [1440, 13.5, 70], [2880, 12, 74], [4800, 10.5, 78]];

export function curve(y) {
  for (let i = 1; i < anchors.length; i++) {
    if (y < anchors[i][0]) {
      const a = anchors[i - 1], b = anchors[i], t = (y - a[0]) / (b[0] - a[0]);
      return {base: a[1] + (b[1] - a[1]) * t, speed: a[2] + (b[2] - a[2]) * t};
    }
  }
  return {base: 10.5, speed: 78};
}

export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every order contains the same (rise, offset) multiset, so nominal length and
// height totals match. Each shape occurs once in each direction: no lateral drift.
// Varied d/h prevents a universal release angle; no performance feeds generation.
const offsets = new Map([[25, 40], [27.5, 45.375], [30, 45], [37.5, 65.625]]);
function library() {
  const out = [];
  function visit(a, left) {
    if (a.length === 8) {
      if (a[0] !== 25 || a[7] !== 25) return;
      let x = -20, ups = 0, downs = 0, big = 0;
      for (let i = 0; i < 8; i++) {
        x += (i % 2 ? -1 : 1) * offsets.get(a[i]);
        if (Math.abs(x) > 46) return;
        if (i) {
          ups += +(a[i] > a[i - 1]);
          downs += +(a[i] < a[i - 1]);
          big += +(Math.abs(a[i] - a[i - 1]) >= 10);
        }
      }
      if (Math.abs(x + 20) < 1e-8 && ups === 3 && downs === 3 && big === 2) {
        out.push(a.map(rise => ({rise, offset: offsets.get(rise)})));
      }
      return;
    }
    for (const h of [25, 27.5, 30, 37.5]) {
      if (left[h]) {
        const next = {...left};
        next[h]--;
        visit([...a, h], next);
      }
    }
  }
  visit([], {25: 2, 27.5: 2, 30: 2, 37.5: 2});
  if (out.length < 2) throw Error('Matched library unavailable');
  return out;
}
export const BLOCKS = library();

// A shared conservative speed per altitude block preserves matched nominal hold
// totals despite reordered rises. It certifies even an 18-unit preceding surface.
function blockSpeed(y) {
  const width = curve(y + 240).base * .5;
  const span = Math.min(...[...offsets].map(([rise, offset]) => {
    const d = offset - 9;
    return Math.hypot(rise, d + width / 2) - Math.hypot(rise, d - width / 2);
  }));
  return Math.min(curve(y).speed, span / .060);
}

export function course(seed, count = 512) {
  const rng = random(seed), mirror = rng() < .5 ? -1 : 1, leaves = [];
  let x = -20 * mirror, y = 0, last = -1;
  while (leaves.length < count) {
    let pick = Math.floor(rng() * BLOCKS.length);
    if (pick === last) pick = (pick + 1) % BLOCKS.length;
    last = pick;
    const speed = blockSpeed(y);
    for (const {rise, offset} of BLOCKS[pick]) {
      x += mirror * (leaves.length % 2 ? -1 : 1) * offset;
      y += rise;
      leaves.push({x, y, base: leaves.length === 0 ? 18 : curve(y - rise).base,
        block: Math.floor(leaves.length / 8), order: pick, speed});
    }
  }
  return {origin: {x: -20 * mirror, y: 0}, leaves};
}

export function interval(pivot, target, width) {
  const h = target.y - pivot.y, d = Math.abs(target.x - pivot.x);
  return {h, d, low: Math.hypot(h, d - width / 2),
    high: Math.hypot(h, d + width / 2), center: Math.hypot(h, d)};
}

export function geometry(pivot, target, width, previous) {
  const g = interval(pivot, target, width);
  // Span increases monotonically with d and W here. Endpoints at minimum W
  // therefore certify the entire preceding surface and all carried widths.
  const pivots = previous ? [previous.x - previous.base / 2, previous.x + previous.base / 2] : [pivot.x];
  const minSpan = Math.min(...pivots.map(x => {
    const z = interval({x, y: pivot.y}, target, target.base * PLATFORM_WIDTH_SCALE * .5);
    return z.high - z.low;
  }));
  const speed = Math.min(target.speed ?? curve(pivot.y).speed, minSpan / .060);
  const xAt = l => Math.sqrt(Math.max(0, l * l - g.h * g.h));
  const r = Math.max(target.base * .11,
    Math.abs(xAt(g.center + speed * .015) - g.d),
    Math.abs(xAt(g.center - speed * .015) - g.d));
  if (g.d - width / 2 <= 0 || 2 * r > target.base * .5 + 1e-8) throw Error('Uncertified geometry');
  return {...g, speed, r, windowMs: (g.high - g.low) / speed * 1000};
}

export function resolve(pivot, target, width, length, r) {
  const h = target.y - pivot.y, dir = Math.sign(target.x - pivot.x);
  const x = length >= h ? pivot.x + dir * Math.sqrt(length * length - h * h) : pivot.x;
  const offset = x - target.x;
  const success = length >= h && Math.abs(offset) <= width / 2 + 1e-9;
  return {success, x, y: target.y, offset, droplet: success && Math.abs(offset) <= r + 1e-9,
    reason: success ? '' : length < h || dir * (x - target.x) < 0 ? '短い' : '長い'};
}

export function widthChange(width, base, offset, r, droplet, recovery = DROPLET_RECOVERY) {
  const playableBase = base * PLATFORM_WIDTH_SCALE;
  const q = width / playableBase;
  const raw = droplet ? recovery : -WIDTH_SHRINK_MAX * clamp((Math.abs(offset) - r) / (playableBase / 2 - r), 0, 1);
  return {ratio: clamp(q + raw, WIDTH_FLOOR, 1), raw};
}

// Deliberately accepts no outcome. All releases use the same camera schedule.
export function cameraPlan(from, pivot, target, at) {
  return {from, to: target.y - pivot.y + from, at, duration: CAMERA_MS};
}

export class Game {
  constructor(seed = 1, pb = 0, recovery = DROPLET_RECOVERY) {
    this.baseSeed = seed >>> 0;
    this.runIndex = 0;
    this.seed = deriveRunSeed(this.baseSeed, this.runIndex);
    this.recovery = recovery;
    this.pb = pb;
    this.logs = [];
    this.held = false;
    this.reset();
  }
  reset() {
    const c = course(this.seed);
    this.leaves = c.leaves;
    this.pivot = {...c.origin};
    this.index = 0;
    this.width = 18 * PLATFORM_WIDTH_SCALE;
    this.height = 0;
    this.phase = 'WAIT';
    this.length = 0;
    this.camera = 0;
    this.plan = null;
    this.missVisibleAt = null;
    this.pending = null;
    this.buffered = false;
    this.impactAt = null;
  }
  get target() { return this.leaves[this.index]; }
  get geom() { return geometry(this.pivot, this.target, this.width, this.index ? this.leaves[this.index - 1] : null); }
  down(at) {
    if (this.held) return;
    if (this.missVisibleAt !== null && at >= this.missVisibleAt) return;
    this.held = true;
    if (this.phase === 'WAIT') this.begin(at);
    else if (this.phase === 'TOPPLE' && this.pending.success) this.buffered = true;
  }
  retry(at, source = '') {
    if (source !== 'result-button') return false;
    if (this.missVisibleAt === null || at < this.missVisibleAt) return false;
    const previous = this.logs.at(-1);
    this.runIndex++;
    this.seed = deriveRunSeed(this.baseSeed, this.runIndex);
    this.reset();
    if (previous) {
      previous.restartVisibleAt = at;
      previous.retryPressAt = at;
      previous.retryLatencyMs = 0;
      previous.restartRunSeed = this.seed;
      previous.restartRunIndex = this.runIndex;
    }
    return true;
  }
  begin(at) {
    this.phase = 'GROW';
    this.holdAt = at;
    this.speed = this.geom.speed;
    this.length = 0;
  }
  up(at, cancel = false) {
    if (!this.held) return;
    this.held = false;
    this.buffered = false;
    if (this.phase !== 'GROW') return;
    if (cancel) {
      this.phase = 'WAIT';
      this.length = 0;
      return;
    }
    this.length = Math.max(0, at - this.holdAt) * this.speed / 1000;
    const g = this.geom;
    this.pending = resolve(this.pivot, this.target, this.width, this.length, g.r);
    this.releaseAt = at;
    this.phase = 'TOPPLE';
    this.plan = cameraPlan(this.camera, this.pivot, this.target, at);
    this.log = {baseSeed: this.baseSeed, runSeed: this.seed, runIndex: this.runIndex, seed: this.seed, index: this.index, block: this.target.block, order: this.target.order,
      pivot: {...this.pivot}, target: {...this.target}, width: this.width, speed: this.speed,
      pressAt: this.holdAt, releaseAt: at, length: this.length, centerLength: g.center,
      windowMs: g.windowMs, dropletRadius: g.r, outcome: {...this.pending}, camera: {...this.plan},
      missVisibleAt: null, restartVisibleAt: null};
    this.logs.push(this.log);
    if (this.logs.length > 2000) this.logs.shift();
  }
  advance(at) {
    if (this.phase === 'GROW') this.length = Math.max(0, at - this.holdAt) * this.speed / 1000;
    if (this.plan) {
      const u = clamp((at - this.plan.at) / CAMERA_MS, 0, 1);
      this.camera = this.plan.from + (this.plan.to - this.plan.from) * (1 - (1 - u) ** 3);
    }
  }
  // Renderer calls this AFTER drawing. A resolved miss alone never grants retry.
  painted(at) {
    if (this.phase !== 'TOPPLE') return;
    const elapsed = at - this.releaseAt;
    if (!this.pending.success && (this.length < this.geom.h || elapsed >= CONTACT_MS) && this.missVisibleAt === null) {
      this.missVisibleAt = at;
      this.log.missVisibleAt = at;
    }
    if (elapsed < CONTACT_MS || !this.pending.success) return;
    const result = this.pending;
    const change = widthChange(this.width, this.target.base, result.offset, this.geom.r, result.droplet, this.recovery);
    this.log.widthRawDelta = change.raw;
    this.log.widthRatioAfter = change.ratio;
    this.pivot = {x: result.x, y: result.y};
    this.height = this.pivot.y;
    this.pb = Math.max(this.pb, this.height);
    this.index++;
    if (this.index + 2 >= this.leaves.length) this.leaves = course(this.seed, this.leaves.length + 512).leaves;
    this.width = this.target.base * PLATFORM_WIDTH_SCALE * change.ratio;
    this.log.nextWidth = this.width;
    this.impactAt = at;
    this.impactDroplet = result.droplet;
    this.phase = 'WAIT';
    this.length = 0;
    this.pending = null;
    this.plan = null;
    if (this.held && this.buffered) this.begin(at);
    this.buffered = false;
  }
  read() {
    return {baseSeed: this.baseSeed, runSeed: this.seed, runIndex: this.runIndex, seed: this.seed, phase: this.phase, index: this.index, pivot: {...this.pivot},
      target: {...this.target}, width: this.width, geometry: this.geom, length: this.length,
      height: this.height, pb: this.pb, held: this.held, missVisibleAt: this.missVisibleAt,
      camera: this.camera, plan: this.plan ? {...this.plan} : null,
      pending: this.pending ? {...this.pending} : null, logs: structuredClone(this.logs)};
  }
}
