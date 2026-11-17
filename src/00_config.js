// ============================================================
// 00_config.js — 서버(Supabase) 연결 정보
//  url: 프로젝트 URL (https://xxxx.supabase.co)
//  key: 공개용 키 (Publishable key 'sb_publishable_…' 또는 예전 anon public key)
//       브라우저에 공개되는 키라 소스에 있어도 된다 — 데이터 보호는 DB의 RLS 규칙이 맡는다
//  비워 두면 로그인 기능이 숨겨지고 지금처럼 이 기기에만 저장된다
// ============================================================
const CLOUD_CFG = {
  url: 'https://lkfikvavalrkznjzvepd.supabase.co',
  key: 'sb_publishable_JimXC4Sz5WgRsJjm1tdO6A_v_SOZFnE',
  // 아이디 → 내부용 이메일 주소의 도메인. 한 번 정하면 바꾸지 말 것(바꾸면 기존 계정으로 로그인할 수 없다)
  idDomain: 'lds-training.vercel.app',
  sdk: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
};
// 개발자 계정은 서버의 관리자 목록(supabase/admin.sql 의 public.admins, 계정 고유번호)으로 정한다 (v21) — 아이디를 바꿔도 그대로
//  아래 아이디는 서버에 admin.sql 을 아직 실행하지 않았을 때만 쓰는 예비 값(소문자로 비교)
const DEV_IDS = ['개발자'];
