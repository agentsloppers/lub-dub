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
