-- ============================================================
-- Last Drop Royale — 개발자(관리자) 계정 관리 (v20, Supabase SQL Editor에서 한 번 실행)
--  · 게임의 개발자 도구 → '계정 관리'가 부르는 함수: 계정 목록 · 계정 상세 · 골드 탄피 지급 · 베타 테스터 부여 · 기록 초기화 · 계정 삭제
--    · 아이디 강제 변경 (v22, admin_rename) · v23 부개발자 · 계정 밴 (admin_role · admin_accounts · admin_ban · admin_unban · ban_info · staff_roles)
--  · 관리자 = public.admins 에 있는 계정. 이 파일을 실행할 때 아이디가 '개발자'인 계정을 관리자로 등록한다
--    (아이디로 판단하지 않고 계정 고유번호로 등록 → 아이디를 바꿔도 관리자 유지, 다른 사람이 '개발자'를 가져가도 관리자가 아님)
--  · v23 역할(role): 'dev' 개발자 · 'sub' 부개발자 — 부개발자는 개발자와 같은 관리 기능(계정 목록·상세·기록 초기화·베타 테스터·
--    아이디 변경·계정 삭제·관전·밴)을 쓰지만, 다른 계정에 골드 탄피를 줄 수 없고(admin_gold 는 개발자만)
--    개발자·다른 부개발자 계정은 건드릴 수 없다. 이 파일을 실행할 때 아이디가 '부개발자'인 계정을 부개발자로 등록한다(고유번호로)
--  · 모든 함수는 관리자가 아니면 거부한다 (security definer + admins 검사)
--  · schema.sql · social.sql · profile.sql 다음에 실행. 여러 번 실행해도 안전
-- ============================================================

create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;   -- 정책 없음: API로는 아무도 못 읽음 (아래 함수만 사용)
-- v23 역할: 원래 있던 관리자(개발자)는 'dev'
alter table public.admins add column if not exists role text not null default 'dev';
do $$ begin alter table public.admins add constraint admins_role_chk check (role in ('dev', 'sub')); exception when duplicate_object then null; end $$;
-- 관리자가 아직 하나도 없을 때만 아이디 '개발자' 계정을 등록 (v21: 다시 실행해도 지금 '개발자' 아이디를 가진 다른 계정이 관리자가 되지 않게)
insert into public.admins (id) select id from public.profiles where lower(username) = lower('개발자') and not exists (select 1 from public.admins) on conflict do nothing;
-- v23 아이디 '부개발자' 계정을 부개발자로 (고유번호로 등록 — 나중에 아이디를 바꿔도 그대로 · 이미 관리자 목록에 있으면 그대로)
insert into public.admins (id, role) select id, 'sub' from public.profiles where lower(username) = lower('부개발자') on conflict (id) do nothing;
-- v22: 운영자가 아이디를 바꾼 시각 (admin_rename) — 게임이 그 사람에게 '운영자가 아이디를 바꿨습니다'로 알릴지 정한다
--  본인만 읽을 수 있다 (profiles 는 'read own' 정책)
alter table public.profiles add column if not exists name_forced_at timestamptz;
-- v23 계정 밴: 이 시각까지 로그인할 수 없다 (실제로 막는 것은 auth.users.banned_until — Supabase 로그인·세션 갱신이 'User is banned' 로 거부)
--  여기는 표시용 사본: 사유 · 밴한 관리자 아이디 · 밴한 시각. 본인도 읽을 수 있다(read own) → 게임이 이미 로그인된 기기를 로그아웃시키고 안내
alter table public.profiles add column if not exists banned_until timestamptz;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists banned_by text;
alter table public.profiles add column if not exists banned_at timestamptz;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;
-- v23 내 역할: 'dev' 개발자 · 'sub' 부개발자 · 관리자가 아니면 null (게임이 개발자 도구에서 부개발자에게 골드 지급을 숨긴다)
create or replace function public.admin_role() returns text
language sql security definer set search_path = '' stable as $$
  select role from public.admins where id = auth.uid();
$$;

