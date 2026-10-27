-- ============================================================
-- Last Drop Royale — 친구 (schema.sql 다음에 SQL Editor에서 한 번 실행)
--  · friendships: 요청한 사람(a) → 받은 사람(b), 상태 pending / accepted
--  · 읽기는 본인이 낀 행만(RLS). 쓰기는 아래 함수로만 → 남의 친구 관계를 만들거나 지울 수 없다
--  · 아이디로 사람 찾기는 friend_request 안에서만 (전체 아이디 목록은 노출하지 않음)
--  · 파티·초대·접속 표시는 DB가 아니라 Supabase Realtime(실시간 채널)을 쓴다 → 추가 설정 없음
--  여러 번 실행해도 안전하다
-- ============================================================

create table if not exists public.friendships (
  a          uuid not null references auth.users (id) on delete cascade,   -- 요청한 사람
  b          uuid not null references auth.users (id) on delete cascade,   -- 받은 사람
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create index if not exists friendships_b_idx on public.friendships (b);

alter table public.friendships enable row level security;
drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (a, b));

-- 친구 요청: 'sent' | 'accepted'(상대가 먼저 보냈던 요청을 수락) | 'pending'(이미 보냄) | 'already' | 'notfound' | 'self' | 'full' | 'auth'
create or replace function public.friend_request(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  st text;
  n int;
begin
  if me is null then return 'auth'; end if;
  select id into other from public.profiles where lower(username) = lower(btrim(p_name));
  if other is null then return 'notfound'; end if;
  if other = me then return 'self'; end if;
  select status into st from public.friendships where (a = me and b = other) or (a = other and b = me) limit 1;
  if st = 'accepted' then return 'already'; end if;
  if exists (select 1 from public.friendships where a = other and b = me and status = 'pending') then
    update public.friendships set status = 'accepted' where a = other and b = me;
    return 'accepted';
  end if;
  if st = 'pending' then return 'pending'; end if;
  select count(*) into n from public.friendships where a = me or b = me;
  if n >= 100 then return 'full'; end if;
  insert into public.friendships (a, b) values (me, other);
  return 'sent';
end; $$;

-- 받은 요청 수락(true) / 거절(false)
create or replace function public.friend_respond(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted' where a = p_other and b = auth.uid() and status = 'pending';
  else
    delete from public.friendships where a = p_other and b = auth.uid() and status = 'pending';
  end if;
end; $$;

-- 친구 삭제 / 보낸 요청 취소
create or replace function public.friend_remove(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships where (a = auth.uid() and b = p_other) or (a = p_other and b = auth.uid());
$$;

-- 내 친구 목록 (상대 아이디·상태·받은 요청 여부·경험치 → 레벨 표시용)
create or replace function public.friend_list()
returns table (id uuid, username text, status text, incoming boolean, xp integer)
language sql security definer set search_path = '' stable as $$
  select p.id, p.username, f.status, (f.b = auth.uid()) as incoming,
         coalesce(floor((d.stats ->> 'xp')::numeric), 0)::integer as xp
  from public.friendships f
  join public.profiles p on p.id = case when f.a = auth.uid() then f.b else f.a end
  left join public.player_data d on d.user_id = p.id
  where auth.uid() in (f.a, f.b)
  order by f.status, p.username;
$$;

revoke execute on function public.friend_request(text) from public, anon;
revoke execute on function public.friend_respond(uuid, boolean) from public, anon;
revoke execute on function public.friend_remove(uuid) from public, anon;
revoke execute on function public.friend_list() from public, anon;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_list() to authenticated;
