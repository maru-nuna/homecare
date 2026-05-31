-- HomeCare 테이블 생성 SQL
-- Supabase 대시보드 → SQL Editor에 붙여넣고 "Run" 실행

-- 1. 청소·교체 항목 마스터
create table if not exists homecare_tasks (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cleaning', 'replacement')),
  name text not null,
  cycle_days int not null check (cycle_days > 0),
  last_done_at date,
  points int not null default 10 check (points > 0),
  memo text,
  for_doyoung boolean not null default false,
  is_recurring boolean not null default true,
  created_at timestamptz not null default now()
);

-- (기존 테이블이 이미 있으면 아래 두 줄만 실행해도 됨)
alter table homecare_tasks
  add column if not exists for_doyoung boolean not null default false;

alter table homecare_tasks
  add column if not exists is_recurring boolean not null default true;

-- 2. 실행 이력 (누적 포인트 계산용)
create table if not exists homecare_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references homecare_tasks(id) on delete cascade,
  done_at date not null,
  points_earned int not null,
  created_at timestamptz not null default now()
);

-- 3. 푸시 구독 정보 (기기별)
create table if not exists homecare_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS 켜고 anon에 모두 허용 (개인 앱)
alter table homecare_tasks enable row level security;
alter table homecare_history enable row level security;
alter table homecare_push_subscriptions enable row level security;

drop policy if exists "anon all" on homecare_tasks;
create policy "anon all" on homecare_tasks for all to anon using (true) with check (true);

drop policy if exists "anon all" on homecare_history;
create policy "anon all" on homecare_history for all to anon using (true) with check (true);

drop policy if exists "anon all" on homecare_push_subscriptions;
create policy "anon all" on homecare_push_subscriptions for all to anon using (true) with check (true);
