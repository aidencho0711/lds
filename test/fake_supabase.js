// 테스트용 가짜 Supabase SDK — '서버' 데이터는 localStorage의 fakeSB에 (페이지를 다시 열어도 유지 = 서버)
(function () {
  const DB = () => JSON.parse(localStorage.getItem('fakeSB') || '{"users":{},"profiles":{},"player_data":{}}');
  const save = (d) => localStorage.setItem('fakeSB', JSON.stringify(d));
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 30));
  window.__fakeSB = { DB, calls: [] };
  window.supabase = { createClient(url, key, opts) {
    const SK = (opts && opts.auth && opts.auth.storageKey) || 'sb';
    const sess = () => JSON.parse(localStorage.getItem(SK) || 'null');
    const auth = {
      async signUp({ email, password, options }) {
        __fakeSB.calls.push(['signUp', email]);
        const d = DB(); if (d.users[email]) return delay({ data: { user: null, session: null }, error: { message: 'User already registered', code: 'user_already_exists' } });
        if (password.length < 6) return delay({ data: {}, error: { message: 'Password should be at least 6 characters', code: 'weak_password' } });
        const id = 'uid-' + Math.random().toString(36).slice(2, 10), user = { id, email, user_metadata: options && options.data || {}, identities: [{ id }] };
        d.users[email] = { user, password }; d.profiles[id] = { id, username: user.user_metadata.username }; d.player_data[id] = { user_id: id, stats: null, rank: null, settings: null }; save(d);
        const session = { access_token: 't', user }; localStorage.setItem(SK, JSON.stringify(session));
        return delay({ data: { user, session }, error: null });
      },
      async signInWithPassword({ email, password }) {
        __fakeSB.calls.push(['signIn', email]);
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
        async upsert(obj) { const s = sess(); if (!s || obj.user_id !== s.user.id) return delay({ error: { message: 'new row violates row-level security policy' } }); const d = DB(); d[table][obj.user_id] = Object.assign({}, d[table][obj.user_id] || {}, obj, { updated_at: new Date().toISOString() }); save(d); __fakeSB.calls.push(['upsert', table]); return delay({ error: null }); },
      };
      return q;
    }
    return { auth, from };
  } };
})();
