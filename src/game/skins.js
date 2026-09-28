// Weapon skins: the catalogue (finishes, rarities, wear), the skin material (a pattern shader that repaints the
// weapon's plastic shell in weapon space) and the pure inventory / battle-pass / case logic the Armory UI drives.
//
// A skin repaints only the shell classes of the weapon plastic (aMat satin / gloss / metal — see character-mats.js
// getPlasticMaterial): rubber grips, lenses, LEDs and printed decals stay as modelled, and the team-ink parts keep the
// team colour so a skinned weapon still reads as friend or foe. Light shell parts (cream / white / metal) take the
// finish, dark parts take a darkened version of it, so every weapon keeps its two-tone structure.
//
// Equipped skins travel with the character look: style.wskins = { [weaponId]: { id, w } } (skin id, wear float).
// Character (character.js) reads it when it builds a weapon, and the lobby / online roster already carry `style`.
import * as THREE from 'three';

// ---------------------------------------------------------------------------------------------- rarities / wear
// Case odds as in CS: blue 79.92 %, purple 15.98 %, pink 3.2 %, red 0.64 %, gold 0.26 %.
export const RARITIES = [
  { id: 'milspec', name: 'Mil-Spec', color: '#4b69ff', odds: 0.7992, recycle: 40 },
  { id: 'restricted', name: 'Restricted', color: '#8847ff', odds: 0.1598, recycle: 120 },
  { id: 'classified', name: 'Classified', color: '#d32ce6', odds: 0.032, recycle: 400 },
  { id: 'covert', name: 'Covert', color: '#eb4b4b', odds: 0.0064, recycle: 1200 },
  { id: 'gold', name: '★ Exceedingly Rare', color: '#e4ae39', odds: 0.0026, recycle: 5000 },
];
export const rarityById = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
export const WEARS = [
  { id: 'FN', name: 'Factory New', max: 0.07 },
  { id: 'MW', name: 'Minimal Wear', max: 0.15 },
  { id: 'FT', name: 'Field-Tested', max: 0.38 },
  { id: 'WW', name: 'Well-Worn', max: 0.45 },
  { id: 'BS', name: 'Battle-Scarred', max: 1.0 },
];
export const wearOf = (w) => WEARS.find((x) => w <= x.max) || WEARS[WEARS.length - 1];
export const STATTRAK_CHANCE = 0.1;

