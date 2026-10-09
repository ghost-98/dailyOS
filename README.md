# dailyOS

개인의 하루, 장소, 소비, 사진, 건강, 사람 데이터를 한곳에 쌓고 다시 꺼내 쓰기 위한 개인 Life Database OS입니다.

## 핵심 가치

- **기록 입력**: 활동, 할 일·이벤트, 하루기록, 사진, 건강, 수입을 날짜와 맥락에 연결합니다.
- **하루 복원**: 하루 화면에서 그날의 행동, 계획, 장소, 사람, 사진, 소비, 건강을 한 장으로 봅니다.
- **회고와 검색**: 키워드와 기간으로 쌓인 기록을 다시 찾습니다.
- **개인 운영**: 가계부, 장소 보관함, 사람 관리를 라이프 DB와 느슨하게 연결합니다.

## 주요 화면

- `/` 시작점: `/m/day`로 리다이렉트
- `/m/day`: 날짜 기반 하루 타임라인과 상세 패널
- `/m/record`: 활동, 할 일·이벤트, 기록, 건강, 사진, 수입 입력과 수정
- `/m/search`: 키워드 검색과 기록 대화 UI (대화 기능 비활성)
- `/m/other`: 사람, 가계부, 지도, 사진 묶음 조회
- `/m/settings`: 계정, 알림, 백업, 데이터 관리

## 개발 명령

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만들고 Supabase, Naver Maps/Search 키를 입력합니다.
기록 대화는 UI만 유지하며 모델 호출, 임베딩, 메모리 동기화를 실행하지 않습니다.

## 문서

- `docs/architecture.md`: 현재 코드/데이터 구조와 관리 기준
- `docs/product-map.md`: 상품 가치, 정보 구조, UI 원칙
- `docs/maintenance.md`: 모듈 책임, 정리 범위와 유지보수 점검
- `docs/remove-local-models.md`: 라즈베리파이의 로컬 모델 및 메모리 DB 정리 절차
- `docs/raspberry-pi-deploy.md`: 라즈베리파이 배포 순서
- `docs/dailyos-ui-design.md`: UI 디자인 방향
