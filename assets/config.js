/* ══════════════════════════════════════════════════════════════
   루앤루 · config.js — 동기화 설정 (선택)

   비워 두면 동기화가 꺼지고, 앱은 지금까지처럼 브라우저 로컬에만
   저장합니다(오프라인 완전 동작). 값을 채우면 기기 간 동기화가 켜집니다.

   ⚠ anon key는 공개되어도 되는 값입니다. 실제 보호는 Supabase의
     RLS(Row Level Security)가 합니다 — 로그인한 본인 행 외에는
     읽기·쓰기가 모두 차단됩니다. 서비스 롤 키(service_role)는
     절대 이 파일에 넣지 마세요.
   ══════════════════════════════════════════════════════════════ */
window.LUANLU_CONFIG = {
  SUPABASE_URL: '',       // 예: https://abcdefghijk.supabase.co
  SUPABASE_ANON_KEY: ''   // 예: eyJhbGciOi...  (anon / public 키)
};
