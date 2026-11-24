-- ============================================================
-- Last Drop Royale — 온라인 매칭 (v21, Supabase SQL Editor에서 한 번 실행)
--  · 대기열 한 줄(mm_tickets) = 혼자 또는 파티 하나(방장이 대표). 같은 대기열 키끼리 한 경기(mm_matches)로 묶는다
--    대기열 키 = 게임 버전·게임 종류·맵·팀 구성·일반/랭크/하드코어 (게임이 만들어 보냄)
--  · 경기는 사람이 다 차거나(cap) 최대 대기 시간(wait_s, 3분)이 지나면 마감
--    배틀로얄 cap = 맵 최대 인원(75·100명) — 사실상 3분 동안 줄 선 사람 모두 (v22, 예전 8명 제한 없앰)
--    → 가장 먼저 줄 선 사람이 방장(경기 서버 역할)이 되어 경기 설정(cfg)을 올리고, 나머지가 받아서 같은 경기에 들어간다
--    → 빈자리는 게임에서 AI(봇)로 채운다
--  · 2초마다 확인(mm_poll). 15초 넘게 확인이 없는 줄은 연결이 끊긴 것으로 보고 뺀다
--    마감 뒤 12초 안에 방장이 설정을 못 올리면(방장 연결 끊김) 다음 사람이 방장
--  · 30분 지난 경기·줄은 지운다. 모든 읽기·쓰기는 아래 함수로만 (RLS 켬, 정책 없음)
--  · v23 같은 대기열 키로 동시에 줄 서면 차례로 처리한다(mm_join 의 advisory lock) — 둘이 각자 새 경기를 열어 갈라지지 않게
--  · 여러 번 실행해도 안전 (기존 기록을 지우지 않음)
-- ============================================================

create table if not exists public.mm_matches (
  id         uuid primary key default gen_random_uuid(),
  qkey       text not null,                       -- 대기열 키
  cap        int  not null,                       -- 한 경기 최대 사람 수
  wait_s     int  not null,                       -- 최대 대기(초)
  created_at timestamptz not null default now(),
  closed_at  timestamptz,                         -- 마감 (다 찼거나 대기 시간이 끝남)
  host       uuid,                                -- 마감 때 정한 방장
  cfg        jsonb                                -- 방장이 올린 경기 설정
);
create index if not exists mm_matches_open_idx on public.mm_matches (qkey, created_at) where closed_at is null;
create index if not exists mm_matches_created_idx on public.mm_matches (created_at);

create table if not exists public.mm_tickets (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,   -- 줄 선 사람 (파티면 방장)
  match_id   uuid not null references public.mm_matches (id) on delete cascade,
  n          int  not null,                       -- 이 줄의 사람 수 (파티원 수)
  members    jsonb not null,                      -- [{uid, name, look, lv}] — 방장이 경기 설정을 만들 때 씀
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()   -- 마지막 확인
);
create index if not exists mm_tickets_match_idx on public.mm_tickets (match_id);
create index if not exists mm_tickets_owner_idx on public.mm_tickets (owner);

alter table public.mm_matches enable row level security;
alter table public.mm_tickets enable row level security;

-- 경기 상태 (안에서만 씀): 줄 목록은 먼저 선 순서
create or replace function public.mm_state(p_match uuid, p_ticket uuid) returns jsonb
language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'mid', m.id, 'ticket', p_ticket, 'cap', m.cap, 'wait', m.wait_s,
    'age', round(extract(epoch from now() - m.created_at)::numeric, 1),
    'closed', m.closed_at is not null, 'host', m.host, 'cfg', m.cfg,
    'n', coalesce((select sum(t.n) from public.mm_tickets t where t.match_id = m.id), 0),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'owner', t.owner, 'n', t.n, 'members', t.members) order by t.created_at, t.id)
                         from public.mm_tickets t where t.match_id = m.id), '[]'::jsonb))
  from public.mm_matches m where m.id = p_match;
$$;

