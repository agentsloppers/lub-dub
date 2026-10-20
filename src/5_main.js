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
