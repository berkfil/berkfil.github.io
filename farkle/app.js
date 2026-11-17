// UI and game flow.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const START_PURSE = 300;

// ---------- persistence: local player profiles ----------
// Everything lives in this browser's localStorage; there is no server and no password.
// db = { current: id, profiles: { id: { name, purse, pools, anim, loadout, owned: {dieId: count}, ownedOnly } } }
const KEY = 'farkle-kcd2';
const CITIES = ['Skalitz']; // default home town
const DEFAULT_NAME = 'Henry';
const fullName = (p) => `${p.name} of ${p.city || CITIES[0]}`;
const newProfile = (name, city = CITIES[0]) => ({ name, city, stats: null, purse: START_PURSE, pools: {}, anim: true, loadout: null, owned: {}, ownedOnly: false });
let db = { current: null, profiles: {} };
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw && raw.profiles) db = raw;
  else if (raw && typeof raw.purse === 'number') { db.profiles.p1 = { ...newProfile(DEFAULT_NAME), ...raw }; db.current = 'p1'; } // pre-profile save
} catch (e) { /* storage unavailable */ }
if (!db.profiles[db.current]) db.current = Object.keys(db.profiles)[0] || null;
let store = db.current ? db.profiles[db.current] : newProfile('Guest'); // the active profile
store.owned = store.owned || {};
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } };
const poolOf = (o) => (o.random ? o.pool : store.pools[o.id] ?? o.pool); // the random dicer never runs dry

// ---------- setup state ----------
const setup = { rounds: 1, mode: 'cpu', opp: 'filip', game: 'beggars', dice: Array(6).fill('ordinary'), badge: '', target: null };
// the last loadout is remembered per player
function loadLoadout() {
  const l = store.loadout;
  setup.dice = Array.isArray(l) && l.length === 6 && l.every((id) => DIE[id]) ? l.slice() : Array(6).fill('ordinary');
}
loadLoadout();
function useProfile(id) {
  db.current = id; store = db.profiles[id]; store.owned = store.owned || {};
  G = null; loadLoadout(); persist();
}
function addProfile(name, city) {
  const id = 'p' + Date.now().toString(36);
  db.profiles[id] = newProfile(name, city);
  useProfile(id);
}
// per-player statistics
function S() {
  if (!store.stats) store.stats = { g: 0, w: 0, net: 0, streak: 0, bestStreak: 0, bestTurn: 0, busts: 0, biggestWin: 0, opp: {}, game: {} };
  return store.stats;
}
function recordGame(won) {
  const s = S(), d = won ? G.wager : -G.wager;
  s.g++; s.net += d;
  if (won) { s.w++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.biggestWin = Math.max(s.biggestWin, G.wager); } else s.streak = 0;
  const o = (s.opp[G.opp.id] = s.opp[G.opp.id] || { g: 0, w: 0, net: 0 });
  o.g++; o.w += won ? 1 : 0; o.net += d;
  if (G.mp) o.name = G.opp.name; // a real player: remember the name for the stats table
  // You are assumed to own every badge, so a staked badge is never taken away: winning or losing one is only counted.
  if (G.game.stakeBadge) {
    const mine = G.players[ME].badge, theirs = G.players[1 - ME].badge;
    s.badgesWon = s.badgesWon || {};
    if (won && theirs) s.badgesWon[theirs.id] = (s.badgesWon[theirs.id] || 0) + 1;
    if (!won && mine) s.badgesLost = (s.badgesLost || 0) + 1;
  }
  const t = (s.game[G.game.id] = s.game[G.game.id] || { g: 0, w: 0, net: 0 });
  t.g++; t.w += won ? 1 : 0; t.net += d;
}
const cleanName = (s) => s.trim().replace(/\s+/g, ' ').slice(0, 24);
// dice you own: ordinary dice are unlimited, a unique die caps at 1, others at 6 (you never need more)
const ownedOf = (id) => (id === 'ordinary' ? 6 : store.owned[id] || 0);
const maxOwn = (d) => (d.unique ? 1 : 6);
// drop dice from the tray that the player does not own enough of
function trimLoadout() {
  if (!store.ownedOnly) return;
  const seen = {};
  setLoadout(setup.dice.map((id) => { seen[id] = (seen[id] || 0) + 1; return seen[id] > ownedOf(id) ? 'ordinary' : id; })
    .sort((x, y) => (x === 'ordinary') - (y === 'ordinary')));
}
const bag = { sort: 'onefive', q: '', edit: false };
const oneFiveOf = (d) => (d.special === 'wild' ? 100 : (d.special === 'joker' ? d.w[4] : d.w[0] + d.w[4]) * 100);
const setLoadout = (dice) => { setup.dice = dice; store.loadout = dice.slice(); persist(); };
// chance that a first throw of these six dice has nothing to score (simulated, cached per loadout)
const bustCache = new Map();
function bustChance(ids) {
  const key = ids.slice().sort().join(',');
  if (!bustCache.has(key)) {
    const defs = ids.map((id) => DIE[id]), mods = makeMods(null), N = 20000;
    let bust = 0;
    for (let n = 0; n < N; n++) {
      const t = defs.map(rollDie);
      // quick outs: any 1, 5 or wild die scores
      if (t.some((d) => d.kind === 'wild' || (!d.kind && (d.v === 1 || d.v === 5)))) continue;
      if (!scoringSubsets(t, mods).length) bust++;
    }
    bustCache.set(key, (bust / N) * 100);
  }
  return bustCache.get(key);
}
let G = null; // running game
let tab = 'play';

const oppTierBadges = (o, tier) => o.badges.filter((b) => BADGE[b].tier === tier);
function gameBlock(o, g) {
  if (poolOf(o) < g.bet) return 'opponent cannot cover the wager';
  if (store.purse < g.bet) return 'you cannot cover the wager';
  if (g.tier && !oppTierBadges(o, g.tier).length) return `opponent has no ${g.tier} badge`;
  return '';
}

// ---------- opponent filters (shared by the Play setup and the Opponents tab) ----------
const filt = { region: '', badge: '', tier: '' };
const canTier = (o, t) => oppTierBadges(o, t).length > 0 && poolOf(o) >= Math.min(...GAMES.filter((g) => g.tier === t).map((g) => g.bet));
const playsBadge = (o) => TIERS.some((t) => canTier(o, t));
const passes = (o) => (o.random || !filt.region || o.region === filt.region)
  && (!filt.badge || (filt.badge === 'yes') === playsBadge(o))
  && (!filt.tier || canTier(o, filt.tier));
function filterBar() {
  const seg = (k, label, opts) => `<div class="seg" role="group" aria-label="${label}"><span>${label}</span>${opts.map(([v, text, cls]) =>
    `<button class="${filt[k] === v ? 'on' : ''} ${cls || ''}" data-act="filt" data-k="${k}" data-v="${v}" aria-pressed="${filt[k] === v}">${text}</button>`).join('')}</div>`;
  const n = OPPONENTS.filter(passes).length;
  return `<div class="filters">
    ${seg('region', 'Region', [['', 'All'], ...Object.entries(REGIONS)])}
    ${seg('badge', 'Games', [['', 'All'], ['yes', 'Plays badge games'], ['no', 'No-badge only']])}
    ${seg('tier', 'Badge level', [['', 'Any'], ...TIERS.map((t) => [t, t[0].toUpperCase() + t.slice(1), 'tier-' + t])])}
    <span class="muted count">${n} of ${OPPONENTS.length} tables</span></div>`;
}

