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
