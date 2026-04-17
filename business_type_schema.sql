-- ================================================================
-- 비즈니스 타입 구분 + 판매처 관리 스키마
-- Supabase SQL Editor에서 실행하세요
-- ================================================================

-- 1. products에 business_type 추가
alter table products
  add column if not exists business_type text not null default 'market'
  check (business_type in ('market', 'academy'));

-- 기존 품목 전부 오픈마켓으로 설정
update products set business_type = 'market' where business_type is null;

-- 2. 판매처(채널) 동적 관리 테이블
create table if not exists channels (
  id            serial primary key,
  key           text not null unique,
  label         text not null,
  color         text not null default '#888888',
  business_type text not null default 'market'
                check (business_type in ('market', 'academy', 'both')),
  sort_order    integer default 0,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table channels enable row level security;
create policy "anon_all" on channels for all to anon using (true) with check (true);
create policy "auth_all" on channels for all to authenticated using (true) with check (true);

-- 기본 채널 데이터 삽입 (오픈마켓)
insert into channels (key, label, color, business_type, sort_order) values
  ('naver',    '네이버',     '#03C75A', 'market', 1),
  ('coupang',  '쿠팡',       '#E8232A', 'market', 2),
  ('esm',      'G마켓/옥션', '#0032A0', 'market', 3),
  ('elevenst', '11번가',     '#e5001d', 'market', 4),
  ('cafe24',   '카페24',     '#0040FF', 'market', 5),
  ('toss',     'Toss',       '#3182F6', 'market', 6),
  ('easy',     '이지판매',   '#7C3AED', 'market', 7)
on conflict (key) do nothing;

-- RLS 정책 추가 (authenticated 사용자용)
create policy "auth_all_products_btype" on products
  for all to authenticated using (true) with check (true);
