'use strict';
// ===== LUB-DUB core: setup, state, helpers =====
const VERSION = '0.1.0';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let W = 0, H = 0, DPR = 1, U = 30, CX = 0, CY = 0;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  U = Math.max(22, Math.min(W, H) / 14); CX = W / 2; CY = H / 2 + (H > W ? 0 : 0);
}
addEventListener('resize', resize); resize();

const COL = { heart: '#ff2d55', gold: '#ffd166', cyan: '#5be7ff', germ: '#7cff6b', runner: '#ff8a3d', brute: '#b46bff', spitter: '#e6ff4d', splitter: '#3df5c8', boss: '#ff3df0' };
const DEF = {
  germ:     { hp: 1, r: .55, every: 2, cost: 1, score: 10, col: COL.germ },
  runner:   { hp: 1, r: .5,  every: 1, cost: 2, score: 20, col: COL.runner },
  brute:    { hp: 3, r: .85, every: 4, cost: 4, score: 50, col: COL.brute },
  spitter:  { hp: 2, r: .62, every: 2, cost: 4, score: 40, col: COL.spitter },
  splitter: { hp: 2, r: .78, every: 2, cost: 3, score: 30, col: COL.splitter },
  boss:     { hp: 14, r: 1.4, every: 2, cost: 0, score: 500, col: COL.boss }
};
const CARDS = {
  wide:   { name: 'Wide Pulse', max: 4, d: l => `All pulses reach +0.8 tiles further.` },
  steady: { name: 'Steady Hands', max: 3, d: l => `Timing windows get more forgiving.` },
  echo:   { name: 'Echo', max: 3, d: l => `A PERFECT pulse sends a second, weaker ring half a beat later.` },
  reflect:{ name: 'Mirror Wall', max: 1, d: l => `Spit bolts you pulse away fly back and kill what they hit.` },
  heart2: { name: 'Second Heart', max: 3, d: l => `+1 max health and heal 1 now.` },
  defib:  { name: 'Defibrillator', max: 3, d: l => `Heal 1 every ${[0, 14, 10, 7][l + 1] || 7} combo.` },
  knock:  { name: 'Shockwave', max: 3, d: l => `Pulses shove survivors back ${l + 1} tile${l ? 's' : ''}.` },
  volatile:{ name: 'Volatile', max: 3, d: l => `Kills burst and hurt neighbours nearby.` }
};

const LS = {
  get(k, d) { try { const v = localStorage.getItem('ld_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ld_' + k, JSON.stringify(v)); } catch (e) {} }
};

let G = null; // run state
let state = 'title'; // title | play | cards | over | pause
let best = LS.get('best', 0), offsetMs = LS.get('off', 0), muted = LS.get('mute', false);
Au.muted = muted;
let shake = 0, flash = 0, flashCol = '#ff2d55', hintT = 0;
const parts = [], texts = [], rings = [], bolts = [], enemies = [];
let ringId = 1, lastHalf = 0, lockUntil = 0, banner = null, titleT = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function BP() { return Au.ac ? Au.beatPos(Au.now()) : performance.now() / 1000 / (60 / 96); }
function SPB() { return Au.spb; }

// glow sprites
const glowCache = {};
function glow(col, size = 64) {
  const k = col + size; if (glowCache[k]) return glowCache[k];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, col); gr.addColorStop(.35, col + '66'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return glowCache[k] = c;
}
function drawGlow(x, y, r, col, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glow(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

function heartPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * .95);
  c.bezierCurveTo(x - s * 1.35, y + s * .1, x - s * 1.15, y - s * 1.05, x, y - s * .38);
  c.bezierCurveTo(x + s * 1.15, y - s * 1.05, x + s * 1.35, y + s * .1, x, y + s * .95); c.closePath();
}

function burst(x, y, col, n = 14, sp = 160, life = .6, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = rnd(.2, 1) * sp;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life * rnd(.6, 1.2), col, size: size * rnd(.6, 1.4) });
  }
}
function floatText(x, y, s, col = '#fff', size = 18, life = .9) { texts.push({ x, y, s, col, size, life, max: life }); }
function showBanner(s, sub, col = '#fff') { banner = { s, sub, col, t: 0, dur: 2.2 }; }
function setHint(s) { const h = $('hint'); if (s) { h.textContent = s; h.style.opacity = 1; } else h.style.opacity = 0; }

// positions: enemy at polar (a, d tiles) from heart
function pos(a, d) { return [CX + Math.cos(a) * d * U, CY + Math.sin(a) * d * U]; }
function spawnDist(a) {
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const dx = c > 1e-3 ? (W / 2) / c : 1e9, dy = s > 1e-3 ? (H / 2) / s : 1e9;
  return Math.min(Math.min(dx, dy) / U + 1.2, 12);
}
function dispD(e, bp) { // displayed distance, tweened hop
  const t = clamp((bp - e.hop) / .38, 0, 1); return lerp(e.dFrom, e.d, easeBack(t));
}
