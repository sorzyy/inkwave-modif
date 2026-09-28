// INKWAVE — Armory: battle pass, weapon cases (CS-style opening reel) and the skin inventory.
//   const armory = new Armory(parentEl, api);   api = { getProfile(), saveProfile(), playSound(name), onEquip() }
//   armory.open(tab?) · armory.close() · armory.isOpen · armory.handleKey(e) → bool
// A full-screen overlay above the menus. Weapon art is the real weapon mesh with the real skin material, rendered by a
// small dedicated three.js renderer: one for the live inspect views, one offscreen for the card thumbnails (cached).
// All state lives in profile.armory (see game/skins.js); nothing here costs real money — coins come from matches.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getWeaponDef } from '../game/character-weapons.js';
import { getInkMaterial } from '../game/character-mats.js';
import * as SK from '../game/skins.js';
import { WEAPONS, WEAPON_ORDER } from '../config.js';
import { weaponIcon } from './ui-icons.js';

const TABS = [['pass', 'BATTLE PASS'], ['cases', 'CASES'], ['inventory', 'INVENTORY']];
const COIN = '<svg viewBox="0 0 24 24" class="iwa-coin"><circle cx="12" cy="12" r="10" fill="#ffcf33" stroke="#15121c" stroke-width="2.4"/><path d="M12 6.5c2.6 0 4 2.2 4 3.9 0 2.4-2 3.1-2 5.1h-4c0-2 -2-2.7-2-5.1 0-1.7 1.4-3.9 4-3.9z" fill="#ff8a14" stroke="#15121c" stroke-width="1.6"/></svg>';
const ACCENT = new THREE.Color('#ff8a14');

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; }
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const weaponName = (id) => (WEAPONS[id] ? WEAPONS[id].name : id);
const fullName = (sk) => `${weaponName(sk.weapon)} | ${SK.skinLabel(sk)}`;

// ---------------------------------------------------------------------------------------------- 3D weapon preview
let _env = null;
class WeaponView {
  constructor(canvas, { thumb = false } = {}) {
    this.canvas = canvas;
    this.thumb = thumb;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: thumb });
    this.r.setPixelRatio(thumb ? 1 : Math.min(2, devicePixelRatio || 1));
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.05;
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.scene.environment = pm.fromScene(_env || (_env = new RoomEnvironment()), 0.04).texture;
    pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 2);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.4); rim.position.set(-2, 1, -3);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));
    this.cam = new THREE.PerspectiveCamera(26, 1.6, 0.01, 20);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.spin = 0; this.drag = null; this.auto = true;
    if (!thumb) {
      canvas.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, s: this.spin }; this.auto = false; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => { if (this.drag) this.spin = this.drag.s + (e.clientX - this.drag.x) * 0.012; });
      canvas.addEventListener('pointerup', () => { this.drag = null; setTimeout(() => { if (!this.drag) this.auto = true; }, 1600); });
    }
  }

  setSkin(skinId, wear = 0.05, weaponId = null) {
    const sk = skinId && SK.skinById(skinId);
    const kind = weaponId || (sk && sk.weapon) || 'shooter';
    this.holder.clear();
    const d = getWeaponDef(kind);
    const shell = (sk && SK.getSkinMaterial(sk.id, wear)) || new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 1 });
    const ink = getInkMaterial(ACCENT);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(d.body, shell), new THREE.Mesh(d.ink, ink));
    if (d.drum) { const dr = new THREE.Group(); dr.position.copy(d.drumAt); dr.add(new THREE.Mesh(d.drum, ink), new THREE.Mesh(d.drumCaps, shell)); g.add(dr); }
    if (d.glow) g.add(new THREE.Mesh(d.glow, new THREE.MeshStandardMaterial({ color: 0x1b1c22, emissive: ACCENT, emissiveIntensity: 1.2 })));
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    g.position.sub(c);
    this.holder.add(g);
    this.len = Math.max(sz.z, 0.15); this.hgt = Math.max(sz.y, 0.08);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    if (!w || !h) return;
    if (!this.thumb) this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    // frame the weapon's length across the width and its height down the height, whichever needs more room
    const tv = Math.tan((this.cam.fov * Math.PI) / 360);
    const fit = Math.max(this.len / (2 * tv * this.cam.aspect), this.hgt / (2 * tv)) * (this.thumb ? 1.08 : 1.25);
    this.cam.position.set(fit, fit * 0.16, fit * 0.06); this.cam.lookAt(0, 0, 0);
  }

  render(dt = 0) {
    if (this.auto) this.spin += dt * 0.6;
    this.holder.rotation.y = this.thumb ? -0.35 : this.spin;
    SK.SKIN_TIME.value = performance.now() / 1000;
    this.r.render(this.scene, this.cam);
  }
}

