# 🛡️ 홈 프로텍터 프로젝트

우리집을 지키는 청소·교체 주기 매니저. 임박하면 푸시 알림으로 알려주고, 게이미피케이션(포인트/레벨)으로 살림 동기부여까지.

> 폴더/repo/URL은 `homecare`로 유지 (배포 안정성). 사용자에게 노출되는 이름만 "홈 프로텍터".

## 🌐 라이브 사이트

- **배포 URL:** https://homecare-kohl.vercel.app
- **GitHub 저장소:** https://github.com/maru-nuna/homecare
- **Supabase 프로젝트 URL:** https://junlsoooxfsqvuejdldu.supabase.co (모임록과 공유, 테이블만 별도)

## 🧱 기술 스택

- **프론트엔드:** 순수 HTML / CSS / JavaScript (프레임워크 X, 빌드 도구 X)
- **데이터베이스:** Supabase (Postgres + REST API)
- **호스팅:** Vercel (정적 사이트 배포, GitHub 자동 연동)
- **PWA:** Service Worker + Web App Manifest (오프라인 캐싱 + 홈화면 설치)
- **푸시 알림:** Web Push API + VAPID + Supabase Edge Function (Deno)
- **인증:** 없음 (anon key + RLS 정책으로 익명 read/write 허용)

## 📁 폴더 구조

```
HomeCare/
├── index.html             # 메인 (탭/카드 리스트/모달)
├── style.css              # 전체 스타일 (주황 톤)
├── script.js              # Supabase 연동 + 모든 동작 로직
├── config.js              # Supabase URL/anon key + VAPID 공개키
├── manifest.json          # PWA 설치 정보
├── service-worker.js      # 오프라인 캐싱 + 푸시 수신
├── icon-192.png           # 홈화면 아이콘 (192x192)
├── icon-512.png           # 홈화면 아이콘 (512x512)
├── SETUP.sql              # Supabase 테이블 생성 SQL (최초 1회 실행)
├── edge-function/
│   └── notify-due.ts      # 매일 푸시 발송하는 Supabase Edge Function
└── PROJECT.md             # 이 문서
```

## 🗄️ 데이터베이스 구조

모두 `homecare_` prefix 사용 (모임록과 같은 Supabase 프로젝트지만 테이블 분리).

### `homecare_tasks` — 청소·교체 항목 마스터

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK) | 고유번호 |
| `category` | text | 'cleaning' 또는 'replacement' |
| `name` | text | 항목명 |
| `cycle_days` | int | 주기 (일 단위) |
| `last_done_at` | date | 마지막 실행일 |
| `points` | int | 한 번 달성 시 받는 포인트 (기본 10) |
| `memo` | text | 메모 (선택) |
| `for_doyoung` | boolean | 도영이를 위한 항목 여부. true면 카드에 "👶 For 도영이" 뱃지 표시 |
| `is_recurring` | boolean | 주기 반복 여부 (기본 true). false면 완료 시 카드 비활성화 + 하단 정렬 |
| `created_at` | timestamptz | 등록 시각 |

### `homecare_history` — 실행 이력 (누적 포인트 계산용)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK) | 고유번호 |
| `task_id` | uuid (FK) | 항목 참조 (삭제 시 cascade) |
| `done_at` | date | 실행일 |
| `points_earned` | int | 획득 포인트 |
| `created_at` | timestamptz | 기록 시각 |

### `homecare_push_subscriptions` — 푸시 구독 정보 (기기별)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK) | 고유번호 |
| `endpoint` | text (unique) | 푸시 endpoint URL |
| `subscription` | jsonb | 전체 구독 객체 (keys 포함) |
| `created_at` | timestamptz | 구독 시각 |

RLS 켜져 있고, anon 역할에 모두 허용.

## 🎮 게이미피케이션

### 포인트
- 각 항목별로 완료 시 받을 포인트를 직접 설정 (기본 10P)
- 완료 버튼을 누르면 누적 포인트 증가

### 레벨
| 레벨 | 누적 P | 이름 |
|---|---|---|
| Lv.1 | 0 | 살림초보 |
| Lv.2 | 100 | 살림인 |
| Lv.3 | 300 | 살림마스터 |
| Lv.4 | 700 | 살림장인 |
| Lv.5 | 1500 | 살림신 |

레벨업 시 토스트로 축하 메시지 노출.

## 🚨 임박 표시 규칙

- **빨간점** (animated pulse): 기한 ≤ 3일 이내 (포함 오늘, 지남)
- **D-day 색상**:
  - 지남(overdue): 빨강 굵게
  - 오늘 / D-1~3 (urgent): 빨강
  - D-4~7 (soon): 주황
  - D-8 이상 (normal): 회색

## 🔔 푸시 알림

매일 아침 Supabase Edge Function이 자동 실행되어,
- `cycle_days` 기준 기한 3일 이내 항목이 1개 이상 있으면
- 등록된 모든 기기에 푸시 발송

**구독 정보**는 기기별로 `homecare_push_subscriptions`에 저장. 만료된 구독(404/410)은 자동 정리.

### iOS 제약
- iOS 16.4+ 필요
- Safari에서 공유 → "홈 화면에 추가" 후 그 아이콘으로 열어야 푸시 동작

## 🚀 셋업 순서

자세한 내용은 [README.md](README.md) 참고.

1. **DB 테이블 생성** — Supabase SQL Editor에서 `SETUP.sql` 실행
2. **VAPID 키 생성** — `npx web-push generate-vapid-keys`
3. **config.js**에 VAPID 공개키 입력
4. **Edge Function 배포** — `supabase functions deploy notify-due`
5. **환경변수 설정** — Supabase Dashboard에서 VAPID 키 등록
6. **Cron 등록** — Supabase Dashboard → Database → Cron Jobs
7. **GitHub 푸시 + Vercel 연결**

## 🎨 디자인 톤

- 주 색상: 주황 (#f97316) — 따뜻한 살림 느낌
- 배경: 아이보리 (#fef7f0)
- 카드 기반 UI, 둥근 모서리, 부드러운 그림자
- 모바일 우선 (최대 480px)

## 📝 변경 이력

- 2026-05-26: 최초 생성. PWA 본체 + 푸시 알림 인프라.
- 2026-05-26: `for_doyoung` 컬럼 추가. 도영이를 위한 항목에 "👶 For 도영이" 뱃지 표시.
- 2026-05-27: 표시 이름을 "HomeCare" → "🛡️ 홈 프로텍터"로 변경 (manifest, 헤더, 푸시 알림 등). 폴더/repo/URL은 유지.
- 2026-05-27: 빨간점 제거. D-day 라벨 좌측에 ⚠️ 아이콘으로 통합 (완료 버튼과의 위치 충돌 해소).
- 2026-05-27: 카드 임박 강조를 듀오링고 스타일로 변경 (overdue/urgent는 진한 빨강 배경 + 흰 텍스트, soon은 연한 주황). `is_recurring` 컬럼 추가하여 일회성 항목 지원. saveTask 안전망 (수정 시 last_done_at 보호). VAPID 공개키 등록.