// ---------------------------------------------------------------------------------------------- finishes
// pat = pattern program (FINISH_PATTERNS), c = [primary, secondary, accent], metal / rough = shell response,
// glow = emissive strength for glowing patterns, s = pattern scale (per metre of weapon space).
export const PATTERNS = ['solid', 'camo', 'stripes', 'tiger', 'carbon', 'fade', 'doppler', 'hex', 'circuit', 'galaxy', 'lava', 'holo', 'gold', 'splatter', 'glitch'];
export const FINISHES = {
  harbor_camo: { name: 'Harbor Camo', pat: 'camo', c: ['#5d7f8a', '#2f4650', '#b8c9c4'], s: 22, rough: 0.55 },
  sandbar: { name: 'Sandbar', pat: 'camo', c: ['#d8c39a', '#9a7b52', '#6a5a3e'], s: 18, rough: 0.6 },
  coral_reef: { name: 'Coral Reef', pat: 'camo', c: ['#ff7a6b', '#1bb3a5', '#ffd9a8'], s: 20, rough: 0.45 },
  carbon_tide: { name: 'Carbon Tide', pat: 'carbon', c: ['#23262c', '#3b404a', '#10d2e6'], s: 140, rough: 0.25 },
  graphite: { name: 'Graphite', pat: 'carbon', c: ['#2a2a2e', '#46464d', '#ff8a14'], s: 140, rough: 0.3 },
  safety_stripe: { name: 'Safety Stripe', pat: 'stripes', c: ['#ffcf33', '#1b1e25', '#ffffff'], s: 14, rough: 0.4 },
  lifeguard: { name: 'Lifeguard', pat: 'stripes', c: ['#ff3b30', '#ffffff', '#ffd21a'], s: 12, rough: 0.35 },
  night_ops: { name: 'Night Ops', pat: 'solid', c: ['#1d2027', '#0f1115', '#ff8a14'], rough: 0.7 },
  tiger_tide: { name: 'Tiger Tide', pat: 'tiger', c: ['#ff8a14', '#15121c', '#ffd28a'], s: 9, rough: 0.35 },
  hex_reactor: { name: 'Hex Reactor', pat: 'hex', c: ['#141821', '#18d48c', '#b6ffd9'], s: 55, glow: 2.2, rough: 0.3 },
  splatterpunk: { name: 'Splatterpunk', pat: 'splatter', c: ['#f4f1ea', '#ff3f9e', '#2f5bff'], s: 16, rough: 0.3 },
  neon_circuit: { name: 'Neon Circuit', pat: 'circuit', c: ['#0d1020', '#10d2e6', '#ff3f9e'], s: 70, glow: 2.6, rough: 0.25 },
  candy_fade: { name: 'Candy Fade', pat: 'fade', c: ['#ff3f9e', '#8a3cff', '#f2e312'], metal: 1, rough: 0.14 },
  glitchcore: { name: 'Glitchcore', pat: 'glitch', c: ['#15121c', '#18d48c', '#ff2d6f'], s: 30, glow: 2.4, rough: 0.3 },
  nebula: { name: 'Nebula', pat: 'galaxy', c: ['#0b0620', '#6a2cff', '#ff4fb8'], s: 7, glow: 1.6, rough: 0.2 },
  molten_core: { name: 'Molten Core', pat: 'lava', c: ['#1b1210', '#ff5a0a', '#ffd21a'], s: 24, glow: 3.2, rough: 0.6 },
  deep_sea: { name: 'Deep Sea', pat: 'galaxy', c: ['#020c1c', '#0b6bff', '#18e6d0'], s: 8, glow: 1.4, rough: 0.2 },
  // ★ finishes (gold tier): the showpieces
  doppler_abyss: { name: 'Doppler Abyss', pat: 'doppler', c: ['#0b1a60', '#6a2cff', '#18e6ff'], s: 9, metal: 1, rough: 0.08 },
  holo_kraken: { name: 'Holo Kraken', pat: 'holo', c: ['#ffffff', '#ffffff', '#ffffff'], s: 6, metal: 1, rough: 0.1, glow: 0.35 },
  royal_gold: { name: 'Royal Gold', pat: 'gold', c: ['#ffcf4a', '#8a5a12', '#fff2c0'], s: 60, metal: 1, rough: 0.16 },
  ruby_doppler: { name: 'Ruby Doppler', pat: 'doppler', c: ['#3a0010', '#e0102f', '#ff7a8a'], s: 9, metal: 1, rough: 0.08 },
};

// ---------------------------------------------------------------------------------------------- skins + cases
// A skin = a finish on one weapon. '★' skins are drawn for a random weapon when a case rolls gold.
const S = (weapon, finish, rarity, extra = {}) => ({ id: `${weapon}.${finish}`, weapon, finish, rarity, ...extra });
export const SKINS = [
  // Ink Riot case
  S('shooter', 'harbor_camo', 'milspec'), S('dualies', 'carbon_tide', 'milspec'), S('roller', 'safety_stripe', 'milspec'),
  S('slosher', 'sandbar', 'milspec'), S('splatling', 'night_ops', 'milspec'),
  S('charger', 'tiger_tide', 'restricted'), S('blaster', 'hex_reactor', 'restricted'), S('launcher', 'splatterpunk', 'restricted'),
  S('shooter', 'neon_circuit', 'classified'), S('roller', 'candy_fade', 'classified'), S('launcher', 'glitchcore', 'classified'),
  S('charger', 'nebula', 'covert'), S('launcher', 'molten_core', 'covert'),
  // Abyss case
  S('blaster', 'coral_reef', 'milspec'), S('charger', 'graphite', 'milspec'), S('launcher', 'sandbar', 'milspec'),
  S('dualies', 'lifeguard', 'milspec'), S('roller', 'harbor_camo', 'milspec'),
  S('shooter', 'tiger_tide', 'restricted'), S('splatling', 'hex_reactor', 'restricted'), S('slosher', 'splatterpunk', 'restricted'),
  S('splatling', 'neon_circuit', 'classified'), S('dualies', 'candy_fade', 'classified'), S('blaster', 'glitchcore', 'classified'),
  S('shooter', 'molten_core', 'covert'), S('splatling', 'deep_sea', 'covert'),
  // battle-pass exclusives
  S('slosher', 'tiger_tide', 'restricted', { pass: true }), S('dualies', 'neon_circuit', 'classified', { pass: true }),
  S('blaster', 'candy_fade', 'classified', { pass: true }), S('roller', 'nebula', 'covert', { pass: true }),
];
// ★ knives of this game: every weapon in every ★ finish
export const GOLD_FINISHES = ['doppler_abyss', 'holo_kraken', 'royal_gold', 'ruby_doppler'];
const WEAPON_IDS = ['shooter', 'dualies', 'splatling', 'roller', 'slosher', 'charger', 'blaster', 'launcher'];
for (const f of GOLD_FINISHES) for (const w of WEAPON_IDS) SKINS.push(S(w, f, 'gold', { star: true }));
export const skinById = (id) => SKINS.find((s) => s.id === id) || null;

