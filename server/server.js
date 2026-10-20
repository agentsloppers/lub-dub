// tiny backend: bug reports + global leaderboard. Listens on 127.0.0.1:8080
const http = require('http'), fs = require('fs');
const DIR = '/root/game/data'; fs.mkdirSync(DIR, { recursive: true });
const BUGS = DIR + '/bugs.jsonl', SC = DIR + '/scores.json';
let scores = []; try { scores = JSON.parse(fs.readFileSync(SC)); } catch (e) {}
const rate = new Map();
function limited(ip, n = 20) { const k = ip + Math.floor(Date.now() / 60000); const c = (rate.get(k) || 0) + 1; rate.set(k, c); if (rate.size > 5000) rate.clear(); return c > n; }
function body(req) { return new Promise(r => { let b = ''; req.on('data', d => { b += d; if (b.length > 5000) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b)); } catch (e) { r({}); } }); }); }
const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, ' ').slice(0, n).trim();
http.createServer(async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const send = (c, o) => { res.writeHead(c, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (req.url === '/api/bug' && req.method === 'POST') {
    if (limited(ip, 5)) return send(429, { ok: false });
    const b = await body(req); const msg = clean(b.msg, 1500); if (msg.length < 5) return send(400, { ok: false, error: 'Tell me a bit more' });
    fs.appendFileSync(BUGS, JSON.stringify({ t: new Date().toISOString(), msg, contact: clean(b.contact, 100), ua: clean(b.ua, 200), v: clean(b.v, 20) }) + '\n'); return send(200, { ok: true });
  }
  if (req.url === '/api/score' && req.method === 'POST') {
    if (limited(ip, 6)) return send(429, { ok: false });
    const b = await body(req); const score = Math.floor(+b.score), wave = Math.floor(+b.wave);
    if (!(score > 0 && score < 5e6 && wave > 0 && wave < 200)) return send(400, { ok: false });
    scores.push({ name: clean(b.name, 12) || 'anon', score, wave, t: Date.now() }); scores.sort((a, c) => c.score - a.score); scores = scores.slice(0, 200);
    fs.writeFileSync(SC, JSON.stringify(scores)); return send(200, { ok: true, rank: scores.findIndex(s => s.score === score) + 1 });
  }
  if (req.url.startsWith('/api/scores')) return send(200, { scores: scores.slice(0, 20) });
  send(404, { error: 'not found' });
}).listen(8080, '127.0.0.1');
