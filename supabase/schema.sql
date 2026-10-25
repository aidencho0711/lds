-- ============================================================
-- Last Drop Royale — 계정·기록 저장 (Supabase SQL Editor에서 한 번 실행)
--  · 아이디+비밀번호 로그인: 게임이 아이디를 내부용 이메일(u<16진수>@lds-training.vercel.app)로 바꿔
--    Supabase Auth에 가입시킨다. 실제로 메일이 오가지는 않는다.
--  · profiles   : 아이디(게임 속 이름). 대소문자만 다른 아이디는 같은 것으로 본다
--  · player_data: 전적·랭크·설정(JSON). 본인 행만 읽고 쓸 수 있다(RLS)
--  여러 번 실행해도 안전하다 (if not exists / or replace)
-- ============================================================

-- 1) 프로필 (아이디)
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (char_length(username) between 2 and 12),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- 2) 게임 기록
create table if not exists public.player_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  stats      jsonb,
  rank       jsonb,
  settings   jsonb,
  updated_at timestamptz not null default now()
);

-- 3) 보안 규칙: 로그인한 본인 것만
alter table public.profiles    enable row level security;
alter table public.player_data enable row level security;

drop policy if exists "profiles: read own"  on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "player_data: read own"   on public.player_data;
drop policy if exists "player_data: insert own" on public.player_data;
drop policy if exists "player_data: update own" on public.player_data;
create policy "player_data: read own" on public.player_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "player_data: insert own" on public.player_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "player_data: update own" on public.player_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 저장 시각은 서버 시계로
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists player_data_touch on public.player_data;
create trigger player_data_touch before insert or update on public.player_data
  for each row execute function public.touch_updated_at();

-- 4) 가입하면 프로필·기록 행을 자동 생성 (가입 때 넘긴 username 사용)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'player_' || left(new.id::text, 6)));
  insert into public.player_data (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- (관리자용) 비밀번호를 잊은 사람의 비밀번호 초기화 — 필요할 때만 아래 두 줄을 고쳐서 실행
--   update auth.users set encrypted_password = extensions.crypt('새비밀번호', extensions.gen_salt('bf'))
--   where id = (select id from public.profiles where lower(username) = lower('아이디'));
-- ------------------------------------------------------------
