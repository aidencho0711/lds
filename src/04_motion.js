// ============================================================
// 04_motion.js — 캐릭터 동작 (새 뼈대용)
//  · 두 뼈 IK(팔·다리): 손을 총 손잡이·총열 덮개·탄창·장전손잡이에 정확히 붙이고, 발은 땅에 디딘다
//  · 걷기·뛰기·옆걸음·뒷걸음(발 궤적 → 다리 IK), 앉기·엎드림·기기, 점프·착지·구르기
//  · 스카이다이빙(박스 자세·급강하·기울기), 낙하산(조종줄 당기기), 넘기(장애물에 손 짚기), 오르기(턱 잡고 끌어올리기)
//  · 줍기·회복 4종·투척(핀·젖힘·던짐)·부활(동료 가슴 누르기)·기절·사망·무기 꺼내기
//  · 총 자세: 조준(개머리판 어깨)·로우 레디·질주(가슴 앞 사선)·엎드려 쏴·권총(양손)
//  좌표 규칙(모든 뼈 공통): 기본 자세 = 선 자세, 팔은 아래로. 위팔 rotation.x 음수 = 앞으로, 팔꿈치 x 음수 = 굽힘
//   허벅지 x 음수 = 앞으로, 무릎 x 양수 = 굽힘, 발 x 양수 = 발끝 내림, 허리 x 양수 = 앞으로 숙임
// ============================================================
const UA = Body.LEN.upper, FA = Body.LEN.fore, TH = Body.LEN.thigh, SH = Body.LEN.shin;
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _U = new THREE.Vector3(), _V = new THREE.Vector3(), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _F = new THREE.Vector3();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3(), _t5 = new THREE.Vector3(), _t6 = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qh = new THREE.Quaternion(), _qg = new THREE.Quaternion(), _qL = new THREE.Quaternion(), _qR = new THREE.Quaternion();
const _mr = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _eu = new THREE.Euler(), _eu2 = new THREE.Euler(0, 0, 0, 'YXZ');
const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
const qx = (q, a) => q.setFromAxisAngle(AX_X, a), qy = (q, a) => q.setFromAxisAngle(AX_Y, a), qz = (q, a) => q.setFromAxisAngle(AX_Z, a);
// 월드 회전(크기 성분 제거 — 1인칭 팔은 ×1.1로 키워서 setFromRotationMatrix를 쓰면 틀어진다)
const _dv = new THREE.Vector3(), _ds = new THREE.Vector3();
const worldQuat = (o, out) => { o.matrixWorld.decompose(_dv, out, _ds); return out; };

