# 🏠 HomeCare 셋업 가이드

세정님이 직접 따라하실 단계별 가이드예요. 순서대로 진행해주세요.

---

## 1단계. 데이터베이스 테이블 만들기 (꼭 먼저!)

1. Supabase 대시보드 접속: https://supabase.com/dashboard
2. `junlsoooxfsqvuejdldu` 프로젝트 선택 (모임록과 같은 곳)
3. 왼쪽 메뉴에서 **SQL Editor** 클릭 → **+ New query**
4. 이 폴더의 [`SETUP.sql`](SETUP.sql) 파일 내용을 복사해서 붙여넣기
5. 오른쪽 위 **Run** 버튼 클릭

✅ 성공 메시지 나오면 완료. `homecare_tasks`, `homecare_history`, `homecare_push_subscriptions` 세 개 테이블이 생겨요.

---

## 2단계. 로컬에서 한번 테스트해보기

1. 터미널에서:
   ```bash
   cd "/Users/shindaecheon/Desktop/세정이공간/클로드 심장/HomeCare"
   python3 -m http.server 8400
   ```
2. 브라우저에서 http://localhost:8400 접속
3. 항목 추가해보고, 완료 버튼 눌러 포인트 받아보고, 탭 전환 확인

이 단계에서는 **푸시 알림은 안 됩니다** (HTTPS 필요). 화면 동작만 확인.

---

## 3단계. GitHub + Vercel 배포

1. GitHub에서 새 저장소 생성 (이름 예: `homecare`)
2. 터미널:
   ```bash
   cd "/Users/shindaecheon/Desktop/세정이공간/클로드 심장/HomeCare"
   git init
   git add .
   git commit -m "init: HomeCare PWA"
   git branch -M main
   git remote add origin https://github.com/maru-nuna/homecare.git
   git push -u origin main
   ```
3. https://vercel.com 접속 → **Add New Project** → GitHub repo 선택 → Deploy
4. 배포 완료되면 `https://homecare.vercel.app` 같은 URL 발급
5. 폰 Safari/Chrome에서 그 URL 접속 → **공유 → 홈 화면에 추가**

---

## 4단계. 푸시 알림 켜기 (선택, 좀 어려움)

푸시 알림은 추가 설정이 필요해요. 안 해도 PWA는 잘 동작하고, 화면 안의 빨간점으로 임박 확인 가능.

### 4-1. VAPID 키 생성
터미널:
```bash
npx web-push generate-vapid-keys
```
→ `Public Key`와 `Private Key`가 출력됨. 둘 다 메모.

### 4-2. config.js에 공개키 입력
[`config.js`](config.js) 파일 열기 → `VAPID_PUBLIC_KEY = ""` 안에 위 Public Key 붙여넣기 → 저장 → GitHub 푸시

### 4-3. Supabase Edge Function 배포
```bash
# Supabase CLI 설치 (한 번만)
brew install supabase/tap/supabase

# 프로젝트 로그인
supabase login
supabase link --project-ref junlsoooxfsqvuejdldu

# 함수 폴더 준비
mkdir -p supabase/functions/notify-due
cp edge-function/notify-due.ts supabase/functions/notify-due/index.ts

# 환경변수 설정 (Supabase 대시보드 → Edge Functions → Settings)
# VAPID_PUBLIC_KEY = 위에서 생성한 Public Key
# VAPID_PRIVATE_KEY = 위에서 생성한 Private Key
# VAPID_SUBJECT = mailto:shindaecheon89@gmail.com

# 함수 배포
supabase functions deploy notify-due
```

### 4-4. 매일 자동 실행 설정 (Cron)
Supabase 대시보드 → **Database → Cron Jobs → Create a new cron job**:
- Name: `homecare-daily-notify`
- Schedule: `0 0 * * *` (UTC 0시 = KST 9시)
- Type: HTTP Request
- URL: `https://junlsoooxfsqvuejdldu.supabase.co/functions/v1/notify-due`
- Method: POST
- Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

### 4-5. 앱에서 알림 켜기
배포된 URL을 홈화면에 추가한 후, 앱 우측 상단 🔔 → **알림 켜기** 버튼 누르기.

---

## 🛠 트러블슈팅

- **카드가 안 보임 / 빈 화면**: 1단계 SQL 실행했는지 확인. 브라우저 콘솔(F12)에서 에러 메시지 확인.
- **푸시 알림 안 옴**: iOS는 홈화면 설치한 아이콘으로 열어야 함. Safari에서 그냥 열면 안 됨.
- **레벨 표시 이상**: 새로고침. `homecare_history` 테이블에 데이터가 잘 들어가는지 확인.

---

## 📂 파일 설명

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 화면 (탭, 카드 리스트, 모달) |
| `style.css` | 전체 스타일 |
| `script.js` | Supabase 연동 + 모든 동작 |
| `config.js` | Supabase URL/키 + VAPID 공개키 |
| `manifest.json` | PWA 설치 정보 |
| `service-worker.js` | 오프라인 + 푸시 수신 |
| `icon-192.png`, `icon-512.png` | 홈화면 아이콘 |
| `SETUP.sql` | DB 테이블 생성 SQL |
| `edge-function/notify-due.ts` | 매일 푸시 발송 함수 |
| `PROJECT.md` | 프로젝트 구조 상세 문서 |
