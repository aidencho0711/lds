-- ============================================================
-- Last Drop Royale — 친구 관전 권한 (v22 · Supabase SQL Editor 에서 한 번 실행 · 여러 번 실행해도 안전)
--  · 관전할 수 있는 사람: 친구(수락됨) 또는 관리자(admin.sql 의 public.admins) — schema.sql · social.sql · admin.sql 다음에 실행
--  · 흐름 (src/10_watch.js)
--    1) 보는 사람이 spec_ask(상대, 1회용 공개 키) → 친구·관리자인지 확인하고 '관전표'를 남긴다 (보는 사람 × 상대마다 하나, 다시 부르면 덮어씀)
--    2) 실시간 로비 채널로 상대에게 '보고 싶다'고 알림 (채널의 보낸 사람 이름은 꾸밀 수 있으므로 믿지 않는다)
--    3) 경기 중인 상대가 spec_check(보는 사람) → 2분 안에 그 사람이 '나를 보려고' 만든 표가 있으면 이름·관리자 여부·공개 키를 받는다
--    4) 상대는 그 공개 키로만 풀 수 있게 연결 정보(WebRTC offer)를 잠가 보낸다 → 표를 만든 바로 그 기기만 화면을 받는다
--       (연결 정보에 들어 있는 IP 주소도 로비 채널의 다른 사람에게는 보이지 않음)
--  · 표 테이블은 RLS 를 켜고 정책을 두지 않는다 → 아래 함수로만 쓰고 읽는다
--  · 지우는 문장이 없다 (표는 덮어쓰고 2분이 지나면 쓰지 않음) → SQL Editor 의 위험 경고 창이 뜨지 않음
-- ============================================================

create table if not exists public.spec_tickets (
  viewer   uuid not null references auth.users (id) on delete cascade,   -- 보는 사람
  target   uuid not null references auth.users (id) on delete cascade,   -- 경기 중인 사람
  pk       text not null check (length(pk) between 40 and 200),          -- 보는 기기의 1회용 공개 키 (ECDH P-256, base64)
  admin    boolean not null default false,                               -- 관리자가 본다 (친구가 아니어도 됨)
  asked_at timestamptz not null default now(),
  primary key (viewer, target)
);
alter table public.spec_tickets enable row level security;

-- 관전 요청 (보는 사람이 부름) → { admin } · 안 되면 예외: 'auth'(로그인 안 함) · 'self' · 'pk' · 'deny'(친구도 관리자도 아님)
create or replace function public.spec_ask(p_target uuid, p_pk text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  adm boolean;
begin
  if me is null then raise exception 'auth'; end if;
  if p_target is null or p_target = me then raise exception 'self'; end if;
  if p_pk is null or length(p_pk) not between 40 and 200 then raise exception 'pk'; end if;
  adm := exists (select 1 from public.admins a where a.id = me);
  if not adm and not exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and ((f.a = me and f.b = p_target) or (f.a = p_target and f.b = me))
  ) then raise exception 'deny'; end if;
  insert into public.spec_tickets (viewer, target, pk, admin, asked_at) values (me, p_target, p_pk, adm, now())
    on conflict (viewer, target) do update set pk = excluded.pk, admin = excluded.admin, asked_at = excluded.asked_at;
  return jsonb_build_object('admin', adm);
end; $$;

-- 관전 확인 (경기 중인 사람이 부름): 2분 안에 그 사람이 나를 보려고 만든 표 → { name, admin, pk } · 없으면 null
create or replace function public.spec_check(p_viewer uuid) returns jsonb
language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('name', p.username, 'admin', t.admin, 'pk', t.pk)
  from public.spec_tickets t
  join public.profiles p on p.id = t.viewer
  where t.viewer = p_viewer and t.target = (select auth.uid()) and t.asked_at > now() - interval '2 minutes';
$$;

grant execute on function public.spec_ask(uuid, text) to authenticated;
grant execute on function public.spec_check(uuid) to authenticated;