// ---------- 두 뼈 IK ----------
// 팔: T = 손목 목표(월드), P = 팔꿈치가 향할 점(월드), Qh = 손 방향(월드, 없으면 팔뚝과 일직선), w = 섞기(1 = IK)
//  부모(쇄골) 월드 행렬이 최신이어야 한다. 실제 닿은 손목 위치를 out에 돌려준다
function armIK(A, T, P, Qh, w, out, sc) {
  if (w <= 0.001) return null;
  const UA = Body.LEN.upper * (sc || 1), FA = Body.LEN.fore * (sc || 1);
  _S.setFromMatrixPosition(A.sh.matrixWorld);
  _U.subVectors(T, _S); const d0 = _U.length(); _U.divideScalar(d0 || 1);
  const d = clamp(d0, Math.abs(UA - FA) + 0.02, (UA + FA) * 0.995);
  _V.subVectors(P, _S); _V.addScaledVector(_U, -_V.dot(_U));
  if (_V.lengthSq() < 1e-8) { _V.set(0, -1, 0); _V.addScaledVector(_U, -_V.dot(_U)); }
  _V.normalize();
  const ca = clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _E.copy(_S).addScaledVector(_U, UA * ca).addScaledVector(_V, UA * sa);
  const W = out || _t6; W.copy(_S).addScaledVector(_U, d);
  _Y.subVectors(_S, _E).normalize();
  _F.subVectors(W, _E).normalize();
  _Z.copy(_F).addScaledVector(_Y, -_F.dot(_Y));
  if (_Z.lengthSq() < 1e-6) _Z.copy(_V).negate().addScaledVector(_Y, _V.dot(_Y)); // 팔을 다 편 경우
  _Z.normalize(); _X.crossVectors(_Y, _Z).normalize(); _Z.crossVectors(_X, _Y);
  _mr.makeBasis(_X, _Y, _Z); _qa.setFromRotationMatrix(_mr);                    // 위팔 월드 회전
  worldQuat(A.clav, _qp).invert();
  _qb.copy(_qp).multiply(_qa);                                                    // 위팔 로컬
  const flex = Math.acos(clamp(-_F.dot(_Y), -1, 1));
  qx(_qc, -flex);                                                                 // 팔꿈치 로컬
  A.sh.quaternion.slerp(_qb, w);
  if (Qh) {
    _qd.copy(_qa).multiply(_qc).invert().multiply(Qh);                            // 손 로컬
    if (_qd.w < 0) _qd.set(-_qd.x, -_qd.y, -_qd.z, -_qd.w);                       // 같은 회전의 짧은 쪽(w ≥ 0) — 안 그러면 비틀림이 ±180° 넘게 잡혀 팔꿈치가 꼬인다
    // 손목 비틀림의 절반을 아래팔로 나눠 손목이 꼬이지 않게
    const tw = Math.atan2(_qd.y, _qd.w) * 2 * 0.5;
    _qh.setFromAxisAngle(AX_Y, tw); _qc.multiply(_qh); _qh.invert(); _qd.premultiply(_qh);
    A.hand.quaternion.slerp(_qd, w);
  } else A.hand.quaternion.slerp(_qh.identity(), w);
  A.el.quaternion.slerp(_qc, w);
  return W;
}
// 다리: T = 발목 목표(월드), fwd = 무릎이 향할 방향(월드), Qf = 발 방향(월드)
function legIK(L, T, fwd, Qf, w) {
  if (w <= 0.001) return;
  _S.setFromMatrixPosition(L.hip.matrixWorld);
  _U.subVectors(T, _S); const d0 = _U.length(); _U.divideScalar(d0 || 1);
  const d = clamp(d0, 0.12, (TH + SH) * 0.999);
  _V.copy(fwd).addScaledVector(_U, -fwd.dot(_U)); if (_V.lengthSq() < 1e-8) _V.set(0, 0, 1); _V.normalize();
  const ca = clamp((TH * TH + d * d - SH * SH) / (2 * TH * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _E.copy(_S).addScaledVector(_U, TH * ca).addScaledVector(_V, TH * sa);
  _t5.copy(_S).addScaledVector(_U, d);
  _Y.subVectors(_S, _E).normalize(); _F.subVectors(_t5, _E).normalize();
  _Z.copy(_F).addScaledVector(_Y, -_F.dot(_Y));
  if (_Z.lengthSq() < 1e-6) _Z.copy(_V); else _Z.normalize().negate();
  _Z.addScaledVector(_Y, -_Z.dot(_Y)).normalize(); _X.crossVectors(_Y, _Z).normalize();
  _mr.makeBasis(_X, _Y, _Z); _qa.setFromRotationMatrix(_mr);
  worldQuat(L.hip.parent, _qp).invert();
  _qb.copy(_qp).multiply(_qa); L.hip.quaternion.slerp(_qb, w);
  const flex = Math.acos(clamp(-_F.dot(_Y), -1, 1)); qx(_qc, flex); L.knee.quaternion.slerp(_qc, w);
  if (Qf) { _qd.copy(_qa).multiply(_qc).invert().multiply(Qf); L.foot.quaternion.slerp(_qd, w); }
}
// 손 방향 쿼터니언: 손가락 방향 fd, 손바닥이 향하는 방향 pn (월드), side +1 왼손 / -1 오른손
function handQuat(out, fd, pn, side) {
  _Y.copy(fd).negate().normalize();
  _X.copy(pn).multiplyScalar(side > 0 ? -1 : 1); _X.addScaledVector(_Y, -_X.dot(_Y)).normalize();
  _Z.crossVectors(_X, _Y);
  _mr.makeBasis(_X, _Y, _Z); return out.setFromRotationMatrix(_mr);
}
// ---------- 손가락 ----------
//  f1·f2 = 나머지 손가락 굽힘, i1·i2 = 검지, t = 엄지 감싸기
const FING = {
  relax: [0.35, 0.3, 0.25, 0.2, 0.15], grip: [1.35, 1.25, 0.55, 0.45, 0.9], trig: [1.35, 1.25, 0.95, 0.75, 0.9], fore: [1.05, 0.9, 1.0, 0.85, 0.5],
  mag: [1.0, 0.85, 0.9, 0.7, 0.75], pinch: [1.4, 1.35, 0.85, 0.75, 1.0], flat: [0.08, 0.05, 0.05, 0.05, 0.05], fist: [1.6, 1.55, 1.5, 1.4, 1.1],
  wheel: [1.25, 1.1, 1.15, 1.0, 0.8], hold: [0.95, 0.8, 0.85, 0.7, 0.85], open: [0.2, 0.1, 0.15, 0.1, 0.0], claw: [0.7, 0.6, 0.6, 0.5, 0.3],
};
const _fing = [0, 0, 0, 0, 0];
function setFingers(A, P, w = 1) {
  const s = A.side, R = Body.REST['thumb1' + (s > 0 ? 'L' : 'R')];
  A.fin1.rotation.set(0, 0, -s * P[0] * w); A.fin2.rotation.set(0, 0, -s * P[1] * w);
  A.idx1.rotation.set(0, 0, -s * P[2] * w); A.idx2.rotation.set(0, 0, -s * P[3] * w);
  A.thumb1.rotation.set(R[0] - 0.25 * P[4] * w, s * 0.15 * P[4] * w, R[2] - s * 0.45 * P[4] * w); A.thumb2.rotation.set(0, 0, -s * 0.7 * P[4] * w);
}
function mixFing(a, b, k) { for (let i = 0; i < 5; i++) _fing[i] = lerp(a[i], b[i], k); return _fing; }
// 꽉 쥔 주먹(주먹질): 손가락을 끝까지 말고 엄지는 검지·중지 앞으로 접어 넣는다
//  FING.fist는 엄지가 손바닥 아래로 벌어져서 가까이(1인칭) 보면 갈고리처럼 보임 — 엄지 첫 마디를 x축으로 +0.8 돌리면 접힌다 (좌우 공통)
function setFist(A, w = 1) {
  const s = A.side, R = Body.REST['thumb1' + (s > 0 ? 'L' : 'R')];
  A.fin1.rotation.set(0, 0, -s * 1.85 * w); A.fin2.rotation.set(0, 0, -s * 1.8 * w);
  A.idx1.rotation.set(0, 0, -s * 1.8 * w); A.idx2.rotation.set(0, 0, -s * 1.75 * w);
  A.thumb1.rotation.set(R[0] + 0.8 * w, R[1], R[2]); A.thumb2.rotation.set(0, 0, -s * 0.6 * w);
}
// 총 부품 위치(anchor)별 손 모양 / 손 방향(총 좌표계 기준 쿼터니언)
const ANCHOR_FING = { grip: 'trig', fore: 'fore', well: 'mag', pouch: 'mag', pouchR: 'mag', charge: 'pinch', chargeBack: 'pinch', port: 'pinch', bolt: 'pinch', boltUp: 'pinch', boltBack: 'pinch', cover: 'claw', coverUp: 'claw', tray: 'flat', lever: 'grip', breech: 'pinch', foreOpen: 'fore',
  vfore: 'grip', wellRock: 'mag', knock: 'mag', catch: 'flat', catchIn: 'flat', knob: 'pinch', knobBack: 'pinch', drum: 'claw', drumOut: 'claw', pan: 'claw', panOut: 'claw', stop: 'grip', gate: 'pinch', clip: 'pinch', clipPush: 'pinch' };
const GQ = {};   // 총 좌표계에서 손 방향
(() => {
  const mk = (name, fd, pn, side) => { const q = new THREE.Quaternion(); handQuat(q, new THREE.Vector3().fromArray(fd), new THREE.Vector3().fromArray(pn), side); GQ[name + (side > 0 ? 'L' : 'R')] = q; };
  // 오른손(-1): 손잡이 = 악수 자세(손가락 앞, 손바닥 왼쪽) + 손잡이 기울기
  mk('grip', [0, -0.28, 0.96], [1, 0, 0], -1); mk('lever', [0, 0.2, 0.98], [0.3, -0.9, 0], -1);
  mk('bolt', [0.2, -0.3, 0.93], [0.6, -0.75, 0], -1); mk('boltUp', [0.3, 0.1, 0.95], [0.7, -0.6, 0.2], -1); mk('boltBack', [0.3, 0.1, 0.95], [0.7, -0.6, 0.2], -1);
  mk('pouchR', [0, -1, 0.1], [1, 0, 0], -1); mk('port', [0.3, -0.2, 0.93], [0.3, 0.9, 0], -1);
  // 왼손(+1): 총열 덮개 = 아래에서 받침(손바닥 위, 손가락이 오른쪽으로 감쌈)
  mk('fore', [-0.75, 0.35, 0.55], [0.15, 1, 0], 1); mk('foreOpen', [-0.75, 0.35, 0.55], [0.15, 1, 0], 1);
  mk('well', [0.0, 0.1, 0.99], [-0.85, 0.3, 0], 1); mk('pouch', [0, -0.95, 0.3], [-1, 0, 0], 1);
  mk('charge', [0.2, 0.1, 0.97], [-0.9, -0.3, 0], 1); mk('chargeBack', [0.2, 0.1, 0.97], [-0.9, -0.3, 0], 1);
  mk('port', [-0.2, 0.0, 0.98], [0.1, 1, 0], 1); mk('cover', [-0.2, -0.3, 0.93], [0, -1, 0], 1); mk('coverUp', [-0.2, 0.4, 0.9], [0, -0.8, 0.6], 1);
  mk('tray', [-0.3, -0.2, 0.93], [0, -1, 0], 1); mk('breech', [-0.2, -0.3, 0.93], [0.2, -0.9, 0], 1);
  mk('grip', [0, -0.28, 0.96], [-1, 0, 0], 1); mk('fore', [-0.75, 0.35, 0.55], [0.15, 1, 0], -1);
  // v16 — 왼손: 앞 수직 손잡이 · 젖힌 탄창 · 탄창 쳐내기 · 노리쇠 멈치(손바닥) · 위 장전 손잡이(위에서) · 드럼 옆면 · 원판 가장자리(위에서)
  mk('vfore', [0, -0.28, 0.96], [-1, 0, 0], 1); mk('wellRock', [0.0, 0.1, 0.99], [-0.85, 0.3, 0], 1); mk('knock', [0.0, 0.25, 0.97], [-0.85, 0.3, 0], 1);
  mk('catch', [0.05, 0.4, 0.92], [-1, 0, 0], 1); mk('catchIn', [0.05, 0.4, 0.92], [-1, 0, 0], 1);
  mk('knob', [-0.45, -0.25, 0.86], [0, -1, 0], 1); mk('knobBack', [-0.45, -0.25, 0.86], [0, -1, 0], 1);
  mk('drum', [0, -0.6, 0.8], [-1, 0, 0], 1); mk('drumOut', [0, -0.6, 0.8], [-1, 0, 0], 1);
  mk('pan', [-0.55, -0.35, 0.76], [-0.3, -0.95, 0], 1); mk('panOut', [-0.55, -0.35, 0.76], [-0.3, -0.95, 0], 1);
  // 오른손: 슬라이드 멈치(엄지) · 장전구(손바닥이 총 오른쪽 옆면) · 클립(위에서 엄지로 누름)
  mk('stop', [0, -0.18, 0.98], [1, 0, 0], -1); mk('gate', [0.05, -0.15, 0.98], [1, 0, 0], -1);
  mk('clip', [0.35, -0.4, 0.85], [0.15, -0.95, 0.2], -1); mk('clipPush', [0.35, -0.4, 0.85], [0.15, -0.95, 0.2], -1);
})();
// 손바닥 가운데(손목 기준, 손 로컬) — 총 anchor는 손바닥 가운데 자리
const PALM = { L: new THREE.Vector3(-0.012, -0.06, 0.004), R: new THREE.Vector3(0.012, -0.06, 0.004) };
function gripQuat(out, info, side, gunQ) {
  const ka = GQ[info.a + (side > 0 ? 'L' : 'R')] || GQ[(side > 0 ? 'fore' : 'grip') + (side > 0 ? 'L' : 'R')];
  const kb = GQ[info.b + (side > 0 ? 'L' : 'R')] || ka;
  out.copy(ka).slerp(kb, info.k); return out.premultiply(gunQ);
}
// 총 anchor(예전 떠 있는 손 모델 기준)를 관절 손에 맞게 보정: 왼손 받침은 총열 덮개 '아래'에 손바닥
const ANCHOR_ADJ = { fore: [-0.022, -0.04, 0], foreOpen: [-0.022, -0.04, 0] };
function anchorAdj(info, out) {
  const a = ANCHOR_ADJ[info.a], b = ANCHOR_ADJ[info.b], ka = a ? 1 - info.k : 0, kb = b ? info.k : 0;
  if (a) { out.x += a[0] * ka; out.y += a[1] * ka; out.z += a[2] * ka; }
  if (b) { out.x += b[0] * kb; out.y += b[1] * kb; out.z += b[2] * kb; }
  return out;
}
function gripFing(info) { const fa = FING[ANCHOR_FING[info.a] || 'grip'], fb = FING[ANCHOR_FING[info.b] || 'grip']; return mixFing(fa, fb, info.k); }
// 총 개머리판 끝(총 좌표 z 최솟값) — 총 모델별로 한 번 계산
const _bb = new THREE.Box3();
function gunButt(gun) {
  const m = gun.userData.meta; if (m.buttZ !== undefined) return m.buttZ;
  _bb.setFromObject(gun); const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert(); _bb.applyMatrix4(inv);
  m.buttZ = isFinite(_bb.min.z) ? _bb.min.z : -0.3; m.muzZ = isFinite(_bb.max.z) ? _bb.max.z : 0.4; return m.buttZ;
}

// ---------- 걸음 ----------
// 한 주기 보폭(m)과 디딤 비율: 속도에 따라 걷기 → 뛰기
const strideLen = (sp, cr) => cr ? 0.8 + 0.3 * sp : clamp(0.95 + 0.42 * sp, 1.0, 3.7);
// 발 궤적: u(0..1 주기), 반환 [앞뒤 오프셋, 높이, 발 각도, 발가락 굽힘]
const _foot = [0, 0, 0, 0];
function footPath(u, S, df, lift, run) {
  const Ls = Math.min(S * df, run ? 0.85 : 0.62);
  if (u < df) {
    const t = u / df; _foot[0] = (0.5 - t) * Ls; _foot[1] = 0;
    _foot[2] = t < 0.15 ? lerp(-0.22, 0, t / 0.15) : t > 0.62 ? sstep(0.62, 1, t) * (run ? 0.55 : 0.45) : 0;
    _foot[3] = t > 0.62 ? -sstep(0.62, 1, t) * 0.55 : 0;
  } else {
    const t = (u - df) / (1 - df);
    _foot[0] = lerp(-Ls / 2, Ls / 2, run ? sstep(0.18, 1, t) : sstep(0, 1, t)) - (run ? 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.6)) : 0);
    _foot[1] = lift * Math.pow(Math.sin(Math.PI * (run ? Math.min(1, t * 1.25) : t)), 0.85);
    _foot[2] = lerp(run ? 0.55 : 0.45, -0.25, sstep(0, 0.85, t)); _foot[3] = -0.3 * (1 - sstep(0, 0.4, t));
  }
  return _foot;
}

