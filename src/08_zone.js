// ============================================================
// 08_zone.js — 안전 구역(자기장) 축소
//  단계별: 대기 → 축소. 다음 구역은 현재 구역 안에서 무작위.
//  구역 밖이면 플레이어/봇 모두 실제 체력 감소(방어구 무시).
// ============================================================
const Zone = {
  phases0: [
    { wait: 95, shrink: 50, r: 200, dps: 0.8 },
    { wait: 60, shrink: 40, r: 120, dps: 1.6 },
    { wait: 50, shrink: 35, r: 68, dps: 3 },
    { wait: 40, shrink: 30, r: 34, dps: 5 },
    { wait: 30, shrink: 25, r: 14, dps: 8 },
    { wait: 20, shrink: 25, r: 7, dps: 12 },
  ],
  get basePhases() { return this.phases0; }, cur: null, next: null, from: null, phase: 0, state: 'wait', timer: 0, dps: 0.4, scale: 1, mesh: null, ring: null, warned: false,
  init(scene, scale, mapId) {
    this.scale = scale;
    const MP = MAPS[mapId] || {};
    this.phases = MP.zone || Zone.basePhases;
    // 첫 구역: 섬 중앙 근처
    const a = Math.random() * TAU, d = Math.random() * (MP.zoneOff || 90);
    this.cur = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: MP.zone0 || 330 };
    this.phase = 0; this.state = 'wait'; this.dps = 0.4; this.finalT = 0;
    // 대형 맵은 비행·강하만 1~2분 걸리므로 쾌속전이라도 첫 대기 시간을 보장한다
    this.timer = Math.max(this.phases[0].wait * scale, MP.wait0Min || 0);
    this.next = this.pickNext(this.cur, this.phases[0].r);
    this.from = null;
    // 구역 벽(원통) + 다음 구역 지면 링
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.mesh.renderOrder = 5; scene.add(this.mesh);
    const pts = []; for (let i = 0; i <= 128; i++) pts.push(new THREE.Vector3());
    this.ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
    this.ring.frustumCulled = false; scene.add(this.ring);
    this.updateMeshes(); this.updateRing();
  },
  pickNext(c, r) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU, d = Math.random() * Math.max(0, c.r - r);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      // 중심이 깊은 물이면 다시
      if (W && heightAt(x, z) < -0.5 && i < 30) continue;
      if (Math.abs(x) + r > HALF - 15 || Math.abs(z) + r > HALF - 15) { if (i < 30) continue; }
      return { x, z, r };
    }
    return { x: c.x, z: c.z, r };
  },
  inside(x, z, c, m = 0) { return !!c && Math.hypot(x - c.x, z - c.z) <= c.r + m; },
  timeToNextEdge() { if (!this.next) return 999; return this.state === 'wait' ? this.timer + this.phases[this.phase].shrink * this.scale * 0.6 : this.timer * 0.6; },
  update(dt) {
    if (!this.cur) return;
    this.timer -= dt;
    const P = this.phases[this.phase];
    if (this.state === 'wait') {
      if (!this.warned && this.timer < 10 && this.next) { this.warned = true; Audio.zoneWarn(); HUD.toast('10초 후 안전 구역이 줄어듭니다', 'warn'); }
      if (this.timer <= 0 && this.next) {
        this.state = 'shrink'; this.timer = P.shrink * this.scale; this.from = Object.assign({}, this.cur); this.shrinkTotal = this.timer;
        this.dps = P.dps; HUD.toast('안전 구역 축소 시작', 'warn'); Audio.zoneWarn();
      }
    } else if (this.state === 'shrink') {
      const t = 1 - clamp(this.timer / this.shrinkTotal, 0, 1);
      this.cur.x = lerp(this.from.x, this.next.x, t); this.cur.z = lerp(this.from.z, this.next.z, t); this.cur.r = lerp(this.from.r, this.next.r, t);
      if (this.timer <= 0) {
        this.cur = Object.assign({}, this.next); this.phase++; this.warned = false;
        if (this.phase < this.phases.length) {
          this.state = 'wait'; this.timer = this.phases[this.phase].wait * this.scale;
          this.next = this.pickNext(this.cur, this.phases[this.phase].r);
          HUD.toast(`${this.phase + 1}단계 안전 구역이 표시되었습니다`, 'info');
        } else { this.state = 'final'; this.next = null; this.timer = 0; }
        this.updateRing();
      }
    } else { this.finalT = (this.finalT || 0) + dt; this.dps = 14 + this.finalT * 1.5; this.cur.r = Math.max(0.5, this.cur.r - dt * 0.12); }
    this.updateMeshes();
    // 구역 밖 피해
    for (const c of CHARS) {
      if (!c.alive || c.mode === 'plane') continue;
      if (!this.inside(c.pos.x, c.pos.z, this.cur)) {
        c.outsideZoneT += dt;
        if (c.mode === 'ground') { applyDamage(c, this.dps * dt, 'zone', null, 'zone'); if (c.isPlayer) Audio.zoneTick(); }
      } else { c.outsideZoneT = 0; if (this.state === 'final' && this.cur.r <= 0.6 && c.mode === 'ground') applyDamage(c, this.dps * 0.5 * dt, 'zone', null, 'zone'); }
    }
  },
  updateMeshes() { this.mesh.scale.set(this.cur.r, 400, this.cur.r); this.mesh.position.set(this.cur.x, 150, this.cur.z); },
  updateRing() {
    const p = this.ring.geometry.attributes.position, n = this.next;
    this.ring.visible = !!n;
    if (!n) return;
    for (let i = 0; i <= 128; i++) {
      const a = i / 128 * TAU, x = n.x + Math.cos(a) * n.r, z = n.z + Math.sin(a) * n.r;
      p.setXYZ(i, x, Math.max(heightAt(x, z), WATER_Y) + 1.2, z);
    }
    p.needsUpdate = true;
  },
  dispose(scene) { if (this.mesh) scene.remove(this.mesh); if (this.ring) scene.remove(this.ring); this.cur = this.next = null; },
};
