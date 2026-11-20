// ============================================================
// 08_outfitfx.js — EXCLUSIVE 옷 효과 (v20 크리스마스): 입으면 몸 둘레에 입자가 맴돈다
//  · 옷 표(04_skins.js)의 fx 로 종류를 정함: santa = 금빛 반짝임이 몸을 휘감아 오르고 머리 위에서 눈송이 · frost = 빛나는 얼음 결정 + 발밑 찬 기운
//  · 입자는 총기 스킨 입자 풀(GunSkin.fx)을 같이 씀 → 로비·창고·경기에서 같은 모양, 매 프레임 갱신도 거기서
//  · 경기: 카메라 40m 안 · 살아 있음 · 1인칭 내 몸은 빼고 / 멀수록 덜 뿌림
// ============================================================
const OutfitFx = (() => {
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  const KIND = {
    santa: [
      { rate: 15, emit(E, P, o, k) { const a = Math.random() * TAU, r = 0.32 + Math.random() * 0.22, y = 0.15 + Math.random() * 1.7; _q.set(o.x + Math.cos(a) * r, o.y + y, o.z + Math.sin(a) * r); const c = Math.random() < 0.7 ? 0xffd65a : Math.random() < 0.6 ? 0xffffff : 0xff4a5a; E(P, _q, -Math.sin(a) * 0.35, 0.18 + Math.random() * 0.25, Math.cos(a) * 0.35, c, (0.022 + Math.random() * 0.02) * k, 1.1 + Math.random() * 0.6, { grow: -0.45 }); } },
      { rate: 6, emit(E, P, o, k) { const a = Math.random() * TAU, r = Math.random() * 0.55; _q.set(o.x + Math.cos(a) * r, o.y + 2.0 + Math.random() * 0.3, o.z + Math.sin(a) * r); E(P, _q, (Math.random() - 0.5) * 0.1, -0.45, (Math.random() - 0.5) * 0.1, 0xffffff, (0.022 + Math.random() * 0.012) * k, 2.2, { grow: -0.2 }); } },
    ],
    frost: [
      { rate: 14, emit(E, P, o, k) { const a = Math.random() * TAU, r = 0.3 + Math.random() * 0.25, y = 0.1 + Math.random() * 1.6; _q.set(o.x + Math.cos(a) * r, o.y + y, o.z + Math.sin(a) * r); E(P, _q, -Math.sin(a) * 0.22, 0.08 + Math.random() * 0.14, Math.cos(a) * 0.22, Math.random() < 0.55 ? 0x9fe8ff : Math.random() < 0.6 ? 0xffffff : 0x6fc8f0, (0.02 + Math.random() * 0.018) * k, 1.3 + Math.random() * 0.5, { sq: 1, grow: -0.4 }); } },
      { rate: 3.5, emit(E, P, o, k) { const a = Math.random() * TAU, r = 0.15 + Math.random() * 0.2; _q.set(o.x + Math.cos(a) * r, o.y + 0.08, o.z + Math.sin(a) * r); E(P, _q, Math.cos(a) * 0.25, 0.05, Math.sin(a) * 0.25, 0xdff4ff, (0.16 + Math.random() * 0.1) * k, 1.3, { grow: 1.2, a: 0.22, drag: 1.2 }); } },
    ],
  };
  // 입은 옷에서 효과 종류 (중복 없이) — v23 헬멧·가방 스킨은 그 장비를 실제로 썼을 때만 (gear = [헬멧, 조끼, 가방] 레벨)
  function kindsOf(look, gear) {
    if (!look || typeof Body === 'undefined') return [];
    const out = new Set();
    for (const sl of ['hat', 'top', 'bottom', 'shoes', 'gloves', 'helmet', 'pack']) {
      if ((sl === 'helmet' && !(gear && gear[0])) || (sl === 'pack' && !(gear && gear[2]))) continue;
      const S = look[sl] && Body.SKINS[look[sl]]; if (S && S.fx && KIND[S.fx]) out.add(S.fx);
    }
    return [...out];
  }
  const sceneOf = (o) => { while (o.parent) o = o.parent; return o.isScene ? o : null; };
  // rig: buildRig 결과(rig.ofx = 효과 종류) · k: 뿌리는 양(멀면 작게)
  function update(rig, dt, k = 1) {
    const K = rig && rig.ofx; if (!K || !K.length || k <= 0) return;
    const sc = sceneOf(rig.root); if (!sc || typeof GunSkin === 'undefined') return;
    rig.root.getWorldPosition(_p); const P = GunSkin.fx.pool(sc), E = GunSkin.fx.emit;
    const acc = rig._ofxA || (rig._ofxA = {});
    for (const kind of K) for (let i = 0; i < KIND[kind].length; i++) {
      const D = KIND[kind][i], key = kind + i; acc[key] = (acc[key] || 0) + dt * D.rate * k;
      let n = 0; while (acc[key] >= 1 && n < 6) { acc[key] -= 1; n++; D.emit(E, P, _p, 1); }
    }
  }
  return { kindsOf, update };
})();