// ---------- 총 자세 ----------
// 가슴 뼈 로컬: 오른쪽 어깨 개머리판 자리 / 질주 때 가슴 앞
const POCKET = new THREE.Vector3(-0.135, 0.165, 0.11), PORT = new THREE.Vector3(0.0, 0.02, 0.27);
const _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gp = new THREE.Vector3(), _gp2 = new THREE.Vector3(), _gb = new THREE.Vector3(), _cw = new THREE.Quaternion();
// c: 캐릭터, r: 리그, a: 애니메이션 상태, aimYaw/aimPitch: 겨눌 방향(월드), A: weaponAnim 결과
function placeGun(c, r, a, aimYaw, aimPitch, A, prone) {
  const gun = r.gunObj, meta = gun.userData.meta, pistol = !!meta.pistol;
  const by = c.bodyYaw;
  // 자세 가중치: 조준·준비(rd) / 로우 레디 / 질주(sp) / 들고 이동(넘기)
  const rd = a.ready || 0, spr = (a.sprint || 0) * (1 - rd), carry = a.carry || 0;
  // 방향
  let yaw = lerp(aimYaw + angleDiff(aimYaw, by + 0.36), aimYaw, rd), pitch = lerp(-0.46, aimPitch, rd), roll = lerp(0.1, 0, rd);
  if (pistol) { yaw = lerp(by + 0.1, aimYaw, rd); pitch = lerp(-0.95, aimPitch, rd); roll = 0; }
  if (spr > 0.001) { yaw = lerp(yaw, by + (pistol ? 0.2 : 0.95), spr); pitch = lerp(pitch, pistol ? -1.1 : 0.42, spr); roll = lerp(roll, pistol ? 0 : 0.65, spr); }
  if (prone) { pitch = lerp(pitch, clamp(aimPitch, -0.25, 0.35), prone); roll = lerp(roll, 0, prone); }
  if (carry > 0.001) { yaw = lerp(yaw, by + 0.15, carry); pitch = lerp(pitch, -1.15, carry); roll = lerp(roll, 0.2, carry); }
  _eu2.set(-pitch, yaw, roll); _gq.setFromEuler(_eu2);
  // 장전 중 기울임(총 좌표 축) — 손잡이를 중심으로
  if (A && (A.tiltX || A.tiltZ)) { _eu.set(A.tiltX, 0, A.tiltZ); _gq2.setFromEuler(_eu); _gq.multiply(_gq2); }
  // 기준점
  r.chest.matrixWorld.decompose(_gp2, _cw, _gb);
  if (pistol) {
    // 권총: 팔을 뻗은 자리(눈 높이 조금 아래)에 손잡이
    _gp.set(-0.04, 0.2 - (1 - rd) * 0.28, 0.24 + rd * 0.24).applyMatrix4(r.chest.matrixWorld);
    if (rd > 0.01) { _gp2.set(Math.sin(aimYaw) * Math.cos(aimPitch), Math.sin(aimPitch), Math.cos(aimYaw) * Math.cos(aimPitch)); _t1.set(-0.04, 0.2, 0.0).applyMatrix4(r.chest.matrixWorld); _gp.lerp(_t1.addScaledVector(_gp2, 0.5), rd); }
    _gb.fromArray(meta.gripPos);
  } else {
    _gp.copy(POCKET); if (spr > 0.001) _gp.lerp(PORT, spr);
    if (A && A.tiltZ) _gp.lerp(_t1.set(-0.06, 0.08, 0.16), Math.min(1, A.tiltZ * 1.6));   // 장전: 몸 쪽으로 끌어옴
    _gp.applyMatrix4(r.chest.matrixWorld);
    _gb.set(0, (meta.boreY || 0.03) - 0.02, gunButt(gun) + 0.01);
    if (spr > 0.001) _gb.lerp(_t2.set(0, -0.03, (gunButt(gun) + (meta.muzZ || 0.5)) * 0.5 - 0.05), spr);
    if (carry > 0.001) { _gp.lerp(_t2.set(-0.2, -0.32, 0.06).applyMatrix4(r.chest.matrixWorld), carry); _gb.lerp(_t3.fromArray(meta.gripPos), carry); }
  }
  // 총 원점 = 기준점 - 회전 × 기준점의 총 좌표
  _t2.copy(_gb).applyQuaternion(_gq); _gp.sub(_t2);
  // 월드 → 가슴 로컬
  _mi.copy(r.chest.matrixWorld).invert(); r.gunMount.position.copy(_gp).applyMatrix4(_mi);
  r.gunMount.quaternion.copy(_cw).invert().multiply(_gq);
  r.gunMount.updateMatrixWorld(true);
  return _gq;
}

// 두 손을 총의 anchor(weaponAnim 결과 A)로: 총 월드 회전 gq, 섞기 w
function handsOnGun(r, gun, A, gq, w, fine, rd, prone) {
  for (const [Ar, anc, info, P] of [[r.armR, A.right, A.ri, PALM.R], [r.armL, A.left, A.li, PALM.L]]) {
    const s = Ar.side;
    gripQuat(_hq, info, s, gq);
    anchorAdj(info, _t1.copy(anc)).applyMatrix4(gun.matrixWorld);
    _t2.copy(P).applyQuaternion(_hq); _t1.sub(_t2);                       // 손바닥 가운데 → 손목
    // 팔이 닿지 않으면(긴 총) 왼손을 총열을 따라 뒤로
    if (s > 0 && info.a === 'fore' && info.b === 'fore') {
      _S.setFromMatrixPosition(Ar.sh.matrixWorld); const reach = (UA + FA) * 0.97;
      _t3.set(0, 0, -1).applyQuaternion(gq); for (let it = 0; it < 3; it++) { const dd = _t1.distanceTo(_S); if (dd <= reach) break; _t1.addScaledVector(_t3, dd - reach + 0.01); }
    }
    // 팔꿈치: 아래·바깥쪽 (오른팔은 조준할 때 들림)
    chestPt(r, s * 0.45, s > 0 ? -0.35 : lerp(-0.3, -0.12, rd), s > 0 ? 0.05 : -0.05, _t3);
    if (prone > 0.5) bodyPt(r, s * 0.5, 1.1, -0.6, _t3);
    Ar.clav.rotation.set(0, -s * (s > 0 ? 0.22 : 0.08) * rd * w, s * 0.06 * w); Ar.clav.updateMatrixWorld(true);
    armIK(Ar, _t1, _t3, _hq, w);
    if (fine) setFingers(Ar, gripFing(info), w);
  }
}
// 로비·창고: 편하게 선 자세 + 총은 로우 레디 (root 위치는 부른 쪽에서)
const _lobbyA = { ready: 0, sprint: 0, carry: 0 }, _lobbyC = { bodyYaw: 0, rl: null, cycle: null, weapon: null, slideKick: 0, fireCd: 0 };
function poseLobby(r, t, yaw, opts) {
  resetPose(r);
  r.root.rotation.set(0, yaw, 0);
  const br = Math.sin(t * 1.6), shift = Math.sin(t * 0.35);
  r.hips.position.set(0.012 * shift, 0.952 + br * 0.003, 0); r.hips.rotation.set(0.02, 0.06, -0.035 + shift * 0.01);
  r.spine.rotation.set(0.03 + br * 0.008, -0.1, 0.025); r.chest.rotation.set(0.012 * br, -0.08, 0);
  const lk = Math.sin(t * 0.4) * (opts && opts.still ? 0.05 : 0.3);
  r.neck.rotation.set(-0.04, lk * 0.5, 0); r.head.rotation.set(-0.03, lk * 0.5, 0);
  r.root.updateMatrixWorld(true);
  const gy = r.root.position.y; _fw.set(Math.sin(yaw), 0, Math.cos(yaw));
  for (const L of [r.legL, r.legR]) {
    const s = L.side; bodyPt(r, s * (s > 0 ? 0.15 : 0.1), 0, s > 0 ? 0.07 : -0.03, _t1); _t1.y = gy + 0.085;
    _eu2.set(0, yaw + s * 0.16, 0); _hq.setFromEuler(_eu2); legIK(L, _t1, _fw, _hq, 1);
  }
  r.root.updateMatrixWorld(true);
  for (const A of [r.armL, r.armR]) { A.sh.rotation.set(0.02, 0, A.side * 0.08); A.el.rotation.set(-0.2, 0, 0); setFingers(A, FING.relax); }
  if (r.gunObj) {
    _lobbyC.bodyYaw = yaw;
    const A = weaponAnim(_lobbyC, r.gunObj.userData.meta), gq = placeGun(_lobbyC, r, _lobbyA, yaw, 0, A, 0);
    handsOnGun(r, r.gunObj, A, gq, 1, true, 0, 0);
  }
}

