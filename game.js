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
// ===== LUB-DUB logic: run, waves, beat, pulses =====
function stats() {
  const c = G.cards;
  return {
    wide: (c.wide || 0) * .8, perfW: 55 + (c.steady || 0) * 14, goodW: 115 + (c.steady || 0) * 22,
    echo: c.echo || 0, reflect: !!c.reflect, defib: c.defib || 0, knock: c.knock || 0, vol: c.volatile || 0
  };
}
function newRun() {
  G = { wave: 0, score: 0, hp: 5, maxhp: 5, combo: 0, bestCombo: 0, cards: {}, hurtThisWave: false,
        spawnQ: [], waveBeat: -4, waveActive: false, clearT: 0, invuln: 0, kills: 0, perfects: 0, taps: 0, offs: 0 };
  enemies.length = bolts.length = rings.length = parts.length = texts.length = 0;
  lockUntil = 0; shake = 0; flash = 0;
  Au.setTempo(96); Au.level = 1;
  state = 'play'; hideAll(); $('hudbtn').style.display = 'flex';
  lastHalf = Math.floor(BP() * 2);
  startWave(1);
}
function genWave(n) {
  const boss = n % 5 === 0, q = [];
  const types = ['germ']; if (n >= 2) types.push('runner'); if (n >= 3) types.push('splitter'); if (n >= 4) types.push('spitter'); if (n >= 6) types.push('brute');
  let budget = 3 + n * 2.3 + (n > 10 ? (n - 10) * 1.2 : 0); if (boss) budget *= .45;
  const packs = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)].slice(0, 1 + (n > 2) + (n > 6));
  const span = 9 + Math.min(16, n * 1.2);
  let safety = 200;
  while (budget > 0 && safety--) {
    const t = types[(Math.random() * types.length) | 0], d = DEF[t]; if (d.cost > budget && t !== 'germ') continue;
    budget -= d.cost;
    const a = packs[(Math.random() * packs.length) | 0] + (Math.random() + Math.random() + Math.random() - 1.5) * .9;
    let at = Math.random() * span; at = t === 'runner' ? Math.round(at) : Math.round(at * 2) / 2;
    q.push({ at, t, a });
  }
  if (boss) q.push({ at: 1, t: 'boss', a: -Math.PI / 2 });
  q.sort((x, y) => x.at - y.at); return q;
}
function startWave(n) {
  G.wave = n; G.spawnQ = genWave(n); G.waveBeat = -4; G.waveActive = true; G.hurtThisWave = false; G.clearT = 0;
  const bpm = 96 + Math.min(28, (n - 1) * 2); Au.setTempo(bpm);
  Au.level = n % 5 === 0 ? 3 : Math.min(3, 1 + Math.floor((n - 1) / 3));
  state = 'play'; hideAll(); $('hudbtn').style.display = 'flex';
  if (n % 5 === 0) { Au.boss(); showBanner('THE CLOT', 'Only a PERFECT pulse reaches it', COL.boss); } else { Au.wave(); showBanner('WAVE ' + n, n === 1 ? '' : 'Tempo ' + bpm, '#fff'); }
  if (n === 1 && !LS.get('seen', false)) { setHint('TAP when the ring closes on the heart'); hintT = 14; }
}
function spawn(t, a) {
  const d = DEF[t], sd = spawnDist(a), bp = BP();
  const e = { t, a, d: sd, dFrom: sd, hop: bp - 1, hp: d.hp + (t === 'boss' ? G.wave * 1.5 | 0 : 0), r: d.r, flash: 0, cnt: 0, warn: 0, ring: 0, seed: Math.random() * 9 };
  e.maxhp = e.hp; if (t === 'spitter') e.hold = Math.min(5, sd - 1.4); if (t === 'boss') e.hold = Math.min(5.4, sd - 1.6);
  enemies.push(e);
}
function onHalf(h) {
  if (state !== 'play') return;
  const beat = h % 2 === 0, bp = h / 2;
  for (const e of enemies) {
    const dd = DEF[e.t];
    if (h % dd.every === 0 && !(e.hold && e.d <= e.hold)) { e.dFrom = dispD(e, bp); e.d -= 1; e.hop = bp; }
  }
  for (const b of bolts) if (!b.ref && h % 2 === 0) { b.dFrom = dispD(b, bp); b.d -= 1.5; b.hop = bp; }
  if (!beat) return;
  onBeat(bp);
}
function onBeat(bp) {
  G.waveBeat++;
  const wb = G.waveBeat;
  while (G.spawnQ.length && G.spawnQ[0].at <= wb) { const s = G.spawnQ.shift(); spawn(s.t, s.a); }
  for (const e of enemies) {
    if (e.hold && e.d <= e.hold) {
      e.cnt++;
      if (e.t === 'spitter') { if (e.cnt % 4 === 3) e.warn = 1; if (e.cnt % 4 === 0) fireBolt(e, 0); }
      if (e.t === 'boss') {
        if (e.cnt % 4 === 3) e.warn = 1;
        if (e.cnt % 4 === 0) { for (let i = -1; i <= 1; i++) { const ne = enemiesPush('germ', e.a + i * .5, e.d); } Au.deflect(); }
        if (e.cnt % 8 === 0) for (let i = -1; i <= 1; i++) fireBolt(e, i * .3);
      }
    }
  }
  if (G.combo > 0 && (BP() - G.lastTapBeat) > 7) G.combo = 0;
  if (G.invuln > 0) G.invuln--;
  if (G.waveActive && !G.spawnQ.length && !enemies.length) { G.clearT++; if (G.clearT >= 2) waveClear(); }
  if (hintT > 0 && --hintT <= 0) setHint('');
}
function enemiesPush(t, a, d) { spawn(t, a); const e = enemies[enemies.length - 1]; e.d = d; e.dFrom = d; return e; }
function fireBolt(e, da) { bolts.push({ a: e.a + da, d: e.d - e.r, dFrom: e.d - e.r, hop: BP(), ref: false }); e.warn = 0; Au.deflect(); }
function waveClear() {
  G.waveActive = false; bolts.length = 0;
  let bonus = G.wave * 50; G.score += bonus;
  let msg = 'CLEAR +' + bonus;
  if (!G.hurtThisWave && G.hp < G.maxhp) { G.hp++; msg += '  FLAWLESS +1♥'; }
  showBanner('WAVE CLEAR', msg, COL.gold); Au.card();
  setTimeout(() => { if (state === 'play') openCards(); }, 1500);
}
function pickCards() {
  const keys = Object.keys(CARDS).filter(k => (G.cards[k] || 0) < CARDS[k].max); const out = [];
  while (out.length < 3 && keys.length) out.push(keys.splice((Math.random() * keys.length) | 0, 1)[0]);
  return out;
}
function openCards() {
  state = 'cards'; setHint(''); const row = $('cardrow'); row.innerHTML = '';
  pickCards().forEach((k, i) => {
    const lv = G.cards[k] || 0, c = CARDS[k], b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<div class="k">${i + 1}</div><div class="n">${c.name}</div><div class="d">${c.d(lv)}</div><div class="lv">${lv ? 'LEVEL ' + lv + ' → ' + (lv + 1) : 'NEW'}</div>`;
    b.onclick = () => takeCard(k); b.dataset.k = k; row.appendChild(b);
  });
  hideAll('cards'); $('cards').classList.add('show'); $('hudbtn').style.display = 'none';
}
function takeCard(k) {
  if (state !== 'cards') return;
  G.cards[k] = (G.cards[k] || 0) + 1;
  if (k === 'heart2') { G.maxhp++; G.hp = Math.min(G.maxhp, G.hp + 1); }
  Au.card(); startWave(G.wave + 1);
}
function hurt(n = 1) {
  if (G.invuln > 0 || state !== 'play') return;
  G.hp -= n; G.hurtThisWave = true; G.combo = 0; G.invuln = 1; shake = 14; flash = .5; flashCol = '#ff0030'; Au.hurt();
  burst(CX, CY, '#ff5070', 26, 260, .7, 4); floatText(CX, CY - U * 1.3, '-' + n + ' ♥', '#ff5070', 26);
  if (G.hp <= 0) gameOver();
}
function gameOver() {
  state = 'over'; Au.over(); Au.level = 0; setHint('');
  const nb = G.score > best; if (nb) { best = G.score; LS.set('best', best); }
  $('oScore').textContent = G.score; $('oWave').textContent = G.wave; $('oCombo').textContent = G.bestCombo;
  $('oBest').innerHTML = nb ? '<b>NEW BEST!</b>' : 'Best <b>' + best + '</b>';
  const cs = Object.entries(G.cards).map(([k, v]) => CARDS[k].name + (v > 1 ? ' ×' + v : '')).join(' · ');
  $('oCards').textContent = cs; $('hudbtn').style.display = 'none';
  $('lbSend').style.display = G.score > 0 ? '' : 'none'; lbLoad(0);
  setTimeout(() => { if (state === 'over') { hideAll('over'); $('over').classList.add('show'); } }, 1100);
  LS.set('seen', true);
}
function hideAll(except) { ['title', 'cards', 'pause', 'over'].forEach(i => { if (i !== except) $(i).classList.remove('show'); }); }
// ===== LUB-DUB: input, pulses, damage =====
function tap(evTs) {
  if (state !== 'play') return;
  const now = Au.now(); if (now < lockUntil) { return; }
  const inDelay = evTs ? Math.max(0, Math.min(.12, (performance.now() - evTs) / 1000)) : 0;
  const lat = Au.latency() + offsetMs / 1000;
  const bp = Au.beatPos(now - lat - inDelay), err = (bp - Math.round(bp)) * SPB() * 1000; // ms, +late
  const S = stats(), a = Math.abs(err);
  const q = a <= S.perfW ? 2 : a <= S.goodW ? 1 : 0;
  G.taps++; G.lastTapBeat = BP(); G.lastErr = err;
  let max, dmg;
  if (q === 2) { max = 5.5 + S.wide; dmg = 2; G.perfects++; G.combo++; floatText(CX, CY - U * 1.6, 'PERFECT', COL.gold, 22); }
  else if (q === 1) { max = 3.8 + S.wide; dmg = 1; G.combo++; floatText(CX, CY - U * 1.6, err < 0 ? 'EARLY' : 'LATE', COL.cyan, 17); }
  else { max = 1.5 + S.wide * .3; dmg = 1; G.combo = 0; G.offs++; G.invuln; floatText(CX, CY - U * 1.6, err < 0 ? 'TOO EARLY' : 'TOO LATE', '#ff7088', 17); }
  lockUntil = now + SPB() * (q === 0 ? .95 : .3);
  G.bestCombo = Math.max(G.bestCombo, G.combo);
  if (S.defib && q && G.combo > 0 && G.combo % ([0, 14, 10, 7][S.defib]) === 0 && G.hp < G.maxhp) { G.hp++; floatText(CX, CY + U * 1.6, '+1 ♥', '#ff5070', 22); }
  Au.pulse(q);
  addRing(max, dmg, q);
  if (q === 2 && S.echo) for (let i = 1; i <= S.echo; i++) setTimeout(() => { if (state === 'play') addRing(max * .75, 1, 3); }, SPB() * 500 * i);
  shake = Math.max(shake, q === 2 ? 5 : 2); flash = q === 2 ? .18 : .06; flashCol = q === 2 ? '#ffd166' : '#ff2d55';
  heartKick = 1;
}
let heartKick = 0;
function addRing(max, dmg, q) { rings.push({ id: ringId++, t0: Au.now(), max, dmg, q, r: 0 }); }
function mult() { return Math.min(6, 1 + Math.floor(G.combo / 10)); }
function ePos(e, bp) { const d = dispD(e, bp); return [Math.cos(e.a) * d, Math.sin(e.a) * d]; }
function damage(e, dmg, kb, bp) {
  e.hp -= dmg; e.flash = 1;
  if (e.hp <= 0) { kill(e, bp); return; }
  Au.deflect();
  if (kb && e.t !== 'boss') { e.dFrom = dispD(e, bp); e.d += kb; e.hop = bp; if (e.hold) e.hold = Math.min(e.hold, 99); }
}
function kill(e, bp, chain = 0) {
  if (e.dead) return; e.dead = true;
  const [x, y] = pos(e.a, dispD(e, bp)), d = DEF[e.t];
  G.kills++; const gain = d.score * mult(); G.score += gain;
  Au.kill(Math.min(9, (G.combo / 2) | 0));
  burst(x, y, d.col, e.t === 'boss' ? 80 : 14, e.t === 'boss' ? 420 : 180, e.t === 'boss' ? 1.4 : .6, e.t === 'boss' ? 5 : 3);
  if (e.t !== 'boss') floatText(x, y - 10, '+' + gain, '#fff', 14, .7);
  if (e.t === 'splitter') { for (const s of [-.3, .3]) { const n = enemiesPush('germ', e.a + s * .5 / Math.max(1, e.d * .3), Math.max(1, dispD(e, bp))); n.hop = bp; } }
  if (e.t === 'boss') {
    shake = 30; flash = .8; flashCol = '#ff3df0'; G.score += 500; if (G.hp < G.maxhp) G.hp++;
    for (const o of enemies) if (o !== e && !o.dead) kill(o, bp, 9); bolts.length = 0; Au.card();
    floatText(CX, CY - U * 2, 'CLOT DESTROYED  +1♥', COL.boss, 26, 2);
  }
  const S = stats();
  if (S.vol && chain < 2) {
    const [ex, ey] = [Math.cos(e.a) * dispD(e, bp), Math.sin(e.a) * dispD(e, bp)], rad = .9 + S.vol * .6;
    burst(x, y, '#ffffff', 10, 120, .35, 2);
    for (const o of enemies) { if (o === e || o.dead) continue; const [ox, oy] = ePos(o, bp); if (Math.hypot(ox - ex, oy - ey) < rad + o.r) damage(o, 1, 0, bp); }
  }
}
function update(dt) {
  const bp = BP();
  if (state === 'play' || state === 'cards' || state === 'over') {
    const h = Math.floor(bp * 2);
    if (h > lastHalf) { for (let i = lastHalf + 1; i <= h && i - lastHalf < 8; i++) onHalf(i); lastHalf = h; }
  }
  if (state !== 'play' && state !== 'over') return stepFx(dt);
  const S = G ? stats() : null, now = Au.now();
  // rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const rg = rings[i], t = (now - rg.t0) / .26; rg.r = rg.max * easeOut(clamp(t, 0, 1));
    if (state === 'play') {
      for (const e of enemies) {
        if (e.dead || e.ring === rg.id) continue; const d = dispD(e, bp);
        if (rg.r >= d - e.r * .8) { e.ring = rg.id; damage(e, rg.dmg, rg.q === 3 ? 0 : S.knock, bp); }
      }
      for (const b of bolts) {
        if (b.dead || b.ref) continue; if (rg.r >= dispD(b, bp)) {
          Au.deflect(); burst(...pos(b.a, dispD(b, bp)), '#e6ff4d', 8, 120, .3, 2);
          if (S.reflect) { b.ref = true; b.ra = b.a; b.rd = dispD(b, bp); } else b.dead = true;
        }
      }
    }
    if (t >= 1.5) rings.splice(i, 1);
  }
  enemies.splice(0, enemies.length, ...enemies.filter(e => !e.dead));
  if (state === 'play') {
    // contact
    for (const e of enemies) {
      const d = dispD(e, bp);
      if (e.t !== 'boss' && d <= .75 + e.r * .6) { e.dead = true; const [x, y] = pos(e.a, d); burst(x, y, DEF[e.t].col, 10, 140, .4); hurt(e.t === 'brute' ? 2 : 1); }
      e.flash = Math.max(0, e.flash - dt * 5);
    }
    enemies.splice(0, enemies.length, ...enemies.filter(e => !e.dead));
    // bolts
    for (const b of bolts) {
      if (b.ref) { b.rd += 16 * dt; const bx = Math.cos(b.ra) * b.rd, by = Math.sin(b.ra) * b.rd;
        for (const o of enemies) { if (o.dead) continue; const [ox, oy] = ePos(o, bp); if (Math.hypot(ox - bx, oy - by) < o.r + .35) { damage(o, 2, 0, bp); b.dead = true; break; } }
        if (b.rd > 14) b.dead = true; continue; }
      const d = dispD(b, bp); if (d <= .7) { b.dead = true; hurt(1); }
    }
    for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].dead) bolts.splice(i, 1);
  }
  stepFx(dt);
}
function stepFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .93; p.vy *= .93; }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; t.y -= 26 * dt; if (t.life <= 0) texts.splice(i, 1); }
  shake *= Math.pow(.001, dt); flash = Math.max(0, flash - dt * 1.6); heartKick = Math.max(0, heartKick - dt * 5);
  if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
}
// ===== LUB-DUB: rendering =====
const bgImg = new Image(); let bgOk = false; bgImg.onload = () => bgOk = true; bgImg.src = '/img/bg.jpg';
const cells = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(.02, .09), s: rnd(.02, .06), p: Math.random() * 6 }));

function drawBG(t, bp) {
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * .75);
  g.addColorStop(0, '#2a0712'); g.addColorStop(.5, '#14040a'); g.addColorStop(1, '#050103');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (bgOk) { ctx.globalAlpha = .38; const s = Math.max(W / bgImg.width, H / bgImg.height) * 1.05; ctx.drawImage(bgImg, CX - bgImg.width * s / 2, CY - bgImg.height * s / 2, bgImg.width * s, bgImg.height * s); ctx.globalAlpha = 1; }
  const ph = bp - Math.floor(bp), pulse = Math.exp(-ph * 5) * .5;
  ctx.globalCompositeOperation = 'lighter';
  for (const c of cells) {
    const x = ((c.x + Math.sin(t * c.s + c.p) * .05) % 1) * W, y = ((c.y + Math.cos(t * c.s * .8 + c.p) * .05) % 1) * H, r = c.r * Math.min(W, H) * (1 + pulse * .12);
    drawGlow(x, y, r, '#8a1230', .22 + pulse * .12);
  }
  drawGlow(CX, CY, U * (8 + pulse * 3), '#ff2d55', .12 + pulse * .1);
  ctx.globalCompositeOperation = 'source-over';
  // arena rings
  ctx.strokeStyle = 'rgba(255,120,150,.07)'; ctx.lineWidth = 1;
  for (const r of [3.8, 5.5]) { ctx.beginPath(); ctx.arc(CX, CY, r * U, 0, 6.283); ctx.stroke(); }
}
function drawBlob(x, y, r, col, t, seed, n = 14, wob = .08, spikes = 0) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * 6.283, k = 1 + Math.sin(t * 4 + i * 1.7 + seed) * wob + (spikes && i % 2 ? spikes : 0);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function drawEnemy(e, t, bp) {
  const d = dispD(e, bp), [x, y] = pos(e.a, d), r = e.r * U, col = DEF[e.t].col, f = e.flash;
  drawGlow(x, y, r * 2.6, col, .5 + (e.warn ? .4 * Math.sin(t * 30) : 0));
  const body = f > .3 ? '#ffffff' : col, dark = 'rgba(0,0,0,.45)';
  const face = e.a + Math.PI; // facing the heart
  switch (e.t) {
    case 'runner': drawBlob(x, y, r, body, t, e.seed, 10, .05, .55); break;
    case 'brute': drawBlob(x, y, r, body, t, e.seed, 18, .04, .12); drawBlob(x, y, r * .62, dark, t, e.seed + 2, 12, .05); break;
    case 'splitter': drawBlob(x - r * .28, y, r * .75, body, t, e.seed, 12, .09); drawBlob(x + r * .3, y + r * .1, r * .62, body, t, e.seed + 3, 12, .09); break;
    case 'spitter': drawBlob(x, y, r, body, t, e.seed, 12, .07); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x + Math.cos(face) * r * .8, y + Math.sin(face) * r * .8, r * .38, 0, 6.283); ctx.fill(); break;
    case 'boss': drawBlob(x, y, r, body, t, e.seed, 28, .06, .1); drawBlob(x, y, r * .7, dark, t * .5, e.seed, 20, .08);
      ctx.fillStyle = body; for (let i = 0; i < 5; i++) { const a = t * .6 + i * 1.2566; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * .38, y + Math.sin(a) * r * .38, r * .12, 0, 6.283); ctx.fill(); } break;
    default: drawBlob(x, y, r, body, t, e.seed, 12, .09);
  }
  // eyes
  if (e.t !== 'boss') {
    const ex = Math.cos(face) * r * .25, ey = Math.sin(face) * r * .25, px = -Math.sin(face) * r * .28, py = Math.cos(face) * r * .28;
    ctx.fillStyle = '#10020a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + ex + px * s, y + ey + py * s, r * .17, 0, 6.283); ctx.fill(); }
  }
  if (e.maxhp > 1 && e.hp > 0) { const w = r * 1.6; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y - r - 11, w, 5); ctx.fillStyle = col; ctx.fillRect(x - w / 2, y - r - 11, w * e.hp / e.maxhp, 5); }
}
function drawHeart(t, bpL) {
  const ph = bpL - Math.floor(bpL), lub = Math.exp(-ph * 7), dub = ph > .22 ? Math.exp(-(ph - .22) * 9) * .6 : 0;
  const s = U * .72 * (1 + .16 * (lub + dub) + .12 * heartKick);
  drawGlow(CX, CY, s * 4.2, '#ff2d55', .55 + .3 * lub);
  const inv = G && G.invuln > 0 && Math.floor(t * 14) % 2 === 0;
  heartPath(ctx, CX, CY, s); const g = ctx.createRadialGradient(CX - s * .3, CY - s * .4, s * .1, CX, CY, s * 1.3);
  g.addColorStop(0, inv ? '#ffffff' : '#ff7a94'); g.addColorStop(.6, inv ? '#ffd0d8' : '#ff2d55'); g.addColorStop(1, '#a50f30'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
}
function drawGuide(bpL) {
  const ph = bpL - Math.floor(bpL), toBeat = 1 - ph, S = G ? stats() : { perfW: 55 }, win = S.perfW / (SPB() * 1000);
  const r = U * .75 + toBeat * U * 3.2, inWin = toBeat < win || ph < win;
  ctx.globalAlpha = Math.pow(ph, 1.5) * .95 + (inWin ? .3 : 0); ctx.lineWidth = inWin ? 5 : 3;
  ctx.strokeStyle = inWin ? COL.gold : '#ffb3c1'; ctx.beginPath(); ctx.arc(CX, CY, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  // edge beat dots on both sides for peripheral reading
  const k = Math.pow(ph, 2); ctx.fillStyle = inWin ? COL.gold : '#ffb3c1'; ctx.globalAlpha = k * .8;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(CX + sx * (U * 4.2 + toBeat * U * 3), CY + U * 4.6, 4 + 3 * k, 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1;
}
function drawRings(bp) {
  const now = Au.now();
  for (const rg of rings) {
    const t = clamp((now - rg.t0) / .26, 0, 1.5), a = rg.q === 3 ? .6 : 1, col = rg.q === 2 ? COL.gold : rg.q === 3 ? '#ffe9a8' : rg.q === 1 ? COL.cyan : '#ff7088';
    const fade = t < 1 ? 1 : 1 - (t - 1) * 2; if (fade <= 0) continue;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col; ctx.globalAlpha = fade * a * .35; ctx.lineWidth = 16 + (rg.q === 2 ? 10 : 0); ctx.beginPath(); ctx.arc(CX, CY, rg.r * U, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = fade * a; ctx.lineWidth = rg.q === 2 ? 5 : 3; ctx.stroke();
    ctx.globalAlpha = fade * a * .08; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(CX, CY, rg.r * U, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}
function drawBolts(t, bp) {
  for (const b of bolts) {
    let x, y; if (b.ref) { [x, y] = pos(b.ra, b.rd); } else [x, y] = pos(b.a, dispD(b, bp));
    drawGlow(x, y, U * 1.1, b.ref ? '#ffffff' : '#e6ff4d', .9); ctx.fillStyle = b.ref ? '#fff' : '#f4ff90'; ctx.beginPath(); ctx.arc(x, y, U * .2, 0, 6.283); ctx.fill();
  }
}
function drawHUD(t) {
  const m = Math.max(12, U * .5), hs = Math.max(9, U * .3);
  for (let i = 0; i < G.maxhp; i++) { heartPath(ctx, m + hs * 1.5 + i * hs * 2.9, m + hs * 1.4, hs); ctx.fillStyle = i < G.hp ? '#ff2d55' : 'rgba(255,255,255,.12)'; ctx.fill(); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(20, U * .85)}px 'Chakra Petch',sans-serif`;
  ctx.fillText(String(G.score).padStart(6, '0'), CX, m + U * .75);
  ctx.font = `600 ${Math.max(11, U * .38)}px 'Chakra Petch',sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillText('WAVE ' + G.wave + (G.wave % 5 === 0 ? ' · BOSS' : ''), CX, m + U * 1.3);
  if (G.combo >= 2) {
    ctx.fillStyle = COL.gold; ctx.font = `700 ${Math.max(18, U * .8)}px 'Chakra Petch',sans-serif`; ctx.fillText(G.combo + ' COMBO', CX, H - m - U * .9);
    ctx.font = `600 ${Math.max(11, U * .4)}px 'Chakra Petch',sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText('×' + mult() + ' score', CX, H - m - U * .35);
  }
  if (banner) {
    const k = banner.t / banner.dur, a = k < .15 ? k / .15 : k > .75 ? (1 - k) / .25 : 1, sc = 1 + (1 - Math.min(1, banner.t * 4)) * .3;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(CX, CY - U * 3.6); ctx.scale(sc, sc);
    ctx.fillStyle = banner.col; ctx.font = `700 ${Math.max(30, U * 1.6)}px 'Chakra Petch',sans-serif`; ctx.shadowColor = banner.col; ctx.shadowBlur = 24; ctx.fillText(banner.s, 0, 0); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = `500 ${Math.max(13, U * .5)}px 'Chakra Petch',sans-serif`; ctx.fillText(banner.sub || '', 0, U * .8); ctx.restore();
  }
}
function render(t) {
  const bp = BP(), bpL = Au.ac ? Au.beatPos(Au.now() - Au.latency() - offsetMs / 1000) : bp;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save(); if (shake > .3) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  drawBG(t, bpL);
  if (G && (state === 'play' || state === 'over' || state === 'pause' || state === 'cards')) {
    for (const e of enemies) drawEnemy(e, t, bp);
    drawBolts(t, bp); drawRings(bp);
    if (state === 'play') drawGuide(bpL);
  } else if (state === 'title') { drawGuide(bpL); }
  if (state !== 'over' || (G && G.hp > 0)) drawHeart(t, bpL);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) { const a = clamp(p.life / p.max, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  for (const x of texts) { ctx.globalAlpha = clamp(x.life / x.max * 1.6, 0, 1); ctx.fillStyle = x.col; ctx.font = `700 ${x.size}px 'Chakra Petch',sans-serif`; ctx.fillText(x.s, x.x, x.y); } ctx.globalAlpha = 1;
  ctx.restore();
  if (flash > 0) { ctx.globalAlpha = flash * .5; ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (G && state !== 'title') { ctx.textAlign = 'center'; drawHUD(t); }
}
// ===== LUB-DUB: loop, input, UI =====
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  try { update(dt); render(now / 1000); } catch (e) { console.error(e); window.__err = String(e && e.stack || e); }
  requestAnimationFrame(frame);
}
function startGame() { Au.init(); Au.setMuted(muted); newRun(); }
function pause() {
  if (state !== 'play') return; state = 'pause'; if (Au.ac) Au.ac.suspend(); $('offV').textContent = offsetMs; hideAll('pause'); $('pause').classList.add('show');
}
function resume() { if (state !== 'pause') return; hideAll(); state = 'play'; if (Au.ac) Au.ac.resume(); lastHalf = Math.floor(BP() * 2); }
function toTitle() { state = 'title'; if (Au.ac) { Au.ac.resume(); Au.level = 0; } G = null; enemies.length = bolts.length = rings.length = 0; hideAll('title'); $('title').classList.add('show'); $('hudbtn').style.display = 'none'; setHint(''); showBest(); }
function showBest() { $('best').textContent = best ? 'Best score ' + best : ''; }
function setMute(m) { muted = m; LS.set('mute', m); Au.setMuted(m); $('bMute').style.opacity = m ? .4 : 1; }

addEventListener('pointerdown', e => { if (e.target.closest('button,a,.card')) return; if (state === 'play') { e.preventDefault(); tap(e.timeStamp); } }, { passive: false });
addEventListener('keydown', e => {
  if (e.repeat) return; const k = e.key;
  if (state === 'play' && (k === ' ' || k === 'Enter' || k === 'z' || k === 'x' || k === 'Z' || k === 'X' || k.startsWith('Arrow'))) { e.preventDefault(); tap(e.timeStamp); return; }
  if (k === 'Escape' || k === 'p' || k === 'P') { state === 'pause' ? resume() : pause(); return; }
  if (k === 'm' || k === 'M') { setMute(!muted); return; }
  if (state === 'cards' && '123'.includes(k)) { const c = $('cardrow').children[+k - 1]; if (c) takeCard(c.dataset.k); return; }
  if ((state === 'title' || state === 'over') && (k === 'Enter' || k === ' ')) { e.preventDefault(); startGame(); }
});
$('bPlay').onclick = startGame; $('bRetry').onclick = startGame; $('bTitle').onclick = toTitle; $('bQuit').onclick = toTitle; $('bResume').onclick = resume;
$('bPause').onclick = pause; $('bMute').onclick = () => setMute(!muted);
$('offM').onclick = () => { offsetMs -= 10; LS.set('off', offsetMs); $('offV').textContent = offsetMs; };
$('offP').onclick = () => { offsetMs += 10; LS.set('off', offsetMs); $('offV').textContent = offsetMs; };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function lbRender(list, hi) { $('lbList').innerHTML = list.slice(0, 5).map((s, i) => `<div${hi === s.score && s.name === ($('lbName').value || 'anon') ? ' style="color:#ffd166"' : ''}>${i + 1}. ${s.name.replace(/[<>&]/g, '')} — ${s.score} (w${s.wave})</div>`).join(''); }
function lbLoad(hi) { fetch('/api/scores').then(r => r.json()).then(j => lbRender(j.scores, hi)).catch(() => {}); }
$('lbName').value = LS.get('name', '');
$('lbSend').onclick = () => { if (!G || G.sent) return; G.sent = true; const n = $('lbName').value.trim() || 'anon'; LS.set('name', n); fetch('/api/score', { method: 'POST', body: JSON.stringify({ name: n, score: G.score, wave: G.wave }) }).then(() => lbLoad(G.score)).catch(() => {}); $('lbSend').style.display = 'none'; };
setMute(muted); showBest();
requestAnimationFrame(frame);