export const CASES = {
  inkriot: {
    id: 'inkriot', name: 'Ink Riot Case', color: '#ff8a14', price: 400,
    skins: ['shooter.harbor_camo', 'dualies.carbon_tide', 'roller.safety_stripe', 'slosher.sandbar', 'splatling.night_ops',
      'charger.tiger_tide', 'blaster.hex_reactor', 'launcher.splatterpunk', 'shooter.neon_circuit', 'roller.candy_fade',
      'launcher.glitchcore', 'charger.nebula', 'launcher.molten_core'],
    gold: ['doppler_abyss', 'royal_gold'],
  },
  abyss: {
    id: 'abyss', name: 'Abyss Case', color: '#2f5bff', price: 400,
    skins: ['blaster.coral_reef', 'charger.graphite', 'launcher.sandbar', 'dualies.lifeguard', 'roller.harbor_camo',
      'shooter.tiger_tide', 'splatling.hex_reactor', 'slosher.splatterpunk', 'splatling.neon_circuit', 'dualies.candy_fade',
      'blaster.glitchcore', 'shooter.molten_core', 'splatling.deep_sea'],
    gold: ['holo_kraken', 'ruby_doppler'],
  },
};

// ---------------------------------------------------------------------------------------------- battle pass
export const PASS = {
  season: 'SEASON 1 · INK RIOT',
  tiers: 50,
  xpPerTier: 1800,
  // tier n (1-based) → reward. Coins everywhere, a case every other tier, pass-exclusive skins on the tens.
  reward(n) {
    if (n === 50) return { kind: 'skin', skin: 'launcher.royal_gold', label: '★ Royal Gold Launcher' };
    const ex = { 10: 'slosher.tiger_tide', 20: 'dualies.neon_circuit', 30: 'blaster.candy_fade', 40: 'roller.nebula' }[n];
    if (ex) return { kind: 'skin', skin: ex };
    if (n % 5 === 0) return { kind: 'cases', case: n % 10 === 5 ? 'abyss' : 'inkriot', n: 2 };
    if (n % 2 === 0) return { kind: 'cases', case: n % 4 === 0 ? 'abyss' : 'inkriot', n: 1 };
    return { kind: 'coins', n: 150 + Math.floor(n / 10) * 50 };
  },
};

// ---------------------------------------------------------------------------------------------- inventory logic
// profile.armory = { coins, passXp, claimed: [tier…], cases: { caseId: n }, items: [{ uid, skin, w, st, t }],
//                    equipped: { weaponId: uid }, seq }
export function armoryOf(profile) {
  const a = profile.armory || (profile.armory = {});
  a.coins ??= 300; a.passXp ??= 0; a.claimed ??= []; a.cases ??= { inkriot: 1 }; a.items ??= []; a.equipped ??= {}; a.seq ??= 1;
  return a;
}
export const passTier = (A) => Math.min(PASS.tiers, Math.floor(A.passXp / PASS.xpPerTier));
export const passProgress = (A) => (passTier(A) >= PASS.tiers ? 1 : (A.passXp % PASS.xpPerTier) / PASS.xpPerTier);

/** After a match: pass XP = the match XP, coins scale with it. Returns { passXp, coins, tiersGained }. */
export function grantMatchRewards(profile, matchXp, won) {
  const A = armoryOf(profile);
  const before = passTier(A);
  const xp = Math.max(0, Math.round(matchXp));
  A.passXp += xp;
  const coins = Math.round(40 + xp / 25 + (won ? 30 : 0));
  A.coins += coins;
  return { passXp: xp, coins, tiersGained: passTier(A) - before };
}