// ---------- dice drawing ----------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pipsHTML = (v) => `<span class="pips">${Array.from({ length: 9 }, (_, k) => `<i${PIPS[v].includes(k) ? ' class="on"' : ''}></i>`).join('')}</span>`;
function dieHTML(d, i, cls = '') {
  const rolling = d.rolling && G && G.anim;
  const face = rolling ? pipsHTML(1 + Math.floor(Math.random() * 6))
    : d.kind === 'joker' ? '<span class="glyph">☠</span>'
    : d.kind === 'wild' ? '<span class="glyph">★</span>'
    : pipsHTML(d.v);
  const label = rolling ? `${d.def.name}: rolling` : `${d.def.name}: ${d.kind === 'joker' ? "Devil's head (joker)" : d.kind === 'wild' ? 'wild, counts as anything' : d.v}`;
  const attrs = i == null || rolling ? 'disabled' : `data-act="die" data-i="${i}"`;
  return `<button class="die ${cls} ${d.def.pipStyle || ''} ${d.sel ? 'sel' : ''} ${rolling ? 'rolling' : ''}" style="--body:${d.def.body};--pip:${d.def.pip};--d:${Math.round(Math.random() * 120)}ms" ${attrs} title="${esc(label)}" aria-label="${esc(label)}" aria-pressed="${!!d.sel}">${face}</button>`;
}
const sample = (d) => d.p.indexOf(Math.max(...d.p)) + 1; // most likely face, for previews
// ---------- badge medals ----------
const dot = (x, y, r = 1.3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const EMBLEMS = {
  twins: '<circle cx="9" cy="12" r="4"/><circle cx="15" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H4M20 12h1.5M5 5l1.5 1.5M19 5l-1.5 1.5M5 19l1.5-1.5M19 19l-1.5-1.5"/>',
  chevrons: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6M18 6v12"/>',
  net: '<path d="M4 5h16M4 10h16M4 15h16M6 5v12l2 3M12 5v12l0 3M18 5v12l-2 3M9 5v10M15 5v10"/>',
  wheel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6M6.3 6.3l4.3 4.3M13.4 13.4l4.3 4.3M17.7 6.3l-4.3 4.3M10.6 13.4l-4.3 4.3"/>',
  dieplus: `<rect x="3" y="9" width="12" height="12" rx="2.5"/>${dot(9, 15, 1.6)}<path d="M18.5 2.5v7M15 6h7"/>`,
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>',
  form: `<path d="M12 5L5 18h14z"/>${dot(12, 5, 2.2)}${dot(5, 18, 2.2)}${dot(19, 18, 2.2)}`,
  arrows: '<path d="M12 21V3M12 3l-2.5 3M12 3l2.5 3M12 21L5 6M5 6l-.3 3.6M5 6l3.2 1.6M12 21l7-15M19 6l.3 3.6M19 6l-3.2 1.6"/>',
  sunrise: '<path d="M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 3v7M12 3L9 6M12 3l3 3M4 12l2 1.5M20 12l-2 1.5"/>',
  swap: '<path d="M4 9h15l-3.5-3.5M20 15H5l3.5 3.5"/>',
  crown: '<path d="M4 19h16M5 16L3.5 7l5 4L12 4l3.5 7 5-4L19 16z"/>',
  rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M9 9l1.5-3h-3zM15 9l1.5-3h-3z"/>',
  six: `<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>${[8.5, 12, 15.5].map((y) => dot(9, y) + dot(15, y)).join('')}`,
  bird: `<path d="M3 13c2-5 7-7 11-5 1-2 3-3 5-2l-2 2 3 1-3 1c0 5-4 8-9 7l-3 3M9 17v3M6 20h5"/>${dot(16, 8, 0.9)}`,
};
function medal(b, cls = '') {
  return `<span class="medal m-${b.tier} ${cls}" title="${esc(b.name)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${EMBLEMS[b.emblem]}</svg></span>`;
}

const chip = (text, cls = '', title = '') => `<span class="chip ${cls}" title="${esc(title)}">${esc(text)}</span>`;
const tierWord = (t, more = '') => `<span class="tw tier-${t}">${t[0].toUpperCase() + t.slice(1)}${more}</span>`; // a badge level as coloured text, no box
const dieChip = (id) => chip(DIE[id].name, 'diechip', `${DIE[id].p.join(' / ')} %`);
const badgeChip = (id, extra = '') => `<span class="chip badgechip tier-${BADGE[id].tier}" title="${esc(BADGE[id].text)}">${medal(BADGE[id], 'tiny')}${esc(BADGE[id].name + (typeof extra === 'string' ? extra : ''))}</span>`; // .map() passes an index as 2nd arg
const bars = (d) => `<span class="bars">${d.p.map((x, k) => `<span class="bar" title="${k + 1}: ${x}%"><b style="height:${Math.min(100, x * 1.5)}%"></b><em>${k + 1}</em></span>`).join('')}</span>`;

// ---------- online play (peer-to-peer) ----------
// The two browsers talk directly over WebRTC (PeerJS). The host's browser owns the game: it rolls the
// dice and applies every move, then sends the whole table to the guest, who only draws it and sends moves back.
const NET = { role: null, peer: null, conn: null, code: '', status: '', guest: null, lobby: null, ready: false, last: null, games: 0, settled: 0, tick: null, prefill: '', open: false, slot: 0, search: null };
const ROOM = 'farkle-kcd2-';
const OPEN_SLOTS = 12; // open tables sit on fixed, well-known ids so strangers can find them without a server
const netSend = (m) => { if (NET.conn && NET.conn.open) NET.conn.send(m); };
function netOpen(id) {
  if (typeof Peer === 'undefined') { NET.status = 'Online play needs an internet connection (the connection library did not load).'; return null; }
  const peer = id ? new Peer(id) : new Peer();
  peer.on('error', (e) => {
    if (NET.peer !== peer) return;
    if (e.type === 'peer-unavailable' && NET.search) return netProbe(); // nobody at that open table: try the next
    if (e.type === 'unavailable-id' && NET.open) { // that open table is taken: take the next one
      const { slot, auto } = NET;
      netLeave(slot < OPEN_SLOTS ? '' : 'Every open table is in use right now. Try joining a random one, or host a private table.');
      if (slot < OPEN_SLOTS) netHost(true, slot + 1, auto);
      return render();
    }
    const msg = e.type === 'peer-unavailable' ? 'No table with that code. Check the code and that the host still has the table open.'
      : e.type === 'unavailable-id' ? 'That code is taken, try creating the table again.' : `Connection problem (${e.type}).`;
    if (NET.role === 'guest' || e.type === 'unavailable-id') netLeave(msg); else NET.status = msg;
    render();
  });
  return peer;
}
function netHost(open = false, slot = 1, auto = false) {
  const code = open ? 'open-' + slot : Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const peer = netOpen(ROOM + code);
  if (!peer) return;
  Object.assign(NET, { role: 'host', peer, code, open, slot, auto, status: 'Opening the table…', guest: null, last: null });
  peer.on('open', () => { NET.status = auto ? 'No open table had a free seat, so you opened one. Waiting for someone to join.' : open ? 'Your table is open. Waiting for someone to join.' : 'Waiting for your opponent to join.'; render(); });
  peer.on('connection', (c) => {
    if (NET.conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } // one opponent per table
    NET.conn = c; netWire(c);
  });
}
function netJoin(code) {
  const peer = netOpen();
  if (!peer) return;
  Object.assign(NET, { role: 'guest', peer, code, status: 'Connecting…', lobby: null, ready: false, last: null });
  peer.on('open', () => { const c = peer.connect(ROOM + code, { reliable: true }); NET.conn = c; netWire(c); });
}
// Join any open table: knock on each in turn until one has a free seat; if none does, open one yourself.
function netRandom() {
  const peer = netOpen();
  if (!peer) return;
  const slots = Array.from({ length: OPEN_SLOTS }, (_, i) => i + 1);
  Object.assign(NET, { role: 'guest', peer, code: '', search: { slots, timer: null }, status: 'Looking for an open table…', lobby: null, ready: false, last: null });
  peer.on('open', netProbe);
}
function netProbe() {
  const s = NET.search;
  if (!s || NET.role !== 'guest') return;
  clearTimeout(s.timer);
  const old = NET.conn; NET.conn = null;
  try { if (old) old.close(); } catch (e) { /* already closed */ }
  const n = s.slots.shift();
  if (!n) { netLeave(); netHost(true, 1, true); return render(); }
  const c = NET.peer.connect(ROOM + 'open-' + n, { reliable: true });
  NET.conn = c; netWire(c);
  s.timer = setTimeout(netProbe, 6000); // no answer: move on
}
function netWire(c) {
  c.on('open', () => { if (NET.role === 'guest') { netSend({ t: 'hello', name: fullName(store) }); NET.status = 'Connected. Waiting for the host.'; } render(); });
  c.on('data', (m) => { if (NET.conn === c && m && typeof m === 'object') netData(m); });
  c.on('close', () => { if (NET.conn === c) netClosed(); });
}
function netData(m) {
  if (NET.role === 'host') {
    if (m.t === 'hello') { NET.guest = { name: cleanName(String(m.name || 'Stranger')).slice(0, 60) || 'Stranger', ready: false }; NET.last = null; }
    else if (!NET.guest) return;
    else if (m.t === 'ready') Object.assign(NET.guest, { ready: true, dice: m.dice, badge: m.badge });
    else if (m.t === 'unready') NET.guest.ready = false;
    else if (m.t === 'act') return G && G.mp ? doAct(1, String(m.a), +m.i) : undefined;
    return render();
  }
  if (m.t === 'full') return NET.search ? netProbe() : netLeave('That table already has two players.') || render();
  if (m.t === 'lobby' && GAMES.some((g) => g.id === m.game)) {
    if (NET.search) { clearTimeout(NET.search.timer); NET.search = null; }
    NET.lobby = m; G = null; ME = 1;
    setup.game = m.game; setup.target = m.target;
  } else if (m.t === 'state' && m.g) {
    if (!G || G.no !== m.g.no) NET.ready = false; // a new game started: ready up again next time
    G = unpack(m.g); ME = 1;
    if (G.over && NET.settled !== G.no) { NET.settled = G.no; settleStakes(G.over.winner === 1); }
  } else return;
  render();
}
function netClosed() {
  if (!NET.role) return;
  const midGame = G && G.mp && !G.over;
  if (G && G.mp) G = null;
  if (NET.role === 'host') {
    Object.assign(NET, { conn: null, guest: null, last: null, status: `Your opponent left${midGame ? '; the game was abandoned and no groschen changed hands' : ''}. Waiting for someone to join.` });
  } else netLeave(`The host closed the table${midGame ? '; the game was abandoned and no groschen changed hands' : ''}.`);
  render();
}
function netLeave(msg = '') {
  const { conn, peer } = NET;
  if (NET.search) clearTimeout(NET.search.timer);
  Object.assign(NET, { role: null, peer: null, conn: null, code: '', open: false, slot: 0, auto: false, search: null, guest: null, lobby: null, ready: false, last: null, status: msg });
  try { if (conn) conn.close(); } catch (e) { /* already closed */ }
  try { if (peer) peer.destroy(); } catch (e) { /* already gone */ }
  if (G && G.mp) G = null;
  ME = 0;
}
// the game as plain data for the guest (dice and badges by id)
function pack() {
  const die = (d) => ({ id: d.def.id, v: d.v, kind: d.kind, sel: !!d.sel, rolling: !!d.rolling, pos: d.pos, tilt: d.tilt });
  return { no: G.no, game: G.game.id, target: G.target, wager: G.wager, cur: G.cur, turnPts: G.turnPts, bust: G.bust, over: G.over, anim: !!G.anim, last: G.last || null, rounds: G.rounds, round: G.round, wins: G.wins, roundOver: G.roundOver || null,
    armedDouble: G.armedDouble, armedMult: G.armedMult, log: G.log.slice(0, 40), table: G.table.map(die), held: G.held.map(die),
    players: G.players.map((p) => ({ name: p.name, dice: p.dice.map((d) => d.id), badge: p.badge ? p.badge.id : null, cancelled: p.cancelled, active: p.active ? p.active.id : null, uses: p.uses, total: p.total })) };
}
function unpack(s) {
  const die = (d) => ({ ...d, def: DIE[d.id] || DIE.ordinary });
  const players = s.players.map((p) => {
    const active = p.active ? BADGE[p.active] : null;
    return { ...p, isAI: false, dice: p.dice.map((id) => DIE[id] || DIE.ordinary), badge: p.badge ? BADGE[p.badge] : null, active, mods: makeMods(active) };
  });
  return { ...s, mp: true, game: GAMES.find((g) => g.id === s.game), table: s.table.map(die), held: s.held.map(die), players, options: [],
    opp: { id: 'h:' + players[0].name.toLowerCase(), name: players[0].name } };
}
// after every redraw: the host pushes what changed, the guest keeps its ready state in sync, rolling dice flicker
function netSync() {
  clearInterval(NET.tick); NET.tick = null;
  if (NET.role === 'guest' && G && G.anim) NET.tick = setInterval(() => { document.querySelectorAll('.die.rolling').forEach((el) => { el.innerHTML = pipsHTML(1 + Math.floor(Math.random() * 6)); }); }, 90);
  if (!NET.conn || !NET.conn.open) return;
  let m = null;
  if (NET.role === 'host') {
    if (!NET.guest) return;
    const game = GAMES.find((g) => g.id === setup.game);
    m = G && G.mp ? { t: 'state', g: pack() } : { t: 'lobby', host: fullName(store), game: game.id, target: Math.max(500, Math.round(setup.target || game.target)), rounds: setup.rounds, open: NET.open };
  } else if (NET.role === 'guest' && !G && NET.lobby) m = NET.ready ? { t: 'ready', dice: setup.dice, badge: setup.badge || null } : { t: 'unready' };
  if (!m) return;
  const s = JSON.stringify(m);
  if (s !== NET.last) { NET.last = s; NET.conn.send(m); }
}
function netPanel() {
  const purse = `<span class="purse big">Your purse: ${Math.round(store.purse)} gr</span>`;
  const note = '<small class="muted">The two browsers connect directly to each other; a public service (PeerJS) is only used to introduce them. The host\'s browser rolls the dice. Purses and dice are each player\'s own, on trust.</small>';
  if (!NET.role) return `<section class="panel"><div class="row between wrap"><h2>1. Find a table</h2>${purse}</div>
    <div class="mpgrid"><div class="mpcard"><h3>Host a table</h3><p class="muted">You get a code to send to your friend, and you choose the game and the wager.</p><div class="row wrap"><button class="btn primary" data-act="mphost">Private table</button><button class="btn" data-act="mphost" data-v="open">Open table</button></div><small class="muted">Private: only someone with your code can join. Open: anyone looking for a random table can sit down.</small></div>
    <div class="mpcard"><h3>Join a random table</h3><p class="muted">Sit down at any open table with a free seat. If there is none, you open one and wait.</p><button class="btn primary" data-act="mprandom">Find a table</button></div>
    <div class="mpcard"><h3>Join a friend's table</h3><p class="muted">Enter the code your friend sent you.</p><div class="row wrap"><input type="text" id="mpcode" maxlength="5" placeholder="CODE" value="${esc(NET.prefill)}" aria-label="Table code" autocapitalize="characters" autocomplete="off"><button class="btn primary" data-act="mpjoin">Join</button></div></div></div>
    ${NET.status ? `<p class="status lose">${esc(NET.status)}</p>` : ''}${note}</section>`;
  if (NET.role === 'host') {
    const link = `${location.origin}${location.pathname}?join=${NET.code}`;
    const gs = NET.guest;
    return `<section class="panel"><div class="row between wrap"><h2>1. Your table</h2>${purse}</div>
      <div class="row wrap">${NET.open ? '<span class="code open">Open table</span><span class="muted">Anyone who looks for a random table can join.</span>' : `<span class="code" aria-label="Table code">${NET.code}</span><input type="text" class="link" readonly value="${esc(link)}" aria-label="Invite link" onfocus="this.select()">
        <button class="btn" data-act="mpcopy" data-v="${esc(link)}">Copy invite link</button>`}<button class="btn ghost" data-act="mpleave">Close table</button></div>
      <p class="status ${gs && gs.ready ? 'win' : ''}">${esc(gs ? `${gs.name} has joined${gs.ready ? ' and is ready.' : '. Waiting for them to choose their dice.'}` : NET.status)}</p>${note}</section>`;
  }
  const lb = NET.lobby, g = lb && GAMES.find((x) => x.id === lb.game);
  return `<section class="panel"><div class="row between wrap"><h2>1. ${lb ? esc(lb.host) + '\'s table' : NET.search ? 'Looking for an open table' : 'Joining table ' + esc(NET.code)}</h2>${purse}</div>
    ${g ? `<p class="lobbyline"><strong>${g.name}</strong>, wager <b>${g.bet} gr</b>${g.stakeBadge ? ' and a badge' : ''}, first to <b>${lb.target}</b>, ${lb.rounds > 1 ? `best of <b>${lb.rounds}</b> rounds` : 'one round'}, ${g.tier ? tierWord(g.tier, ' badges') : 'no badges'}</p>
      <p class="muted">The host chooses the game. Pick your dice${g.tier ? ' and badge' : ''} below, then press Ready.</p>` : `<p class="status">${esc(NET.status)}</p>`}
    <div class="row wrap">${lb && lb.open ? '<button class="btn" data-act="mprandom">Try another table</button>' : ''}<button class="btn ghost" data-act="mpleave">${NET.search ? 'Stop looking' : 'Leave table'}</button></div>${note}</section>`;
}

// ---------- game flow ----------
const P = () => G.players[G.cur];
let ME = 0; // your seat: 0 when you host or play a dicer, 1 when you joined someone else's table
const subj = (p, you, they) => (p.you ? `You ${you}` : `${p.name} ${they}`); // "You bank" / "Filip banks"
const seatCls = () => (G.cur === 0 ? 'me' : 'ai'); // log colour for the player to move, as seen from seat 0
function log(msg, cls = '') { G.log.unshift({ msg, cls }); if (G.log.length > 60) G.log.pop(); }

// ---------- table talk ----------
const SAY_MS = 4200;
// Maybe say a line for an event (chance 0..1). Shown as a speech bubble on the table and kept in the log.
function say(event, chance = 1) {
  if (store.talk === false || !G || G.mp || Math.random() > chance) return; // no scripted banter between real players
  const lines = BANTER[event].filter((l) => !G.said || l[1] !== G.said.text);
  const [who, text] = lines[Math.floor(Math.random() * lines.length)];
  const name = who === 'me' ? store.name : G.opp.name;
  G.said = { who, name, text, at: Date.now() };
  G.log.unshift({ msg: `${name}: “${text}”`, cls: 'say' });
}
function bubble() {
  const s = G.said, age = s ? Date.now() - s.at : 0;
  if (!s || age > SAY_MS || store.talk === false) return '';
  return `<div class="say ${s.who}" style="animation-delay:-${age}ms"><b>${esc(s.name)}</b>${esc(s.text)}</div>`;
}

// Dice for the random dicer: one to four loaded dice (at most two of a kind), the rest ordinary.
function randomDice() {
  const pool = DICE.filter((d) => d.id !== 'ordinary' && !d.unique), out = [];
  const n = 1 + Math.floor(Math.random() * 4);
  while (out.length < n) {
    const id = pool[Math.floor(Math.random() * pool.length)].id;
    if (out.filter((x) => x === id).length < 2) out.push(id);
  }
  return out;
}
// a Balatro's die is unique: extra copies become ordinary dice
function uniqueDice(ids) {
  let seen = false;
  return ids.map((id) => { if (DIE[id].unique) { if (seen) return DIE.ordinary; seen = true; } return DIE[id]; });
}
// A badge only works when the other player also brought one of that tier, and a Defence badge cancels the other's.
function mkPlayer(name, isAI, dice, badge, other, risk, target) {
  const cancelled = !!(badge && other && other.fx.type === 'defence');
  const active = badge && other && !cancelled && badge.fx.type !== 'defence' ? badge : null;
  const head = active && active.fx.type === 'head' ? Math.round((target * active.fx.frac) / 50) * 50 : 0;
  return { name, isAI, dice, badge, cancelled, active, uses: active ? active.fx.uses || 0 : 0, total: head, head, mods: makeMods(active), risk };
}
function newGame(extra, game, target, players) {
  G = { game, target, wager: game.bet, cur: 0, turnPts: 0, table: [], held: [], remaining: [], options: [], bust: false,
    armedDouble: false, armedMult: false, over: null, log: [], players, rounds: [3, 5].includes(setup.rounds) ? setup.rounds : 1, round: 1, wins: [0, 0], roundOver: null, ...extra };
  if (G.rounds > 1) log(`Best of ${G.rounds} rounds: the first to win ${(G.rounds + 1) / 2} takes the wager.`);
  log(`${game.name}: first to ${target}. Wager ${game.bet} groschen${game.stakeBadge ? ' and a badge' : ''}.`);
  G.players.forEach((p) => {
    if (p.cancelled) log(`${p.name}'s ${p.badge.name} is cancelled by a Defence badge.`);
    else if (p.badge && !p.active && p.badge.fx.type !== 'defence') log(`${p.name}'s ${p.badge.name} has no effect: the other player brought no badge.`);
    if (p.total) log(`${p.name} starts ${p.total} points ahead (${p.badge.name}).`);
  });
}
function startGame() {
  if (setup.mode === 'human') return startOnline();
  const opp = OPPONENTS.find((o) => o.id === setup.opp);
  const game = GAMES.find((g) => g.id === setup.game);
  if (gameBlock(opp, game)) return;
  const target = Math.max(500, Math.round(setup.target || game.target));
  const myBadge = game.tier && setup.badge ? BADGE[setup.badge] : null;
  const tierBadges = game.tier ? oppTierBadges(opp, game.tier) : [];
  const oppBadge = tierBadges.length ? BADGE[tierBadges[Math.floor(Math.random() * tierBadges.length)]] : null;
  const oppDice = (opp.random ? randomDice() : opp.dice).map((id) => DIE[id]);
  while (oppDice.length < 6) oppDice.push(DIE.ordinary);
  ME = 0;
  newGame({ opp, mp: false }, game, target,
    [mkPlayer('You', false, uniqueDice(setup.dice), myBadge, oppBadge, 1, target), mkPlayer(opp.name, true, oppDice, oppBadge, myBadge, opp.random ? 0.85 + Math.random() * 0.4 : opp.risk, target)]);
  G.players[0].you = true;
  say('start');
  beginTurn();
}
// Online game: you are the host (seat 0) and your browser rolls for both players.
function startOnline() {
  const game = GAMES.find((g) => g.id === setup.game), gs = NET.guest;
  if (NET.role !== 'host' || !gs || !gs.ready || store.purse < game.bet) return;
  const target = Math.max(500, Math.round(setup.target || game.target));
  const inTier = (id) => (game.tier && id && BADGE[id] && BADGE[id].tier === game.tier ? BADGE[id] : null);
  const myBadge = inTier(setup.badge), theirBadge = inTier(gs.badge);
  const theirDice = uniqueDice((Array.isArray(gs.dice) ? gs.dice : []).filter((id) => DIE[id]).concat(Array(6).fill('ordinary')).slice(0, 6));
  ME = 0;
  newGame({ opp: { id: 'h:' + gs.name.toLowerCase(), name: gs.name }, mp: true, no: ++NET.games }, game, target,
    [mkPlayer(fullName(store), false, uniqueDice(setup.dice), myBadge, theirBadge, 1, target), mkPlayer(gs.name, false, theirDice, theirBadge, myBadge, 1, target)]);
  G.cur = G.first = Math.random() < 0.5 ? 0 : 1;
  log(`${P().name} throws first.`);
  beginTurn();
}

function beginTurn() {
  G.turnPts = 0; G.armedDouble = false; G.armedMult = false; G.held = [];
  G.remaining = P().dice.slice();
  throwDice();
}
function throwDice() {
  if (!G.said || Date.now() - G.said.at > 2500) say(P().isAI ? 'oppRoll' : 'playerRoll', 0.4);
  G.extraThisThrow = false; G.table = G.remaining.map(rollDie); afterThrow();
}
const ROLL_MS = 850;
// Called after anything changes the table. Newly rolled dice tumble first (unless switched off or skipped).
// Scatter dice over the table: each new die takes a free cell of a 4x2 grid, with some jitter and tilt.
function place(table) {
  const free = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !table.some((d) => d.pos && d.pos.c === c)).sort(() => Math.random() - 0.5);
  const rnd = (n) => (Math.random() * 2 - 1) * n;
  table.forEach((d) => {
    if (d.pos) return;
    const c = free.length ? free.pop() : Math.floor(Math.random() * 8);
    d.pos = { c, x: 24 + ((c % 4) + 0.5) * 17 + rnd(3.5), y: 15 + (Math.floor(c / 4) + 0.5) * 22 + rnd(4.5), r: Math.round(rnd(30)) };
  });
}
function afterThrow() {
  const g = G;
  place(g.table);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!store.anim || reduce || !g.table.some((d) => d.rolling)) return settle(g);
  g.anim = true;
  render();
  const tick = setInterval(() => {
    document.querySelectorAll('.die.rolling').forEach((el) => { el.innerHTML = pipsHTML(1 + Math.floor(Math.random() * 6)); });
  }, 90);
  const done = () => { clearInterval(tick); clearTimeout(timer); if (G === g && g.anim) settle(g); };
  const timer = setTimeout(done, ROLL_MS);
  g.skipRoll = done;
}
function settle(g) {
  g.anim = false; g.skipRoll = null;
  g.table.forEach((d) => { d.rolling = false; });
  g.options = scoringSubsets(g.table, P().mods);
  g.bust = !g.options.length;
  if (g.bust) say(P().isAI ? 'oppBust' : 'playerBust', 0.85);
  render();
  if (P().isAI) aiAct(g);
}
const selected = () => G.table.filter((d) => d.sel);
const selScore = () => scoreDice(selected(), P().mods);

