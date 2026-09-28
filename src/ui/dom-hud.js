// Domination HUD: the score race under the match clock (your team on the left), the A · B · C badges with their
// capture rings, a status line while you stand in a zone, and waypoint markers over each zone (clamped to the screen
// edge when a zone is off-screen or behind you, with the distance).
import * as THREE from 'three';
import { DOM } from '../game/domination.js';

const _p = new THREE.Vector3();
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class DomHud {
  constructor(parent) {
    this.root = el('div', 'iwd');
    this.root.hidden = true;
    const bar = el('div', 'iwd-bar');
    this.sA = el('div', 'iwd-score is-a', '<i></i><b>0</b>');
    this.sB = el('div', 'iwd-score is-b', '<i></i><b>0</b>');
    this.badgesEl = el('div', 'iwd-zones');
    bar.append(this.sA, this.badgesEl, this.sB);
    this.status = el('div', 'iwd-status');
    this.marks = el('div', 'iwd-marks');
    this.root.append(this.marks, bar, this.status);
    parent.appendChild(this.root);
    this.badges = null;
    this.visible = false;
  }

  hide() { if (this.visible) { this.visible = false; this.root.hidden = true; } }

  _build(dom) {
    this.badgesEl.innerHTML = ''; this.marks.innerHTML = '';
    this.badges = dom.zones.map((z) => {
      const b = el('div', 'iwd-badge', `<span>${z.id}</span>`);
      const m = el('div', 'iwd-mark', `<span>${z.id}</span><small></small>`);
      this.badgesEl.appendChild(b); this.marks.appendChild(m);
      return { b, m, dist: m.querySelector('small'), last: '' };
    });
    this.dom = dom;
  }

  update(dom, cam, local, teamHex) {
    if (!dom) { this.hide(); return; }
    if (!this.visible) { this.visible = true; this.root.hidden = false; }
    if (this.dom !== dom || !this.badges) this._build(dom);
    const me = local ? local.team : 0, them = 1 - me;
    this.root.style.setProperty('--tm', teamHex[me]); this.root.style.setProperty('--te', teamHex[them]);
    const sc = (el0, v) => { el0.querySelector('i').style.width = `${Math.min(100, (v / DOM.target) * 100).toFixed(1)}%`; const b = el0.querySelector('b'); const t = String(Math.floor(v)); if (b.textContent !== t) b.textContent = t; };
    sc(this.sA, dom.score[me]); sc(this.sB, dom.score[them]);
    const W = innerWidth, H = innerHeight, pad = 46;
    let here = null;
    dom.zones.forEach((z, i) => {
      const B = this.badges[i];
      const rel = z.owner < 0 ? 'n' : z.owner === me ? 'm' : 'e';
      const capRel = z.cap === 0 ? 'n' : (z.cap > 0 ? 0 : 1) === me ? 'm' : 'e';
      const key = `${rel}|${capRel}|${z.contested}|${Math.round(Math.abs(z.cap) * 100)}`;
      if (key !== B.last) {
        B.last = key;
        for (const x of [B.b, B.m]) {
          x.dataset.own = rel; x.dataset.cap = capRel;
          x.classList.toggle('is-contested', z.contested);
          x.style.setProperty('--p', Math.abs(z.cap).toFixed(3));
        }
      }
      // waypoint
      const inside = local && dom.inZone(z, local);
      if (inside) here = z;
      _p.copy(z.pos); _p.y += 2.6;
      const d = cam.position.distanceTo(_p);
      _p.project(cam);
      let x = (_p.x * 0.5 + 0.5) * W, y = (-_p.y * 0.5 + 0.5) * H;
      const behind = _p.z > 1;
      if (behind) { x = W - x; y = H - pad; }
      const off = behind || x < pad || x > W - pad || y < pad || y > H - pad;
      x = Math.min(W - pad, Math.max(pad, x)); y = Math.min(H - pad, Math.max(pad + 60, y));
      B.m.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%)`;
      B.m.classList.toggle('is-off', off);
      B.m.classList.toggle('is-here', !!inside);
      const dt = `${Math.round(d)}m`;
      if (B.dist.textContent !== dt) B.dist.textContent = dt;
    });
    // status line while you stand in a zone
    let txt = '', cls = '';
    if (here && local && local.alive) {
      const pct = Math.round(Math.abs(here.cap) * 100);
      if (here.contested) { txt = `CONTESTED ${here.id}`; cls = 'is-contested'; }
      else if (here.owner === me && pct >= 100) { txt = `HOLDING ${here.id}`; cls = 'is-hold'; }
      else if (here.owner === me) { txt = `DEFENDING ${here.id} · ${pct}%`; cls = 'is-hold'; }
      else if (here.owner === them) { txt = `NEUTRALIZING ${here.id} · ${pct}%`; cls = 'is-cap'; }
      else { txt = `CAPTURING ${here.id} · ${pct}%`; cls = 'is-cap'; }
    }
    if (this.status.textContent !== txt) this.status.textContent = txt;
    this.status.className = 'iwd-status ' + cls + (txt ? ' is-on' : '');
  }
}