export function claimTier(profile, n, rng = Math.random) {
  const A = armoryOf(profile);
  if (n < 1 || n > passTier(A) || A.claimed.includes(n)) return null;
  A.claimed.push(n);
  const r = PASS.reward(n);
  if (r.kind === 'coins') A.coins += r.n;
  else if (r.kind === 'cases') A.cases[r.case] = (A.cases[r.case] || 0) + r.n;
  else if (r.kind === 'skin') return { reward: r, item: addItem(profile, r.skin, rollWear(rng), rng() < STATTRAK_CHANCE) };
  return { reward: r };
}

export function rollWear(rng = Math.random) {
  // skewed toward the middle like real drops: most items land Field-Tested / Minimal Wear
  const u = rng();
  return +(u < 0.1 ? u * 0.7 : u < 0.35 ? 0.07 + (u - 0.1) * 0.32 : u < 0.8 ? 0.15 + (u - 0.35) * 0.51 : u < 0.9 ? 0.38 + (u - 0.8) * 0.7 : 0.45 + (u - 0.9) * 5.5).toFixed(4);
}

export function addItem(profile, skinId, w, stattrak) {
  const A = armoryOf(profile);
  const it = { uid: A.seq++, skin: skinId, w: Math.min(1, Math.max(0, +w || 0)), st: stattrak ? 0 : -1, t: Date.now() };
  A.items.push(it);
  return it;
}

/** Roll one case: rarity by the CS odds, then a skin of that rarity from the case (gold: a ★ finish on a random weapon). */
export function rollCase(caseId, rng = Math.random) {
  const C = CASES[caseId];
  let u = rng(), rar = RARITIES[0];
  for (const r of RARITIES) { if (u < r.odds) { rar = r; break; } u -= r.odds; }
  if (rar.id === 'gold') {
    const f = C.gold[Math.floor(rng() * C.gold.length)], w = WEAPON_IDS[Math.floor(rng() * WEAPON_IDS.length)];
    return `${w}.${f}`;
  }
  const pool = C.skins.filter((id) => skinById(id)?.rarity === rar.id);
  return pool[Math.floor(rng() * pool.length)] || C.skins[0];
}

export function openCase(profile, caseId, rng = Math.random) {
  const A = armoryOf(profile);
  if (!CASES[caseId] || !(A.cases[caseId] > 0)) return null;
  A.cases[caseId]--;
  const skin = rollCase(caseId, rng);
  return addItem(profile, skin, rollWear(rng), rng() < STATTRAK_CHANCE);
}

export function buyCase(profile, caseId) {
  const A = armoryOf(profile), C = CASES[caseId];
  if (!C || A.coins < C.price) return false;
  A.coins -= C.price;
  A.cases[caseId] = (A.cases[caseId] || 0) + 1;
  return true;
}

export function recycleItem(profile, uid) {
  const A = armoryOf(profile);
  const i = A.items.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const it = A.items[i], sk = skinById(it.skin);
  for (const k in A.equipped) if (A.equipped[k] === uid) delete A.equipped[k];
  A.items.splice(i, 1);
  const coins = rarityById(sk?.rarity).recycle;
  A.coins += coins;
  syncStyle(profile);
  return coins;
}

export function equipItem(profile, uid) {
  const A = armoryOf(profile);
  const it = A.items.find((x) => x.uid === uid), sk = it && skinById(it.skin);
  if (!sk) return false;
  if (A.equipped[sk.weapon] === uid) delete A.equipped[sk.weapon]; else A.equipped[sk.weapon] = uid;
  syncStyle(profile);
  return true;
}

/** Mirror the equipped skins into the look the character / lobby / online roster use. */
export function syncStyle(profile) {
  const A = armoryOf(profile);
  const ws = {};
  for (const [w, uid] of Object.entries(A.equipped)) {
    const it = A.items.find((x) => x.uid === uid);
    if (it) ws[w] = { id: it.skin, w: it.w };
  }
  profile.style = { ...(profile.style || {}), wskins: ws };
}