function setAside(score) {
  G.turnPts += score;
  G.held.push(...G.table.filter((d) => d.sel).map((d) => ({ ...d, sel: false, rolling: false, tilt: Math.round(Math.random() * 24 - 12) })));
  G.remaining = G.table.filter((d) => !d.sel).map((d) => d.def);
  if (!G.remaining.length) { G.remaining = P().dice.slice(); G.held = []; say(P().isAI ? 'oppHot' : 'hot'); log(`${subj(P(), 'scored every die and throw', 'scored every die and throws')} all six again.`); }
}
function bank(pts) {
  const p = P();
  p.total += pts;
  if (G.cur === 0 && !p.isAI) S().bestTurn = Math.max(S().bestTurn, pts);
  log(`${subj(p, 'bank', 'banks')} ${pts} (total ${p.total}).`, seatCls());
  // Online, both players get the same number of turns: if the one who threw first reaches the goal,
  // the other gets one last turn and wins only by ending it with a higher total.
  if (G.last) return finish(p.total > G.players[G.last.leader].total ? G.cur : G.last.leader);
  if (p.total >= G.target) {
    if (!G.mp || G.cur !== G.first) return finish(G.cur);
    G.last = { leader: G.cur, total: p.total };
    log(`${p.name} reached the goal. ${G.players[1 - G.cur].name} gets one last turn and must beat ${p.total}.`);
    return nextTurn();
  }
  if (pts >= 500) say(p.isAI ? 'oppBig' : 'playerBig', 0.8);
  nextTurn();
}
function nextTurn() { G.cur = 1 - G.cur; beginTurn(); }
// A round is won. In a match of 3 or 5 rounds the wager is only paid once someone has won most of them.
function finish(winner, forfeit) {
  if (G.rounds > 1 && !forfeit) {
    G.wins[winner]++;
    const w = G.players[winner];
    log(`${subj(w, 'win', 'wins')} round ${G.round} (${G.wins[0]}–${G.wins[1]}).`, winner === 0 ? 'me' : 'ai');
    if (G.wins[winner] * 2 < G.rounds) { G.roundOver = { winner }; return render(); }
  }
  G.over = { winner };
  settleStakes(winner === ME);
  const champ = G.players[winner], loser = G.players[1 - winner];
  if (G.mp) log(`${G.players[winner].name} wins ${G.wager} groschen.`, winner === 0 ? 'me' : 'ai');
  else {
    say(winner === 0 ? 'win' : 'lose');
    log(winner === 0 ? `You win ${G.wager} groschen.` : `${G.opp.name} wins. You lose ${G.wager} groschen.`, winner === 0 ? 'me' : 'ai');
  }
  if (G.game.stakeBadge && loser.badge) log(`${champ.you ? 'You also win' : champ.name + ' also wins'} the ${loser.badge.name}.`, winner === 0 ? 'me' : 'ai');
  render();
}
function nextRound() {
  if (!G || !G.roundOver || G.over) return;
  G.round++; G.roundOver = null; G.last = null; G.bust = false; G.table = []; G.held = [];
  G.players.forEach((p) => { p.total = p.head || 0; p.uses = p.active ? p.active.fx.uses || 0 : 0; });
  G.cur = G.mp ? (G.first = 1 - G.first) : 0; // online, the first throw alternates
  log(`Round ${G.round}. ${subj(P(), 'throw', 'throws')} first.`);
  beginTurn();
}
// move the wager and record the result for the local player
function settleStakes(won) {
  recordGame(won);
  store.purse += won ? G.wager : -G.wager;
  if (!G.mp && !G.opp.random) store.pools[G.opp.id] = poolOf(G.opp) + (won ? -G.wager : G.wager);
  persist();
}

