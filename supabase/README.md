# Supabase DB 적용 방법

## 빈 Supabase 프로젝트

`schema.sql` 하나를 SQL Editor에서 실행한다. 이 파일이 dailyOS의 현재 전체 DB 정의다.

다음 항목이 모두 생성된다.

- 프로젝트에서 사용하는 모든 public 테이블과 컬럼
- 인덱스와 제약 조건
- `updated_at` 및 신규 사용자 프로필 트리거
- Row Level Security 정책
- `life-media` Storage 버킷과 접근 정책
- PostgREST 스키마 캐시 갱신

빈 DB에 `migrations` 폴더만 실행하지 않는다. 초기 테이블을 만드는 베이스라인 마이그레이션이 아니라 기존 운영 DB를 업데이트하기 위한 변경분이기 때문이다.

## 기존 dailyOS DB

이미 `schema.sql`의 이전 버전을 적용한 DB라면 아직 적용하지 않은 `migrations` 파일을 파일명 순서대로 실행한다. 각 파일은 다시 실행해도 안전하도록 `if exists`, `if not exists` 또는 충돌 방지 조건을 사용한다.

2026-09-24 장소 체계 업데이트에 필요한 순서는 다음과 같다.

1. `20260924_add_place_verifications.sql`
2. `20260924_refine_place_identity.sql`
3. `20260924_complete_schema_permissions.sql`
4. `20260924_cascade_linked_expenses.sql`

`calendar_events.place_provider_name`, `tasks.place_provider_name`, `life_activities.place_latitude` 오류는 두 번째 파일이 적용되지 않았다는 뜻이다.

## `schema.sql` 안의 반복 정의

일부 컬럼은 `create table if not exists`와 뒤의 `alter table ... add column if not exists`에 모두 나타난다. 이는 실수로 같은 컬럼을 두 번 생성하는 코드가 아니다.

- 빈 DB에서는 `create table`이 최신 컬럼을 즉시 만든다.
- 예전 테이블이 이미 있으면 `create table if not exists`는 내부 컬럼을 바꾸지 않으므로 뒤의 `alter table`이 누락 컬럼을 추가한다.
- `if not exists` 때문에 최신 DB에서 다시 실행해도 중복 컬럼 오류가 발생하지 않는다.

즉 `schema.sql`은 빈 DB 초기화와 오래된 수동 설치 DB의 보정 모두를 지원하기 위해 의도적으로 멱등성을 유지한다.