export function equippedItem(profile, weaponId) {
  const A = armoryOf(profile), uid = A.equipped[weaponId];
  return uid ? A.items.find((x) => x.uid === uid) || null : null;
}

export function skinLabel(sk) {
  const F = FINISHES[sk.finish];
  return (sk.star ? '★ ' : '') + (F ? F.name : sk.finish);
}

// ---------------------------------------------------------------------------------------------- material
export const SKIN_TIME = { value: 0 };   // shared clock for animated finishes (ticked by character.js / the Armory)
const NOISE_GLSL = /* glsl */`
float skH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float skN(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skH(i), skH(i + vec3(1,0,0)), f.x), mix(skH(i + vec3(0,1,0)), skH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(skH(i + vec3(0,0,1)), skH(i + vec3(1,0,1)), f.x), mix(skH(i + vec3(0,1,1)), skH(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float skF(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * skN(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// voronoi: x = distance to nearest cell point, y = distance to the border between the two nearest, z = cell hash
vec3 skV(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), o = vec3(skH(i + g), skH(i + g + 31.7), skH(i + g + 63.1));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = skH(i + g + 11.3); } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2 - d1, id);
}
vec3 skHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
`;
// Each pattern writes col (albedo), may change rough / metal and add glow (emissive). p = weapon-space position (m),
// q = p * uScale, lit = 1 on light shell parts / 0 on dark parts, V = view dir, N = normal (view space).
const PATTERN_GLSL = {
  solid: 'col = mix(uC0, uC2, step(0.965, fract(p.z * 7.0)) * lit);',
  camo: `float n = skF(q + vec3(0.0, 0.0, 3.1));
    col = n < 0.42 ? uC1 : n < 0.56 ? uC0 : uC2;`,
  stripes: `float s = fract((p.z + p.y * 0.8) * uScale); col = s < 0.5 ? uC0 : uC1;
    col = mix(col, uC2, smoothstep(0.47, 0.5, s) - smoothstep(0.5, 0.53, s));`,
  tiger: `float w = skF(q * 0.6 + 4.0) * 1.6;
    float s = sin((p.z * uScale + p.y * uScale * 0.5 + w) * 6.2832);
    float b = smoothstep(0.35, 0.55, s + (skN(q * 3.0) - 0.5) * 0.5);
    col = mix(uC0, uC1, b); col = mix(col, uC2, (1.0 - b) * smoothstep(0.6, 0.9, skN(q * 1.3)) * 0.5);`,
  carbon: `vec2 u = vec2(p.z, p.y + p.x) * uScale; vec2 c = floor(u); vec2 f = fract(u);
    float dir = mod(c.x + c.y, 2.0); float t = dir < 0.5 ? f.x : f.y;
    float weave = 0.55 + 0.45 * sin(t * 3.1416);
    col = mix(uC0, uC1, weave * 0.8); rough = mix(rough, 0.18, 0.6);
    col = mix(col, uC2, lit * step(0.93, fract(p.z * 6.0)) * 0.9);`,
  fade: `float t = clamp((p.z + 0.2) / 0.55, 0.0, 1.0) + (skN(q * 0.0 + p * 8.0) - 0.5) * 0.1;
    col = t < 0.5 ? mix(uC2, uC0, t * 2.0) : mix(uC0, uC1, (t - 0.5) * 2.0);`,
  doppler: `vec3 w = p * uScale + vec3(skF(p * uScale * 0.7), skF(p * uScale * 0.7 + 9.0), 0.0) * 2.4;
    float m = skF(w + uTime * 0.03);
    col = m < 0.4 ? mix(uC0, uC1, m / 0.4) : mix(uC1, uC2, (m - 0.4) / 0.6);
    col *= 0.55 + 0.6 * smoothstep(0.2, 0.9, m);
    float sp = step(0.985, skH(floor(p * 900.0))) * (0.5 + 0.5 * sin(uTime * 3.0 + skH(floor(p * 900.0)) * 40.0));
    glow = col * sp * 1.2;`,
  hex: `vec2 u = vec2(p.z, p.y + p.x * 0.5) * uScale;
    vec2 r = vec2(1.0, 1.732), hh = r * 0.5;
    vec2 a = mod(u, r) - hh, b = mod(u - hh, r) - hh;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    float e = 0.5 - max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y));
    float edge = 1.0 - smoothstep(0.02, 0.07, e);
    vec2 cid = u - g;
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.2 - cid.x * 0.45 + skH(vec3(cid, 1.0)) * 6.0), 3.0);
    col = mix(uC0, uC1 * 0.4, edge);
    glow = mix(uC1, uC2, pulse * 0.5) * edge * pulse * uGlow * lit;`,
  circuit: `vec2 u = vec2(p.z, p.y + p.x) * uScale; vec2 c = floor(u), f = fract(u);
    float h = skH(vec3(c, 3.0));
    float lx = smoothstep(0.08, 0.0, abs(f.y - 0.5)) * step(0.45, h);
    float ly = smoothstep(0.08, 0.0, abs(f.x - 0.5)) * step(h, 0.55);
    float pad = smoothstep(0.2, 0.12, length(f - 0.5)) * step(0.8, skH(vec3(c, 7.0)));
    float line = max(max(lx, ly), pad);
    float flow = pow(0.5 + 0.5 * sin(u.x * 0.9 - uTime * 4.0 + h * 6.0), 6.0);
    col = mix(uC0, uC0 * 1.6 + 0.04, line);
    glow = mix(uC1, uC2, step(0.7, h)) * line * (0.25 + 1.2 * flow) * uGlow * lit;`,
  galaxy: `float n = skF(q + vec3(0.0, uTime * 0.02, 0.0)), n2 = skF(q * 2.1 + 7.0);
    col = mix(uC0, uC1, smoothstep(0.35, 0.8, n)); col = mix(col, uC2, smoothstep(0.55, 0.95, n2) * 0.8);
    vec3 cell = floor(p * 420.0); float st = skH(cell);
    float tw = step(0.992, st) * (0.4 + 0.6 * sin(uTime * (2.0 + st * 5.0) + st * 50.0));
    glow = (col * 0.25 + vec3(tw) * 1.8) * uGlow * lit;`,
  lava: `vec3 v = skV(q + vec3(0.0, 0.0, uTime * 0.05));
    float crack = 1.0 - smoothstep(0.0, 0.09, v.y);
    float heat = crack * (0.6 + 0.4 * sin(uTime * 2.5 + v.z * 20.0)) + smoothstep(0.55, 1.0, skF(q * 0.7 - uTime * 0.1)) * 0.25;
    col = mix(uC0 * (0.7 + 0.5 * v.z), uC1, crack * 0.6); rough = mix(rough, 0.9, 1.0 - crack);
    glow = mix(uC1, uC2, heat) * heat * uGlow * lit;`,
  holo: `float fr = 1.0 - abs(dot(N, V));
    float h = fr * 1.4 + p.z * 3.0 + p.y * 2.0 + skN(p * 20.0) * 0.4 + uTime * 0.12;
    col = mix(vec3(0.8), skHue(h), 0.85);
    glow = skHue(h + 0.3) * uGlow * lit * (0.4 + fr);`,
  gold: `vec2 u = vec2(p.z, p.y + p.x) * uScale;
    float orn = sin(u.x) * sin(u.y) + 0.5 * sin(u.x * 2.0 + sin(u.y * 1.5) * 2.0);
    float engr = smoothstep(0.05, 0.0, abs(orn - 0.3)) + smoothstep(0.05, 0.0, abs(orn + 0.4));
    col = mix(uC0, uC1, clamp(engr, 0.0, 1.0) * 0.85); rough = mix(rough, 0.5, engr * 0.6);
    col = mix(col, uC2, smoothstep(0.7, 1.0, skN(p * 30.0)) * 0.25);`,
  splatter: `vec3 v = skV(q); vec3 v2 = skV(q * 2.3 + 5.0);
    float s1 = step(v.x, 0.35 + 0.15 * skN(q * 4.0)) * step(0.55, v.z);
    float s2 = step(v2.x, 0.25 + 0.1 * skN(q * 6.0)) * step(0.6, v2.z);
    col = uC0; col = mix(col, uC1, s1); col = mix(col, uC2, s2 * (1.0 - s1)); rough = mix(rough, 0.12, max(s1, s2));`,
  glitch: `float tt = floor(uTime * 7.0);
    vec2 blk = floor(vec2(p.z * uScale, p.y * uScale * 3.0));
    float r = skH(vec3(blk, tt));
    float scan = step(0.5, fract(p.y * 260.0 + uTime * 3.0));
    col = uC0 * (0.8 + 0.2 * scan);
    float on = step(0.82, r);
    col = mix(col, r > 0.91 ? uC2 : uC1, on * 0.8);
    glow = (r > 0.91 ? uC2 : uC1) * on * uGlow * lit * (0.6 + 0.4 * scan);`,
};