// ---------- 메인 ----------
const PICK_T = 0.5;
const HOLD_POSE = {   // [손바닥 쪽, 위아래, 앞뒤, rx, ry, rz, 크기] (손 로컬)
  bandage: [0.02, -0.01, 0.0, 0, 0, Math.PI / 2, 1.2], firstaid: [0.045, -0.01, 0.0, 0, 0, Math.PI / 2, 0.95], medkit: [0.055, -0.01, 0.0, 0, 0, Math.PI / 2, 0.85],
  drink: [0.035, -0.005, 0.0, Math.PI / 2, 0, 0, 1.15], frag: [0.035, -0.005, 0.0, 0, 0, 0, 1.15], smoke: [0.035, -0.005, 0.0, 0, 0, 0, 1.1],
};
let _rollGeo = null;
function heldModel(id) {
  if (id !== 'bandage') return Models.display(id);
  if (!_rollGeo) _rollGeo = [new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16).rotateZ(Math.PI / 2), new THREE.BoxGeometry(0.06, 0.003, 0.11).translate(0, -0.03, 0.05)];
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xe9e3d2 });
  g.add(new THREE.Mesh(_rollGeo[0], m)); g.add(new THREE.Mesh(_rollGeo[1], m)); return g;
}
function setHeld(c, R, L) {
  const r = c.rig, key = (R || '') + '|' + (L || '');
  if (r.heldKey === key) return; r.heldKey = key;
  for (const [arm, id] of [[r.armR, R], [r.armL, L]]) {
    while (arm.hold.children.length) arm.hold.remove(arm.hold.children[0]);
    if (!id) continue;
    const o = heldModel(id), P = HOLD_POSE[id] || [0, 0, 0, 0, 0, 0, 1];
    o.position.set(-arm.side * P[0], P[1], P[2]); o.rotation.set(P[3], P[4], P[5]); o.scale.setScalar(P[6]);
    o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    arm.hold.add(o);
  }
}
// 모든 뼈를 기본 자세로
function resetPose(r) {
  for (const b of r.bones) b.quaternion.set(0, 0, 0, 1);
  for (const A of [r.armL, r.armR]) { const R = Body.REST['thumb1' + (A.side > 0 ? 'L' : 'R')]; A.thumb1.rotation.set(R[0], R[1], R[2]); }
  r.hips.position.set(0, 0.97, 0); r.body.position.set(0, 0, 0); r.body.rotation.set(0, 0, 0);
}
const _fv1 = new THREE.Vector3(), _fv2 = new THREE.Vector3(), _fv3 = new THREE.Vector3(), _fq1 = new THREE.Quaternion(), _fq2 = new THREE.Quaternion();   // 주먹 자세용
const _bw = new THREE.Vector3(), _fw = new THREE.Vector3(), _rq = new THREE.Quaternion(), _lt = new THREE.Vector3(), _rt = new THREE.Vector3(), _pl = new THREE.Vector3(), _pr = new THREE.Vector3(), _hq = new THREE.Quaternion();
// 몸(가슴) 로컬 점 → 월드
const chestPt = (r, x, y, z, out) => out.set(x, y, z).applyMatrix4(r.chest.matrixWorld);
const bodyPt = (r, x, y, z, out) => out.set(x, y, z).applyMatrix4(r.body.matrixWorld);
// 가슴 로컬 방향 → 월드 방향 (worldQuat 는 전용 임시 벡터에 분해 — _t3(팔꿈치 방향 점)·_t4 를 덮어쓰면 안 된다)
const chestDir = (r, x, y, z, out) => out.set(x, y, z).applyQuaternion(worldQuat(r.chest, _qg));
const bodyDir = (r, x, y, z, out) => out.set(x, y, z).applyQuaternion(worldQuat(r.body, _qg));