// ----- human actions -----
function humanScore(cont, seat = 0) {
  if (G.over || G.anim || G.cur !== seat || P().isAI) return;
  let s = selScore();
  if (!s && (cont || !G.turnPts)) return;
  const p = P();
  if (G.armedDouble && s) { s *= 2; p.uses--; G.armedDouble = false; log(`${subj(p, 'double', 'doubles')} the throw with the ${p.badge.name}.`, seatCls()); }
  if (cont) {
    log(`${subj(p, 'set aside', 'sets aside')} ${s}.`, seatCls());
    setAside(s);
    throwDice();
  } else {
    let pts = G.turnPts + s;
    if (G.armedMult) { pts = Math.round(pts * p.active.fx.m); p.uses--; G.armedMult = false; log(`${p.badge.name}: turn score x${p.active.fx.m}.`, seatCls()); }
    bank(pts);
  }
}
function humanBadge(seat = 0) {
  const p = P();
  if (G.over || G.anim || G.cur !== seat || p.isAI || !p.active || p.uses < 1) return;
  const fx = p.active.fx, sel = selected();
  if (fx.type === 'double') G.armedDouble = !G.armedDouble;
  else if (fx.type === 'mult') G.armedMult = !G.armedMult;
  else if (fx.type === 'antibust') { if (!G.bust) return; p.uses--; log(`${subj(p, 'throw', 'throws')} again (${p.badge.name}).`, seatCls()); return throwDice(); }
  else if (fx.type === 'extra') { p.uses--; G.table.push(rollDie(DIE.ordinary)); log(`${subj(p, 'add', 'adds')} an extra die.`, seatCls()); return afterThrow(); }
  else if (fx.type === 'set') {
    if (sel.length !== 1) return;
    p.uses--; sel[0].v = fx.to; sel[0].kind = null; sel[0].sel = false;
    log(`${subj(p, 'change', 'changes')} a die to ${fx.to}.`, seatCls()); return afterThrow();
  } else if (fx.type === 'reroll') {
    if (!rerollOK(fx, sel)) return;
    p.uses--;
    G.table = G.table.map((d) => (d.sel ? rollDie(d.def) : d));
    log(`${subj(p, 'reroll', 'rerolls')} ${sel.length} ${sel.length === 1 ? 'die' : 'dice'}.`, seatCls()); return afterThrow();
  }
  render();
}
// Every move goes through here. seat = who is asking; it must be that player's turn.
function doAct(seat, a, i) {
  if (!G) return;
  if (a === 'skip') { if (G.skipRoll) G.skipRoll(); return; }
  if (a === 'nextround') return nextRound();
  if (G.over || G.roundOver || G.anim || G.cur !== seat || P().isAI) return;
  if (a === 'die') { const d = G.table[i]; if (d) { d.sel = !d.sel; render(); } }
  else if (a === 'cont') humanScore(true, seat);
  else if (a === 'pass') humanScore(false, seat);
  else if (a === 'badge') humanBadge(seat);
  else if (a === 'endbust') {
    if (!G.bust) return;
    if (seat === 0) S().busts++;
    log(`${subj(P(), 'bust and lose', 'busts and loses')} ${G.turnPts} unbanked points.`, seatCls());
    if (G.last) return finish(G.last.leader); // busted on the last turn
    nextTurn();
  } else if (a === 'giveup') finish(1 - seat, true);
}
// a move made on this screen: played here, or sent to the host when you are the guest
function act(a, i) {
  if (!G) return;
  if (NET.role === 'guest') { if (a === 'endbust' && G.bust && G.cur === ME) { S().busts++; persist(); } return netSend({ t: 'act', a, i }); }
  doAct(0, a, i);
}
const rerollOK = (fx, sel) => (fx.same ? sel.length === 2 && sel[0].v === sel[1].v : sel.length >= 1 && sel.length <= fx.n);
function badgeButton(p) {
  if (!p.active || !['double', 'mult', 'antibust', 'extra', 'set', 'reroll'].includes(p.active.fx.type)) return '';
  const fx = p.active.fx, sel = selected();
  let label = '', ok = p.uses > 0;
  if (fx.type === 'double') { label = G.armedDouble ? 'Doubling this throw ✓' : 'Double this throw'; ok = ok && !G.bust; }
  if (fx.type === 'mult') { label = G.armedMult ? `Turn x${fx.m} on pass ✓` : `Turn x${fx.m} on pass`; ok = ok && !G.bust; }
  if (fx.type === 'antibust') { label = 'Throw again'; ok = ok && G.bust; }
  if (fx.type === 'extra') label = 'Add an extra die';
  if (fx.type === 'set') { label = `Change selected die to ${fx.to}`; ok = ok && sel.length === 1; }
  if (fx.type === 'reroll') { label = fx.same ? 'Reroll selected pair' : `Reroll selected (max ${fx.n})`; ok = ok && rerollOK(fx, sel); }
  return `<button class="act badge" data-act="badge" ${ok ? '' : 'disabled'} title="${esc(p.active.text)}">${medal(p.active, 'tiny')}${label} <small>(${p.uses} left)</small><kbd>B</kbd></button>`;
}

// ----- opponent AI -----
async function aiAct(g) {
  const alive = () => G === g && !g.over && !g.roundOver;
  const p = P(), fx = p.active ? p.active.fx : null;
  const canUse = fx && p.uses > 0;
  const maxScore = () => g.options.reduce((m, o) => Math.max(m, o.score), 0);
  await wait(900);
  if (!alive()) return;

  if (g.bust) {
    if (canUse && fx.type === 'antibust') { p.uses--; log(`${p.name} throws again (${p.badge.name}).`, 'ai'); return throwDice(); }
    if (canUse && fx.type === 'extra') { p.uses--; g.table.push(rollDie(DIE.ordinary)); log(`${p.name} adds an extra die.`, 'ai'); return afterThrow(); }
    if (canUse && fx.type === 'set') { p.uses--; g.table[0].v = fx.to; g.table[0].kind = null; log(`${p.name} changes a die to ${fx.to}.`, 'ai'); return afterThrow(); }
    if (canUse && fx.type === 'reroll') {
      let idx = g.table.map((_, i) => i).slice(0, fx.n);
      if (fx.same) { idx = []; g.table.forEach((d, i) => g.table.forEach((e, k) => { if (!idx.length && k > i && d.v === e.v) idx = [i, k]; })); }
      if (idx.length) { p.uses--; idx.forEach((i) => { g.table[i] = rollDie(g.table[i].def); }); log(`${p.name} rerolls ${idx.length} dice.`, 'ai'); return afterThrow(); }
    }
    log(`${p.name} busts and loses ${g.turnPts} unbanked points.`, 'ai');
    await wait(900);
    if (alive()) nextTurn();
    return;
  }

  // badges that change the throw before choosing
  if (canUse && fx.type === 'extra' && g.table.length >= 4 && !g.extraThisThrow) {
    p.uses--; g.extraThisThrow = true; g.table.push(rollDie(DIE.ordinary));
    log(`${p.name} adds an extra die.`, 'ai'); return afterThrow();
  } else if (canUse && fx.type === 'set') {
    const now = maxScore();
    let bestI = -1, bestGain = 249;
    g.table.forEach((d, i) => {
      if (d.kind || d.v === fx.to) return;
      const t = g.table.map((e, k) => (k === i ? { ...e, v: fx.to } : e));
      const gain = scoringSubsets(t, p.mods).reduce((m, o) => Math.max(m, o.score), 0) - now;
      if (gain > bestGain) { bestGain = gain; bestI = i; }
    });
    if (bestI >= 0) {
      p.uses--; g.table[bestI].v = fx.to; g.options = scoringSubsets(g.table, p.mods);
      log(`${p.name} changes a die to ${fx.to}.`, 'ai'); render(); await wait(700); if (!alive()) return;
    }
  } else if (canUse && fx.type === 'reroll' && !fx.same && maxScore() <= 100 && g.table.length >= 4) {
    const keep = new Set(g.options.flatMap((o) => o.idx));
    const idx = g.table.map((_, i) => i).filter((i) => !keep.has(i)).slice(0, fx.n);
    if (idx.length) { p.uses--; idx.forEach((i) => { g.table[i] = rollDie(g.table[i].def); }); log(`${p.name} rerolls ${idx.length} dice.`, 'ai'); return afterThrow(); }
  }

  const need = g.target - p.total;
  const pick = aiChoose(g.options, g.table.length, g.turnPts, need, p.risk, p.dice.length);
  pick.idx.forEach((i) => { g.table[i].sel = true; });
  render();
  await wait(1100);
  if (!alive()) return;
  let s = pick.score;
  if (canUse && fx.type === 'double' && (s >= 300 || (g.turnPts + s < need && g.turnPts + s * 2 >= need))) {
    s *= 2; p.uses--; log(`${p.name} doubles the throw (${p.badge.name}).`, 'ai');
    if (g.turnPts + s >= need) pick.cont = false;
  }
  if (pick.cont) {
    log(`${p.name} sets aside ${s} and throws on.`, 'ai');
    setAside(s);
    throwDice();
  } else {
    let pts = g.turnPts + s;
    if (canUse && fx.type === 'mult' && (pts >= 400 || Math.round(pts * fx.m) >= need)) { pts = Math.round(pts * fx.m); p.uses--; log(`${p.name} uses the ${p.badge.name}: turn x${fx.m}.`, 'ai'); }
    bank(pts);
  }
}