-- 계정 목록 (최근 저장 순, 이름 검색)
--  v21: 숫자 칸을 bigint 로 — 경험치가 21억(integer 한도)을 넘는 계정이 하나라도 있으면 'integer out of range' 로 목록 전체가 안 열렸다
--  반환 형식이 바뀌면 create or replace 가 안 되므로 먼저 지운다 (함수만 지움, 기록은 그대로)
drop function if exists public.admin_list(text);
create or replace function public.admin_list(p_q text default '')
returns table (id uuid, username text, created_at timestamptz, updated_at timestamptz, xp bigint, matches bigint, wins bigint, kills bigint, gold bigint, rp bigint, admin boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then raise exception 'not admin'; end if;
  return query
    select p.id, p.username, p.created_at, d.updated_at,
      least(coalesce(floor((d.stats ->> 'xp')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.stats ->> 'matches')::numeric), 0), 9e15)::bigint,
      least(coalesce(floor((d.stats ->> 'wins')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.stats ->> 'kills')::numeric), 0), 9e15)::bigint,
      least(coalesce(floor((d.stats -> 'eco' ->> 'gold')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.rank ->> 'rp')::numeric), 0), 9e15)::bigint,
      exists (select 1 from public.admins a2 where a2.id = p.id)
    from public.profiles p left join public.player_data d on d.user_id = p.id
    where coalesce(p_q, '') = '' or p.username ilike '%' || p_q || '%'
    order by d.updated_at desc nulls last
    limit 300;
end; $$;
-- v23 계정 목록 + 역할·밴: admin_list 와 같은 칸 + role('dev'·'sub'·null) · banned_until · ban_reason
--  게임은 이것을 먼저 부르고, 없으면(옛 서버) admin_list (반환 형식을 바꾸려면 지워야 해서 새 이름으로)
create or replace function public.admin_accounts(p_q text default '')
returns table (id uuid, username text, created_at timestamptz, updated_at timestamptz, xp bigint, matches bigint, wins bigint, kills bigint, gold bigint, rp bigint, admin boolean, role text, banned_until timestamptz, ban_reason text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then raise exception 'not admin'; end if;
  return query
    select p.id, p.username, p.created_at, d.updated_at,
      least(coalesce(floor((d.stats ->> 'xp')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.stats ->> 'matches')::numeric), 0), 9e15)::bigint,
      least(coalesce(floor((d.stats ->> 'wins')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.stats ->> 'kills')::numeric), 0), 9e15)::bigint,
      least(coalesce(floor((d.stats -> 'eco' ->> 'gold')::numeric), 0), 9e15)::bigint, least(coalesce(floor((d.rank ->> 'rp')::numeric), 0), 9e15)::bigint,
      a2.id is not null, a2.role, p.banned_until, p.ban_reason
    from public.profiles p left join public.player_data d on d.user_id = p.id left join public.admins a2 on a2.id = p.id
    where coalesce(p_q, '') = '' or p.username ilike '%' || p_q || '%'
    order by d.updated_at desc nulls last
    limit 300;
end; $$;

-- 계정 상세 (목록에서 계정을 눌렀을 때): 프로필 · 마지막 로그인 · 전체 기록(stats) · 랭크. 없는 계정이면 null
create or replace function public.admin_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then raise exception 'not admin'; end if;
  select jsonb_build_object('id', p.id, 'username', p.username, 'created_at', p.created_at, 'name_changed_at', p.name_changed_at, 'name_forced_at', p.name_forced_at,
      'updated_at', d.updated_at, 'last_sign_in_at', u.last_sign_in_at, 'admin', exists (select 1 from public.admins a2 where a2.id = p.id),
      'role', (select a3.role from public.admins a3 where a3.id = p.id),   -- v23 역할 · 밴
      'banned_until', p.banned_until, 'ban_reason', p.ban_reason, 'banned_by', p.banned_by, 'banned_at', p.banned_at,
      'stats', coalesce(d.stats, '{}'::jsonb) - 'sync', 'rank', d.rank)
    into r
    from public.profiles p left join public.player_data d on d.user_id = p.id left join auth.users u on u.id = p.id
    where p.id = p_id;
  return r;
end; $$;

