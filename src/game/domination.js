// Domination: three capture zones (A · B · C, from the stage layout's `zones`). Stand in a zone to take it — alone it
// takes DOM.capTime seconds from neutral, teammates speed it up (up to 2×) and so does your ink on the zone's floor
// (up to +40 %: ink it to take it faster). An enemy zone has to be drained to neutral before it flips. Anyone from
// both teams inside = contested, nothing moves. Every zone you own scores a point a second; first to DOM.target wins,
// otherwise the higher score when time runs out.
//   events: 'dom:capture' { zone, team }  ·  'dom:lost' { zone, team }  (team = the side that lost it)  ·  'dom:win'
import * as THREE from 'three';
import { G, emit, clamp } from '../core/ctx.js';

export const DOM = { target: 250, capTime: 6, durations: [180, 300], duration: 300, height: 2.2 };
const _stats = { n: 0, own: 0, enemy: 0, empty: 0 };
const WHITE = new THREE.Color(1, 1, 1);

// flat zone marker: outer ring, capture-progress arc (from 12 o'clock, clockwise), soft fill, a slow pulse inward
const DISC_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FRAG = /* glsl */`
uniform vec3 uOwner, uCap; uniform float uProg, uTime, uContest, uOwned;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float a = atan(vUv.x, vUv.y); a = a < 0.0 ? a + 6.28318 : a;
  float ring = smoothstep(0.9, 0.93, d) * (1.0 - smoothstep(0.985, 1.0, d));
  float band = smoothstep(0.78, 0.8, d) * (1.0 - smoothstep(0.88, 0.9, d));
  float arc = band * step(a / 6.28318, uProg);
  float track = band * 0.18;
  float pulse = smoothstep(0.06, 0.0, abs(d - fract(uTime * 0.35))) * 0.35 * (1.0 - d);
  float flash = uContest * (0.5 + 0.5 * sin(uTime * 12.0));
  vec3 col = mix(uOwner, vec3(1.0, 0.25, 0.2), flash * ring);
  float fill = mix(0.06, 0.16, uOwned) * (1.0 - smoothstep(0.7, 0.9, d));
  vec3 c = col * (ring + fill + pulse) + uCap * arc + uOwner * track;
  float al = clamp(ring * 0.95 + arc + track + fill + pulse, 0.0, 1.0);
  gl_FragColor = vec4(c / max(al, 1e-3), al);
}`;

export class DomMode {
  constructor(match) {
    this.m = match;
    this.score = [0, 0];
    this.acc = 0;
    this.winner = -1;
    this.group = new THREE.Group(); this.group.name = 'domination';
    G.scene.add(this.group);
    const src = (G.level.layout && G.level.layout.zones) || defaultZones(G.level);
    this.zones = src.map((z) => this._makeZone(z));
    this._navNodes();
  }

