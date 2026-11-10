-- ============================================================
-- Last Drop Royale — 개발자(관리자) 계정 관리 (v20, Supabase SQL Editor에서 한 번 실행)
--  · 게임의 개발자 도구 → '계정 관리'가 부르는 함수: 계정 목록 · 계정 상세 · 골드 탄피 지급 · 기록 초기화 · 계정 삭제
--  · 관리자 = public.admins 에 있는 계정. 이 파일을 실행할 때 아이디가 '개발자'인 계정을 관리자로 등록한다
--    (아이디로 판단하지 않고 계정 고유번호로 등록 → 아이디를 바꿔도 관리자 유지, 다른 사람이 '개발자'를 가져가도 관리자가 아님)
--  · 모든 함수는 관리자가 아니면 거부한다 (security definer + admins 검사)
--  · schema.sql · social.sql · profile.sql 다음에 실행. 여러 번 실행해도 안전
-- ============================================================

create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;   -- 정책 없음: API로는 아무도 못 읽음 (아래 함수만 사용)
insert into public.admins (id) select id from public.profiles where lower(username) = lower('개발자') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- 계정 목록 (최근 저장 순, 이름 검색)
create or replace function public.admin_list(p_q text default '')
returns table (id uuid, username text, created_at timestamptz, updated_at timestamptz, xp integer, matches integer, wins integer, kills integer, gold integer, rp integer, admin boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then raise exception 'not admin'; end if;
  return query
    select p.id, p.username, p.created_at, d.updated_at,
      coalesce((d.stats ->> 'xp')::numeric, 0)::integer, coalesce((d.stats ->> 'matches')::numeric, 0)::integer,
      coalesce((d.stats ->> 'wins')::numeric, 0)::integer, coalesce((d.stats ->> 'kills')::numeric, 0)::integer,
      coalesce((d.stats -> 'eco' ->> 'gold')::numeric, 0)::integer, coalesce((d.rank ->> 'rp')::numeric, 0)::integer,
      exists (select 1 from public.admins a2 where a2.id = p.id)
    from public.profiles p left join public.player_data d on d.user_id = p.id
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
  select jsonb_build_object('id', p.id, 'username', p.username, 'created_at', p.created_at, 'name_changed_at', p.name_changed_at,
      'updated_at', d.updated_at, 'last_sign_in_at', u.last_sign_in_at, 'admin', exists (select 1 from public.admins a2 where a2.id = p.id),
      'stats', coalesce(d.stats, '{}'::jsonb) - 'sync', 'rank', d.rank)
    into r
    from public.profiles p left join public.player_data d on d.user_id = p.id left join auth.users u on u.id = p.id
    where p.id = p_id;
  return r;
end; $$;

-- 골드 탄피 지급: 서버 기록의 재화에 더하고 동기화 표식(sync)을 바꾼다 → 접속 중인 기기도 다음 저장 때 합쳐서 받음
create or replace function public.admin_gold(p_id uuid, p_amount integer) returns text
language plpgsql security definer set search_path = '' as $$
declare s jsonb; e jsonb;
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then return 'denied'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then return 'amount'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  select stats into s from public.player_data where user_id = p_id for update;
  s := coalesce(s, '{}'::jsonb);
  e := coalesce(s -> 'eco', jsonb_build_object('v', 1, 'gold', 1000, 'coin', 0, 'gcoin', 0, 'rev', 1, 'pulls', '{}'::jsonb, 'att', jsonb_build_object('last', '', 'n', 0), 'welcome', 1));
  e := jsonb_set(e, '{gold}', to_jsonb(coalesce((e ->> 'gold')::numeric, 0)::integer + p_amount));
  e := jsonb_set(e, '{rev}', to_jsonb(greatest(coalesce((e ->> 'rev')::numeric, 0)::integer + 1, 3)));
  s := jsonb_set(s, '{eco}', e);
  s := jsonb_set(s, '{sync}', to_jsonb('admin:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint));
  insert into public.player_data (user_id, stats) values (p_id, s)
    on conflict (user_id) do update set stats = excluded.stats;
  return 'ok';
end; $$;

-- 기록 초기화: 전적·레벨·재화·스킨·랭크를 처음 상태로 (설정은 유지). 'reset' 표식이 있어 게임이 기기의 옛 기록으로 되돌리지 않음
create or replace function public.admin_reset(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid()) then return 'denied'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then return 'notfound'; end if;
  insert into public.player_data (user_id, stats, rank)
    values (p_id, jsonb_build_object('matches', 0, 'wins', 0, 'kills', 0, 'xp', 0, 'best', 99, 'recent', '[]'::jsonb, 'reset', t, 'sync', 'reset:' || t), null)
    on conflict (user_id) do update set stats = excluded.stats, rank = null;
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
  if lower(nm) in ('개발자') and not exists (select 1 from public.admins where id = me) then return 'taken'; end if;
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

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_list(text) from public, anon;
revoke execute on function public.admin_get(uuid) from public, anon;
revoke execute on function public.admin_gold(uuid, integer) from public, anon;
revoke execute on function public.admin_reset(uuid) from public, anon;
revoke execute on function public.admin_delete(uuid) from public, anon;
revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list(text) to authenticated;
grant execute on function public.admin_get(uuid) to authenticated;
grant execute on function public.admin_gold(uuid, integer) to authenticated;
grant execute on function public.admin_reset(uuid) to authenticated;
grant execute on function public.admin_delete(uuid) to authenticated;
grant execute on function public.change_username(text) to authenticated;