function animateChar(c, dt) {
  if (c.veh) { Veh.animateRider(c, dt); return; }
  const a = c.anim, r = c.rig, T = G.time || 0;
  const camD = c.isPlayer || !G.camera ? 0 : Math.hypot(c.pos.x - G.camera.position.x, c.pos.z - G.camera.position.z);
  const fine = c.isPlayer || camD < 30;          // 손가락·발 디딤 등 세부
  const sp = Math.hypot(c.vel.x, c.vel.z);
  a.speed = lerp(a.speed, sp, clamp(dt * 10, 0, 1));
  const k = clamp(dt * 9, 0, 1);
  // ----- 동작 가중치 -----
  const V = c.vault, vu = V ? clamp(V.t / V.dur, 0, 1) : 0, vk = V ? Math.sin(Math.PI * vu) : 0, climb = !!V && V.kind === 'climb';
  const ru = c.rollT > 0 ? 1 - c.rollT / ROLL_T : 0, rk = c.rollT > 0 ? Math.sin(Math.PI * clamp(ru * 1.1, 0, 1)) : 0;
  const pk = c.pickT > 0 && c.alive ? Math.sin(Math.PI * (1 - c.pickT / PICK_T)) : 0;
  a.air = lerp(a.air || 0, c.alive && c.mode === 'ground' && !c.onGround && !c.inWater && !V && c.airT > 0.2 && c.vel.y < -2 ? 1 : 0, clamp(dt * 7, 0, 1));
  a.heal = lerp(a.heal || 0, c.heal && c.alive ? 1 : 0, clamp(dt * 8, 0, 1)); if (c.heal) a.healId = c.heal.id;
  const tm = c.throwMode, nadeOn = c.alive && !c.knocked && (!!tm || c.throwAnim > 0);
  a.nade = lerp(a.nade || 0, nadeOn ? 1 : 0, clamp(dt * 12, 0, 1)); if (tm) a.nadeId = tm.type;
  const rv = c.revive && c.revive.tgt; a.rev = lerp(a.rev || 0, rv ? 1 : 0, clamp(dt * 6, 0, 1));
  const busy = Math.max(a.heal, a.nade, climb ? Math.min(1, vk * 2) : 0, rk, a.rev);   // 총을 내려놓는 동작
  a.crouch = lerp(a.crouch, c.stance === 'crouch' ? 1 : 0, k);
  a.prone = lerp(a.prone, c.stance === 'prone' ? 1 : 0, clamp(dt * 6, 0, 1));
  const hasGun = !!(c.weapon && !c.knocked && r.gunObj);
  a.armed = lerp(a.armed, hasGun && c.equipT <= 0 ? 1 : 0, k);
  const armed = a.armed * (1 - busy);
  // 주먹 가드: 맨손으로 지르는 중이거나 방금 쳤을 때 (달리기 시작하면 내림)
  const pu = c.punch, guardOn = !hasGun && c.alive && !c.knocked && (!!pu || (G.time - (c.punchT || -99) < PUNCH.guardT && !c.sprint));
  a.guard = lerp(a.guard || 0, guardOn ? 1 : 0, clamp(dt * 12, 0, 1));
  a.knock = lerp(a.knock || 0, c.knocked ? 1 : 0, k);
  a.aim = lerp(a.aim, c.aiming ? 1 : 0, k);
  const ready = c.aiming || c.combatFacing || (c.fireHold && c.weapon && !tm) || (G.time - (c.lastShotT || -99) < 1.5) || !!c.rl || !!c.cycle;
  a.ready = lerp(a.ready || 0, ready ? 1 : 0, clamp(dt * 8, 0, 1));
  a.sprint = lerp(a.sprint || 0, c.sprint && sp > 3.2 && !ready && c.onGround ? 1 : 0, clamp(dt * 6, 0, 1));
  a.carry = lerp(a.carry || 0, V && !climb ? 1 : 0, clamp(dt * 12, 0, 1));
  a.flinch = Math.max(0, a.flinch - dt * 5);
  a.land = Math.max(0, a.land - dt * 3);
  a.fall = lerp(a.fall, c.mode === 'fall' ? 1 : 0, clamp(dt * 4, 0, 1));
  a.chute = lerp(a.chute, c.mode === 'chute' ? 1 : 0, clamp(dt * 4, 0, 1));
  a.swim = lerp(a.swim || 0, c.inWater ? 1 : 0, clamp(dt * 5, 0, 1));
  if (!c.alive) a.dead = Math.min(1, a.dead + dt * 1.6);
  // 걸음 위상: 이동 거리 ÷ 보폭
  const crouchW = a.crouch * (1 - a.prone);
  const S = strideLen(a.speed, crouchW > 0.5);
  if (c.onGround && !c.inWater) a.phase += sp * dt * TAU / (a.prone > 0.5 ? 1.6 : S);
  else if (c.inWater) a.phase += dt * 3.2;
  // ----- 몸 방향 -----
  const mv = sp > 0.6;
  let targetYaw = c.yaw;
  if (!c.isPlayer || !(c.aiming || c.fireHold || c.firstPerson)) { if (mv && !c.aiming && !c.combatFacing && !(a.ready > 0.5 && c.isPlayer)) targetYaw = Math.atan2(c.vel.x, c.vel.z); }
  if (pu || a.guard > 0.5) targetYaw = c.yaw;   // 주먹·가드: 치는 쪽을 본다
  if (rv) targetYaw = Math.atan2(rv.pos.x - c.pos.x, rv.pos.z - c.pos.z);
  if (V) targetYaw = Math.atan2(V.dx, V.dz); else if (c.rollT > 0) targetYaw = c.rollYaw;
  c.bodyYaw += angleDiff(c.bodyYaw, targetYaw) * clamp(dt * (a.prone > 0.5 ? 4 : V || c.rollT > 0 ? 20 : 11), 0, 1);
  c.root.position.copy(c.pos); c.root.rotation.set(0, c.bodyYaw, 0);
  resetPose(r);
  const pitch = c.alive ? clamp(c.pitch, -1.3, 1.3) : 0;
  // 몸 기준 이동 방향 (x 왼쪽, z 앞)
  const cy = Math.cos(c.bodyYaw), sy = Math.sin(c.bodyYaw);
  let lvx = c.vel.x * cy - c.vel.z * sy, lvz = c.vel.x * sy + c.vel.z * cy;
  const lsp = Math.hypot(lvx, lvz); if (lsp > 0.05) { lvx /= lsp; lvz /= lsp; } else { lvx = 0; lvz = 1; }
  const gait = clamp(a.speed / 1.1, 0, 1) * (1 - a.prone) * (1 - a.air) * (1 - rk) * (V ? 1 - vk : 1) * (1 - a.swim);
  const run = sstep(2.6, 4.6, a.speed) * (1 - crouchW);
  const ph = a.phase, sph = Math.sin(ph), cph = Math.cos(ph);
  // ----- 골반·허리·목 -----
  const stoop = pk * (1 - a.prone);
  const kneel = a.rev * (1 - a.prone);
  let hipsY = 0.962 - crouchW * 0.36 - a.land * 0.22 - stoop * 0.3 - kneel * 0.42 - run * 0.04 * gait;
  hipsY += gait * ((run > 0.5 ? -0.03 * Math.abs(cph) : 0.014 * Math.cos(2 * ph)) - lerp(0.045, 0.07, run));
  r.hips.position.y = hipsY;
  r.hips.position.z = -crouchW * 0.05 - stoop * 0.08;
  r.hips.rotation.set(crouchW * 0.25 + run * 0.08 * gait, 0.14 * gait * sph * (1 - run * 0.4), 0.05 * gait * cph * (1 - run));
  const blade = -(0.12 * (1 - a.ready) + 0.38 * a.ready) * armed * (1 - a.prone) * (1 - a.dead) * (1 - a.sprint);
  const lean = crouchW * 0.18 + run * 0.18 * gait + stoop * 0.75 + kneel * 0.3 + a.heal * 0.1 + (V ? vk * (climb ? 0.2 : 0.35) : 0) + rk * 0.5 - a.air * 0.08;
  r.spine.rotation.set(lean - pitch * 0.25 * (1 - a.prone) * (armed > 0.5 ? 1 : 0.5), blade * 0.5 - r.hips.rotation.y * 0.7, a.flinch * 0.3 * a.flinchDir);
  r.chest.rotation.set(-pitch * 0.2 * (1 - a.prone) * (armed > 0.5 ? 1 : 0.4) + 0.012 * Math.sin(T * 1.7), blade * 0.5 - r.hips.rotation.y * 0.3, 0);
  // 머리: 바라보는 방향 (몸 회전과 차이만큼 목을 돌림)
  const look = clamp(angleDiff(c.bodyYaw + blade, c.yaw), -1.1, 1.1) * (1 - a.prone * 0.6) * (c.alive ? 1 : 0);
  r.neck.rotation.set(-pitch * 0.3 * (1 - a.prone) - a.prone * 0.55, look * 0.45, 0);
  r.head.rotation.set(-pitch * 0.25 * (1 - a.prone) - a.prone * 0.55 + a.aim * 0.08, look * 0.55, -a.aim * 0.12 * armed);
  // ----- 몸 전체 회전: 엎드림 / 자유낙하 / 사망 / 구르기 / 넘기 기울임 -----
  const fallP = a.fall * (Math.PI * 0.46 + 0.5 * clamp((-c.vel.y - 36) / 12, 0, 1));
  let bx = a.prone * Math.PI / 2 + fallP, by = a.prone * 0.12, bz = 0;
  r.body.rotation.z = a.knock * 0.3 * a.prone + (V && !climb ? 0.28 * vk : 0) + (a.fall > 0.01 ? clamp(-lvx * 0.5, -0.5, 0.5) * a.fall * clamp(sp / 8, 0, 1) : 0);
  if (a.dead > 0 && a.prone < 0.5) { const d = smoothstep01(clamp(a.dead * 1.15 - 0.15, 0, 1)); bx = lerp(bx, -Math.PI / 2, d); by = lerp(by, 0.16, d); }
  if (c.rollT > 0 && c.alive) { const th = TAU * sstep(0.08, 0.88, ru), pv = 0.5; bx += th; by += pv - pv * Math.cos(th); bz = -pv * Math.sin(th); }
  r.body.rotation.x = bx; r.body.position.set(0, by + a.fall * 0.7, bz);
  // ----- 다리 (FK 기본: 엎드림·낙하·공중·접기) -----
  const dk = a.dead > 0 && a.prone < 0.5 ? sstep(0, 0.6, a.dead) * (1 - sstep(0.6, 1, a.dead)) : 0;   // 쓰러지며 무릎이 꺾임
  const tuck = Math.max(rk, V && !climb ? vk : 0);
  for (const L of [r.legL, r.legR]) {
    const s = L.side, lp = s > 0 ? ph + Math.PI : ph;
    let hx = 0, hz = s * 0.02, kx = 0.05, fx = 0;
    // 엎드림: 다리를 뒤로 쭉, 발끝은 땅 / 기어갈 때 무릎을 옆으로 번갈아 끌어올림
    if (a.prone > 0.01) { const cr = clamp(a.speed / 1.0, 0, 1) * Math.max(0, Math.sin(lp)); hx = lerp(hx, -0.1 - cr * 0.9, a.prone); hz = lerp(hz, s * (0.14 + cr * 0.55), a.prone); kx = lerp(kx, 0.1 + cr * 1.2, a.prone); fx = lerp(fx, 1.1, a.prone); }
    // 스카이다이빙: 무릎 60° / 낙하산: 모아 늘어뜨림
    if (a.fall > 0.01) { const dv = clamp((-c.vel.y - 36) / 12, 0, 1); hx = lerp(hx, lerp(0.25, 0.05, dv), a.fall); hz = lerp(hz, s * lerp(0.28, 0.1, dv), a.fall); kx = lerp(kx, lerp(1.15, 0.25, dv), a.fall); fx = lerp(fx, 0.6, a.fall); }
    if (a.chute > 0.01) { hx = lerp(hx, -0.18 + Math.sin(T * 1.3 + s) * 0.06, a.chute); hz = lerp(hz, s * 0.04, a.chute); kx = lerp(kx, 0.28, a.chute); fx = lerp(fx, 0.55, a.chute); }
    // 공중(높은 곳에서 떨어짐): 한 무릎을 앞으로
    if (a.air > 0.01) { hx = lerp(hx, s > 0 ? -0.8 : 0.12, a.air); kx = lerp(kx, s > 0 ? 1.3 : 0.6, a.air); fx = lerp(fx, 0.3, a.air); }
    if (tuck > 0.01) { hx = lerp(hx, -1.45 - (s > 0 ? 0.2 : 0), tuck); kx = lerp(kx, 2.1, tuck); hz = lerp(hz, (V && !climb ? 0.45 : s * 0.1) * 1, tuck); }
    if (climb) { const up = s > 0 ? sstep(0.25, 0.55, vu) * (1 - sstep(0.75, 1, vu)) : 0, w = Math.max(up, vk * 0.4); hx = lerp(hx, s > 0 ? -1.55 : 0.15, w); kx = lerp(kx, s > 0 ? 2.0 : 0.4, w); }
    if (a.swim > 0.01) { hx = lerp(hx, 0.1 + Math.sin(lp * 1.0) * 0.35, a.swim); kx = lerp(kx, 0.35 + Math.max(0, Math.sin(lp)) * 0.6, a.swim); fx = lerp(fx, 0.8, a.swim); }
    if (dk > 0) { hx = lerp(hx, -0.6, dk); kx = lerp(kx, 1.4, dk); }
    L.hip.rotation.set(hx, 0, hz); L.knee.rotation.set(kx, 0, 0); L.foot.rotation.set(fx, 0, 0);
  }
  // ----- 다리 IK: 서기·걷기·앉기·착지·줍기·무릎 꿇기 (발을 땅에 디딤) -----
  const legW = (1 - a.prone) * (1 - a.fall) * (1 - a.chute) * (1 - a.air) * (1 - tuck) * (climb ? 1 - vk : 1) * (1 - a.swim) * (1 - dk) * (c.alive ? 1 : 1 - a.dead);
  r.root.updateMatrixWorld(true);
  if (legW > 0.01) {
    const gy = c.pos.y, lift = lerp(0.09, 0.26, run) * (1 - crouchW * 0.4);
    const df = lerp(0.6, 0.38, run);
    _fw.set(sy, 0, cy);                                       // 몸 앞쪽(월드)
    for (const L of [r.legL, r.legR]) {
      const s = L.side, u = ((ph / TAU + (s > 0 ? 0.5 : 0)) % 1 + 1) % 1;
      let ox = s * (0.1 + crouchW * 0.04 + kneel * 0.03), oz = 0.0, oy = 0, fp = 0, tb = 0, toeOut = s * 0.1;
      // 앉기: 왼발 앞, 오른발 뒤(뒤꿈치 듦) / 무릎 꿇기(부활): 오른 무릎을 땅에
      if (crouchW > 0.01) { oz += crouchW * (s > 0 ? 0.12 : -0.17); fp += crouchW * (s > 0 ? 0 : 0.75); tb -= crouchW * (s > 0 ? 0 : 0.8); }
      if (kneel > 0.01) { oz += kneel * (s > 0 ? 0.22 : -0.28); fp += kneel * (s > 0 ? 0 : 1.1); tb -= kneel * (s > 0 ? 0 : 0.9); oy += kneel * (s > 0 ? 0 : 0.0); }
      if (stoop > 0.01) { oz += stoop * (s > 0 ? 0.1 : -0.12); }
      if (gait > 0.01) {
        const P = footPath(u, S, df, lift, run > 0.5);
        ox += lvx * P[0] * gait; oz += lvz * P[0] * gait; oy += P[1] * gait; fp += P[2] * gait * (lvz >= -0.2 ? 1 : -0.4); tb += P[3] * gait;
        toeOut *= 1 - gait * 0.6;
      } else {
        // 서 있을 때: 무게 이동
        ox += Math.sin(T * 0.7) * 0.012;
      }
      // 발목 목표: 발바닥이 땅(gy) — 발목 높이 0.085
      bodyPt(r, ox, 0, oz, _t1); _t1.y = gy + 0.085 + oy + (fp > 0 ? fp * 0.07 : 0);
      _eu2.set(fp, c.bodyYaw + toeOut, 0); _hq.setFromEuler(_eu2);
      _t2.copy(_fw).applyAxisAngle(AX_Y, toeOut * 0.6);
      legIK(L, _t1, _t2, _hq, legW);
      if (fine) L.toe.rotation.x = tb * legW;
    }
    r.root.updateMatrixWorld(true);
  }
  // ----- 팔: FK 기본(흔들기·엎드림 기기·공중 균형) -----
  const swingK = gait * (1 - armed);
  for (const A of [r.armL, r.armR]) {
    const s = A.side, lp = s > 0 ? ph : ph + Math.PI;
    let x = -Math.sin(lp) * lerp(0.42, 0.75, run) * swingK + 0.04, e = -0.18 - run * 0.95 * swingK - 0.2 * swingK, z = s * (0.07 + run * 0.08 * swingK);
    if (a.prone > 0.01) { const cr = a.prone * clamp(a.speed / 1.0, 0, 1) * Math.sin(lp); x = lerp(x, -Math.PI + 0.35 + cr * 0.5 + a.knock * 0.3, a.prone); e = lerp(e, -0.5 - Math.max(0, cr) * 0.6, a.prone); z = lerp(z, s * (0.35 + a.knock * 0.2), a.prone); }
    const ak = a.air * (1 - armed * 0.7); x = lerp(x, -1.0, ak); e = lerp(e, -0.6, ak); z = lerp(z, s * 1.05, ak);
    if (a.swim > 0.01) { const st = Math.sin(T * 3.2 + (s > 0 ? 0 : 0.4)); x = lerp(x, -2.4 + st * 0.5, a.swim); e = lerp(e, -0.6 - Math.max(0, st) * 0.6, a.swim); z = lerp(z, s * (0.5 + st * 0.3), a.swim); }
    if (dk > 0 || (!c.alive && a.prone < 0.5)) { const d = Math.max(dk, a.dead); x = lerp(x, -0.6, d); e = lerp(e, -0.4, d); z = lerp(z, s * 0.9, d); }
    A.sh.rotation.set(x, 0, z); A.el.rotation.set(e, 0, 0);
    if (fine) setFingers(A, FING.relax);
  }
  // ----- 총 -----
  let gun = r.gunObj, gunVis = !!gun && hasGun && busy < 0.5 && a.chute < 0.3 && a.fall < 0.3 && c.equipT <= 0.25;
  r.gunMount.visible = gunVis;
  let A = null;
  if (gun && gunVis) {
    const near = c.isPlayer || camD < 45;
    if (near && (c.rl || c.cycle || c.slideKick > 0 || (c.weapon && c.weapon.mag === 0))) { A = weaponAnim(c, gun.userData.meta); applyParts(gun, A); gun.userData.posed = true; }
    else { if (gun.userData.posed) { applyParts(gun, weaponAnim({ rl: null, cycle: null, weapon: c.weapon, slideKick: 0 }, gun.userData.meta)); gun.userData.posed = false; } A = weaponAnim({ rl: null, cycle: null, weapon: c.weapon, slideKick: 0, fireCd: 0 }, gun.userData.meta); if (gun.userData.meta.openBolt) applyParts(gun, A); }
    const aimYaw = c.isPlayer || c.aiming || c.combatFacing || c.fireHold ? c.yaw : c.bodyYaw;
    const gq = placeGun(c, r, a, aimYaw, pitch, A, a.prone > 0.5 ? a.prone : 0);
    // 손 → 총 (anchor = 손바닥 가운데)
    const wL = armed * (1 - Math.max(a.fall, a.chute));
    if (wL > 0.01) handsOnGun(r, gun, A, gq, wL, fine, a.ready, a.prone);
  }
  // ----- 손 동작 (IK): 줍기·회복·투척·넘기·오르기·부활·스카이다이빙·낙하산·무기 꺼내기 -----
  const ik = (Ar, wpos, pole, q, w, fing) => { if (w <= 0.01) return; Ar.clav.updateMatrixWorld(true); armIK(Ar, wpos, pole, q, w); if (fine && fing) setFingers(Ar, FING[fing], w); };
  // 주먹: 가드(두 주먹을 턱 앞, 팔꿈치는 아래로 모음) → 지르기(한 팔을 조준 방향으로 뻗고 어깨를 틀어 넣음) → 복귀
  const gw = a.guard * (1 - busy) * (1 - a.prone) * (1 - Math.max(a.fall, a.chute, a.swim, a.air)) * (1 - a.knock);
  if (gw > 0.01) {
    const ext = pu ? punchExt(pu.t) : 0, cp = Math.cos(pitch);
    if (pu) { r.spine.rotation.y -= pu.side * 0.3 * ext * gw; r.chest.rotation.y -= pu.side * 0.14 * ext * gw; r.root.updateMatrixWorld(true); }
    _fv3.set(Math.sin(c.yaw) * cp, Math.sin(pitch), Math.cos(c.yaw) * cp);   // 조준 방향(월드)
    for (const Ar of [r.armL, r.armR]) {
      const s = Ar.side, e = pu && pu.side === s ? ext : 0;
      // 손 방향 (chestDir가 _t3·_t4를 덮어쓰므로 위치보다 먼저): 가드 = 주먹 마디가 위·앞, 손바닥은 안쪽 / 지르기 = 마디가 앞, 손바닥은 아래로 비틀어
      handQuat(_fq1, chestDir(r, -s * 0.05, 0.75, 0.6, _fv1), chestDir(r, -s, 0, -0.3, _fv2), s);
      if (e > 0) {
        chestDir(r, -s * 0.3, 0.04, 0, _fv1).add(_fv3).normalize();                          // 지르는 방향: 조준 방향 + 몸 가운데 쪽으로 조금
        handQuat(_fq2, _fv1, chestDir(r, -s * 0.35, -1, 0, _fv2), s); _fq1.slerp(_fq2, e);
      }
      chestPt(r, s * 0.13, 0.21, 0.23, _t1);                                                 // 가드: 턱 앞
      if (e > 0) { _t2.setFromMatrixPosition(Ar.sh.matrixWorld).addScaledVector(_fv1, (UA + FA) * 0.95); _t1.lerp(_t2, e); }   // 어깨에서 팔을 거의 다 펴서
      chestPt(r, s * lerp(0.3, 0.45, e), lerp(-0.32, -0.15, e), lerp(0.12, 0.05, e), _t3);   // 팔꿈치: 아래로 (지를 때는 옆으로 조금)
      ik(Ar, _t1, _t3, _fq1, gw, null); if (fine) setFist(Ar, gw);
    }
  }
  // 줍기: 오른손을 발 앞 바닥으로
  if (pk > 0.01) {
    _t1.set(c.pos.x + Math.sin(c.bodyYaw) * 0.45 - Math.cos(c.bodyYaw) * 0.12, c.pos.y + (a.prone > 0.5 ? 0.1 : 0.12), c.pos.z + Math.cos(c.bodyYaw) * 0.45 + Math.sin(c.bodyYaw) * 0.12);
    if (a.prone > 0.5) bodyPt(r, -0.2, 1.75, 0.1, _t1);
    chestPt(r, -0.5, -0.2, 0.1, _t3); handQuat(_hq, _t4.set(Math.sin(c.bodyYaw), -1, Math.cos(c.bodyYaw)), _t5.set(0, -1, 0), -1);
    ik(r.armR, _t1, _t3, _hq, pk, pk > 0.6 ? 'hold' : 'open');
  }
  // 회복
  if (a.heal > 0.01 && c.alive) {
    const id = a.healId, hu = c.heal ? 1 - c.heal.t / c.heal.total : 1, w = a.heal;
    if (id === 'bandage') {
      // 왼팔을 배 앞에 가로로, 오른손이 그 둘레를 감는다
      chestPt(r, 0.06, -0.14, 0.27, _t1); chestPt(r, 0.5, -0.3, 0.0, _t3); handQuat(_hq, chestDir(r, -1, 0, 0.3, _t4), chestDir(r, 0, -1, 0, _t5), 1);
      ik(r.armL, _t1, _t3, _hq, w, 'relax');
      const an = T * 8.5; chestPt(r, -0.02 + Math.cos(an) * 0.055, -0.12 + Math.sin(an) * 0.05, 0.27 + Math.sin(an) * 0.02, _t1); chestPt(r, -0.45, -0.3, -0.05, _t3);
      handQuat(_hq, chestDir(r, 0.6, -0.2, 0.6, _t4), chestDir(r, 0.2, 0.3 * Math.sin(an), -1, _t5), -1);
      ik(r.armR, _t1, _t3, _hq, w, 'hold');
    } else if (id === 'drink') {
      const up = sstep(0, 0.22, hu) * (1 - sstep(0.88, 1, hu));
      r.neck.rotation.x -= 0.25 * up * w; r.head.rotation.x -= 0.3 * up * w; r.root.updateMatrixWorld(true);
      _t1.set(-0.025, -0.09, 0.115).applyMatrix4(r.head.matrixWorld); chestPt(r, -0.12, -0.08, 0.3, _t2); _t1.lerp(_t2, 1 - up);
      chestPt(r, -0.4, -0.25, -0.1, _t3); handQuat(_hq, chestDir(r, 0.95, 0.1, 0.25, _t4), chestDir(r, 0, 0, -1, _t5), -1);
      ik(r.armR, _t1, _t3, _hq, w, 'hold');
      chestPt(r, 0.14, -0.4, 0.06, _t1); chestPt(r, 0.5, -0.3, -0.1, _t3); ik(r.armL, _t1, _t3, null, w * 0.6, 'relax');
    } else {
      // 구급상자·의료 키트: 왼손에 들고 오른손으로 처치
      chestPt(r, 0.07, -0.18, 0.28, _t1); chestPt(r, 0.5, -0.35, 0.0, _t3); handQuat(_hq, chestDir(r, -0.3, 0, 1, _t4), chestDir(r, 0, 1, 0, _t5), 1);
      ik(r.armL, _t1, _t3, _hq, w, 'hold');
      chestPt(r, -0.03 + Math.sin(T * 6) * 0.03, -0.1 + Math.cos(T * 7) * 0.02, 0.31, _t1); chestPt(r, -0.45, -0.3, 0, _t3);
      handQuat(_hq, chestDir(r, 0.3, -0.5, 0.8, _t4), chestDir(r, 0, -1, 0, _t5), -1);
      ik(r.armR, _t1, _t3, _hq, w, 'pinch');
    }
  }
  // 투척: 가슴 앞에 쥠 → 핀을 뽑으면 머리 뒤로 젖힘 → 놓으면 앞으로 휘두름
  if (a.nade > 0.01) {
    const w = a.nade, thr = c.throwAnim > 0 ? 1 - c.throwAnim / 0.35 : 0, wind = tm && tm.pin ? 1 : 0;
    a.wind = lerp(a.wind || 0, wind, clamp(dt * 10, 0, 1));
    const W0 = [-0.06, 0.0, 0.3], W1 = [-0.24, 0.34, -0.12], W2 = [-0.08, 0.28, 0.5], W3 = [-0.02, -0.18, 0.42];
    let p = W0.map((v, i) => lerp(v, W1[i], a.wind));
    if (thr > 0) p = thr < 0.5 ? W1.map((v, i) => lerp(v, W2[i], sstep(0, 0.5, thr))) : W2.map((v, i) => lerp(v, W3[i], sstep(0.5, 1, thr)));
    chestPt(r, p[0], p[1], p[2], _t1); chestPt(r, -0.55, -0.2 + a.wind * 0.4, -0.1, _t3);
    handQuat(_hq, chestDir(r, 0.2, 0.6 - a.wind * 0.3, 0.8, _t4), chestDir(r, 0.8, 0, -0.2, _t5), -1);
    ik(r.armR, _t1, _t3, _hq, w, thr > 0.4 ? 'open' : 'hold');
    // 왼손: 핀 뽑기(쥔 손으로) → 앞으로 뻗어 겨냥
    const lw = Math.max(a.wind, thr > 0 ? 1 - thr : 0);
    chestPt(r, lerp(0.02, 0.16, lw), lerp(0.02, 0.22, lw), lerp(0.3, 0.46, lw), _t1); chestPt(r, 0.55, -0.3, 0, _t3);
    ik(r.armL, _t1, _t3, null, w, lw > 0.5 ? 'open' : 'pinch');
    r.spine.rotation.y += (thr > 0 ? 0.35 * (1 - thr) - 0.25 * thr : -0.32 * a.wind) * w;
  }
  // 넘기: 왼손을 장애물 위에 짚음 / 오르기: 두 손으로 턱을 잡고 끌어올림
  if (V) {
    const fx = V.dx, fz = V.dz, px = fz, pz = -fx, edge = V.d0 !== undefined ? V.d0 + 0.06 : 0.55;   // px,pz: 왼쪽
    if (climb) {
      const hw = Math.min(1, vk * 2.5) * (1 - sstep(0.82, 1, vu));
      for (const Ar of [r.armL, r.armR]) {
        const s = Ar.side;
        _t1.set(V.x0 + fx * edge + px * s * 0.2, V.top + 0.03, V.z0 + fz * edge + pz * s * 0.2);
        _t3.set(_t1.x - fx * 0.3 + px * s * 0.4, _t1.y - 0.4, _t1.z - fz * 0.3 + pz * s * 0.4);
        handQuat(_hq, _t4.set(fx, -0.3, fz), _t5.set(0, -1, 0), s); _t1.y += 0.012;
        ik(Ar, _t1, _t3, _hq, hw, 'claw');
      }
    } else {
      const hw = sstep(0.05, 0.25, vu) * (1 - sstep(0.55, 0.75, vu));
      _t1.set(V.x0 + fx * edge + px * 0.12, V.top + 0.035, V.z0 + fz * edge + pz * 0.12);
      _t3.set(_t1.x + px * 0.4 - fx * 0.2, _t1.y + 0.1, _t1.z + pz * 0.4 - fz * 0.2);
      handQuat(_hq, _t4.set(fx + px * 0.3, 0, fz + pz * 0.3), _t5.set(0, -1, 0), 1);
      ik(r.armL, _t1, _t3, _hq, hw, 'flat');
    }
  }
  // 구르기: 팔을 몸에 붙임
  if (rk > 0.01) for (const Ar of [r.armL, r.armR]) { Ar.sh.quaternion.slerp(_qa.setFromEuler(_eu.set(-1.6, 0, Ar.side * 0.2)), rk); Ar.el.quaternion.slerp(qx(_qb, -2.0), rk); if (fine) setFingers(Ar, FING.fist, rk); }
  // 부활: 무릎 꿇고 두 손으로 동료 가슴을 누름
  if (a.rev > 0.01 && rv) {
    rv.chest(_t1);
    for (const Ar of [r.armL, r.armR]) {
      const s = Ar.side; _t2.set(_t1.x + Math.cos(c.bodyYaw) * s * 0.06, _t1.y + 0.06 + Math.sin(T * 7 + s) * 0.02 * (Math.sin(T * 1.3) > 0 ? 1 : 0), _t1.z - Math.sin(c.bodyYaw) * s * 0.06);
      chestPt(r, s * 0.5, -0.2, 0, _t3); handQuat(_hq, _t4.set(Math.sin(c.bodyYaw), -0.6, Math.cos(c.bodyYaw)), _t5.set(0, -1, 0), s);
      ik(Ar, _t2, _t3, _hq, a.rev, 'flat');
    }
  }
  // 기절: 왼손으로 배를 감싸고 오른팔로 기어감
  if (a.knock > 0.01 && c.alive && a.prone > 0.5) { chestPt(r, 0.02, -0.16, 0.16, _t1); chestPt(r, 0.5, -0.1, 0.2, _t3); ik(r.armL, _t1, _t3, null, a.knock * 0.85, 'claw'); }
  // 스카이다이빙: 박스 자세(팔을 W자로 벌림) → 급강하는 팔을 뒤로
  if (a.fall > 0.01) {
    const dv = clamp((-c.vel.y - 36) / 12, 0, 1), turn = clamp(lvx * 0.6, -1, 1) * clamp(sp / 8, 0, 1);
    for (const Ar of [r.armL, r.armR]) {
      const s = Ar.side, tw = 1 + turn * s * 0.25;
      _t1.set(s * lerp(0.47 * tw, 0.3, dv), lerp(1.66, 0.95, dv), lerp(0.02, -0.12, dv)); bodyPt(r, _t1.x, _t1.y, _t1.z, _t1);
      bodyPt(r, s * 0.7, lerp(1.25, 1.05, dv), lerp(0.05, -0.2, dv), _t3);
      handQuat(_hq, bodyDir(r, s * 0.1, 1, lerp(0.3, -0.2, dv), _t4), bodyDir(r, 0, 0, 1, _t5), s);
      ik(Ar, _t1, _t3, _hq, a.fall, 'open');
      if (dv > 0.01) Ar.hand.quaternion.slerp(_qh.identity(), dv);   // 급강하: 손을 아래팔과 일직선으로 (박스 자세 손 방향 그대로면 엉덩이 옆 손목이 뒤로 접힌다)
    }
    r.neck.rotation.x = lerp(r.neck.rotation.x, -0.75, a.fall); r.head.rotation.x = lerp(r.head.rotation.x, -0.45, a.fall);
  }
  // 낙하산: 머리 위 조종줄 손잡이 — 당기는 쪽으로 회전, 둘 다 당기면 감속
  if (a.chute > 0.01) {
    const dvz = clamp((-c.vel.y - 5.2) / 2.2, -1, 1), turn = clamp(lvx * 0.5, -1, 1);
    for (const Ar of [r.armL, r.armR]) {
      const s = Ar.side, pull = clamp(Math.max(0, -dvz) * 0.8 + Math.max(0, turn * s) * 0.9, 0, 1);
      bodyPt(r, s * lerp(0.2, 0.27, pull), lerp(1.86 + Math.max(0, dvz) * 0.06, 1.38, pull), lerp(0.04, 0.12, pull), _t1);
      bodyPt(r, s * 0.6, lerp(1.6, 1.2, pull), -0.1, _t3);
      handQuat(_hq, bodyDir(r, 0, 1, 0.1, _t4), bodyDir(r, -s, 0, 0.3, _t5), s);
      const wp = ik(Ar, _t1, _t3, _hq, a.chute, 'fist');
      if (s > 0) _pl.copy(_t1); else _pr.copy(_t1);
    }
  }
  // 무기 꺼내기(등 뒤로 손을 뻗었다 내림)
  if (hasGun && c.equipT > 0 && c.alive && busy < 0.3 && a.fall < 0.1 && a.chute < 0.1) {
    const e = clamp(c.equipT / 0.6, 0, 1), w = Math.sin(Math.PI * e) * (1 - a.prone);
    chestPt(r, -0.16, 0.32, -0.12, _t1); chestPt(r, -0.5, 0.3, 0.1, _t3); ik(r.armR, _t1, _t3, null, w, 'claw');
  }
  // ----- 손에 든 물건 -----
  const near = c.isPlayer || camD < 40;
  if (near) {
    const hid = a.heal > 0.3 ? a.healId : null, nid = a.nade > 0.3 && (c.throwAnim <= 0 || c.throwAnim > 0.2) ? (a.nadeId || 'frag') : null;
    setHeld(c, nid || (hid === 'bandage' || hid === 'drink' ? hid : null), !nid && (hid === 'firstaid' || hid === 'medkit') ? hid : null);
  } else if (r.heldKey && r.heldKey !== '|') setHeld(c, null, null);
  // ----- 낙하산 -----
  r.chute.visible = a.chute > 0.05; r.chute.scale.set(Math.max(0.05, a.chute), Math.max(0.05, Math.min(1, a.chute * 1.3)), Math.max(0.05, a.chute));
  if (r.chute.visible) {
    r.chute.rotation.set(0, 0, clamp(lvx * 0.25, -0.3, 0.3) * clamp(sp / 4, 0, 1));
    const br = r.chute.userData.brakes;
    if (br && a.chute > 0.5) {
      r.root.updateMatrixWorld(true); _mi.copy(r.root.matrixWorld).invert();
      const P = br.geometry.attributes.position, tl = r.chute.userData.tipL, tr = r.chute.userData.tipR;
      r.armL.hand.getWorldPosition(_t1).applyMatrix4(_mi); r.armR.hand.getWorldPosition(_t2).applyMatrix4(_mi);
      P.setXYZ(0, tl[0], tl[1], tl[2]); P.setXYZ(1, _t1.x, _t1.y + 0.08, _t1.z); P.setXYZ(2, tr[0], tr[1], tr[2]); P.setXYZ(3, _t2.x, _t2.y + 0.08, _t2.z); P.needsUpdate = true;
      br.visible = true;
    } else if (br) br.visible = false;
  }
}
function smoothstep01(t) { return t * t * (3 - 2 * t); }

