-- ============================================================
-- Last Drop Royale — 같이 하기 기기 키 등록 (v24.3 설계안 · 아직 실행하지 않음 · 게임도 아직 쓰지 않음)
--  v24.3 기기 키(10_net.js '기기 키 · 봉투')는 서버가 주인을 보증하는 곳에 공개 키가 있어야 믿을 수 있다:
--   혼자 줄 선 온라인 매칭은 줄 표(mm_join — 서버가 줄 주인 owner 를 적음)로 되지만, 파티 경기와 파티째 매칭의 파티원은
--   파티장·파티원끼리 채널로만 키를 주고받으므로 누구나 남의 키라고 꾸밀 수 있다
--  → 기기마다 자기 공개 키를 이 표에 올리고(net_key_add — 서버가 auth.uid() 를 적음), 경기 설정을 만드는 사람(파티장 · 매칭 방장)은
--    파티원이 알려 준 키가 정말 그 사람 것인지 확인(net_key_check)한 것만 cfg.ek 에 넣는다 · 받는 기기도 같은 함수로 cfg.ek 를 다시 확인할 수 있다
--  · 공개 키는 비밀이 아니다 — 로그인한 사람은 누구나 확인할 수 있다 (이 사람이 이 키를 올렸는가?) · 쓰는 것은 자기 것만
--  · 한 사람당 최근 20개 · 2일 지난 키는 지운다 (경기 이어하기는 35분까지라 넉넉함)
--  · 정책 없는 RLS — 읽기·쓰기는 아래 함수로만 · 여러 번 실행해도 안전 (있는 것은 지우지 않음 — 함수 안의 delete 는 오래된 키 정리)
--  · 함수 본문에 delete 가 있어 SQL Editor 가 'Potential issue detected' 를 띄운다 → 그 확인은 대시보드에서 직접 눌러야 할 수 있다
-- ============================================================

create table if not exists public.net_keys (
  uid        uuid not null references auth.users (id) on delete cascade,
  ek         text not null,                        -- P-256 공개 키(0x04 + x + y, 65바이트)의 base64 (88자)
  created_at timestamptz not null default now(),
  primary key (uid, ek)
);
create index if not exists net_keys_created_idx on public.net_keys (created_at);
alter table public.net_keys enable row level security;

-- 내 기기 키 올리기 (페이지마다 한 번 · 같은 키를 다시 올려도 됨)
create or replace function public.net_key_add(p_ek text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'auth'; end if;
  if p_ek is null or p_ek !~ '^B[A-Za-z0-9+/]{86}=$' then return 'ek'; end if;
  delete from public.net_keys where created_at < now() - interval '2 days';
  insert into public.net_keys (uid, ek) values (me, p_ek) on conflict do nothing;
  delete from public.net_keys k
   where k.uid = me and k.ek not in (select x.ek from public.net_keys x where x.uid = me order by x.created_at desc limit 20);
  return 'ok';
end; $$;

-- 키 확인: p_list = [[uid, ek], ...] (128개까지) → 그 사람이 그 키를 올린 짝의 uid 목록
create or replace function public.net_key_check(p_list jsonb) returns jsonb
language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(e->>0), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_list) = 'array' and jsonb_array_length(p_list) <= 128 then p_list else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'array'
     and exists (select 1 from public.net_keys k where k.uid::text = e->>0 and k.ek = e->>1 and k.created_at > now() - interval '2 days');
$$;

revoke execute on function public.net_key_add(text) from public, anon;
revoke execute on function public.net_key_check(jsonb) from public, anon;
grant execute on function public.net_key_add(text) to authenticated;
grant execute on function public.net_key_check(jsonb) to authenticated;
