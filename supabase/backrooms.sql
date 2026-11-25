-- ============================================================
-- Last Drop Royale × THE BACKROOMS — 계정마다 백룸 탈출 기록 · 이벤트 보상 (v22)
--  · 백룸(backrooms-theta.vercel.app)에는 로그인이 없다. 대신 LDR 이벤트 창의 '백룸 들어가기'가
--    계정마다 하나인 연결 코드를 주소 뒤(#ldr=…)로 넘기고, 백룸은 그 코드로 탈출을 기록한다 (js/ldr.js)
--  · br_links   : 연결 코드 ↔ 계정 (계정마다 하나 — 이벤트 창을 처음 열 때 만듦)
--  · br_escapes : 계정이 해낸 탈출 방법 (방법마다 처음 한 번 — 12가지)
--  · br_claims  : 이벤트 보상을 받은 기록 (계정마다 이벤트 하나에 한 번 — one = 탈출 1회 · all = 12가지 모두)
--  · br_hidden  : v24.2 히든 업적 (계정마다 id 하나에 한 번 — madman = 군 병원에서 정신력이 다 닳음 → LDR 칭호 「광인」 · 우로보로스 테두리)
--  · 네 테이블 모두 RLS 를 켜고 정책을 두지 않는다 → 직접 읽고 쓰지 못하고 아래 함수로만
--  · 보상(골드 탄피·칭호·사진·테두리)은 게임이 'ok' 를 받은 뒤 계정 기록(player_data.stats)에 넣는다
--  여러 번 실행해도 안전하다 (if not exists / or replace)
-- ============================================================

create table if not exists public.br_links (
  code       text primary key check (code ~ '^[0-9a-f]{40}$'),
  owner      uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.br_escapes (
  owner   uuid not null references auth.users (id) on delete cascade,
  method  text not null,
  done_at timestamptz not null default now(),
  primary key (owner, method)
);
create table if not exists public.br_claims (
  owner      uuid not null references auth.users (id) on delete cascade,
  ev         text not null check (ev in ('one', 'all')),
  how        text not null default 'new',
  claimed_at timestamptz not null default now(),
  primary key (owner, ev)
);
alter table public.br_links   enable row level security;
alter table public.br_escapes enable row level security;
alter table public.br_claims  enable row level security;
create table if not exists public.br_hidden (
  owner   uuid not null references auth.users (id) on delete cascade,
  id      text not null,
  done_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.br_hidden  enable row level security;

-- 백룸의 탈출 방법 12가지 (백룸 js/escapes.js 의 id 와 같아야 한다)
create or replace function public.br_method_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['elevator', 'radio', 'drain', 'boarding', 'train', 'pod', 'lighthouse', 'dream', 'phones', 'book', 'stairs', 'mirror']), false)
$$;

-- 계정의 탈출 기록 [{ m, at }] (먼저 한 것부터) — 아래 함수들(security definer) 안에서 쓴다
--  부른 사람 권한으로 돌므로(invoker) 직접 부르면 RLS 때문에 늘 빈 목록
create or replace function public.br_list(p_owner uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('m', method, 'at', done_at) order by done_at), '[]'::jsonb)
    from public.br_escapes where owner = p_owner and public.br_method_ok(method)
$$;

-- v24.2 백룸 히든 업적 id (백룸 js/ldr.js 가 부르는 id 와 같아야 한다)
create or replace function public.br_hidden_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p = any (array['madman']), false)
$$;
-- 계정의 히든 업적 ['madman', …] (먼저 한 것부터) — br_list 처럼 아래 security definer 함수 안에서만 의미가 있다
create or replace function public.br_hidden_list(p_owner uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(id order by done_at), '[]'::jsonb)
    from public.br_hidden where owner = p_owner and public.br_hidden_ok(id)
$$;

-- LDR 이벤트 창 (로그인한 본인): 연결 코드(없으면 만듦) · 탈출 기록 · 받은 보상 · v24.2 히든 업적(hid)
create or replace function public.br_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c  text;
begin
  if me is null then raise exception 'auth'; end if;
  select code into c from public.br_links where owner = me;
  if c is null then
    insert into public.br_links (code, owner)
      values (substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 40), me)
      on conflict do nothing;
    select code into c from public.br_links where owner = me;
  end if;
  return jsonb_build_object('code', c, 'esc', public.br_list(me),
    'claims', (select coalesce(jsonb_agg(ev order by ev), '[]'::jsonb) from public.br_claims where owner = me),
    'hid', public.br_hidden_list(me));
end; $$;
grant execute on function public.br_state() to authenticated;

