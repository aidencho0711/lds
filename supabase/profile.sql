-- ============================================================
-- Last Drop Royale — 아이디 변경 (v20, Supabase SQL Editor에서 한 번 실행)
--  · 게임의 '계정 정보 → 계정 → 아이디 변경'이 부르는 함수
--  · 3일에 한 번만 (profiles.name_changed_at 으로 서버에서 막음)
--  · 표시 이름(profiles.username)과 로그인 아이디(내부 이메일 u<16진수>@도메인)를 같이 바꾼다
--    → 다음 로그인부터 새 아이디 + 기존 비밀번호. 지금 로그인된 기기는 그대로 유지
--  · schema.sql · social.sql 을 먼저 실행한 뒤 실행. 여러 번 실행해도 안전 (if not exists / or replace)
-- ============================================================

alter table public.profiles add column if not exists name_changed_at timestamptz;

-- 반환: 'ok' · 'invalid'(형식) · 'taken'(이미 있음) · 'wait:<유닉스초>'(이 시각부터 가능) · 'auth'(로그인 필요)
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
  select name_changed_at into last from public.profiles where id = me;
  if last is not null and last > now() - interval '3 days' then
    return 'wait:' || floor(extract(epoch from last + interval '3 days'))::bigint;
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(nm) and id <> me) then return 'taken'; end if;
  -- 게임과 같은 규칙으로 내부 이메일을 만든다: 'u' + 소문자 아이디의 UTF-8 16진수 + '@' + 기존 도메인
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

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;
