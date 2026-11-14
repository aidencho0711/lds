-- ============================================================
-- Last Drop Royale — 랭킹 (v20, Supabase SQL Editor에서 한 번 실행)
--  · rank_boards(): 레벨 · 랭크 티어 · 하드코어 티어 세 랭킹의 1~15위와 내 순위를 한 번에 돌려준다
--  · 순위는 저장된 기록(player_data)으로 부를 때마다 새로 계산한다 → 기록이 바뀌면 순위도 바로 바뀐다
--    1위 칭호·테두리는 게임이 이 결과로 판정하므로, 1위를 빼앗기면 이전 1위 계정에서 칭호·테두리가 회수된다
--  · 기준: 레벨 = 경험치(stats.xp) · 랭크 티어 = 배치고사를 마친 계정의 RP(rank.rp) · 하드코어 = 한 판 이상 한 계정의 RP(rank.hc.rp)
--    점수가 같으면 먼저 가입한 계정이 앞
--  · 관리자(개발자) 계정은 개발자 도구로 기록을 바꿀 수 있으므로 랭킹에서 뺀다
--  · 다른 사람의 계정 고유번호는 돌려주지 않는다 (아이디 · 순위 · 경험치/RP · 사진·테두리·칭호만)
--  · 기록 값이 숫자가 아니어도(잘못 저장된 기록) 함수가 멈추지 않게 숫자만 읽는다
--  · schema.sql (· admin.sql) 다음에 실행. 여러 번 실행해도 안전
-- ============================================================

create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

-- jsonb 값이 숫자일 때만 숫자로, 아니면 0
create or replace function public.jnum(v jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else 0 end;
$$;

create or replace function public.rank_boards() returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare
  me  uuid := auth.uid();
  res jsonb := '{}'::jsonb;
  k   text;
  b   jsonb;
begin
  if me is null then return null; end if;
  foreach k in array array['lv', 'tier', 'hc'] loop
    with base as (
      select d.user_id, p.username, p.created_at,
        public.jnum(d.stats -> 'xp') as xp,
        public.jnum(d.rank -> 'rp') as rp,
        public.jnum(d.rank -> 'placed') as placed,
        public.jnum(d.rank -> 'hc' -> 'rp') as hrp,
        public.jnum(d.rank -> 'hc' -> 'games') as hgames,
        case when jsonb_typeof(d.stats -> 'prof') = 'object' then d.stats -> 'prof' else '{}'::jsonb end as prof
      from public.player_data d
      join public.profiles p on p.id = d.user_id
      where not exists (select 1 from public.admins a where a.id = d.user_id)
    ), pick as (
      select bs.*, case k when 'lv' then bs.xp when 'tier' then bs.rp else bs.hrp end as score
      from base bs
      where case k when 'lv' then bs.xp > 0 when 'tier' then bs.placed >= 3 else bs.hgames > 0 end
    ), ranked as (
      select pk.*, row_number() over (order by pk.score desc, pk.created_at asc, pk.username asc) as pos, count(*) over () as n
      from pick pk
    ), rowset as (
      select r.pos, r.n, r.user_id = me as mine,
        jsonb_build_object('pos', r.pos, 'name', r.username, 'me', r.user_id = me, 'xp', floor(r.xp), 'rp', floor(r.rp), 'hrp', floor(r.hrp),
          'av', left(coalesce(r.prof ->> 'av', ''), 24), 'fr', left(coalesce(r.prof ->> 'fr', ''), 24), 'ti', left(coalesce(r.prof ->> 'ti', ''), 24)) as j
      from ranked r
    )
    select jsonb_build_object(
        'n', coalesce(max(rw.n), 0),
        'top', coalesce(jsonb_agg(rw.j order by rw.pos) filter (where rw.pos <= 15), '[]'::jsonb),
        'mine', (jsonb_agg(rw.j) filter (where rw.mine)) -> 0)
      into b
      from rowset rw;
    res := res || jsonb_build_object(k, b);
  end loop;
  return res || jsonb_build_object('admin', exists (select 1 from public.admins a where a.id = me));
end; $$;

revoke execute on function public.rank_boards() from public, anon;
grant execute on function public.rank_boards() to authenticated;