-- 줄 서기: 같은 키의 열린 경기 중 자리가 남은 가장 오래된 곳, 없으면 새 경기. 다 차면 바로 마감
create or replace function public.mm_join(p_qkey text, p_cap int, p_wait int, p_members jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me  uuid := auth.uid();
  k   int;
  mid uuid;
  cand uuid;
  tid uuid;
  tot int;
begin
  if me is null then raise exception 'auth'; end if;
  if p_qkey is null or char_length(p_qkey) not between 1 and 80 then raise exception 'qkey'; end if;
  if p_cap is null or p_cap not between 2 and 128 then raise exception 'cap'; end if;   -- 배틀로얄 = 맵 최대 인원(75·100명)
  if p_wait is null or p_wait not between 5 and 300 then raise exception 'wait'; end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or octet_length(p_members::text) > 24000 then raise exception 'members'; end if;
  k := jsonb_array_length(p_members);
  if k < 1 or k > 4 or k > p_cap then raise exception 'members'; end if;
  -- v23 같은 대기열 키끼리는 한 번에 하나씩: 둘이 거의 같은 순간에 줄 서면 둘 다 아래에서 '열린 경기 없음'을 보고
  --  각자 새 경기를 열어 따로 AI 와 시작했다 → 키마다 잠그고(트랜잭션이 끝나면 풀림) 뒤에 온 사람은 앞사람이 연 경기에 들어간다
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_qkey));
  -- 내 예전 줄은 지우고 새로 선다
  delete from public.mm_tickets where owner = me;
  -- 정리: 연결이 끊긴 줄(열린 경기) · 사람이 없는 열린 경기 · 30분 지난 경기
  delete from public.mm_tickets t using public.mm_matches m
   where t.match_id = m.id and m.closed_at is null and t.seen_at < now() - interval '15 seconds';
  delete from public.mm_matches m
   where m.closed_at is null and m.created_at < now() - interval '5 seconds'
     and not exists (select 1 from public.mm_tickets t where t.match_id = m.id);
  delete from public.mm_matches where created_at < now() - interval '30 minutes';
  -- 들어갈 경기: 잠근 뒤 인원을 다시 세어 넘치지 않게 (동시에 줄 서도 cap 을 넘지 않음)
  for cand in
    select m.id from public.mm_matches m
     where m.qkey = p_qkey and m.cap = p_cap and m.closed_at is null
       and now() < m.created_at + make_interval(secs => m.wait_s) - interval '3 seconds'
     order by m.created_at
     limit 5
  loop
    perform 1 from public.mm_matches where id = cand and closed_at is null for update;
    if found then
      select coalesce(sum(n), 0) into tot from public.mm_tickets where match_id = cand;
      if tot + k <= p_cap then mid := cand; exit; end if;
    end if;
  end loop;
  if mid is null then
    insert into public.mm_matches (qkey, cap, wait_s) values (p_qkey, p_cap, p_wait) returning id into mid;
  end if;
  insert into public.mm_tickets (owner, match_id, n, members) values (me, mid, k, p_members) returning id into tid;
  select coalesce(sum(n), 0) into tot from public.mm_tickets where match_id = mid;
  if tot >= p_cap then
    update public.mm_matches
       set closed_at = now(), host = (select owner from public.mm_tickets where match_id = mid order by created_at, id limit 1)
     where id = mid and closed_at is null;
  end if;
  return public.mm_state(mid, tid);
end; $$;

-- 확인 (2초마다): 내 줄이 살아 있다고 알리고, 마감할 때가 되면 마감 · 방장이 사라졌으면 다음 사람이 방장
create or replace function public.mm_poll(p_ticket uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me  uuid := auth.uid();
  mid uuid;
  m   public.mm_matches;
  tot int;
begin
  if me is null then raise exception 'auth'; end if;
  select match_id into mid from public.mm_tickets where id = p_ticket and owner = me;
  if mid is null then return jsonb_build_object('gone', true); end if;
  update public.mm_tickets set seen_at = now() where id = p_ticket;
  select * into m from public.mm_matches where id = mid for update;
  if m.closed_at is null then
    delete from public.mm_tickets where match_id = mid and seen_at < now() - interval '15 seconds';
    select coalesce(sum(n), 0) into tot from public.mm_tickets where match_id = mid;
    if tot >= m.cap or now() >= m.created_at + make_interval(secs => m.wait_s) then
      update public.mm_matches
         set closed_at = now(), host = (select owner from public.mm_tickets where match_id = mid order by created_at, id limit 1)
       where id = mid;
    end if;
  elsif m.cfg is null and m.closed_at < now() - interval '12 seconds' then
    delete from public.mm_tickets where match_id = mid and seen_at < now() - interval '10 seconds';
    update public.mm_matches
       set closed_at = now(), host = (select owner from public.mm_tickets where match_id = mid order by created_at, id limit 1)
     where id = mid;
  end if;
  return public.mm_state(mid, p_ticket);
end; $$;

-- 방장이 경기 설정을 올림 (마감된 경기 · 방장 본인 · 한 번만)
create or replace function public.mm_cfg(p_match uuid, p_cfg jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'auth'; end if;
  if p_cfg is null or octet_length(p_cfg::text) > 200000 then return 'size'; end if;
  update public.mm_matches set cfg = p_cfg where id = p_match and host = me and closed_at is not null and cfg is null;
  if not found then return 'no'; end if;
  return 'ok';
end; $$;

-- 매칭 취소: 내 줄을 지운다
create or replace function public.mm_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.mm_tickets where owner = auth.uid();
$$;

revoke execute on function public.mm_state(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mm_join(text, int, int, jsonb) from public, anon;
revoke execute on function public.mm_poll(uuid) from public, anon;
revoke execute on function public.mm_cfg(uuid, jsonb) from public, anon;
revoke execute on function public.mm_leave() from public, anon;
grant execute on function public.mm_join(text, int, int, jsonb) to authenticated;
grant execute on function public.mm_poll(uuid) to authenticated;
grant execute on function public.mm_cfg(uuid, jsonb) to authenticated;
grant execute on function public.mm_leave() to authenticated;