-- 백룸 (로그인 없이 연결 코드로): 탈출 기록 → 그 계정의 이름과 기록
create or replace function public.br_escape(p_code text, p_method text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me    uuid;
  nm    text;
  isnew boolean;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{40}$' then raise exception 'code'; end if;
  if not public.br_method_ok(p_method) then raise exception 'method'; end if;
  select owner into me from public.br_links where code = p_code;
  if me is null then raise exception 'code'; end if;
  insert into public.br_escapes (owner, method) values (me, p_method) on conflict do nothing;
  isnew := found;
  select username into nm from public.profiles where id = me;
  return jsonb_build_object('name', coalesce(nm, ''), 'esc', public.br_list(me), 'new', isnew);
end; $$;
grant execute on function public.br_escape(text, text) to anon, authenticated;

-- 백룸: 연결 확인 (메인 메뉴 · 탈출 도감에 계정 이름과 기록)
--  admin: 연결된 계정이 관리자(admin.sql 의 public.admins)인지 — 백룸 개발자 메뉴용 (v22, 백룸 js/dev.js). admin.sql 이 없으면 false
--  hid: v24.2 히든 업적 목록 (백룸 메뉴·도감의 「광인 해금」 표시)
create or replace function public.br_peek(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me  uuid;
  nm  text;
  adm boolean := false;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{40}$' then raise exception 'code'; end if;
  select owner into me from public.br_links where code = p_code;
  if me is null then raise exception 'code'; end if;
  select username into nm from public.profiles where id = me;
  if to_regclass('public.admins') is not null then
    execute 'select exists (select 1 from public.admins where id = $1)' into adm using me;
  end if;
  return jsonb_build_object('name', coalesce(nm, ''), 'esc', public.br_list(me), 'admin', coalesce(adm, false), 'hid', public.br_hidden_list(me));
end; $$;
grant execute on function public.br_peek(text) to anon, authenticated;

-- v24.2 백룸 (로그인 없이 연결 코드로): 히든 업적 기록 → 그 계정의 이름 · 히든 업적 목록 · 이번에 새로 기록했는지
--  · 잘못된 코드 → 'code' · 모르는 id → 'id' · 이미 있으면 new = false (다시 불러도 안전)
--  · LDR 은 br_state 의 hid 를 읽고 칭호를 넣는다 (10_event.js) — 보상 받기(br_claim)는 따로 없음
create or replace function public.br_hidden(p_code text, p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me    uuid;
  nm    text;
  isnew boolean;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{40}$' then raise exception 'code'; end if;
  if not public.br_hidden_ok(p_id) then raise exception 'id'; end if;
  select owner into me from public.br_links where code = p_code;
  if me is null then raise exception 'code'; end if;
  insert into public.br_hidden (owner, id) values (me, p_id) on conflict do nothing;
  isnew := found;
  select username into nm from public.profiles where id = me;
  return jsonb_build_object('name', coalesce(nm, ''), 'hid', public.br_hidden_list(me), 'new', isnew);
end; $$;
grant execute on function public.br_hidden(text, text) to anon, authenticated;

-- LDR 이벤트 창: 보상 받기 — 계정마다 이벤트 하나에 한 번
--  p_how 'new'  : 계정의 탈출 기록으로 확인 (one = 1가지 이상 · all = 12가지 모두)
--        'old'  : 예전 판(기기마다 받던 때)에 이 기기에서 탈출이 확인됐지만 아직 안 받은 것 — 탈출 1회(one)만
--        'mark' : 예전 판에서 이미 받은 계정 — 받은 것으로 적기만 (보상 없음)
--  돌려주는 값: 'ok'(지금 받음 → 게임이 보상을 넣는다) · 'already'(이미 받음) · 'not-yet'(조건 부족) · 'marked'
create or replace function public.br_claim(p_ev text, p_how text default 'new') returns text
language plpgsql security definer set search_path = '' as $$
declare
  me    uuid := auth.uid();
  v_how text := coalesce(p_how, 'new');
  n     int;
begin
  if me is null then raise exception 'auth'; end if;
  if p_ev is null or p_ev not in ('one', 'all') then raise exception 'ev'; end if;
  if v_how not in ('new', 'old', 'mark') or (v_how = 'old' and p_ev <> 'one') then raise exception 'how'; end if;
  if v_how = 'new' then
    select count(*) into n from public.br_escapes where owner = me and public.br_method_ok(method);
    if n < (case when p_ev = 'all' then 12 else 1 end) then return 'not-yet'; end if;
  end if;
  insert into public.br_claims (owner, ev, how) values (me, p_ev, v_how) on conflict do nothing;
  if not found then return 'already'; end if;
  return case when v_how = 'mark' then 'marked' else 'ok' end;
end; $$;
grant execute on function public.br_claim(text, text) to authenticated;