const _skinMats = new Map();
/** The shell material for a skin (cached per skin + wear bucket). */
export function getSkinMaterial(skinId, wear = 0.1) {
  const sk = skinById(skinId), F = sk && FINISHES[sk.finish];
  if (!F) return null;
  const wb = Math.round(Math.min(1, Math.max(0, wear)) * 20) / 20;
  const key = `${skinId}|${wb}`;
  if (_skinMats.has(key)) return _skinMats.get(key);
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: F.rough ?? 0.4, metalness: F.metal ?? 0, clearcoat: 1, clearcoatRoughness: 0.08, name: 'iw-skin-' + sk.finish });
  const U = {
    uTime: SKIN_TIME, uWear: { value: wb }, uScale: { value: F.s ?? 20 }, uGlow: { value: F.glow ?? 0 },
    uC0: { value: new THREE.Color(F.c[0]) }, uC1: { value: new THREE.Color(F.c[1]) }, uC2: { value: new THREE.Color(F.c[2]) },
    uMetal: { value: F.metal ?? 0 }, uRough: { value: F.rough ?? 0.4 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMat;\nvarying float vSkMat;\nvarying vec3 vSkP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkMat = aMat; vSkP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uWear, uScale, uGlow, uMetal, uRough;
        uniform vec3 uC0, uC1, uC2;
        varying float vSkMat; varying vec3 vSkP;
        ${NOISE_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 skGlow = vec3(0.0);
        {
          float cls = floor(vSkMat + 0.5);
          if (cls == 0.0 || cls == 1.0 || cls == 3.0) {
            vec3 base = vColor.rgb;
            float lit = smoothstep(0.3, 0.5, dot(base, vec3(0.299, 0.587, 0.114)));
            vec3 p = vSkP, q = p * uScale, V = normalize(vViewPosition), N = normal;
            vec3 col = uC0, glow = vec3(0.0); float rough = uRough, metal = uMetal;
            ${PATTERN_GLSL[F.pat] || PATTERN_GLSL.solid}
            col = mix(col * 0.32, col, lit);
            // wear: grime in the recesses, then paint scratched through to bare metal on the edges and grip areas
            float grime = skF(p * 38.0);
            col *= 1.0 - uWear * 0.45 * smoothstep(0.35, 0.8, grime);
            float sc = skF(vec3(p.x * 90.0, p.y * 90.0, p.z * 300.0)) + skN(p * 400.0) * 0.25;
            float scratched = step(1.08 - uWear * 0.75, sc) * step(0.02, uWear);
            col = mix(col, vec3(0.62, 0.64, 0.66), scratched);
            glow *= 1.0 - scratched;
            diffuseColor.rgb = col;
            roughnessFactor = mix(rough, 0.42, scratched) + uWear * 0.12;
            metalnessFactor = mix(metal, 0.85, scratched);
            skGlow = glow;
          }
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += skGlow;');
  };
  m.customProgramCacheKey = () => 'iw-skin-' + F.pat;
  m.userData.skin = { id: skinId, wear: wb, uniforms: U };
  _skinMats.set(key, m);
  return m;
}

/** The skin material for a character look + weapon (null = stock plastic). */
export function skinMaterialFor(style, weaponId) {
  const e = style && style.wskins && style.wskins[weaponId];
  return e && e.id ? getSkinMaterial(e.id, e.w) : null;
}

/** Bots dress up too (offline): about a third carry a case skin for their weapon, a rare few a ★. */
export function withBotSkin(style, weaponId, rng = Math.random) {
  const u = rng();
  if (u > 0.33) return style;
  const pool = SKINS.filter((s) => s.weapon === weaponId && !s.pass && (u < 0.012 ? s.star : !s.star));
  const sk = pool[Math.floor(rng() * pool.length)];
  return sk ? { ...style, wskins: { [weaponId]: { id: sk.id, w: rollWear(rng) } } } : style;
}
