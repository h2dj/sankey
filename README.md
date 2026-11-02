# 생키 메이커 (가칭)

데이터 입력만으로 생키(Sankey) 다이어그램을 만들고 PNG·SVG·CSV로 내려받는 브라우저 도구입니다.
로그인 없이 쓰며, 입력한 데이터는 서버로 전송하지 않습니다.

- 개발 계획: [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)
- 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)
- 배포 안내: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 사용성 테스트 대본: [docs/USABILITY_TEST.md](docs/USABILITY_TEST.md) — 주소 끝에 `?observe=1`을 붙이면 진행자용 관찰 모드(내용 없이 과제 시간·오류·내려받기만 기록)

## 개발

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev        # 개발 서버
npm run check      # lint + 타입 검사 + 단위 테스트
npm run build      # 정적 파일을 dist/에 생성
npm run test:e2e   # Playwright E2E (빌드 후 미리보기 서버에서 실행)
npm run perf       # 행 수별 계산 시간 측정(결과는 docs/DECISIONS.md)
npm run fonts:manifest  # Pretendard 버전을 올렸을 때 글꼴 범위 목록 다시 만들기
```

처음 E2E를 실행할 때는 `npx playwright install chromium`으로 브라우저를 설치합니다.

`npm run dev`·`npm run build` 전에 Pretendard 글꼴 파일이 `public/fonts/`로 자동 복사됩니다(저장소에는 넣지 않음).

## 구조

```
src/core/    순수 함수(검증·그래프·레이아웃·CSV). React·DOM 의존 금지(ESLint로 강제)
src/i18n/    화면 문자열
src/state/   편집 상태(zustand), 실행 취소·다시 실행
src/ui/      화면 컴포넌트(표, 오류 요약, 미리보기, 설정, 가져오기·내려받기 창)
src/export/  PNG 변환·글꼴 포함·파일 내려받기(브라우저 전용)
src/fonts/   Pretendard 분할 글꼴 목록과 등록
tests/e2e/   Playwright 시나리오
tests/fixtures/csv/  CSV 가져오기 테스트 파일(UTF-8, EUC-KR, UTF-16, 오류 파일 등)
```

## 글꼴 라이선스

Pretendard © Kil Hyung-jin, SIL Open Font License 1.1. 빌드 시 `public/fonts/LICENSE-Pretendard.txt`로 함께 배포됩니다.