// thumbnails: one offscreen renderer, cached data URLs per skin (FN look)
const _thumbs = new Map();
let _thumbView = null;
function thumbFor(skinId) {
  if (_thumbs.has(skinId)) return _thumbs.get(skinId);
  let url = '';
  try {
    if (!_thumbView) { const c = document.createElement('canvas'); c.width = 320; c.height = 180; _thumbView = new WeaponView(c, { thumb: true }); }
    _thumbView.setSkin(skinId, 0.02);
    _thumbView.render(0);
    url = _thumbView.canvas.toDataURL('image/png');
  } catch (e) { console.warn('[armory] thumbnail', e); }
  _thumbs.set(skinId, url);
  return url;
}

// ---------------------------------------------------------------------------------------------- Armory overlay
export class Armory {
  constructor(parent, api) {
    this.api = api;
    this.isOpen = false;
    this.tab = 'pass';
    this.filter = 'all';
    this.sel = null;          // selected inventory uid
    this.caseSel = 'inkriot';
    this.views = [];
    this.root = el('div', { class: 'iwa', 'aria-hidden': 'true' });
    parent.appendChild(this.root);
    this._raf = 0;
    this._last = 0;
    this._loop = this._loop.bind(this);
  }

  get profile() { return this.api.getProfile(); }
  get A() { return SK.armoryOf(this.profile); }
  _save() { SK.syncStyle(this.profile); this.api.saveProfile(); }
  _snd(n) { try { this.api.playSound?.(n); } catch (e) { /* optional */ } }

  open(tab) {
    if (tab) this.tab = tab;
    this.isOpen = true;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    if (document.pointerLockElement) document.exitPointerLock?.();
    this._snd('ui_confirm');
    this._render();
    this._last = performance.now();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  close() {
    if (this.reel) return;           // never mid-spin
    if (this.modal) { this._closeModal(); return; }
    this.isOpen = false;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this._snd('ui_back');
    cancelAnimationFrame(this._raf);
    this._disposeViews();
    this.root.innerHTML = '';
    this.api.onClose?.();
  }

  handleKey(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault?.(); this.close(); return true; }
    if (!this.modal && (e.code === 'KeyQ' || e.code === 'KeyE')) {
      const i = TABS.findIndex(([id]) => id === this.tab), n = (i + (e.code === 'KeyE' ? 1 : -1) + TABS.length) % TABS.length;
      this._setTab(TABS[n][0]);
    }
    return true;                     // the overlay owns the keyboard while it's up
  }

