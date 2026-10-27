// 테스트용 가짜 Supabase SDK (실시간 포함) — 같은 출처의 여러 탭이 '서버'를 함께 쓴다
//  · DB: localStorage 'fakeSB' (users·profiles·player_data·friendships) · 친구 함수(friend_*) 구현
//  · 실시간: BroadcastChannel('fakeRT') 로 broadcast·presence 흉내 (채널 이름 = 주제)
(function () {
  const DB = () => { const d = JSON.parse(localStorage.getItem('fakeSB') || '{}'); d.users = d.users || {}; d.profiles = d.profiles || {}; d.player_data = d.player_data || {}; d.friendships = d.friendships || []; return d; };
  const save = (d) => localStorage.setItem('fakeSB', JSON.stringify(d));
  const delay = (v, ms = 25) => new Promise((r) => setTimeout(() => r(v), ms));
  const rid = () => Math.random().toString(36).slice(2, 10);
  const bc = new BroadcastChannel('fakeRT'), chans = new Set();
  window.__fakeRT = { sent: 0, recv: 0, drop: false };
  const post = (m) => { if (__fakeRT.drop) return; __fakeRT.sent++; bc.postMessage(m); };
  bc.onmessage = (ev) => { const m = ev.data; __fakeRT.recv++; for (const ch of chans) if (ch.topic === m.topic && ch.subscribed) ch._recv(m); };
  class Ch {
    constructor(topic, opts) { const c = (opts && opts.config) || {}; this.topic = topic; this.key = (c.presence && c.presence.key) || rid(); this.self = !!(c.broadcast && c.broadcast.self); this.binds = []; this.pres = {}; this.myMeta = null; this.id = rid(); this.subscribed = false; }
    on(type, filter, cb) { this.binds.push({ type, filter: filter || {}, cb }); return this; }
    subscribe(cb) { chans.add(this); setTimeout(() => { this.subscribed = true; post({ topic: this.topic, kind: 'presReq', from: this.id }); cb && cb('SUBSCRIBED'); }, 30); return this; }
    send({ type, event, payload }) { if (!this.subscribed) return Promise.resolve('error'); post({ topic: this.topic, kind: 'bc', event, payload: JSON.parse(JSON.stringify(payload)), from: this.id }); return Promise.resolve('ok'); }
    track(meta) { this.myMeta = meta; this.pres[this.key] = [Object.assign({}, meta, { presence_ref: this.id })]; post({ topic: this.topic, kind: 'pres', key: this.key, meta, from: this.id }); setTimeout(() => this._sync(), 5); return Promise.resolve('ok'); }
    untrack() { this.myMeta = null; delete this.pres[this.key]; post({ topic: this.topic, kind: 'presLeave', key: this.key, from: this.id }); return Promise.resolve('ok'); }
    presenceState() { return JSON.parse(JSON.stringify(this.pres)); }
    _recv(m) {
      if (m.from === this.id) return;
      if (m.kind === 'bc') { for (const b of this.binds) if (b.type === 'broadcast' && (b.filter.event === m.event || b.filter.event === '*')) b.cb({ type: 'broadcast', event: m.event, payload: m.payload }); }
      else if (m.kind === 'pres') { this.pres[m.key] = [Object.assign({}, m.meta, { presence_ref: m.from })]; this._sync(); }
      else if (m.kind === 'presLeave') { delete this.pres[m.key]; this._sync(); }
      else if (m.kind === 'presReq') { if (this.myMeta) post({ topic: this.topic, kind: 'pres', key: this.key, meta: this.myMeta, from: this.id }); }
    }
    _sync() { for (const b of this.binds) if (b.type === 'presence' && b.filter.event === 'sync') b.cb(); }
    _leave() { if (this.myMeta) post({ topic: this.topic, kind: 'presLeave', key: this.key, from: this.id }); chans.delete(this); this.subscribed = false; this.myMeta = null; }
  }
  window.addEventListener('pagehide', () => { for (const ch of [...chans]) ch._leave(); });
  window.__fakeSB = { DB, calls: [], chans };
  window.supabase = { createClient(url, key, opts) {
    const SK = (opts && opts.auth && opts.auth.storageKey) || 'sb';
    const sess = () => JSON.parse(localStorage.getItem(SK) || 'null');
    const me = () => { const s = sess(); return s && s.user.id; };
    const auth = {
      async signUp({ email, password, options }) {
        const d = DB(); if (d.users[email]) return delay({ data: { user: null, session: null }, error: { message: 'User already registered', code: 'user_already_exists' } });
        if (password.length < 6) return delay({ data: {}, error: { message: 'Password should be at least 6 characters', code: 'weak_password' } });
        const id = 'uid-' + rid(), user = { id, email, user_metadata: (options && options.data) || {}, identities: [{ id }] };
        d.users[email] = { user, password }; d.profiles[id] = { id, username: user.user_metadata.username }; d.player_data[id] = { user_id: id, stats: null, rank: null, settings: null }; save(d);
        const session = { access_token: 't', user }; localStorage.setItem(SK, JSON.stringify(session));
        return delay({ data: { user, session }, error: null });
      },
      async signInWithPassword({ email, password }) {
        const u = DB().users[email]; if (!u || u.password !== password) return delay({ data: {}, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
        const session = { access_token: 't', user: u.user }; localStorage.setItem(SK, JSON.stringify(session)); return delay({ data: { user: u.user, session }, error: null });
      },
      async getSession() { return delay({ data: { session: sess() }, error: null }); },
      async signOut() { localStorage.removeItem(SK); return delay({ error: null }); },
    };
    function from(table) {
      let filt = null;
      const q = {
        select() { return q; }, eq(c, v) { filt = [c, v]; return q; },
        async maybeSingle() { const s = sess(); const d = DB()[table]; const row = Object.values(d).find((r) => r[filt[0]] === filt[1]) || null; const own = row && s && (row.id === s.user.id || row.user_id === s.user.id); return delay({ data: own ? row : null, error: s ? null : { message: 'JWT missing' } }); },
        async upsert(obj) { const s = sess(); if (!s || obj.user_id !== s.user.id) return delay({ error: { message: 'new row violates row-level security policy' } }); const d = DB(); d[table][obj.user_id] = Object.assign({}, d[table][obj.user_id] || {}, obj, { updated_at: new Date().toISOString() }); save(d); window.__fakeSB.calls.push(['upsert', table]); return delay({ error: null }); },
      };
      return q;
    }
    // 친구 함수 (supabase/social.sql 과 같은 규칙)
    const RPC = {
      friend_request({ p_name }) {
        const m = me(); if (!m) return 'auth'; const d = DB();
        const o = Object.values(d.profiles).find((p) => p.username.toLowerCase() === String(p_name).trim().toLowerCase()); if (!o) return 'notfound'; if (o.id === m) return 'self';
        const f = d.friendships.find((x) => (x.a === m && x.b === o.id) || (x.a === o.id && x.b === m));
        if (f && f.status === 'accepted') return 'already';
        if (f && f.a === o.id && f.status === 'pending') { f.status = 'accepted'; save(d); return 'accepted'; }
        if (f) return 'pending';
        if (d.friendships.filter((x) => x.a === m || x.b === m).length >= 100) return 'full';
        d.friendships.push({ a: m, b: o.id, status: 'pending' }); save(d); return 'sent';
      },
      friend_respond({ p_other, p_accept }) { const m = me(), d = DB(); const f = d.friendships.find((x) => x.a === p_other && x.b === m && x.status === 'pending'); if (f) { if (p_accept) f.status = 'accepted'; else d.friendships.splice(d.friendships.indexOf(f), 1); save(d); } return null; },
      friend_remove({ p_other }) { const m = me(), d = DB(); d.friendships = d.friendships.filter((x) => !((x.a === m && x.b === p_other) || (x.a === p_other && x.b === m))); save(d); return null; },
      friend_list() { const m = me(), d = DB(); return d.friendships.filter((x) => x.a === m || x.b === m).map((x) => { const oid = x.a === m ? x.b : x.a, p = d.profiles[oid], pd = d.player_data[oid]; return { id: oid, username: p ? p.username : '?', status: x.status, incoming: x.b === m, xp: (pd && pd.stats && pd.stats.xp) || 0 }; }); },
    };
    async function rpc(fn, args) { if (!RPC[fn]) return delay({ data: null, error: { message: `Could not find the function public.${fn}`, code: 'PGRST202' } }); try { return delay({ data: RPC[fn](args || {}), error: null }); } catch (e) { return delay({ data: null, error: { message: String(e) } }); } }
    const channel = (name, opts) => new Ch('realtime:' + name, opts);
    const removeChannel = (ch) => { ch._leave(); return Promise.resolve('ok'); };
    return { auth, from, rpc, channel, removeChannel };
  } };
})();