  _makeZone(z) {
    const pos = new THREE.Vector3(...z.pos);
    const uni = {
      uOwner: { value: WHITE.clone() }, uCap: { value: WHITE.clone() }, uProg: { value: 0 }, uTime: { value: 0 },
      uContest: { value: 0 }, uOwned: { value: 0 },
    };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 72).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: uni, vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    disc.position.copy(pos).y += 0.05; disc.renderOrder = 3;
    // a light column that reads from across the map (owner colour; white while neutral)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 16, 20, 1, true), beamMat);
    beam.position.copy(pos).y += 8;
    this.group.add(disc, beam);   // (the A / B / C letters are HUD waypoints — dom-hud.js)
    return { id: z.id, pos, r: z.r, cap: 0, owner: -1, n: [0, 0], contested: false, capturing: -1, ink: [0, 0], disc, beam, uni };
  }

  // nav nodes inside each zone (bots pick a spot in there, so a squad spreads over the zone instead of stacking)
  _navNodes() {
    const nav = G.nav;
    for (const z of this.zones) {
      z.nodes = [];
      if (!nav) continue;
      for (const id of nav.validIds) {
        const n = nav.nodes[id];
        if (Math.hypot(n.x - z.pos.x, n.z - z.pos.z) < z.r * 0.8 && Math.abs(n.y - z.pos.y) < 1.2) z.nodes.push(id);
      }
    }
  }

  inZone(z, a) {
    return a.alive && Math.hypot(a.pos.x - z.pos.x, a.pos.z - z.pos.z) < z.r && Math.abs(a.pos.y - z.pos.y) < DOM.height;
  }

  update(dt) {
    const live = this.m.state === 'playing' && !this.m.paused;
    for (const z of this.zones) {
      z.n[0] = z.n[1] = 0;
      for (const a of this.m.actors) if (this.inZone(z, a)) z.n[a.team]++;
      z.contested = z.n[0] > 0 && z.n[1] > 0;
      z.capturing = -1;
      if (live) this._step(z, dt);
      this._visual(z, dt);
    }
    if (!live) return;
    this.acc += dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      for (const z of this.zones) if (z.owner >= 0) this.score[z.owner] += 1;
    }
    const t = this.score[0] >= DOM.target ? 0 : this.score[1] >= DOM.target ? 1 : -1;
    if (t >= 0 && this.winner < 0) {
      this.winner = t;
      this.score[t] = DOM.target;
      emit('dom:win', { team: t });
      this.m.time = 0;                        // the match's clock ends the round on the next frame
    }
  }

  _step(z, dt) {
    const base = 1 / DOM.capTime;
    if (z.contested) return;
    const t = z.n[0] > 0 ? 0 : z.n[1] > 0 ? 1 : -1;
    if (t >= 0) {
      const dir = t === 0 ? 1 : -1;
      if (z.cap * dir >= 1) { z.cap = dir; return; }
      // your ink on the zone floor speeds it up (sampled a few times a second: regionStats walks the paint grid)
      z.inkT = (z.inkT || 0) - dt;
      if (z.inkT <= 0) { z.inkT = 0.25; const st = G.paint?.regionStats?.(z.pos.x, z.pos.y, z.pos.z, z.r, t, _stats); z.ink[t] = st && st.n ? st.own : 0; }
      const rate = base * Math.min(2, 1 + 0.5 * (z.n[t] - 1)) * (1 + 0.4 * z.ink[t]);
      z.cap = clamp(z.cap + dir * rate * dt, -1, 1);
      z.capturing = t;
      // drained an enemy zone to neutral
      if (z.owner === 1 - t && z.cap * dir >= 0) {
        const lost = z.owner; z.owner = -1;
        emit('dom:lost', { zone: z.id, team: lost, by: t });
      }
      if (z.cap * dir >= 1 && z.owner !== t) {
        z.cap = dir; z.owner = t;
        emit('dom:capture', { zone: z.id, team: t, pos: z.pos.clone() });
      }
    } else {
      // empty: an owned zone refills to full, a half-taken neutral one drains back to zero
      const goal = z.owner === 0 ? 1 : z.owner === 1 ? -1 : 0;
      const k = (z.owner >= 0 ? 0.5 : 0.3) * base * dt;
      z.cap = z.cap < goal ? Math.min(goal, z.cap + k) : Math.max(goal, z.cap - k);
    }
  }

  _visual(z, dt) {
    const tc = G.teamColors || [WHITE, WHITE];
    const u = z.uni;
    u.uTime.value = G.time;
    u.uOwner.value.copy(z.owner >= 0 ? tc[z.owner] : WHITE);
    u.uCap.value.copy(z.cap >= 0 ? tc[0] : tc[1]);
    u.uProg.value = Math.abs(z.cap);
    u.uContest.value = z.contested ? 1 : 0;
    u.uOwned.value = z.owner >= 0 ? 1 : 0;
    z.beam.material.color.copy(z.owner >= 0 ? tc[z.owner] : WHITE);
    z.beam.material.opacity = (z.contested ? 0.3 + 0.15 * Math.sin(G.time * 12) : z.owner >= 0 ? 0.26 : 0.14);
  }

  result() {
    const [s0, s1] = this.score;
    const cov = G.paint.coverage();
    const winner = s0 === s1 ? (cov[0] >= cov[1] ? 0 : 1) : s0 > s1 ? 0 : 1;
    return { mode: 'dom', score: [s0, s1], winner, coverage: cov, zones: this.zones.map((z) => ({ id: z.id, owner: z.owner })) };
  }

  dispose() {
    G.scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
  }
}

// a stage without authored zones: B at the centre, A / C on the line between the spawns
export function defaultZones(level) {
  const [p0, p1] = level.spawnPads;
  const at = (k) => { const x = p0.x + (p1.x - p0.x) * k, z = p0.z + (p1.z - p0.z) * k; return [x, level.groundHeight(x, z, 20) || 0, z]; };
  return [{ id: 'A', pos: at(0.3), r: 4.5 }, { id: 'B', pos: at(0.5), r: 5.5 }, { id: 'C', pos: at(0.7), r: 4.5 }];
}