  _loop(t) {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, (t - this._last) / 1000); this._last = t;
    for (const v of this.views) if (v.canvas.isConnected) v.render(dt);
    if (this.reel) this._stepReel(t);
  }

  _view(canvas) {
    const v = new WeaponView(canvas);
    this.views.push(v);
    requestAnimationFrame(() => v.resize());
    return v;
  }
  _disposeViews(keep = null) {
    for (const v of this.views) if (v !== keep) { v.r.dispose(); v.r.forceContextLoss?.(); }
    this.views = keep ? [keep] : [];
  }

  // ------------------------------------------------------------------ layout
  _render() {
    this._disposeViews();
    const A = this.A;
    this.root.innerHTML = '';
    const tabs = TABS.map(([id, label]) => el('button', { class: 'iwa-tab' + (id === this.tab ? ' is-on' : ''), onclick: () => this._setTab(id) }, label,
      id === 'pass' && this._claimable().length ? el('i', { class: 'iwa-dot' }, String(this._claimable().length)) : null,
      id === 'cases' && this._caseCount() ? el('i', { class: 'iwa-dot' }, String(this._caseCount())) : null));
    this.coinEl = el('span', { class: 'iwa-coins', html: `${COIN}<b>${fmt(A.coins)}</b>` });
    const top = el('header', { class: 'iwa-top' },
      el('div', { class: 'iwa-title' }, el('b', null, 'ARMORY'), el('small', null, SK.PASS.season)),
      el('nav', { class: 'iwa-tabs' }, tabs),
      this.coinEl,
      el('button', { class: 'iwa-close', onclick: () => this.close(), title: 'Close (Esc)' }, '✕'));
    this.body = el('main', { class: 'iwa-body' });
    this.root.append(el('div', { class: 'iwa-bg' }), top, this.body,
      el('footer', { class: 'iwa-foot' }, el('span', null, el('kbd', null, 'Q'), ' / ', el('kbd', null, 'E'), ' tabs'), el('span', null, el('kbd', null, 'Esc'), ' close'),
        el('span', { class: 'iwa-foot__note' }, 'Earn pass XP and coins by playing matches. No real money, ever.')));
    this['_tab_' + this.tab]();
  }
  _setTab(id) { if (id === this.tab) return; this.tab = id; this._snd('ui_click'); this._render(); }
  _refreshCoins() { if (this.coinEl) this.coinEl.querySelector('b').textContent = fmt(this.A.coins); }
  _claimable() { const A = this.A, n = SK.passTier(A), out = []; for (let i = 1; i <= n; i++) if (!A.claimed.includes(i)) out.push(i); return out; }
  _caseCount() { return Object.values(this.A.cases).reduce((s, n) => s + (n || 0), 0); }

  // ------------------------------------------------------------------ BATTLE PASS
  _tab_pass() {
    const A = this.A, tier = SK.passTier(A), prog = SK.passProgress(A), claimable = this._claimable();
    const head = el('section', { class: 'iwa-pass__head' },
      el('div', { class: 'iwa-pass__tier' }, el('small', null, 'TIER'), el('b', null, String(tier)), el('small', null, `/ ${SK.PASS.tiers}`)),
      el('div', { class: 'iwa-pass__bar' },
        el('div', { class: 'iwa-pass__barlabel' }, tier >= SK.PASS.tiers ? 'PASS COMPLETE' : `NEXT TIER · ${fmt(A.passXp % SK.PASS.xpPerTier)} / ${fmt(SK.PASS.xpPerTier)} XP`),
        el('div', { class: 'iwa-bar' }, el('i', { style: { width: `${(prog * 100).toFixed(1)}%` } }))),
      el('button', { class: 'iwa-btn iwa-btn--gold', disabled: claimable.length ? null : true, onclick: () => this._claimAll() },
        claimable.length ? `CLAIM ALL (${claimable.length})` : 'NOTHING TO CLAIM'));
    const track = el('div', { class: 'iwa-track' });
    for (let n = 1; n <= SK.PASS.tiers; n++) track.append(this._tierCard(n, tier));
    this.body.append(head, el('p', { class: 'iwa-hint' }, 'Every match you play fills the pass with the XP you earned. Scroll the track → rewards on every tier, exclusive skins every 10, and a ★ at tier 50.'), track);
    // open on the first unclaimed reward (else the current tier)
    const focus = claimable.length ? claimable[0] : Math.max(1, tier);
    requestAnimationFrame(() => { const c = track.children[focus - 1]; if (c) track.scrollLeft = Math.max(0, c.offsetLeft - 40); });
    track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  }

  _tierCard(n, tier) {
    const A = this.A, r = SK.PASS.reward(n);
    const claimed = A.claimed.includes(n), reached = n <= tier;
    let art, label;
    if (r.kind === 'coins') { art = el('div', { class: 'iwa-tc__art is-coins', html: COIN }); label = `${r.n} coins`; }
    else if (r.kind === 'cases') { art = this._caseArt(r.case, true); label = `${r.n}× ${SK.CASES[r.case].name}`; }
    else {
      const sk = SK.skinById(r.skin);
      art = el('div', { class: 'iwa-tc__art is-skin' }, el('img', { src: thumbFor(sk.id), alt: '' }));
      label = r.label || fullName(sk);
    }
    const sk = r.kind === 'skin' ? SK.skinById(r.skin) : null;
    const card = el('div', { class: `iwa-tc${reached ? ' is-reached' : ''}${claimed ? ' is-claimed' : ''}${reached && !claimed ? ' is-ready' : ''}${n % 10 === 0 ? ' is-big' : ''}`,
      style: sk ? { '--rc': SK.rarityById(sk.rarity).color } : null },
      el('div', { class: 'iwa-tc__n' }, String(n)), art, el('div', { class: 'iwa-tc__label' }, label),
      claimed ? el('div', { class: 'iwa-tc__state' }, '✔ CLAIMED')
        : reached ? el('button', { class: 'iwa-btn iwa-btn--sm', onclick: () => this._claim(n) }, 'CLAIM')
          : el('div', { class: 'iwa-tc__state is-lock' }, `🔒 ${fmt(n * SK.PASS.xpPerTier)} XP`));
    return card;
  }

  _claim(n) {
    const res = SK.claimTier(this.profile, n);
    if (!res) return;
    this._save();
    this._snd('ui_confirm');
    if (res.item) { this._render(); this._reveal(res.item, { title: `TIER ${n} REWARD` }); }
    else this._render();
  }

  _claimAll() {
    const items = [];
    for (const n of this._claimable()) { const r = SK.claimTier(this.profile, n); if (r && r.item) items.push(r.item); }
    this._save(); this._snd('ui_confirm'); this._render();
    if (items.length) this._reveal(items[items.length - 1], { title: 'PASS REWARD' });
  }

  // ------------------------------------------------------------------ CASES
  _caseArt(caseId, small = false) {
    const C = SK.CASES[caseId];
    return el('div', { class: 'iwa-case' + (small ? ' is-sm' : ''), style: { '--cc': C.color } },
      el('i', { class: 'iwa-case__lid' }), el('i', { class: 'iwa-case__band' }), el('b', { class: 'iwa-case__name' }, C.name.replace(' Case', '')));
  }

  _tab_cases() {
    const A = this.A;
    const list = el('div', { class: 'iwa-cases' }, Object.values(SK.CASES).map((C) => el('button', {
      class: 'iwa-caserow' + (C.id === this.caseSel ? ' is-on' : ''), onclick: () => { this.caseSel = C.id; this._snd('ui_click'); this._render(); },
    }, this._caseArt(C.id, true), el('div', null, el('b', null, C.name), el('small', null, `Owned: ${A.cases[C.id] || 0}`)))));
    const C = SK.CASES[this.caseSel], owned = A.cases[C.id] || 0;
    const contents = el('div', { class: 'iwa-contents' });
    const skins = C.skins.map((id) => SK.skinById(id)).sort((a, b) => SK.RARITIES.findIndex((r) => r.id === b.rarity) - SK.RARITIES.findIndex((r) => r.id === a.rarity));
    for (const sk of skins) contents.append(this._skinCard(sk, null));
    contents.append(el('div', { class: 'iwa-card is-mystery', style: { '--rc': SK.rarityById('gold').color } },
      el('div', { class: 'iwa-card__art' }, el('b', null, '★')), el('div', { class: 'iwa-card__name' }, '★ Rare Special Item'),
      el('div', { class: 'iwa-card__sub' }, C.gold.map((f) => SK.FINISHES[f].name).join(' · '))));
    const odds = el('div', { class: 'iwa-odds' }, SK.RARITIES.map((r) => el('span', { style: { '--rc': r.color } }, el('i'), `${r.name.replace('★ ', '')} ${(r.odds * 100).toFixed(2)}%`)));
    const main = el('section', { class: 'iwa-casemain' },
      el('div', { class: 'iwa-casehero' }, this._caseArt(C.id),
        el('div', null, el('h2', null, C.name), el('p', null, `You own ${owned}. Every case holds one skin — ${Math.round(SK.STATTRAK_CHANCE * 100)}% chance of StatTrak™.`),
          el('div', { class: 'iwa-row' },
            el('button', { class: 'iwa-btn iwa-btn--gold iwa-btn--lg', disabled: owned ? null : true, onclick: () => this._openCase(C.id) }, owned ? 'OPEN CASE' : 'NO CASE'),
            el('button', { class: 'iwa-btn', disabled: A.coins >= C.price ? null : true, onclick: () => this._buy(C.id), html: `BUY · ${COIN} ${C.price}` })))),
      el('h3', null, 'CONTAINS ONE OF THE FOLLOWING'), odds, contents);
    this.body.append(el('div', { class: 'iwa-casegrid' }, list, main));
  }

  _buy(caseId) {
    if (!SK.buyCase(this.profile, caseId)) { this._snd('ui_error'); return; }
    this._save(); this._snd('ui_confirm'); this._render();
  }

  _skinCard(sk, it, onclick = null) {
    const rar = SK.rarityById(sk.rarity);
    const w = it ? SK.wearOf(it.w) : null;
    const equipped = it && this.A.equipped[sk.weapon] === it.uid;
    return el(onclick ? 'button' : 'div', { class: 'iwa-card' + (equipped ? ' is-equipped' : '') + (it && this.sel === it.uid ? ' is-sel' : ''), style: { '--rc': rar.color }, onclick },
      el('div', { class: 'iwa-card__art' }, el('img', { src: thumbFor(sk.id), alt: '', loading: 'lazy' })),
      el('div', { class: 'iwa-card__weapon', html: `${weaponIcon(sk.weapon)}<span>${weaponName(sk.weapon)}</span>` }),
      el('div', { class: 'iwa-card__name' }, (it && it.st >= 0 ? 'StatTrak™ ' : '') + SK.skinLabel(sk)),
      w ? el('div', { class: 'iwa-card__sub' }, w.name) : el('div', { class: 'iwa-card__sub' }, rar.name),
      equipped ? el('i', { class: 'iwa-card__eq' }, 'EQUIPPED') : null);
  }

  // ------------------------------------------------------------------ opening reel (CS style)
  _openCase(caseId) {
    const item = SK.openCase(this.profile, caseId);
    if (!item) return;
    this._save();
    const WIN = 46, N = 56, CW = 172;   // winner index, strip length, card pitch (px)
    const strip = el('div', { class: 'iwa-reel__strip' });
    for (let i = 0; i < N; i++) {
      const id = i === WIN ? item.skin : SK.rollCase(caseId);
      const sk = SK.skinById(id);
      // ★ items on the strip always show as the mystery gold card, like in CS (the winner too, until it lands)
      strip.append(sk.star
        ? el('div', { class: 'iwa-rc is-gold', style: { '--rc': SK.rarityById('gold').color } }, el('div', { class: 'iwa-rc__art' }, el('b', null, '★')), el('div', { class: 'iwa-rc__name' }, 'Rare Special Item'))
        : el('div', { class: 'iwa-rc', style: { '--rc': SK.rarityById(sk.rarity).color } }, el('div', { class: 'iwa-rc__art' }, el('img', { src: thumbFor(sk.id), alt: '' })),
          el('div', { class: 'iwa-rc__name' }, fullName(sk))));
    }
    const win = el('div', { class: 'iwa-reel__win' }, strip, el('i', { class: 'iwa-reel__marker' }));
    this._modal(el('div', { class: 'iwa-open' }, el('h2', null, `OPENING ${SK.CASES[caseId].name.toUpperCase()}`), win,
      el('p', { class: 'iwa-hint' }, 'Good luck…')), { locked: true });
    const vw = win.clientWidth || 900;
    // land somewhere inside the winning card (never dead-centre: the near-miss tension is the point)
    const jitter = (Math.random() - 0.5) * CW * 0.7;
    const end = WIN * CW + CW / 2 - vw / 2 + jitter;
    this.reel = { strip, t0: performance.now(), dur: 6400, end, CW, vw, lastIdx: -1, item, caseId };
  }

  _stepReel(t) {
    const R = this.reel;
    const k = Math.min(1, (t - R.t0) / R.dur);
    const e = 1 - Math.pow(1 - k, 4.2);          // fast start, long slow crawl to the stop
    const x = R.end * e;
    R.strip.style.transform = `translate3d(${-x}px,0,0)`;
    const idx = Math.floor((x + R.vw / 2) / R.CW);
    if (idx !== R.lastIdx) { R.lastIdx = idx; this._snd('ui_hover'); }
    if (k >= 1) {
      this.reel = null;
      const sk = SK.skinById(R.item.skin), rar = SK.rarityById(sk.rarity);
      this._snd(rar.id === 'gold' || rar.id === 'covert' ? 'victory_fanfare' : 'ui_confirm');
      setTimeout(() => this._reveal(R.item, { title: 'YOU GOT', again: R.caseId }), 650);
    }
  }

  // ------------------------------------------------------------------ reveal / inspect
  _reveal(item, { title = 'NEW ITEM', again = null } = {}) {
    const sk = SK.skinById(item.skin), rar = SK.rarityById(sk.rarity), w = SK.wearOf(item.w);
    const canvas = el('canvas', { class: 'iwa-inspect' });
    const actions = el('div', { class: 'iwa-row' },
      el('button', { class: 'iwa-btn iwa-btn--gold', onclick: () => { SK.equipItem(this.profile, item.uid); if (this.A.equipped[sk.weapon] !== item.uid) SK.equipItem(this.profile, item.uid); this._save(); this.api.onEquip?.(); this._snd('ui_confirm'); this._closeModal(); this.tab = 'inventory'; this.sel = item.uid; this._render(); } }, 'EQUIP'),
      el('button', { class: 'iwa-btn', onclick: () => { const c = SK.recycleItem(this.profile, item.uid); this._save(); this.api.onEquip?.(); this._snd('ui_click'); this._closeModal(); this._render(); this._toast(`Recycled for ${c} coins`); } }, `RECYCLE · +${rar.recycle}`),
      again && (this.A.cases[again] || 0) > 0 ? el('button', { class: 'iwa-btn', onclick: () => { this._closeModal(); this._render(); this._openCase(again); } }, 'OPEN ANOTHER') : null,
      el('button', { class: 'iwa-btn iwa-btn--ghost', onclick: () => { this._closeModal(); this._render(); } }, 'KEEP'));
    this._modal(el('div', { class: `iwa-reveal is-${rar.id}`, style: { '--rc': rar.color } },
      el('div', { class: 'iwa-reveal__rays' }),
      el('small', { class: 'iwa-reveal__kicker' }, title),
      canvas,
      el('h2', null, (item.st >= 0 ? 'StatTrak™ ' : '') + fullName(sk)),
      el('div', { class: 'iwa-reveal__meta' }, el('b', { style: { color: rar.color } }, rar.name), el('span', null, w.name), el('span', null, `Float ${item.w.toFixed(4)}`)),
      actions));
    const v = this._view(canvas);
    v.setSkin(sk.id, item.w);
  }

  // ------------------------------------------------------------------ INVENTORY
  _tab_inventory() {
    const A = this.A;
    const chips = el('div', { class: 'iwa-chips' }, [['all', 'ALL']].concat(WEAPON_ORDER.map((id) => [id, weaponName(id)])).map(([id, label]) =>
      el('button', { class: 'iwa-chip' + (this.filter === id ? ' is-on' : ''), onclick: () => { this.filter = id; this._snd('ui_click'); this._render(); } },
        id === 'all' ? null : el('i', { html: weaponIcon(id) }), label)));
    const items = A.items.filter((it) => { const sk = SK.skinById(it.skin); return sk && (this.filter === 'all' || sk.weapon === this.filter); })
      .sort((a, b) => b.t - a.t);
    const grid = el('div', { class: 'iwa-grid' });
    for (const it of items) grid.append(this._skinCard(SK.skinById(it.skin), it, () => { this.sel = it.uid; this._snd('ui_click'); this._render(); }));
    if (!items.length) grid.append(el('div', { class: 'iwa-empty' }, A.items.length ? 'No skins for this weapon yet.' : 'No skins yet — open a case or claim battle-pass tiers!'));
    const it = A.items.find((x) => x.uid === this.sel) || null;
    const side = el('aside', { class: 'iwa-detail' });
    if (it) {
      const sk = SK.skinById(it.skin), rar = SK.rarityById(sk.rarity), w = SK.wearOf(it.w);
      const equipped = A.equipped[sk.weapon] === it.uid;
      const canvas = el('canvas', { class: 'iwa-inspect' });
      side.style.setProperty('--rc', rar.color);
      side.append(...[canvas,
        el('h2', null, (it.st >= 0 ? 'StatTrak™ ' : '') + fullName(sk)),
        el('div', { class: 'iwa-reveal__meta' }, el('b', { style: { color: rar.color } }, rar.name), el('span', null, w.name)),
        el('div', { class: 'iwa-wear' }, el('div', { class: 'iwa-wear__bar' }, el('i', { style: { left: `${(it.w * 100).toFixed(1)}%` } })), el('small', null, `Float ${it.w.toFixed(6)}`)),
        it.st >= 0 ? el('div', { class: 'iwa-st' }, 'StatTrak™ splats: ', el('b', null, fmt(it.st))) : null,
        el('div', { class: 'iwa-row' },
          el('button', { class: 'iwa-btn iwa-btn--gold', onclick: () => { SK.equipItem(this.profile, it.uid); this._save(); this.api.onEquip?.(); this._snd('ui_confirm'); this._render(); } }, equipped ? 'UNEQUIP' : 'EQUIP'),
          el('button', { class: 'iwa-btn', onclick: () => this._confirmRecycle(it) }, `RECYCLE · +${rar.recycle}`)),
        el('p', { class: 'iwa-hint' }, 'Drag to rotate. Equipped skins show in every match — offline and online.')].filter(Boolean));
      requestAnimationFrame(() => { const v = this._view(canvas); v.setSkin(sk.id, it.w); });
    } else side.append(el('div', { class: 'iwa-empty' }, 'Pick a skin to inspect it.'));
    this.body.append(chips, el('div', { class: 'iwa-invgrid' }, grid, side));
  }

  _confirmRecycle(it) {
    const sk = SK.skinById(it.skin), rar = SK.rarityById(sk.rarity);
    this._modal(el('div', { class: 'iwa-confirm' }, el('h2', null, 'RECYCLE THIS SKIN?'), el('p', null, `${fullName(sk)} will be gone for good. You get ${rar.recycle} coins.`),
      el('div', { class: 'iwa-row' },
        el('button', { class: 'iwa-btn iwa-btn--gold', onclick: () => { const c = SK.recycleItem(this.profile, it.uid); this._save(); this.api.onEquip?.(); this.sel = null; this._closeModal(); this._render(); this._toast(`+${c} coins`); } }, 'RECYCLE'),
        el('button', { class: 'iwa-btn iwa-btn--ghost', onclick: () => this._closeModal() }, 'CANCEL'))));
  }

  // ------------------------------------------------------------------ modal / toast
  _modal(content, { locked = false } = {}) {
    this._closeModal(true);
    this.modal = el('div', { class: 'iwa-modal' + (locked ? ' is-locked' : ''), onclick: (e) => { if (e.target === this.modal && !this.reel) this._closeModal(); } }, content);
    this.root.append(this.modal);
  }
  _closeModal(silent = false) {
    if (!this.modal) return;
    const keep = this.views.filter((v) => v.canvas.isConnected && !this.modal.contains(v.canvas));
    for (const v of this.views) if (!keep.includes(v)) { v.r.dispose(); v.r.forceContextLoss?.(); }
    this.views = keep;
    this.modal.remove(); this.modal = null;
    if (!silent) this._refreshCoins();
  }
  _toast(text) {
    const t = el('div', { class: 'iwa-toast' }, text);
    this.root.append(t);
    setTimeout(() => t.classList.add('is-out'), 1800);
    setTimeout(() => t.remove(), 2300);
  }
}