// ---------- views ----------
function viewWelcome() {
  return `<section class="panel welcome"><h2>Who is playing?</h2>
    <p class="muted">Pick a name and where you hail from. It is saved in this browser only, along with your purse and the dice you own. No password, nothing is sent anywhere.</p>
    <div class="row wrap"><input type="text" id="pname" maxlength="24" value="${DEFAULT_NAME}" placeholder="${DEFAULT_NAME}" aria-label="Your name" autofocus><span class="of">of</span><input type="text" id="pcity" maxlength="24" value="${esc(CITIES[0])}" placeholder="Skalitz" aria-label="Home town">
      <button class="btn primary" data-act="pnew">Start playing</button></div></section>`;
}
function viewSetup() {
  const shown = OPPONENTS.filter(passes);
  if (shown.length && !shown.some((o) => o.id === setup.opp)) { setup.opp = shown[0].id; setup.target = null; }
  const opp = OPPONENTS.find((o) => o.id === setup.opp);
  const mp = setup.mode === 'human', guest = NET.role === 'guest';
  // what stops a game type: against a dicer, their purse and badges; online, only your own purse
  const block = (g) => (mp ? (store.purse < g.bet ? 'you cannot cover the wager' : '') : gameBlock(opp, g));
  let game = GAMES.find((g) => g.id === setup.game);
  if (!guest && block(game)) { game = GAMES.find((g) => !block(g)) || game; setup.game = game.id; setup.target = null; }
  const blocked = block(game);
  if (!game.tier || (setup.badge && BADGE[setup.badge].tier !== game.tier)) setup.badge = '';

  // only the first few tables are listed until you ask for all of them; the chosen one is always among them
  const FEW = 6;
  let listed = bag.allOpps ? shown : shown.slice(0, FEW);
  const chosen = shown.find((o) => o.id === setup.opp);
  if (chosen && !listed.includes(chosen)) listed = [...listed.slice(0, FEW - 1), chosen];
  const more = shown.length > FEW ? `<div class="row center"><button class="btn ghost" data-act="oppsall">${bag.allOpps ? 'Show fewer tables' : `Show all ${shown.length} tables`}</button></div>` : '';
  const opps = listed.map((o) => `
    <button class="card opp ${o.random ? 'rand' : ''} ${o.id === setup.opp ? 'on' : ''}" data-act="opp" data-id="${o.id}" aria-pressed="${o.id === setup.opp}">
      <strong>${esc(o.name)}</strong><span class="purse">${o.random ? 'any wager' : Math.round(poolOf(o)) + ' gr'}</span>
      <span class="where">${o.random ? 'A stranger: you see their dice when the game starts' : esc(o.where) + (o.where.includes(REGIONS[o.region]) ? '' : ', ' + REGIONS[o.region])}</span>
      <span class="chips">${o.random ? chip('1–4 random loaded dice', 'diechip') + chip('random badge of the game\'s tier') : o.dice.map(dieChip).join('') + o.badges.map(badgeChip).join('')}</span>
    </button>`).join('');

  const group = (title, list) => `<div class="ggroup"><h4>${title}</h4>${list.map((g) => {
    const why = block(g);
    return `<button class="game ${g.id === setup.game ? 'on' : ''} ${g.tier ? 'tier-' + g.tier : ''}" data-act="game" data-id="${g.id}" ${why ? 'disabled' : ''} title="${esc(why || `First to ${g.target} (estimate)`)}">
      <strong>${g.name}</strong><span>${g.bet} gr${g.stakeBadge ? ' + badge' : ''}</span></button>`;
  }).join('')}</div>`;

  // tray: your six dice; bag: every die, click to add
  // a picture of the die as a <span>: these sit inside buttons, and a button cannot contain a button
  const face = (d) => dieHTML({ def: d, v: sample(d), kind: d.special === 'wild' ? 'wild' : d.special === 'joker' ? 'joker' : null }, null, 'small')
    .replace(/^<button/, '<span').replace(/<\/button>$/, '</span>').replace(' disabled ', ' ');
  const full = !setup.dice.includes('ordinary');
  const tray = setup.dice.map((id, i) => (id === 'ordinary'
    ? `<span class="tslot empty" title="Empty slot: an ordinary die">${face(DIE.ordinary)}<small>Ordinary</small></span>`
    : `<button class="tslot" data-act="trayrm" data-i="${i}" title="Remove ${esc(DIE[id].name)}">${face(DIE[id])}<small>${esc(DIE[id].name.replace(/ die$/i, ''))}</small><b aria-hidden="true">×</b></button>`)).join('');
  const sorted = DICE.filter((d) => d.id !== 'ordinary').sort((x, y) => (bag.sort === 'name' ? x.name.localeCompare(y.name)
    : bag.sort === 'onefive' ? oneFiveOf(y) - oneFiveOf(x) : y.p[+bag.sort] - x.p[+bag.sort]) || x.name.localeCompare(y.name));
  const only = store.ownedOnly && !bag.edit;
  const tiles = sorted.filter((d) => !only || ownedOf(d.id) > 0).map((d) => {
    const n = setup.dice.filter((id) => id === d.id).length, own = ownedOf(d.id);
    const off = bag.edit || full || (d.unique && n > 0) || (only && n >= own);
    const stat = d.special === 'wild' ? 'wild' : bag.sort === 'name' || bag.sort === 'onefive' ? `1 or 5: ${oneFiveOf(d).toFixed(0)}%` : `${+bag.sort + 1}s: ${d.p[+bag.sort].toFixed(0)}%`;
    const right = bag.edit
      ? `<span class="step"><button data-act="ownm" data-id="${d.id}" ${own ? '' : 'disabled'} aria-label="Own one fewer ${esc(d.name)}">−</button><b>${own}</b><button data-act="ownp" data-id="${d.id}" ${own < maxOwn(d) ? '' : 'disabled'} aria-label="Own one more ${esc(d.name)}">+</button></span>`
      : d.unique || (only && own < 6) ? '' : `<button class="tsix" data-act="bagfill" data-id="${d.id}" title="Use six of ${esc(d.name)}">×6</button>`;
    return `<div class="tile ${n && !bag.edit ? 'in' : ''} ${bag.edit ? 'editing' + (own ? ' owned' : '') : ''}" data-name="${esc(d.name.toLowerCase())}" ${bag.q && !d.name.toLowerCase().includes(bag.q) ? 'hidden' : ''}>
      <button class="tadd" data-act="bagadd" data-id="${d.id}" ${off ? 'disabled' : ''} title="${esc(d.note)}">${face(d)}<span class="tname"><strong>${esc(d.name)}</strong><em>${stat}${only ? `, own ${own}` : ''}</em></span>${bars(d)}</button>
      ${n && !bag.edit ? `<span class="tcount">×${n}</span>` : ''}${right}</div>`;
  }).join('') || '<p class="muted">You have not marked any dice as owned yet. Click “Edit my dice” and set how many of each you have.</p>';
  const ownedTotal = Object.values(store.owned).reduce((x, y) => x + y, 0);
  const loaded = setup.dice.filter((id) => id !== 'ordinary').length;
  const notOwned = store.ownedOnly ? [...new Set(setup.dice)].filter((id) => setup.dice.filter((x) => x === id).length > ownedOf(id)).map((id) => DIE[id].name) : [];
  const picker = `
    <div class="tray"><div class="tslots">${tray}</div>
      <div class="traymeta"><span>${loaded} loaded, ${6 - loaded} ordinary</span><span>Bust on first throw: <b>${bustChance(setup.dice).toFixed(1)}%</b> <small>(ordinary dice: ${bustChance(Array(6).fill('ordinary')).toFixed(1)}%)</small></span>
        <button class="btn ghost" data-act="trayclear" ${loaded ? '' : 'disabled'}>Clear</button></div>
      ${notOwned.length ? `<small class="warn">Not marked as owned: ${esc(notOwned.join(', '))}. They stay in the tray; use “Edit my dice” to add them.</small>` : ''}
      <div class="sets"><span class="lbl">Saved sets</span>
        ${(store.sets || []).map((s, i) => {
          const same = s.dice.slice().sort().join() === setup.dice.slice().sort().join();
          const list = [...new Set(s.dice.filter((id) => id !== 'ordinary'))].map((id) => `${s.dice.filter((x) => x === id).length}× ${DIE[id].name}`).join(', ') || 'six ordinary dice';
          return `<span class="set ${same ? 'on' : ''}"><button data-act="setload" data-i="${i}" title="${esc(list)}">${s.dice.filter((id) => id !== 'ordinary').slice(0, 6).map((id) => `<i style="background:${DIE[id].body}"></i>`).join('')}${esc(s.name)}</button><button data-act="setdel" data-i="${i}" aria-label="Delete set ${esc(s.name)}" title="Delete this set">×</button></span>`;
        }).join('') || '<small class="muted">none yet</small>'}
        <span class="row setnew"><input type="text" id="setname" maxlength="20" placeholder="Set name" aria-label="Name for this dice set"><button class="btn" data-act="setsave">Save current</button></span></div></div>
    <div class="bagbar"><label class="field inline">Find <input type="search" data-act="bagq" value="${esc(bag.q)}" placeholder="die name"></label>
      <label class="field inline">Sort by <select data-act="bagsort">${[['onefive', 'Chance of 1 or 5'], ['name', 'Name'], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n - 1), `Chance of a ${n}`])].map(([v, t]) => `<option value="${v}" ${bag.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="toggle"><input type="checkbox" data-act="ownedonly" ${store.ownedOnly ? 'checked' : ''}> Only dice I own</label>
      <button class="btn ${bag.edit ? 'primary' : ''}" data-act="bagedit">${bag.edit ? 'Done' : `Edit my dice (${ownedTotal})`}</button>
      <small class="muted">${bag.edit ? 'Set how many of each die you have in your game.' : full ? 'Tray is full: click a die in the tray to free a slot.' : 'Click a die to add it to your tray.'}</small></div>
    <div class="bag">${tiles}</div>`;
  const badgeSel = game.tier
    ? `<label class="field">Your ${game.tier} badge
        <select data-act="mybadge"><option value="">No badge</option>${BADGES.filter((b) => b.tier === game.tier).map((b) => `<option value="${b.id}" ${b.id === setup.badge ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
        <small class="row">${setup.badge ? medal(BADGE[setup.badge]) + esc(BADGE[setup.badge].text) : 'Badges only work when both players hold one of the same tier.'}</small>${mp ? '<small class="muted">Online, your badge only takes effect if your opponent brings one too.</small>' : ''}</label>`
    : '<p class="muted">This game type is played without badges.</p>';

  const ids = Object.keys(db.profiles);
  const player = `<section class="panel player"><div class="row between wrap">
    <div class="row wrap"><h2>Player</h2><select data-act="profile" aria-label="Current player">${ids.map((id) => `<option value="${id}" ${id === db.current ? 'selected' : ''}>${esc(fullName(db.profiles[id]))} (${Math.round(db.profiles[id].purse)} gr)</option>`).join('')}</select></div>
    <div class="row wrap"><input type="text" id="pname" maxlength="24" placeholder="${DEFAULT_NAME}" aria-label="Player name"><span class="of">of</span><input type="text" id="pcity" maxlength="24" value="${esc(store.city || CITIES[0])}" placeholder="Skalitz" aria-label="Home town">
      <button class="btn" data-act="pnew">Add player</button><button class="btn ghost" data-act="prename">Rename current</button>
      <button class="btn ghost" data-act="pdelete">Delete current</button></div></div>
    <small class="muted">Players are saved in this browser only: name, purse, opponents' purses, dice owned, saved dice sets and statistics. No password, nothing is sent anywhere.</small></section>`;
  const modeBar = `<div class="tabs" role="group" aria-label="Opponent type">
    <button class="${mp ? '' : 'on'}" data-act="mode" data-v="cpu" aria-pressed="${!mp}">Against a dicer (computer)</button><button class="${mp ? 'on' : ''}" data-act="mode" data-v="human" aria-pressed="${mp}">Against a real player (online)</button></div>`;
  const step1 = mp ? netPanel() : `<section class="panel"><div class="row between"><h2>1. Choose an opponent</h2>
    <div class="row"><span class="purse big">Your purse: ${Math.round(store.purse)} gr</span><button class="btn ghost" data-act="reset">Reset purse and pools</button></div></div>
    ${filterBar()}<div class="grid opps">${opps || '<p class="muted">No table matches these filters.</p>'}</div>${more}</section>`;
  const step2 = `<section class="panel"><h2>2. Game type</h2>
    <div class="games">${group('Without a badge', GAMES.filter((g) => !g.tier))}${TIERS.map((t) => group(`${t[0].toUpperCase() + t.slice(1)} badge`, GAMES.filter((g) => g.tier === t))).join('')}</div>
    <div class="row wrap"><label class="field inline">Points to win <input type="number" min="500" step="500" value="${setup.target || game.target}" data-act="target"></label>
    <div class="seg" role="group" aria-label="Rounds"><span>Rounds</span>${[1, 3, 5].map((n) => `<button class="${setup.rounds === n ? 'on' : ''}" data-act="rounds" data-v="${n}" aria-pressed="${setup.rounds === n}">${n === 1 ? '1' : 'Best of ' + n}</button>`).join('')}</div>
    <small class="muted">The game does not publish a winning score per game type; these defaults are my estimates. Set the one your table shows.${setup.rounds > 1 ? ` Best of ${setup.rounds}: the first to win ${(setup.rounds + 1) / 2} rounds takes the wager, paid once.` : ''}</small></div></section>`;
  const step3 = `<section class="panel"><h2>${guest ? '2' : '3'}. Your dice and badge</h2>${picker}${badgeSel}</section>`;
  let go;
  if (!mp) go = `<button class="btn primary big" data-act="start" ${blocked || !shown.length ? 'disabled' : ''}>Play ${esc(game.name)} against ${esc(opp.name)}</button>
    ${blocked ? `<span class="muted">Cannot start: ${blocked}.</span>` : ''}`;
  else if (NET.role === 'host') go = `<button class="btn primary big" data-act="start" ${NET.guest && NET.guest.ready && !blocked ? '' : 'disabled'}>Start ${esc(game.name)}${NET.guest ? ' against ' + esc(NET.guest.name) : ''}</button>
    <span class="muted">${blocked ? `Cannot start: ${blocked}.` : !NET.guest ? 'Waiting for an opponent to join.' : NET.guest.ready ? '' : 'Waiting for your opponent to press Ready.'}</span>`;
  else go = `<button class="btn primary big" data-act="mpready" ${blocked ? 'disabled' : ''}>${NET.ready ? 'Ready ✓ (click to change your dice)' : 'Ready'}</button>
    <span class="muted">${blocked ? 'You cannot cover this wager.' : NET.ready ? 'Waiting for the host to start the game.' : ''}</span>`;
  // online: nothing to set up until you have a table; a guest does not choose the game
  const rest = mp && (!NET.role || (guest && !NET.lobby)) ? '' : `${guest ? '' : step2}${step3}<div class="row center wrap">${go}</div>`;
  return `${player}${modeBar}${step1}${rest}`;
}

function viewGame() {
  const p = P(), myTurn = G.cur === ME && !p.isAI, human = myTurn && !G.over && !G.roundOver && !G.anim;
  const me = G.players[ME], them = G.players[1 - ME];
  const s = G.table.length && !G.anim ? selScore() : 0;
  const shown = G.armedDouble ? s * 2 : s;
  const side = (pl, i) => `
    <div class="side ${G.cur === i && !G.over && !G.roundOver ? 'turn' : ''}"><strong>${esc(i === ME ? fullName(store) : pl.name)}</strong>
      <div class="chips">${[...new Set(pl.dice.filter((d) => d.id !== 'ordinary').map((d) => d.id))].map((id) => chip(`${DIE[id].name}${pl.dice.filter((d) => d.id === id).length > 1 ? ' ×' + pl.dice.filter((d) => d.id === id).length : ''}`, 'diechip', DIE[id].p.join(' / ') + ' %')).join('') || chip('ordinary dice', 'diechip')}
        ${pl.badge ? badgeChip(pl.badge.id, pl.cancelled ? ' (cancelled)' : !pl.active && pl.badge.fx.type !== 'defence' ? ' (no effect)' : pl.uses ? ` (${pl.uses} left)` : '') : ''}</div>
    </div>`;
  let status;
  if (G.anim) status = `<p class="status">${myTurn ? 'Rolling…' : esc(p.name) + ' rolls…'}</p>`;
  else if (G.over) status = `<p class="status ${G.over.winner === ME ? 'win' : 'lose'}">${G.over.winner === ME ? `You win ${G.wager} groschen!` : `${esc(them.name)} wins. You lose ${G.wager} groschen.`}</p>`;
  else if (G.roundOver) status = `<p class="status ${G.roundOver.winner === ME ? 'win' : 'lose'}">${G.roundOver.winner === ME ? 'You win' : esc(them.name) + ' wins'} round ${G.round}. Rounds: ${G.wins[ME]}–${G.wins[1 - ME]}.</p>`;
  else if (G.bust) status = `<p class="status lose">${myTurn ? `Bust! No scoring dice. ${G.turnPts} unbanked points lost.` : esc(p.name) + ' busts.'}</p>`;
  else if (!myTurn) status = `<p class="status">${esc(p.name)} is playing…</p>`;
  else status = `<p class="status">${selected().length && !s ? 'That selection is not a scoring combination.' : selected().length ? '' : 'Select scoring dice to hold.'}</p>`;

  const act = (label, a, key, on = true, cls = '') => `<button class="act ${cls}" data-act="${a}" ${on ? '' : 'disabled'}>${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
  let actions = '';
  if (G.anim) actions = act('Skip roll', 'skip', 'Space');
  else if (G.over) actions = NET.role === 'guest' ? `<span class="act">Waiting for the host…</span>${act('Leave table', 'mpleave', '')}` : act(G.mp ? 'Back to the lobby' : 'Back to the tables', 'again', 'Enter', true, 'main');
  else if (G.roundOver) actions = act('Next round', 'nextround', 'Enter', true, 'main') + (G.mp ? act('Leave table', 'mpleave', '') : '');
  else if (human) {
    actions = G.bust
      ? `${badgeButton(p)}${act('End turn', 'endbust', 'Enter', true, 'main')}`
      : `${badgeButton(p)}${act('Score and continue', 'cont', 'F', !!s)}${act('Score and pass', 'pass', 'Q', !!(s || G.turnPts))}`;
    actions += act('Give up', 'giveup', 'G');
  } else if (G.mp) actions = act('Leave table', 'mpleave', '');
  // scoreboard: total / points set aside this turn / current selection. You are always on the left.
  const col = (i) => {
    const cur = G.cur === i && !G.over && !G.roundOver;
    return `<div class="sc ${cur ? 'cur' : ''} ${i === ME ? 'me' : 'opp'}"><span>${i === ME ? esc(store.name) : G.mp ? esc(G.players[i].name.split(' of ')[0]) : 'Opponent'}</span><b>${G.players[i].total}</b><i>${cur ? G.turnPts : 0}</i><i>${cur ? shown : 0}</i></div>`;
  };
  const spot = (d, i) => `<span class="spot" style="--x:${d.pos.x.toFixed(1)};--y:${d.pos.y.toFixed(1)};--r:${d.pos.r}deg">${dieHTML(d, human ? i : null)}${human ? `<small>${i + 1}</small>` : ''}</span>`;
  const lc = (c) => (ME === 1 ? (c === 'me' ? 'ai' : c === 'ai' ? 'me' : c) : c); // the guest sees the colours swapped
  return `
  <section class="panel game-top"><div class="row between"><h2>${esc(G.game.name)}, ${G.wager} gr${G.game.stakeBadge ? ' + badge' : ''}${G.mp ? ', online' : ''}${G.rounds > 1 ? `, round ${G.round} of ${G.rounds} <span class="rw">${G.wins[ME]}–${G.wins[1 - ME]}</span>` : ''}</h2><span class="purse">Your purse: ${Math.round(store.purse)} gr</span></div>
    <div class="sides">${side(me, ME)}${side(them, 1 - ME)}</div></section>
  <section class="board ${G.anim ? 'rolling' : ''}" aria-live="polite" ${G.anim ? 'data-act="skip" title="Click to skip the roll"' : ''}>
    ${status}${G.last && !G.over && !G.roundOver ? `<p class="lastturn">Last turn: ${G.cur === ME ? 'you' : esc(p.name)} must finish above <b>${G.last.total}</b> to win.</p>` : ''}${bubble()}
    <div class="held" aria-label="Dice set aside this turn">${G.held.map((d) => `<span style="--r:${d.tilt}deg">${dieHTML(d, null, 'small')}</span>`).join('')}</div>
    <div class="throw">${G.table.map(spot).join('')}</div>
    <div class="scoreboard">${col(ME)}<div class="sc goal"><span>Goal</span><b>${G.target}</b><i>Round</i><i>Selected</i></div>${col(1 - ME)}</div>
    <div class="acts">${actions}</div>
  </section>
  <div class="row between wrap"><span class="row wrap">${NET.role === 'guest' ? '' : `<label class="toggle"><input type="checkbox" data-act="anim" ${store.anim ? 'checked' : ''}> Rolling animation</label>`}
    ${G.mp ? '' : `<label class="toggle"><input type="checkbox" data-act="talk" ${store.talk === false ? '' : 'checked'}> Table talk</label>`}</span>
    <small class="muted">Keys: 1–7 hold a die, F continue, Q pass, B badge, Space skip roll</small></div>
  <section class="panel"><h3>Log</h3><ol class="log">${G.log.map((l) => `<li class="${lc(l.cls)}">${esc(l.msg)}</li>`).join('')}</ol></section>`;
}

const diceSort = { key: 'name', dir: 1 }; // key: 'name' | 0..5 (face) | 'onefive'
function viewDice() {
  const pct = (x) => `${+x.toFixed(1)}%`;
  // chance the die scores on its own: a 1 or a 5 (the Devil's head replaces the 1, so only its 5 counts)
  const oneFive = (d) => (d.special === 'joker' ? d.w[4] : d.w[0] + d.w[4]) * 100;
  const { key, dir } = diceSort;
  const val = (d) => (key === 'onefive' ? oneFive(d) : d.p[key]);
  const list = DICE.slice().sort((x, y) => {
    if (key === 'name') return dir * x.name.localeCompare(y.name);
    const wx = x.special === 'wild', wy = y.special === 'wild';
    if (wx !== wy) return wx ? 1 : -1; // unknown odds always last
    return dir * (val(x) - val(y)) || x.name.localeCompare(y.name);
  });
  const th = (k, label, cls = '') => {
    const on = String(key) === String(k);
    return `<th class="${cls}" aria-sort="${on ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="sort ${on ? 'on' : ''}" data-act="sort" data-key="${k}" title="Sort by ${label === 'Die' ? 'name' : label}">${label}<span aria-hidden="true">${on ? (dir > 0 ? ' ▲' : ' ▼') : ''}</span></button></th>`;
  };
  return `<section class="panel"><h2>Dice (${DICE.length})</h2><p class="muted">Chance of each face. "1 or 5" is the chance the die scores by itself. Click a column heading to sort; click again to reverse. Odds are the datamined values after patch 1.4; notes mark the dice that patches changed.</p>
  <div class="scroll"><table><thead><tr>${th('name', 'Die')}<th>Odds</th>${[1, 2, 3, 4, 5, 6].map((n) => th(n - 1, n, 'num')).join('')}${th('onefive', '1 or 5', 'num sum')}<th>Notes</th></tr></thead><tbody>
  ${list.map((d) => {
    const wild = d.special === 'wild', o = oneFive(d);
    return `<tr><td><span class="row">${dieHTML({ def: d, v: sample(d), kind: wild ? 'wild' : d.special === 'joker' ? 'joker' : null }, null, 'small')}<strong>${esc(d.name)}</strong></span></td><td>${bars(d)}</td>${d.p.map((x, k) => `<td class="num ${x >= 25 ? 'hi' : x <= 7 ? 'lo' : ''} ${k === key ? 'sorted' : ''}">${wild ? '?' : pct(x)}</td>`).join('')}<td class="num sum ${o >= 45 ? 'hi' : o <= 20 ? 'lo' : ''} ${key === 'onefive' ? 'sorted' : ''}">${wild ? '?' : pct(o)}</td><td>${esc(d.note)}</td></tr>`;
  }).join('')}
  </tbody></table></div></section>`;
}
function viewBadges() {
  return `<section class="panel"><h2>Badges (${BADGES.length})</h2><p class="muted">A badge only works when both players hold a badge of the same tier. Price is the item's base value in groschen.</p>
  <div class="scroll"><table><thead><tr><th>Badge</th><th>Tier</th><th>Effect</th><th class="num">Uses</th><th class="num">Price</th></tr></thead><tbody>
  ${BADGES.map((b) => `<tr><td><span class="row">${medal(b)}<strong>${esc(b.name)}</strong></span></td><td>${tierWord(b.tier)}</td><td>${esc(b.text)}${b.fx.estimate ? ' <em class="est">Exact value not published; this app uses ' + (b.fx.pts ? b.fx.pts + ' points' : Math.round(b.fx.frac * 100) + '% of the target') + '.</em>' : ''}</td><td class="num">${b.fx.uses || 'passive'}</td><td class="num">${b.price}</td></tr>`).join('')}
  </tbody></table></div></section>`;
}
function viewOpponents() {
  return `<section class="panel"><h2>Opponents (${OPPONENTS.length})</h2><p class="muted">Purse is the groschen they carry, which caps what they can wager. Their loaded dice replace ordinary ones; the rest of their six are fair.</p>
  ${filterBar()}<div class="scroll"><table><thead><tr><th>Player</th><th>Where</th><th>Region</th><th class="num">Purse</th><th>Loaded dice</th><th>Badges</th><th>Highest games</th></tr></thead><tbody>
  ${OPPONENTS.filter(passes).map((o) => {
    const ok = GAMES.filter((g) => o.pool >= g.bet && (!g.tier || oppTierBadges(o, g.tier).length));
    const top = (f) => { const l = ok.filter(f); return l.length ? l[l.length - 1].name : '—'; };
    return `<tr><td><strong>${esc(o.name)}</strong>${o.note ? `<br><small>${esc(o.note)}</small>` : ''}</td><td>${esc(o.where)}</td><td>${o.random ? 'Any' : REGIONS[o.region]}</td><td class="num">${o.random ? '∞' : o.pool}</td><td><span class="chips">${o.random ? 'Random each game' : o.dice.map(dieChip).join('')}</span></td><td><span class="chips">${o.random ? 'Random, any tier' : o.badges.map(badgeChip).join('') || '—'}</span></td><td>${top((g) => !g.tier)} / ${top((g) => g.tier)}</td></tr>`;
  }).join('')}
  </tbody></table></div><p class="muted">Also listed as dice players on the wiki, but with no gambling data recorded: ${UNDOCUMENTED.map(esc).join('; ')}.</p></section>
  <section class="panel"><h2>Game types</h2><div class="scroll"><table><thead><tr><th>Game</th><th>Badge tier</th><th class="num">Wager</th><th>Badge at stake</th><th class="num">Points to win (estimate)</th></tr></thead><tbody>
  ${GAMES.map((g) => `<tr><td><strong>${g.name}</strong></td><td>${g.tier ? tierWord(g.tier) : 'none'}</td><td class="num">${g.bet}</td><td>${g.stakeBadge ? 'yes' : 'no'}</td><td class="num">${g.target}</td></tr>`).join('')}
  </tbody></table></div></section>`;
}
function viewRules() {
  const CHART = { name: 'Die', body: '#14110a', pip: 'var(--chart)' };
  // one row of the chart: faces, points; dice from index `extraFrom` are the "additional" ones
  const combo = (vals, pts, extraFrom = 99) => `<li aria-label="${vals.join(', ')}: ${pts} points"><span class="faces">${vals.map((v, i) =>
    dieHTML({ def: CHART, v, kind: v === 'J' ? 'joker' : null }, null, 'small chart' + (i >= extraFrom ? ' extra' : ''))).join('')}</span><b>${pts}</b></li>`;
  return `<section class="panel"><h2>Point combinations</h2>
  <div class="combos">
    <div><ul class="combo">
      ${combo([1], 100)}${combo([5], 50)}
      ${combo([1, 2, 3, 4, 5], 500)}${combo([2, 3, 4, 5, 6], 750)}${combo([1, 2, 3, 4, 5, 6], 1500)}</ul>
      <p class="joker">${dieHTML({ def: CHART, v: 1, kind: 'joker' }, null, 'small chart')}<span>The Devil's Head acts as a joker, adding one value to any combination of dice. On its own it scores nothing.</span></p>
      <ul class="combo">${combo([2, 2, 'J'], 200)}${combo([1, 2, 3, 4, 'J'], 500)}</ul></div>
    <div><ul class="combo">
      ${[1, 2, 3, 4, 5, 6].map((v) => combo([v, v, v], v === 1 ? 1000 : v * 100)).join('')}</ul>
      <p class="muted">Each additional die after 3 doubles the value:</p>
      <ul class="combo">${combo([2, 2, 2, 2], 400, 3)}${combo([2, 2, 2, 2, 2], 800, 3)}${combo([2, 2, 2, 2, 2, 2], 1600, 3)}</ul></div>
  </div></section>
  <section class="panel prose"><h2>How a game goes</h2>
  <ul><li>Two players, six dice each. You may swap any of your six for loaded dice before the game.</li>
  <li>Throw, set aside at least one scoring die or combination, then either throw the rest again or pass and bank the turn's points.</li>
  <li>A throw with no scoring dice is a bust: the turn ends and everything set aside that turn is lost.</li>
  <li>Combinations count within one throw only. If every die has been set aside you throw all six again and keep adding.</li>
  <li>First to the target score wins the wager.</li></ul>
  <h3>What is estimated in this app</h3>
  <ul><li>Points to win for each game type (editable before each game).</li><li>The size of the Headstart leads and the point value of the Cut, the Gallows and the Eye.</li>
  <li>Balatro's die odds (treated as always wild) and how opponents decide; their dice, badges and purses are from the wiki.</li>
  <li>In this app you are assumed to own every badge. In games that stake a badge, the badge you win or lose is only counted on the Stats tab; nothing is added to or taken from what you can use.</li></ul></section>`;
}

function viewStats() {
  if (!db.current) return viewWelcome();
  const s = S(), pct = (w, g) => (g ? Math.round((w / g) * 100) + '%' : '—');
  const gr = (n) => `<span class="${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : ''}${Math.round(n)} gr</span>`;
  const opps = Object.entries(s.opp).map(([id, r]) => ({ ...r, o: OPPONENTS.find((x) => x.id === id) || (r.name ? { name: `${r.name} (player)` } : null) })).filter((r) => r.o);
  const pick = (cmp) => (opps.length ? opps.slice().sort(cmp)[0] : null);
  const rate = (r) => r.w / r.g;
  const fav = pick((x, y) => y.g - x.g || y.net - x.net);
  const best = pick((x, y) => rate(y) - rate(x) || y.net - x.net || y.g - x.g);
  const worst = pick((x, y) => rate(x) - rate(y) || x.net - y.net || y.g - x.g);
  const card = (label, value, sub = '') => `<div class="stat"><span>${label}</span><b>${value}</b><small>${sub}</small></div>`;
  const who = (label, r, sub) => `<div class="stat who"><span>${label}</span><b>${r ? esc(r.o.name) : '—'}</b><small>${r ? sub(r) : 'No games yet'}</small></div>`;
  const record = (r) => `${r.w} won, ${r.g - r.w} lost`;
  const row = (name, r) => `<tr><td><strong>${esc(name)}</strong></td><td class="num">${r.g}</td><td class="num">${r.w}</td><td class="num">${r.g - r.w}</td><td class="num">${pct(r.w, r.g)}</td><td class="num">${gr(r.net)}</td></tr>`;
  const head = (first) => `<thead><tr><th>${first}</th><th class="num">Played</th><th class="num">Won</th><th class="num">Lost</th><th class="num">Win rate</th><th class="num">Groschen</th></tr></thead>`;
  return `<section class="panel"><div class="row between wrap"><h2>${esc(fullName(store))}</h2>
      <div class="row"><span class="purse big">Purse: ${Math.round(store.purse)} gr</span><button class="btn ghost" data-act="statreset" ${s.g || s.busts ? '' : 'disabled'}>Reset stats</button></div></div>
    <div class="stats">
      ${card('Games played', s.g)}${card('Games won', s.w, `${s.g - s.w} lost`)}${card('Win rate', pct(s.w, s.g))}
      ${card('Groschen won', gr(s.net), s.biggestWin ? `biggest win ${s.biggestWin} gr` : '')}
      ${card('Win streak', s.streak, `best ${s.bestStreak}`)}${card('Best turn', s.bestTurn, 'points banked at once')}${card('Busts', s.busts)}${card('Badges won', Object.values(s.badgesWon || {}).reduce((x, y) => x + y, 0), `${s.badgesLost || 0} lost`)}
    </div>
    <div class="stats three">
      ${who('Favourite opponent', fav, (r) => `${r.g} game${r.g === 1 ? '' : 's'} played`)}
      ${who('Best opponent', best, (r) => `${pct(r.w, r.g)} win rate, ${record(r)}`)}
      ${who('Worst opponent', worst && opps.length > 1 ? worst : opps.length === 1 && worst.w < worst.g ? worst : null, (r) => `${pct(r.w, r.g)} win rate, ${record(r)}`)}
    </div>
    ${Object.keys(s.badgesWon || {}).length ? `<div class="won"><span class="lbl">Badges won</span>${BADGES.filter((b) => s.badgesWon[b.id]).map((b) => badgeChip(b.id, s.badgesWon[b.id] > 1 ? ` ×${s.badgesWon[b.id]}` : '')).join('')}</div>` : ''}
    <small class="muted">Badges are won and lost only in the games that stake one (Novices, Knights, Kings, Emperors); you always keep the use of every badge. Favourite is who you have played most. Best and worst are by your win rate against them, then by groschen. Giving up counts as a loss.</small></section>
  <section class="panel"><h2>By opponent</h2>${opps.length ? `<div class="scroll"><table>${head('Opponent')}<tbody>
    ${opps.sort((x, y) => y.g - x.g || x.o.name.localeCompare(y.o.name)).map((r) => row(r.o.name, r)).join('')}</tbody></table></div>` : '<p class="muted">Play a game and it will show up here.</p>'}</section>
  <section class="panel"><h2>By game type</h2>${Object.keys(s.game).length ? `<div class="scroll"><table>${head('Game')}<tbody>
    ${GAMES.filter((g) => s.game[g.id]).map((g) => row(g.name, s.game[g.id])).join('')}</tbody></table></div>` : '<p class="muted">Nothing yet.</p>'}</section>`;
}

function render() {
  document.querySelectorAll('nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  const v = { play: () => (!db.current ? viewWelcome() : G ? viewGame() : viewSetup()), stats: viewStats, dice: viewDice, badges: viewBadges, opponents: viewOpponents, rules: viewRules }[tab];
  $('#app').innerHTML = v();
  netSync();
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const th = e.target.closest('[data-theme]');
  if (th && th.tagName === 'BUTTON') return setTheme(th.dataset.theme);
  const t = e.target.closest('[data-act],[data-tab]');
  if (!t || t.disabled) return;
  if (t.dataset.tab) { tab = t.dataset.tab; return render(); }
  const a = t.dataset.act;
  if (a === 'opp') { setup.opp = t.dataset.id; setup.target = null; }
  else if (a === 'game') { setup.game = t.dataset.id; setup.target = null; }
  else if (a === 'start') return startGame();
  else if (a === 'mode') { if (setup.mode === 'human' && t.dataset.v === 'cpu' && NET.role) { if (!confirm('Leave the online table?')) return; netLeave(); } setup.mode = t.dataset.v; G = null; }
  else if (a === 'oppsall') bag.allOpps = !bag.allOpps;
  else if (a === 'mphost') netHost(t.dataset.v === 'open');
  else if (a === 'mprandom') { if (NET.role) netLeave(); netRandom(); }
  else if (a === 'rounds') setup.rounds = +t.dataset.v;
  else if (a === 'mpjoin') { const c = ($('#mpcode') ? $('#mpcode').value : '').trim().toUpperCase(); if (c.length < 5) { if ($('#mpcode')) $('#mpcode').focus(); return; } NET.prefill = c; netJoin(c); }
  else if (a === 'mpleave') { if (G && G.mp && !G.over && !confirm('Leave the table? The game will be abandoned.')) return; netLeave(); }
  else if (a === 'mpready') NET.ready = !NET.ready;
  else if (a === 'mpcopy') { if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.v).then(() => { t.textContent = 'Copied ✓'; }, () => {}); return; }
  else if (a === 'reset') { store.purse = START_PURSE; store.pools = {}; persist(); }
  else if (a === 'pnew' || a === 'prename') {
    // an empty name means Henry for a new player, and "keep the current name" when renaming
    const input = $('#pname'), name = cleanName(input ? input.value : '') || (a === 'pnew' ? DEFAULT_NAME : store.name);
    const city = cleanName($('#pcity') ? $('#pcity').value : '') || CITIES[0]; // empty town falls back to Skalitz
    if (a === 'pnew') addProfile(name, city); else { store.name = name; store.city = city; persist(); }
  }
  else if (a === 'pdelete') {
    if (!confirm(`Delete player "${fullName(store)}" with their purse and dice? This cannot be undone.`)) return;
    delete db.profiles[db.current];
    const next = Object.keys(db.profiles)[0];
    if (next) useProfile(next); else { db.current = null; store = newProfile('Guest'); G = null; persist(); }
  }
  else if (a === 'statreset') { if (!confirm(`Reset all statistics for ${fullName(store)}? The purse is kept.`)) return; store.stats = null; persist(); }
  else if (a === 'bagedit') { bag.edit = !bag.edit; if (!bag.edit) trimLoadout(); }
  else if (a === 'ownp' || a === 'ownm') {
    const id = t.dataset.id, n = Math.max(0, Math.min(maxOwn(DIE[id]), ownedOf(id) + (a === 'ownp' ? 1 : -1)));
    if (n) store.owned[id] = n; else delete store.owned[id];
    persist();
  }
  else if (a === 'die') return act('die', +t.dataset.i);
  else if (a === 'cont' || a === 'pass' || a === 'badge' || a === 'endbust' || a === 'nextround') return act(a);
  else if (a === 'giveup') { if (confirm(`Give up and lose ${G.wager} groschen?`)) act('giveup'); return; }
  else if (a === 'sort') {
    const k = t.dataset.key, key = k === 'name' || k === 'onefive' ? k : +k;
    if (diceSort.key === key) diceSort.dir *= -1;
    else { diceSort.key = key; diceSort.dir = key === 'name' ? 1 : -1; } // numbers start highest first
  }
  else if (a === 'filt') {
    filt[t.dataset.k] = t.dataset.v;
    if (t.dataset.k === 'tier' && t.dataset.v && filt.badge === 'no') filt.badge = '';
    if (t.dataset.k === 'badge' && t.dataset.v === 'no') filt.tier = '';
  }
  else if (a === 'bagadd') { const i = setup.dice.indexOf('ordinary'); if (i < 0) return; const d = setup.dice.slice(); d[i] = t.dataset.id; setLoadout(d); }
  else if (a === 'bagfill') setLoadout(Array(6).fill(t.dataset.id));
  else if (a === 'trayrm') { const d = setup.dice.slice(); d.splice(+t.dataset.i, 1); d.push('ordinary'); setLoadout(d); }
  else if (a === 'trayclear') setLoadout(Array(6).fill('ordinary'));
  else if (a === 'setsave') {
    const sets = (store.sets = store.sets || []);
    const name = cleanName($('#setname') ? $('#setname').value : '').slice(0, 20) || `Set ${sets.length + 1}`;
    const old = sets.find((s) => s.name.toLowerCase() === name.toLowerCase()); // same name: overwrite
    if (old) old.dice = setup.dice.slice(); else sets.push({ name, dice: setup.dice.slice() });
    persist();
  }
  else if (a === 'setload') { const s = (store.sets || [])[+t.dataset.i]; if (!s) return; setLoadout(s.dice.filter((id) => DIE[id]).concat(Array(6).fill('ordinary')).slice(0, 6)); } // a saved set always loads in full, even with "Only dice I own" on
  else if (a === 'setdel') { const s = (store.sets || [])[+t.dataset.i]; if (!s || !confirm(`Delete the dice set "${s.name}"?`)) return; store.sets.splice(+t.dataset.i, 1); persist(); }
  else if (a === 'skip') { if (G && G.anim) { if (NET.role === 'guest') netSend({ t: 'act', a: 'skip' }); else doAct(0, 'skip'); } return; }
  else if (a === 'again') { if (NET.role === 'guest') return; G = null; if (NET.guest) NET.guest.ready = false; }
  else return;
  render();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'mpcode') { e.preventDefault(); document.querySelector('[data-act=mpjoin]').click(); return; }
  if (e.key === 'Enter' && e.target.id === 'setname') { e.preventDefault(); document.querySelector('[data-act=setsave]').click(); return; }
  if (e.key === 'Enter' && (e.target.id === 'pname' || e.target.id === 'pcity')) { e.preventDefault(); const b = document.querySelector('[data-act=pnew]'); if (b) b.click(); return; }
  if (!G || tab !== 'play' || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  const map = { f: 'cont', q: 'pass', b: 'badge', g: 'giveup', ' ': 'skip', enter: G.over ? 'again' : G.roundOver ? 'nextround' : 'endbust' };
  let el = null;
  if (/^[1-7]$/.test(k)) el = document.querySelector(`.die[data-act="die"][data-i="${k - 1}"]`);
  else if (map[k]) el = document.querySelector(`.acts [data-act="${map[k]}"]`);
  if (el && !el.disabled) { e.preventDefault(); el.click(); }
});
// live search in the dice bag: hide tiles in place so the box keeps focus
document.addEventListener('input', (e) => {
  if (e.target.dataset.act !== 'bagq') return;
  bag.q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.tile').forEach((el) => { el.hidden = !!bag.q && !el.dataset.name.includes(bag.q); });
});
document.addEventListener('change', (e) => {
  const t = e.target, a = t.dataset.act;
  if (a === 'bagsort') bag.sort = t.value;
  else if (a === 'profile') { if (NET.role) netLeave(); useProfile(t.value); }
  else if (a === 'ownedonly') { store.ownedOnly = t.checked; persist(); trimLoadout(); }
  else if (a === 'mybadge') setup.badge = t.value;
  else if (a === 'target') { setup.target = +t.value || null; return; }
  else if (a === 'talk') { store.talk = t.checked; persist(); render(); return; }
  else if (a === 'anim') { store.anim = t.checked; persist(); if (!t.checked && G && G.skipRoll) G.skipRoll(); return; }
  else return;
  render();
});
// colour theme: dark, beige or light; remembered for this browser (not per player)
function setTheme(name) {
  const t = ['dark', 'beige', 'light'].includes(name) ? name : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('farkle-theme', t); } catch (e) { /* ignore */ }
  document.querySelectorAll('.themes button').forEach((b) => { const on = b.dataset.theme === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
setTheme(document.documentElement.dataset.theme);
// an invite link (?join=CODE) opens straight on the join box
const invite = new URLSearchParams(location.search).get('join');
if (invite) { setup.mode = 'human'; NET.prefill = invite.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }
render();
