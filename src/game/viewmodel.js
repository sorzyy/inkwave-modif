// First-person viewmodel: while the camera rig is in the eyes (rig.fpK), the local squidkid's own body is hidden
// from the camera (render layer 1) and a second instance of their weapon — same model, same skin, same moving parts,
// animated by character.js alongside the held one — floats at the lower right of the view with walk bob, look sway
// and a recoil kick on every shot. Nothing here touches gameplay: shots still leave from the kid's real muzzle.
import * as THREE from 'three';
import { G, on, clamp, damp } from '../core/ctx.js';
import { getWeaponDef } from './character-weapons.js';

const HIDDEN = 1;                     // camera layer the local kid moves to in first person
const REST = new THREE.Vector3(0.2, -0.21, -0.5);
// per weapon: how much further out / lower the gun sits (long guns would otherwise fill the lens)
const FIT = { launcher: [0.06, -0.08, -0.26], charger: [0.01, -0.01, -0.08], splatling: [0.02, -0.03, -0.1], roller: [0.04, -0.06, -0.06], slosher: [0.02, -0.02, -0.04] };
const _e = new THREE.Euler();

export class Viewmodel {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'viewmodel';
    this.group.visible = false;
    scene.add(this.group);
    this.actor = null; this.key = '';
    this.inst = null;
    this.kick = 0; this.kickV = 0; this.bobT = 0; this.swayX = 0; this.swayY = 0; this.lastYaw = 0; this.lastPitch = 0;
    this.show = 0;
    this.hidden = null;   // the character root we moved to the hidden layer
    on('weapon:fire', (e) => { if (e.actor && e.actor === this.actor) this.kickV += e.weapon === 'launcher' ? 3.2 : e.weapon === 'blaster' || e.weapon === 'charger' ? 2.2 : 0.7; });
  }

  _build(a) {
    const ch = a.character, kind = a.weaponId;
    this._drop();
    const d = getWeaponDef(kind);
    const mk = (left) => {
      const w = ch._weaponInstance(d, false);
      w.off.position.set(0, 0, 0); w.off.quaternion.identity();
      w.pivot.remove(w.off);
      const holder = new THREE.Group();
      holder.add(w.off);
      holder.userData.left = left;
      w.body.castShadow = w.ink.castShadow = false;
      this.group.add(holder);
      return { w, holder };
    };
    const R = mk(false);
    const L = d.dual ? mk(true) : null;
    if (L) R.w.left = L.w;
    this.inst = { R, L };
    ch.vm = R.w;   // character.js animates it next to the held weapon (moving parts, lamps, drums)
    this.key = `${a.weaponId}|${JSON.stringify(ch.style.wskins?.[kind] || null)}`;
  }

  _drop() {
    if (this.actor?.character) this.actor.character.vm = null;
    this.group.clear();
    this.inst = null;
  }

  _hideBody(root, hide) {
    if (hide) {
      root.traverse((o) => o.layers.set(HIDDEN));
      this.hidden = root;
    } else if (this.hidden) {
      this.hidden.traverse((o) => o.layers.set(0));
      this.hidden = null;
    }
  }

  /** After the camera rig: pose the viewmodel in front of the lens. */
  update(dt, rig, cam, actor, active) {
    const fp = active && actor && rig.mode === 'follow' && rig.target === actor ? rig.fpK : 0;
    if (actor !== this.actor) { this._hideBody(null, false); this._drop(); this.actor = actor; }
    const a = this.actor;
    // hide the kid from our own camera once the lens is well inside the head
    const hideBody = !!(a && fp > 0.55 && rig.mapK < 0.05);
    if (hideBody !== !!this.hidden || (hideBody && this.hidden !== a.character.root)) { this._hideBody(null, false); if (hideBody) this._hideBody(a.character.root, true); }
    else if (hideBody) a.character.root.traverse((o) => { if (o.layers.mask !== 2) o.layers.set(HIDDEN); });   // late additions (bomb prop, weapon swap)
    cam.layers.disable(HIDDEN);
    const kid = a && a.alive && a.form === 'kid' && !a.superJumpState && (a.character.kidScale ?? 1) > 0.6;
    const want = fp > 0.9 && kid && rig.mapK < 0.05 ? 1 : 0;
    this.show = damp(this.show, want, want ? 14 : 22, dt);
    this.group.visible = this.show > 0.02;
    if (!this.group.visible) return;
    const key = `${a.weaponId}|${JSON.stringify(a.character.style.wskins?.[a.weaponId] || null)}`;
    if (!this.inst || key !== this.key) this._build(a);
    // follow the lens
    this.group.position.copy(cam.position);
    this.group.quaternion.copy(cam.quaternion);
    // recoil (a stiff spring), walk bob, look sway (the gun lags the view a touch)
    this.kickV += (-this.kick * 260 - this.kickV * 26) * dt;
    this.kick = clamp(this.kick + this.kickV * dt, -0.02, 0.12);
    const hs = Math.hypot(a.vel.x, a.vel.z);
    const moving = a.grounded ? clamp(hs / 6, 0, 1) : 0;
    this.bobT += dt * (5 + hs * 1.1);
    const dy = rig.yaw - this.lastYaw, dp = rig.pitch - this.lastPitch;
    this.lastYaw = rig.yaw; this.lastPitch = rig.pitch;
    const k = dt > 0 ? 1 / Math.max(dt, 1 / 240) : 0;
    this.swayX = damp(this.swayX, clamp(-dy * k * 0.012, -0.05, 0.05), 10, dt);
    this.swayY = damp(this.swayY, clamp(dp * k * 0.01, -0.04, 0.04), 10, dt);
    const drop = (1 - this.show) * 0.35;   // slides up into view
    const firing = a.weaponRunner?.firingPose?.() ? 1 : 0;
    const fit = FIT[a.weaponId] || [0, 0, 0];
    for (const part of [this.inst.R, this.inst.L]) {
      if (!part) continue;
      const side = part.holder.userData.left ? -1 : 1;
      const x = (REST.x + fit[0]) * side + this.swayX - (firing ? 0.03 * side : 0);
      const y = REST.y + fit[1] - drop + Math.sin(this.bobT * 2) * 0.012 * moving + this.swayY + (firing ? 0.03 : 0);
      const z = REST.z + fit[2] + this.kick * 0.9 + Math.abs(Math.sin(this.bobT)) * 0.006 * moving;
      part.holder.position.set(x, y, z);
      // weapon +Z → view forward (-Z); a slight inward cant, recoil tips the muzzle up
      _e.set(this.kick * 2.2 + this.swayY * 2, Math.PI + side * 0.06 + this.swayX * 1.5, -side * 0.04 + Math.sin(this.bobT) * 0.02 * moving);
      part.holder.quaternion.setFromEuler(_e);
    }
  }
}
