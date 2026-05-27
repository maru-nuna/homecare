// Supabase 연결 정보 (모임록과 동일 프로젝트, 테이블만 별도)
window.SUPABASE_CONFIG = {
  url: "https://junlsoooxfsqvuejdldu.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bmxzb29veGZzcXZ1ZWpkbGR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTU0ODMsImV4cCI6MjA5Mzc3MTQ4M30.3baapEr8SvVwMXdMGkNKxI-Njdj2I32Oy1aeKcSEl_4"
};

// VAPID 공개키 (푸시 알림용) — Edge Function 설정 후 여기에 붙여넣기
window.VAPID_PUBLIC_KEY = "";
