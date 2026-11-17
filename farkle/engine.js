// Scoring and AI. No DOM in here.

const STRAIGHTS = [
  { name: 'Full straight', vals: [1, 2, 3, 4, 5, 6], pts: 1500 },
  { name: 'Straight 2-6', vals: [2, 3, 4, 5, 6], pts: 750 },
  { name: 'Straight 1-5', vals: [1, 2, 3, 4, 5], pts: 500 },
];

function kindPts(v, n, mods) {
  let p = (v === 1 ? 1000 : v * 100) * 2 ** (n - 3);
  if (v === 1 && mods.ones3) p *= 3;
  if (v === 6 && mods.six2) p *= 2;
  return p;
}

// Best score using ALL dice in counts c[1..6]; j[v] = how many of them are jokers
// (jokers may sit in any combination but never count as a lone 1 or 5). -1 = not all scoring.
function bestExact(c, j, mods) {
  let best = -1;
  for (const s of mods.combos) {
    if (!s.vals.every((v) => c[v] > 0)) continue;
    const c2 = c.slice(), j2 = j.slice();
    for (const v of s.vals) { c2[v]--; if (j2[v] > 0) j2[v]--; }
    const r = bestExact(c2, j2, mods);
    if (r >= 0 && r + s.pts > best) best = r + s.pts;
  }
  let t = 0;
  for (let v = 1; v <= 6; v++) {
    const n = c[v];
    if (!n) continue;
    if (n >= 3) t += kindPts(v, n, mods);
    else if ((v === 1 || v === 5) && j[v] === 0) t += n * (v === 1 ? 100 : 50);
    else { t = -1; break; }
  }
  return Math.max(best, t);
}

const scoreCache = new Map();

// dice: [{v, kind}] with kind null | 'joker' | 'wild'. Returns best score using every die, 0 if invalid.
function scoreDice(dice, mods) {
  if (!dice.length) return 0;
  const key = mods.key + '|' + dice.map((d) => (d.kind ? d.kind[0] : '') + d.v).sort().join(',');
  if (scoreCache.has(key)) return scoreCache.get(key);
  const c = [0, 0, 0, 0, 0, 0, 0], j = [0, 0, 0, 0, 0, 0, 0];
  let nJ = 0, nW = 0;
  for (const d of dice) {
    if (d.kind === 'joker') nJ++;
    else if (d.kind === 'wild') nW++;
    else c[d.v]++;
  }
  let best = 0;
  // assign values to jokers then wilds, as non-decreasing sequences (order is irrelevant)
  const assign = (left, min, isJoker) => {
    if (left === 0) {
      if (isJoker) return assign(nW, 1, false);
      const r = bestExact(c, j, mods);
      if (r > best) best = r;
      return;
    }
    for (let v = min; v <= 6; v++) {
      c[v]++; if (isJoker) j[v]++;
      assign(left - 1, v, isJoker);
      c[v]--; if (isJoker) j[v]--;
    }
  };
  assign(nJ, 1, true);
  scoreCache.set(key, best);
  return best;
}

function makeMods(badge) {
  const fx = badge ? badge.fx : null;
  const combos = STRAIGHTS.slice();
  if (fx && fx.type === 'form') combos.push(fx);
  return { combos, ones3: !!(fx && fx.type === 'ones3'), six2: !!(fx && fx.type === 'six2'), key: badge ? badge.id : '-' };
}

// All scoring ways to set dice aside from a throw: [{idx:[...], score}]
function scoringSubsets(table, mods) {
  const out = [];
  const n = table.length;
  for (let m = 1; m < 1 << n; m++) {
    const idx = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i);
    const s = scoreDice(idx.map((i) => table[i]), mods);
    if (s > 0) out.push({ idx, score: s });
  }
  return out;
}

function rollDie(def) {
  let r = Math.random(), v = 6;
  for (let i = 0; i < 6; i++) { r -= def.w[i]; if (r < 0) { v = i + 1; break; } }
  let kind = null;
  if (def.special === 'wild') kind = 'wild';
  else if (def.special === 'joker' && v === 1) kind = 'joker';
  return { def, v, kind, sel: false, rolling: true };
}

// Rough fair-dice numbers used by the AI: chance to bust and average gain when rolling n dice.
const P_BUST = [0, 0.667, 0.444, 0.278, 0.157, 0.077, 0.03, 0.01];
const AVG_GAIN = [0, 70, 100, 160, 230, 330, 480, 600];

// Pick what to set aside and whether to roll on.
// turnPts = points already set aside this turn; need = points still missing to win.
function aiChoose(options, tableSize, turnPts, need, risk, fullCount) {
  let pick = null;
  for (const o of options) {
    const x = turnPts + o.score;
    let left = tableSize - o.idx.length;
    if (left === 0) left = fullCount;
    const stay = x;
    let go = (1 - P_BUST[left]) * (x + AVG_GAIN[left]) * risk;
    if (x >= need) go = -1; // already winning: bank it
    else if (x < 300 && left >= 3) go = Math.max(go, stay + 1); // too little to bank
    const val = Math.max(stay, go);
    if (!pick || val > pick.val) pick = { ...o, val, cont: go > stay };
  }
  return pick;
}
