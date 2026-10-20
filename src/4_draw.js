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