// ---------- 탑승 자세 (08_vehicle.js의 Veh.animateRider가 부름) ----------
//  운전: 두 손을 핸들(차) / 손잡이(오토바이) / 고삐(말)에. 동승자: 총을 들고 조준 방향으로 상체를 돌림
const WHEEL = { sedan: [0.4, 0.98, 0.42, -0.45, 0.17], pickup: [0.42, 1.24, 0.72, -0.5, 0.18], uaz: [0.42, 1.28, 0.5, -0.65, 0.19] };
function poseRider(c, v, dt) {
  const r = c.rig, a = c.anim, T = v.T, pose = T.pose, Tm = G.time || 0;
  resetPose(r);
  r.root.rotation.order = 'YXZ'; r.root.position.copy(c.pos); r.root.rotation.set(-v.pitch, v.yaw, v.roll + v.lean);
  r.chute.visible = false;
  a.speed = 0; a.crouch = 0; a.prone = 0; a.fall = 0; a.chute = 0; a.land = 0; a.air = 0;
  const bob = pose === 'horse' ? Math.sin(v.phase * 2) * 0.03 * clamp(Math.abs(v.f) / 6, 0, 1) : 0;
  r.hips.position.y = 0.95 + bob;
  const st = v.steer, seat = T.seats[c.seat || 0] || T.seat;
  for (const L of [r.legL, r.legR]) {
    const s = L.side;
    if (pose === 'car') { L.hip.rotation.set(-1.42, 0, s * 0.08); L.knee.rotation.x = 1.25; L.foot.rotation.x = -0.25; }
    else if (pose === 'moto') { L.hip.rotation.set(-1.0, 0, s * 0.3); L.knee.rotation.x = 1.55; L.foot.rotation.x = 0.1; }
    else { L.hip.rotation.set(-0.45, 0, s * 0.5); L.knee.rotation.x = 0.95; L.foot.rotation.x = 0.35; }
  }
  r.spine.rotation.set(pose === 'moto' ? 0.4 : pose === 'horse' ? 0.12 + bob * 2 : -0.08, 0, 0);
  const look = c.isPlayer ? clamp(angleDiff(v.yaw, c.yaw), -1.1, 1.1) : 0;
  r.neck.rotation.set(pose === 'moto' ? -0.35 : -0.05, look * 0.5, 0); r.head.rotation.set(0, look * 0.5, 0);
  a.flinch = Math.max(0, a.flinch - dt * 5); r.spine.rotation.z = a.flinch * 0.25 * a.flinchDir;
  const shoot = c.seat > 0 && c.weapon && c.equipT <= 0 && r.gunObj;
  if (shoot) { const tw = clamp(angleDiff(v.yaw, c.yaw), -2.7, 2.7); r.spine.rotation.set(-(c.pitch || 0) * 0.3 + (pose === 'moto' ? 0.15 : 0), tw * 0.6, 0); r.chest.rotation.y = tw * 0.25; r.neck.rotation.set(-(c.pitch || 0) * 0.3, tw * 0.15, 0); }
  r.root.updateMatrixWorld(true);
  for (const A of [r.armL, r.armR]) { A.sh.rotation.set(-0.4, 0, A.side * 0.1); A.el.rotation.x = -0.8; setFingers(A, FING.relax); }
  r.gunMount.visible = !!shoot;
  if (shoot) {
    a.ready = 1; a.sprint = 0; a.carry = 0;
    const gun = r.gunObj, A = weaponAnim({ rl: c.rl, cycle: c.cycle, weapon: c.weapon, slideKick: c.slideKick || 0, fireCd: c.fireCd || 0 }, gun.userData.meta);
    const gq = placeGun(c, r, a, c.yaw, clamp(c.pitch || 0, -1, 1), A, 0);
    handsOnGun(r, gun, A, gq, 1, true, 1, 0);
    return;
  }
  if (c.seat > 0) return;   // 맨손 동승자: 팔을 무릎 위에
  // 운전자: 손을 핸들에
  const sx = seat[0], sy0 = seat[1] - 0.9, sz = seat[2];
  for (const A of [r.armL, r.armR]) {
    const s = A.side;
    if (pose === 'car') {
      const W = WHEEL[v.type] || WHEEL.sedan, ang = (s > 0 ? 0.55 : Math.PI - 0.55) + st * 0.9;
      _t1.set(Math.cos(ang) * W[4], Math.sin(ang) * W[4], 0).applyAxisAngle(AX_X, W[3]).add(_t2.set(W[0] - sx, W[1] - sy0, W[2] - sz - 0.01));
      _t1.applyMatrix4(r.root.matrixWorld);
      bodyPt(r, s * 0.45, 1.05, 0.1, _t3); r.root.matrixWorld.decompose(_t4, _qg, _t5);
      handQuat(_hq, _t4.set(-s * 0.3, 0.6, 0.75).applyQuaternion(_qg), _t5.set(-s * 0.2, -0.3, 0.9).applyQuaternion(_qg), s);
      A.clav.updateMatrixWorld(true); armIK(A, _t1, _t3, _hq, 1); setFingers(A, FING.wheel);
    } else if (pose === 'moto') {
      const ang = -st * (T.steerMax || 0.5);
      _t1.set(s * 0.31, 0.17, -0.1).applyAxisAngle(AX_Y, ang).add(_t2.set(0 - sx, 0.98 - sy0, 0.52 - sz)).applyMatrix4(r.root.matrixWorld);
      bodyPt(r, s * 0.5, 1.1, -0.1, _t3); r.root.matrixWorld.decompose(_t4, _qg, _t5);
      handQuat(_hq, _t4.set(-s * 1, -0.2, 0.3).applyQuaternion(_qg), _t5.set(0, -1, 0.2).applyQuaternion(_qg), s);
      A.clav.updateMatrixWorld(true); armIK(A, _t1, _t3, _hq, 1); setFingers(A, FING.wheel);
    } else {
      // 말: 안장 앞 고삐
      _t1.set(s * 0.1, 1.28 + bob, 0.38).applyMatrix4(r.root.matrixWorld); bodyPt(r, s * 0.45, 1.0, 0, _t3);
      r.root.matrixWorld.decompose(_t4, _qg, _t5); handQuat(_hq, _t4.set(-s * 0.6, 0.2, 0.75).applyQuaternion(_qg), _t5.set(0, -0.6, -0.8).applyQuaternion(_qg), s);
      A.clav.updateMatrixWorld(true); armIK(A, _t1, _t3, _hq, 1); setFingers(A, FING.fist);
    }
  }
}