-- 골드 탄피 지급: 서버 기록의 재화에 더하고 동기화 표식(sync)을 바꾼다 → 접속 중인 기기도 다음 저장 때 합쳐서 받음
--  v23: 개발자만 — 부개발자는 'devonly'
create or replace function public.admin_gold(p_id uuid, p_amount integer) returns text
language plpgsql security definer set search_path = '' as $$
declare s jsonb; e jsonb; my text;
begin
  select a.role into my from public.admins a where a.id = auth.uid();
  if my is null then return 'denied'; end if;
  if my <> 'dev' then return 'devonly'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then return 'amount'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  select stats into s from public.player_data where user_id = p_id for update;
  s := coalesce(s, '{}'::jsonb);
  e := coalesce(s -> 'eco', jsonb_build_object('v', 1, 'gold', 1000, 'coin', 0, 'gcoin', 0, 'rev', 1, 'pulls', '{}'::jsonb, 'att', jsonb_build_object('last', '', 'n', 0), 'welcome', 1));
  e := jsonb_set(e, '{gold}', to_jsonb(least(coalesce(floor((e ->> 'gold')::numeric), 0), 9e15)::bigint + p_amount));   -- v21: bigint (21억 넘는 골드도 지급 가능)
  e := jsonb_set(e, '{rev}', to_jsonb(greatest(least(coalesce(floor((e ->> 'rev')::numeric), 0), 9e15)::bigint + 1, 3)));
  s := jsonb_set(s, '{eco}', e);
  s := jsonb_set(s, '{sync}', to_jsonb('admin:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint));
  insert into public.player_data (user_id, stats) values (p_id, s)
    on conflict (user_id) do update set stats = excluded.stats;
  return 'ok';
end; $$;

-- 기록 초기화: 전적·레벨·재화·스킨·랭크를 처음 상태로 (설정은 유지). 'reset' 표식이 있어 게임이 기기의 옛 기록으로 되돌리지 않음
create or replace function public.admin_reset(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint; my text;
begin
  select a.role into my from public.admins a where a.id = auth.uid();
  if my is null then return 'denied'; end if;
  if my <> 'dev' and p_id <> auth.uid() and exists (select 1 from public.admins a where a.id = p_id) then return 'admin'; end if;   -- v23 부개발자는 다른 관리자 계정을 건드릴 수 없다
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  insert into public.player_data (user_id, stats, rank)
    values (p_id, jsonb_build_object('matches', 0, 'wins', 0, 'kills', 0, 'xp', 0, 'best', 99, 'recent', '[]'::jsonb, 'reset', t, 'sync', 'reset:' || t)
      || coalesce((select jsonb_strip_nulls(jsonb_build_object('beta', d.stats -> 'beta')) from public.player_data d where d.user_id = p_id), '{}'::jsonb), null)   -- 베타 테스터는 초기화해도 유지
    on conflict (user_id) do update set stats = excluded.stats, rank = null;
  return 'ok';
end; $$;

-- 베타 테스터 칭호 부여·회수: stats.beta = { on, t } + 동기화 표식 → 접속 중인 기기도 다음 저장 때 받음
--  받으면 게임에서 베타 테스터 사진·테두리·칭호와 테스터 등급 총기 스킨(프로토타입 β)이 해금된다
create or replace function public.admin_beta(p_id uuid, p_on boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare s jsonb; t bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint; my text;
begin
  select a.role into my from public.admins a where a.id = auth.uid();
  if my is null then return 'denied'; end if;
  if my <> 'dev' and p_id <> auth.uid() and exists (select 1 from public.admins a where a.id = p_id) then return 'admin'; end if;   -- v23 부개발자는 다른 관리자 계정을 건드릴 수 없다
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  select stats into s from public.player_data where user_id = p_id for update;
  s := coalesce(s, '{}'::jsonb);
  s := jsonb_set(s, '{beta}', jsonb_build_object('on', coalesce(p_on, false), 't', t));
  s := jsonb_set(s, '{sync}', to_jsonb('admin:' || t));
  insert into public.player_data (user_id, stats) values (p_id, s)
    on conflict (user_id) do update set stats = excluded.stats;
  return 'ok';
end; $$;

-- 계정 삭제 (되돌릴 수 없음): 로그인 정보·프로필·기록·친구 관계가 모두 지워진다. 자신과 다른 관리자는 지울 수 없음
create or replace function public.admin_delete(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then return 'denied'; end if;
  if p_id = auth.uid() then return 'self'; end if;
  if exists (select 1 from public.admins a where a.id = p_id) then return 'admin'; end if;
  delete from auth.users where id = p_id;
  return 'ok';
end; $$;

-- 아이디 변경(profile.sql)에 '개발자' 같은 예약 아이디 막기: 관리자가 아니면 예약 아이디로 바꿀 수 없음
create or replace function public.change_username(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me   uuid := auth.uid();
  nm   text := btrim(coalesce(p_name, ''));
  last timestamptz;
  dom  text;
  em   text;
begin
  if me is null then return 'auth'; end if;
  if char_length(nm) < 2 or char_length(nm) > 10 or nm !~ '^[가-힣A-Za-z0-9_]+$' then return 'invalid'; end if;
  -- 예약 아이디: '개발자'는 개발자 계정만 · v23 '부개발자'는 관리자(개발자·부개발자) 계정만
  if lower(nm) = '개발자' and not exists (select 1 from public.admins where id = me and role = 'dev') then return 'taken'; end if;
  if lower(nm) = '부개발자' and not exists (select 1 from public.admins where id = me) then return 'taken'; end if;
  select name_changed_at into last from public.profiles where id = me;
  if last is not null and last > now() - interval '3 days' then
    return 'wait:' || floor(extract(epoch from last + interval '3 days'))::bigint;
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(nm) and id <> me) then return 'taken'; end if;
  select split_part(email, '@', 2) into dom from auth.users where id = me;
  em := 'u' || encode(convert_to(lower(nm), 'UTF8'), 'hex') || '@' || dom;
  if exists (select 1 from auth.users where lower(email) = lower(em) and id <> me) then return 'taken'; end if;
  update public.profiles set username = nm, name_changed_at = now() where id = me;
  update auth.users
     set email = em,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', nm)
   where id = me;
  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', em)
   where user_id = me and provider = 'email';
  return 'ok';
end; $$;

-- v22: 아이디 강제 변경 (계정 관리 → 계정 상세 → '아이디 강제 변경')
--  · 본인 변경(change_username)과 같은 규칙(2~10자 · 한글·영문·숫자·_ · 대소문자만 달라도 겹침)으로 표시 이름과 로그인 아이디(내부 이메일)를 같이 바꾼다
--    → 그 사람은 다음 로그인부터 새 아이디 + 원래 비밀번호. 지금 로그인된 기기는 그대로 (게임이 바뀐 아이디를 창으로 알려 줌)
--  · 3일에 한 번 제한을 받지 않고, 바꾼 뒤 3일 동안은 본인이 다시 바꿀 수 없다 (name_changed_at 을 지금으로)
--  · '개발자' 같은 예약 아이디는 관리자 계정에만
--  돌려주는 값: 'ok' · 'denied' · 'invalid' · 'notfound' · 'same'(지금과 같음) · 'reserved' · 'taken'
create or replace function public.admin_rename(p_id uuid, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  nm  text := btrim(coalesce(p_name, ''));
  cur text;
  dom text;
  em  text;
  my  text;
begin
  select a.role into my from public.admins a where a.id = auth.uid();
  if my is null then return 'denied'; end if;
  if my <> 'dev' and p_id <> auth.uid() and exists (select 1 from public.admins a where a.id = p_id) then return 'admin'; end if;   -- v23 부개발자는 다른 관리자 계정을 건드릴 수 없다
  if char_length(nm) < 2 or char_length(nm) > 10 or nm !~ '^[가-힣A-Za-z0-9_]+$' then return 'invalid'; end if;
  select username into cur from public.profiles where id = p_id for update;
  if cur is null then return 'notfound'; end if;
  if cur = nm then return 'same'; end if;
  if lower(nm) = '개발자' and not exists (select 1 from public.admins where id = p_id and role = 'dev') then return 'reserved'; end if;
  if lower(nm) = '부개발자' and not exists (select 1 from public.admins where id = p_id) then return 'reserved'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(nm) and id <> p_id) then return 'taken'; end if;
  select split_part(email, '@', 2) into dom from auth.users where id = p_id;
  if coalesce(dom, '') = '' then return 'notfound'; end if;
  em := 'u' || encode(convert_to(lower(nm), 'UTF8'), 'hex') || '@' || dom;
  if exists (select 1 from auth.users where lower(email) = lower(em) and id <> p_id) then return 'taken'; end if;
  update public.profiles set username = nm, name_changed_at = now(), name_forced_at = now() where id = p_id;
  update auth.users
     set email = em,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', nm)
   where id = p_id;
  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', em)
   where user_id = p_id and provider = 'email';
  return 'ok';
end; $$;

-- v23 계정 밴 (계정 관리 → 계정 상세 → '계정 밴'): p_minutes 분 동안 (1분 ~ 3650일) · p_reason 사유(선택, 60자까지)
--  · auth.users.banned_until 을 정한다 → Supabase 가 그 시각까지 비밀번호 로그인·세션 갱신을 거부('User is banned')
--  · profiles 에 사본(시각·사유·밴한 관리자 아이디·밴한 시각) → 계정 관리 표시 · 게임이 이미 로그인된 기기를 로그아웃시키고 안내
--  · 개발자 계정은 아무도 밴할 수 없고, 부개발자는 다른 부개발자도 밴할 수 없다 · 자기 자신도 안 됨 · 다시 밴하면 지금부터 새 기간
--  돌려주는 값: 'ok' · 'denied' · 'self' · 'admin' · 'notfound' · 'amount'(기간이 잘못됨)
create or replace function public.admin_ban(p_id uuid, p_minutes integer, p_reason text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare
  me  uuid := auth.uid();
  my  text;
  tr  text;
  who text;
  til timestamptz;
begin
  select a.role into my from public.admins a where a.id = me;
  if my is null then return 'denied'; end if;
  if p_id = me then return 'self'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 5256000 then return 'amount'; end if;
  select a.role into tr from public.admins a where a.id = p_id;
  if tr = 'dev' or (tr is not null and my <> 'dev') then return 'admin'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  til := now() + make_interval(mins => p_minutes);
  select username into who from public.profiles where id = me;
  update public.profiles
     set banned_until = til, ban_reason = nullif(left(btrim(coalesce(p_reason, '')), 60), ''), banned_by = who, banned_at = now()
   where id = p_id;
  update auth.users set banned_until = til where id = p_id;
  return 'ok';
end; $$;

-- v23 밴 해제: 바로 다시 로그인할 수 있다 · 부개발자는 다른 관리자 계정을 풀 수 없다
--  돌려주는 값: 'ok' · 'denied' · 'admin' · 'notfound'
create or replace function public.admin_unban(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare my text; tr text;
begin
  select a.role into my from public.admins a where a.id = auth.uid();
  if my is null then return 'denied'; end if;
  select a.role into tr from public.admins a where a.id = p_id;
  if tr is not null and my <> 'dev' then return 'admin'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  update public.profiles set banned_until = null, ban_reason = null, banned_by = null, banned_at = null where id = p_id;
  update auth.users set banned_until = null where id = p_id;
  return 'ok';
end; $$;

-- v23 로그인이 'User is banned' 로 막혔을 때 게임이 안내할 내용 (로그인 전이라 누구나 부를 수 있다)
--  { until, reason } · 그 아이디가 지금 밴 중이 아니면 null
create or replace function public.ban_info(p_name text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('until', p.banned_until, 'reason', coalesce(p.ban_reason, ''))
    from public.profiles p
   where lower(p.username) = lower(btrim(coalesce(p_name, ''))) and p.banned_until > now()
   limit 1;
$$;

-- v23 관리자 표시: 주어진 계정들 가운데 관리자인 것의 역할 { "<계정 고유번호>": "dev" | "sub" } (관리자가 아니면 빠짐)
--  · 파티 로비에서 개발자 전용 입장 연출과 관리자가 단 칭호를, 그 계정이 정말 관리자일 때만 보여 주려고 다른 기기가 부른다
--    (게임이 파티원·같은 경기 사람의 고유번호를 넣어 부름 — 로그인한 사람 누구나 · 한 번에 16명까지 · 읽기만 함)
--  · 이 함수가 없는 동안 게임은 예약 아이디('개발자'·'부개발자')로 대신 본다
create or replace function public.staff_roles(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(a.id::text, a.role), '{}'::jsonb)
    from public.admins a
   where a.id = any ((coalesce(p_ids, '{}'::uuid[]))[1:16]);
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_list(text) from public, anon;
revoke execute on function public.admin_get(uuid) from public, anon;
revoke execute on function public.admin_gold(uuid, integer) from public, anon;
revoke execute on function public.admin_reset(uuid) from public, anon;
revoke execute on function public.admin_beta(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete(uuid) from public, anon;
revoke execute on function public.change_username(text) from public, anon;
revoke execute on function public.admin_rename(uuid, text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list(text) to authenticated;
grant execute on function public.admin_get(uuid) to authenticated;
grant execute on function public.admin_gold(uuid, integer) to authenticated;
grant execute on function public.admin_reset(uuid) to authenticated;
grant execute on function public.admin_beta(uuid, boolean) to authenticated;
grant execute on function public.admin_delete(uuid) to authenticated;
grant execute on function public.change_username(text) to authenticated;
grant execute on function public.admin_rename(uuid, text) to authenticated;
-- v23
revoke execute on function public.admin_role() from public, anon;
revoke execute on function public.admin_accounts(text) from public, anon;
revoke execute on function public.admin_ban(uuid, integer, text) from public, anon;
revoke execute on function public.admin_unban(uuid) from public, anon;
grant execute on function public.admin_role() to authenticated;
grant execute on function public.admin_accounts(text) to authenticated;
grant execute on function public.admin_ban(uuid, integer, text) to authenticated;
grant execute on function public.admin_unban(uuid) to authenticated;
grant execute on function public.ban_info(text) to anon, authenticated;
revoke execute on function public.staff_roles(uuid[]) from public, anon;
grant execute on function public.staff_roles(uuid[]) to authenticated;
