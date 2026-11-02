# 생키 다이어그램 웹 도구 — MVP 개발 계획 v0.1

- 근거 문서: 「로그인 없이 시작하는 브라우저 기반 MVP 제작 기준안」(이하 기획서)
- 작성일: 2026-11-02
- 범위: 기획서 §2의 "MVP에 포함" 항목과 §7의 F-01~F-07. F-08(공유 링크)과 "후속 단계로 보류" 항목은 이 계획에서 제외한다.

---

## 1. 목표와 완료 기준

**목표**: 처음 방문한 사용자가 로그인 없이 샘플 또는 자기 데이터로 첫 생키 다이어그램을 만들고 PNG·SVG·CSV로 내려받는다.

**완료 기준**은 기획서 §14 MVP 수용 기준 8개를 그대로 쓴다. 각 기준은 아래 자동 검사로 확인한다.

| # | 수용 기준(요약) | 검증 방법 |
|---|---|---|
| A1 | 예시 데이터를 불러와 안내 없이 다이어그램을 본다 | E2E `sample.spec.ts` |
| A2 | 표 값을 고치면 미리보기가 갱신된다 | E2E `edit.spec.ts` |
| A3 | 필수 누락·숫자 오류·CSV 형식 오류를 행/셀 단위로 확인 | 단위 `validate.test.ts`, E2E `csv-import.spec.ts` |
| A4 | 같은 노드 이름은 일관되게 연결, 중복 연결 처리 방식 안내 | 단위 `buildGraph.test.ts`, E2E |
| A5 | 제목·단위·레이블·색상 조정 결과를 PNG·SVG로 내려받기 | E2E `export.spec.ts` |
| A6 | 내보낸 CSV를 다시 불러오면 핵심 데이터 유지 | 단위 `csv.roundtrip.test.ts` |
| A7 | 키보드만으로 표 입력·주요 버튼 조작, 오류를 텍스트로 확인 | E2E `keyboard.spec.ts` + axe 검사 |
| A8 | 서버 전송 여부와 브라우저 임시 저장 한계를 알 수 있다 | E2E 안내 문구 존재 확인 + 네트워크 요청 0건 검사 |

**제외(Non-goals)**: 계정·클라우드 저장, 공동 편집·댓글, 공유 링크, 엑셀 다중 시트·DB 연동, PDF·PPT 내보내기, 서버 API.

---

## 2. 기술 결정

기획서 §10의 권장안 가운데 하나를 고르고, §17의 미결정 항목은 아래 **잠정값**으로 개발을 시작한다. 잠정값은 S5 사용자 검토 전까지 바꿀 수 있도록 설정 상수로 둔다.

### 2.1 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | React 18 + Vite + TypeScript, 정적 SPA | 서버 없이 배포, 생태계·인력 수급 용이 |
| 생키 레이아웃 | `d3-sankey` (BSD-3-Clause) + `d3-shape` | 레이아웃만 계산하고 렌더는 React SVG로 직접 그려 한글 레이블·접근성·SVG 출력을 통제 |
| CSV | `papaparse` (MIT) | 따옴표·줄바꿈 처리, 헤더 인식 |
| 상태 | `zustand` | 작은 전역 상태, 실행 취소(undo)용 스냅샷 구현이 단순 |
| 스타일 | CSS Modules + CSS 변수 | 내보내기 SVG에 같은 토큰을 인라인으로 넣기 쉬움 |
| 글꼴 | Pretendard(OFL) 서브셋, 자체 호스팅 | PNG 렌더 시 SVG에 base64로 임베드 가능 |
| 테스트 | Vitest(단위), Playwright(E2E), `@axe-core/playwright`(접근성) | |
| 품질 | ESLint, Prettier, `tsc --noEmit` | |
| 배포 | GitHub Actions → 정적 호스팅(GitHub Pages 또는 Cloudflare Pages) | 백엔드 없음 |

### 2.2 §17 미결정 항목 잠정값

| 결정 항목 | 잠정값 | 근거 |
|---|---|---|
| 최대 입력 행 수 | 500행 하드 제한, 200행 초과 시 "느려질 수 있음" 안내 | S1에서 성능 측정 후 확정(T1.6) |
| 중복 출발·도착 조합 | 기본 자동 합산, 설정에서 "별도 흐름으로 표시" 전환 가능 | 기획서 §5 기본값. d3-sankey는 같은 쌍의 링크 여러 개를 허용 |
| 순환 연결 | **오류**(그리지 않음, 순환 경로를 텍스트로 표시) | d3-sankey는 순환 그래프에서 예외 발생. 순환 지원(d3-sankey-circular)은 후속 검토 |
| 유입·유출 불균형 | **경고**(그대로 그림, 노드별 차이 값 표시) | d3-sankey는 노드 값을 max(유입, 유출)로 계산하므로 표시 가능 |
| 연결되지 않은 노드 | 해당 없음(행 단위 입력이라 고립 노드가 생기지 않음). 서로 분리된 그래프 묶음이 2개 이상이면 **정보** 안내 | |
| 자기 자신 연결 | **경고** + 해당 행은 그리기에서 제외 | 기획서 §5 |
| PNG | 배율 1×/2×/3×(기본 2×), 배경 흰색/투명 선택 | 기획서 §12 |
| SVG 글꼴 | 텍스트는 `<text>`로 유지(편집 가능), `font-family` 대체 목록 지정. 윤곽선 변환은 후속 | 기획서 §12 "사용자가 편집 가능" |
| 브라우저 임시 저장 | MVP에 포함(F-07), localStorage 자동 저장 + "이 기기·브라우저에만 저장됨" 상시 표시 | 기획서 §16 오해 위험 대응 |
| 언어 | 한국어만 출시. 문자열은 `src/i18n/ko.ts` 한곳에 모아 영문 추가에 대비 | |
| CSV 인코딩 | 읽기: UTF-8 시도 → 실패 시 EUC-KR(CP949) 자동 재시도 후 안내. 쓰기: UTF-8 + BOM | 엑셀에서 저장한 한글 CSV 대응 |
| 노드 이름 동일성 | 앞뒤 공백 제거 + 유니코드 NFC 정규화 후 대소문자 구분 비교 | 맥·윈도 한글 조합 차이 대응 |

---

## 3. 구조

### 3.1 디렉터리

```
sankey/
├─ src/
│  ├─ core/            # 순수 함수만 (React·DOM 의존 없음) → 단위 테스트 대상
│  │  ├─ types.ts        # 데이터 계약
│  │  ├─ normalize.ts    # 노드 이름 정규화
│  │  ├─ validate.ts     # 행/셀 검증 → Issue[]
│  │  ├─ buildGraph.ts   # Row[] → SankeyInput (합산, 행-링크 매핑, 순환·불균형 검사)
│  │  ├─ layout.ts       # d3-sankey 호출 → LayoutResult
│  │  ├─ csv.ts          # 파싱·인코딩 감지·헤더 매핑·직렬화
│  │  ├─ palette.ts      # 색상 팔레트, 자동 배정, 대비 계산
│  │  ├─ persist.ts      # localStorage 직렬화·버전 마이그레이션
│  │  └─ samples.ts      # 예시 데이터 4종(기획서 §3)
│  ├─ export/          # 브라우저 의존 출력
│  │  ├─ svg.ts          # 미리보기 SVG → 독립 SVG 문자열
│  │  ├─ png.ts          # SVG → canvas → Blob
│  │  └─ download.ts     # 파일명 처리·다운로드
│  ├─ state/store.ts   # zustand 스토어, undo/redo
│  ├─ ui/
│  │  ├─ TopBar/  DataTable/  IssueSummary/  CsvImportDialog/
│  │  ├─ Preview/ (SankeyChart, Tooltip, ZoomControls)
│  │  ├─ SettingsPanel/  ExportDialog/  MobileTabs/
│  ├─ i18n/ko.ts
│  └─ main.tsx, App.tsx
├─ public/fonts/       # Pretendard 서브셋
├─ tests/e2e/          # Playwright
├─ docs/
└─ .github/workflows/ci.yml, deploy.yml
```

### 3.2 데이터 계약 (`src/core/types.ts`)

이후 작업이 모두 의존하므로 S0에서 확정한다.

```ts
export interface Row {
  id: string;          // 안정 ID (nanoid). 정렬·삭제 후에도 유지
  source: string;      // 원문 그대로 저장, 비교 시 normalize
  target: string;
  value: string;       // 입력 원문. 검증 후 숫자로 변환
  group?: string;      // 색상 그룹
  memo?: string;       // 편집용, 이미지 내보내기에서 제외
}

export interface DiagramDoc {
  schemaVersion: 1;
  meta: { title: string; description: string; unit: string };
  rows: Row[];
  settings: Settings;
  updatedAt: string;   // ISO
}

export interface Settings {
  direction: 'ltr' | 'rtl';
  nodeAlign: 'justify' | 'left' | 'right' | 'center';
  nodeWidth: number;      // px
  nodePadding: number;    // 노드 세로 간격
  minLinkWidth: number;   // 작은 흐름 최소 두께
  fontSize: number;
  showValues: boolean;
  labelPosition: 'outside' | 'inside';
  paletteId: string;
  colorMode: 'node' | 'group';          // 노드별 / 색상 그룹별
  linkColor: 'source' | 'target' | 'gradient' | 'neutral';
  nodeColorOverrides: Record<string, string>; // 정규화된 노드 이름 → 색
  duplicateMode: 'merge' | 'separate';
  numberFormat: { decimals: number | 'auto'; thousands: boolean };
}

export type IssueLevel = 'error' | 'warning' | 'info';
export interface Issue {
  level: IssueLevel;
  code: 'REQUIRED' | 'NOT_NUMBER' | 'NOT_POSITIVE' | 'NOT_FINITE'
      | 'SELF_LOOP' | 'DUPLICATE_PAIR' | 'CYCLE' | 'IMBALANCE'
      | 'DISCONNECTED_GROUPS' | 'ROW_LIMIT';
  rowId?: string;
  field?: keyof Row;
  nodeName?: string;
  message: string;     // ko.ts 문자열, 화면에 그대로 노출
}

export interface GraphLink { id: string; source: string; target: string; value: number; rowIds: string[] }
export interface GraphNode { id: string; label: string; group?: string; inflow: number; outflow: number }
export interface BuildResult { nodes: GraphNode[]; links: GraphLink[]; issues: Issue[]; drawable: boolean }
```

핵심 규칙:
- `GraphLink.rowIds`로 차트 요소 ↔ 원본 행 연결을 유지한다(기획서 §8). 링크를 클릭하면 해당 행으로 이동·강조하고, 행에 초점을 두면 링크를 강조한다.
- `drawable=false`는 `error` 수준 Issue가 그리기를 막을 때(순환, 유효 행 0개)만. 행 단위 오류는 해당 행만 빼고 나머지는 그린다.
- 렌더링 파이프라인: `rows → validate → buildGraph → layout → <SankeyChart>`. 앞 세 단계는 `useMemo`로 묶고 입력은 150ms 디바운스.

---

## 4. 일정과 작업

1인 프런트엔드 개발 기준 약 6주. 기획서 §13 단계와 아래처럼 대응한다.

| 스프린트 | 기간 | 기획서 단계 | 산출물 |
|---|---|---|---|
| S0 | 0.5주 | — | 저장소·CI·데이터 계약 |
| S1 | 1.5주 | 1. 시제품 | 표 입력 → 자동 생키 → 오류 표시 |
| S2 | 1주 | 2. 편집 | 스타일 설정 패널, 툴팁, 확대 |
| S3 | 1주 | 3. 파일 입출력 | CSV 가져오기·내보내기, PNG·SVG |
| S4 | 1주 | (비기능) | 임시 저장, 반응형, 접근성, 배포 |
| S5 | 1주 | 4. 사용자 검토 | 실무자 테스트, 수정 |
| — | 이후 | 5. 확장 판단 | 지표·검토 결과로 후속 범위 결정 |

각 작업은 끝났을 때 앱이 동작하고 검사가 통과하는 상태여야 한다.

### S0. 기반

**T0.1 프로젝트 골격**
- Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `src/main.tsx`, `src/App.tsx`
- Steps: Vite React-TS 템플릿, Vitest·Playwright·axe 설치, `npm run check`(= lint + tsc + vitest) 스크립트
- Verify: `npm run check && npm run build` 성공, `npx playwright test` 빈 페이지 스모크 통과

**T0.2 CI**
- Files: `.github/workflows/ci.yml`
- Steps: PR·push 시 `check` → `build` → Playwright(chromium)
- Verify: 첫 PR에서 CI 녹색
- Depends: T0.1

**T0.3 데이터 계약과 예시 데이터**
- Files: `src/core/types.ts`, `src/core/samples.ts`, `src/i18n/ko.ts`
- Produces: §3.2 타입 전체, 예시 4종(예산 배분 / 에너지 흐름 / 프로그램 참여 단계 / 설문 응답 경로)
- Verify: `tsc` 통과, 예시마다 순환 없음 단위 테스트(T1.2 이후 활성화)

### S1. 시제품 — 표 입력과 자동 생키 (F-01, F-02, F-04)

**T1.1 검증 로직**
- Files: `src/core/normalize.ts`, `src/core/validate.ts` + 테스트
- Consumes: `Row[]` / Produces: `Issue[]`
- Steps: 필수값, 숫자 파싱(쉼표 천 단위 허용, `1,234.5` → 1234.5), >0·유한성, 자기 연결, 행 수 제한
- Verify: `vitest validate` — 기획서 §5 규칙마다 케이스 1개 이상, 빈 문자열·공백·`Infinity`·`-3`·`abc`·`1e309` 포함

**T1.2 그래프 생성**
- Files: `src/core/buildGraph.ts` + 테스트
- Consumes: `Row[]`, `Settings.duplicateMode` / Produces: `BuildResult`
- Steps: 오류 행 제외 → 정규화 이름으로 노드 생성 → 중복 쌍 합산(merge) 또는 분리(separate) + `DUPLICATE_PAIR` info → 순환 검사(DFS, 순환 경로를 메시지에 포함) → 노드별 유입·유출 차이 `IMBALANCE` 경고(출발·도착 끝 노드는 제외) → 분리된 묶음 수 검사
- Verify: 기획서 §5 예시(전체 예산→교육 40 …)로 노드 5개·링크 4개, `교육` 유입 40 = 유출 40. 순환 A→B→A는 `drawable=false`

**T1.3 레이아웃**
- Files: `src/core/layout.ts` + 테스트
- Consumes: `BuildResult`, `Settings`, 크기 / Produces: `LayoutResult`(노드 x0,x1,y0,y1, 링크 path·width)
- Steps: d3-sankey 호출, `minLinkWidth` 적용, `direction='rtl'`이면 x 좌표 반전
- Verify: 예시 데이터에서 모든 좌표가 유한하고 캔버스 안에 있음

**T1.4 데이터 표**
- Files: `src/ui/DataTable/*`, `src/state/store.ts`
- Steps: `<table>` + 셀별 `<input>`, 행 추가·삭제, 엑셀에서 복사한 TSV/CSV 붙여넣기(여러 행·열), 오류 셀 `aria-invalid` + 빨간 테두리 + 아이콘, undo/redo(Ctrl+Z / Ctrl+Shift+Z)
- 키보드: Tab/Shift+Tab 셀 이동, Enter 아래 행(마지막 행이면 새 행), Ctrl+Enter 행 추가, Ctrl+Delete 행 삭제
- Verify: E2E `edit.spec.ts` — 셀 수정 시 SVG 링크 수·값 변경, 엑셀 3행 붙여넣기 시 3행 추가

**T1.5 미리보기와 오류 요약**
- Files: `src/ui/Preview/SankeyChart.tsx`, `src/ui/IssueSummary/*`, `src/ui/TopBar/*`
- Steps: LayoutResult를 React SVG로 렌더, 노드 레이블 "이름 값단위", 오류 요약(수준별 개수 + 클릭 시 해당 셀 초점), "예시 불러오기" 메뉴, 첫 방문 시 예산 예시 자동 로드
- Verify: E2E `sample.spec.ts` (A1), `drawable=false`일 때 빈 차트 대신 원인 메시지 표시

**T1.6 성능 측정**
- Files: `tests/perf/layout.bench.ts`
- Steps: 50/200/500/1000행 무작위 비순환 데이터로 validate+build+layout 시간 측정
- Verify: 결과를 `docs/DECISIONS.md`에 기록하고 행 제한 잠정값 확정 또는 수정

### S2. 편집 (F-05)

**T2.1 설정 패널**
- Files: `src/ui/SettingsPanel/*`
- Steps: 제목·설명·단위, 방향(좌→우/우→좌), 정렬, 노드 폭·간격, 글자 크기, 값 표시, 숫자 형식, 중복 처리 방식
- Verify: 설정 변경마다 미리보기 SVG 속성 변화를 E2E로 확인

**T2.2 색상**
- Files: `src/core/palette.ts` + 테스트, `SettingsPanel/ColorSection.tsx`
- Steps: 색각 이상 고려 팔레트 3종 이상, 노드·그룹별 자동 배정(입력 순서 고정), 노드별 직접 선택, 링크 색 방식, 레이블 글자색은 배경 대비 4.5:1 이상 자동 선택
- Verify: 팔레트 색과 흰 배경 대비 단위 테스트, 노드 색 변경 후 SVG `fill` 확인

**T2.3 상호작용**
- Files: `src/ui/Preview/Tooltip.tsx`, `ZoomControls.tsx`
- Steps: 링크·노드 hover/focus 툴팁(출발→도착, 값, 비율), SVG 요소에 `tabindex`·`aria-label`, 확대·축소·맞춤·전체 화면, 링크 클릭 → 해당 행 강조(`rowIds`)
- Verify: E2E — 키보드로 링크 초점 시 툴팁 텍스트 노출, 클릭 시 행 강조

### S3. 파일 입출력 (F-03, F-06)

**T3.1 CSV 파싱과 인코딩**
- Files: `src/core/csv.ts` + 테스트, `tests/fixtures/*.csv`
- Steps: `TextDecoder('utf-8', {fatal:true})` 실패 시 `euc-kr` 재시도, BOM 제거, 구분자 자동 감지(쉼표·탭·세미콜론), 헤더 별칭 매핑(`출발|source|from`, `도착|target|to`, `값|value|amount` 등)
- Verify: 픽스처 — UTF-8, UTF-8 BOM, CP949, 탭 구분, 헤더 없음, 따옴표 안 쉼표, 빈 파일, 바이너리 파일

**T3.2 가져오기 대화상자**
- Files: `src/ui/CsvImportDialog/*`
- Steps: 파일 선택·드래그앤드롭 → 미리보기 5행 → 열 매핑 드롭다운(자동 추정값 채움) → "현재 데이터 대체 / 뒤에 추가" → 확인. 실패하면 원인 표시, 기존 데이터 유지(기획서 §9 오류 복구)
- Verify: E2E `csv-import.spec.ts` — 정상 파일 가져오기, 깨진 파일은 오류 메시지 + 기존 행 수 그대로

**T3.3 CSV 내보내기**
- Files: `src/core/csv.ts`(serialize), `src/export/download.ts`
- Steps: 열 `출발 노드,도착 노드,값,색상 그룹,메모`, UTF-8 BOM, 원본 입력 순서 유지
- Verify: 단위 `csv.roundtrip.test.ts` — 예시 4종 직렬화→파싱 후 Row 내용 동일 (A6)

**T3.4 SVG·PNG 내보내기**
- Files: `src/export/svg.ts`, `src/export/png.ts`, `src/ui/ExportDialog/*`
- Steps: 미리보기 SVG 복제 → 확대 상태 초기화 → 계산된 스타일 인라인 → 제목·단위·설명 포함 → `xmlns` 추가. PNG는 글꼴 서브셋을 `@font-face` base64로 임베드한 SVG를 `<img>`로 로드 후 canvas에 배율 적용, 배경 선택. 파일명 입력(기본값: 제목, 금지 문자 제거)
- Verify: E2E `export.spec.ts` — 다운로드된 SVG에 제목·레이블 텍스트 존재, PNG 크기 = 차트 크기 × 배율. 다운로드 파일명은 E2E에서 `suggestedFilename()`으로 확인(헤드리스에서 한글 파일명이 바뀔 수 있어 ASCII 이름 케이스도 함께 검사)

### S4. 저장·반응형·접근성·배포 (F-07, 비기능)

**T4.1 브라우저 임시 저장**
- Files: `src/core/persist.ts` + 테스트, TopBar 저장 상태 표시
- Steps: 변경 1초 후 localStorage 저장, `schemaVersion` 마이그레이션 자리, 용량 초과·비활성(사파리 사생활 보호) 시 안내, "새 다이어그램" 시 확인 대화상자, 상단에 "이 브라우저에만 저장됩니다 · 서버로 전송하지 않습니다" 표시
- Verify: E2E — 편집 후 새로고침 시 복구 (F-07), 저장 문구 존재 (A8)

**T4.2 반응형**
- Files: `src/ui/MobileTabs/*`, 레이아웃 CSS
- Steps: 960px 이상 좌우 2단(입력 | 미리보기) + 설정 서랍, 미만은 "데이터 / 미리보기" 탭 + 설정 접기
- Verify: Playwright 뷰포트 390×844, 768×1024, 1440×900 스크린샷 비교, 가로 스크롤 없음

**T4.3 접근성 점검**
- Steps: axe 검사를 모든 E2E 시나리오에 추가, 초점 표시, 오류 요약 `aria-live="polite"`, 차트 대체 텍스트(노드·링크 목록 표를 스크린리더용으로 제공)
- Verify: E2E `keyboard.spec.ts` — 마우스 없이 예시 로드 → 값 수정 → PNG 내보내기 완료 (A7), axe 위반 0건(serious 이상)

**T4.4 개인정보·네트워크 검사**
- Steps: 외부 CDN·분석 스크립트 없음, 글꼴 자체 호스팅, CSP 메타 태그(`connect-src 'self'`)
- Verify: E2E에서 전체 시나리오 동안 외부 도메인 요청 0건 (A8)

**T4.5 배포**
- Files: `.github/workflows/deploy.yml`, `docs/DEPLOYMENT.md`
- Steps: main 병합 시 빌드 → 정적 호스팅 게시, `robots`·`noindex`는 테스트 기간 동안만
- Verify: 배포 URL에서 스모크 E2E 통과

### S5. 사용자 검토 (기획서 §13 단계 4)

**T5.1 사용성 테스트 대본**
- Files: `docs/USABILITY_TEST.md`
- 내용: 대상(시민단체·공공기관 실무자, 교육자 등 5~8명), 과제 3개(예시 수정 / 자기 CSV 가져오기 / PNG로 보고서 삽입), 관찰 항목(첫 차트까지 시간, 막힌 지점, 오류 복구 여부)

**T5.2 지표 계측(선택)**
- 기획서 §15 지표를 입력 데이터 없이 계산할 수 있는 이벤트만 정의: `sample_loaded`, `first_render`, `error_shown`, `error_resolved`, `export_{png|svg|csv}`, `session_resumed`. 이벤트에 노드 이름·값·제목을 넣지 않는다
- 도입 여부와 도구(자체 호스팅 Plausible/Umami 등)는 사용자 결정 사항(§6 Q5). 미결정이면 S5는 관찰 기록만으로 진행

**T5.3 수정 반영**
- 테스트에서 나온 막힘을 우선순위로 정리해 수정, `docs/DECISIONS.md`에 §2.2 잠정값 확정 기록

---

## 5. 품질 게이트

| 시점 | 검사 |
|---|---|
| 커밋 전(로컬) | `npm run check` (lint, tsc, vitest) |
| PR | CI: check → build → Playwright E2E(chromium) + axe |
| 출시 전 | Playwright firefox·webkit 실행, 실기기(iOS Safari, Android Chrome) 수동 점검, 스크린리더(VoiceOver, NVDA) 핵심 흐름 1회 |

`src/core`는 DOM 의존 금지, 문장 커버리지 90% 이상을 목표로 한다.

---

## 6. 위험과 대응 (기획서 §16 보완)

| 위험 | 대응 | 확인 작업 |
|---|---|---|
| 큰 데이터 지연 | 디바운스, 행 제한, 측정 후 확정 | T1.6 |
| CSV 인코딩·열 이름 다양 | UTF-8→EUC-KR 재시도, 열 매핑 화면, 샘플 CSV 다운로드 제공 | T3.1, T3.2 |
| d3-sankey 순환 미지원 | 순환은 사전 검사해 오류로 안내, 경로 표시 | T1.2 |
| PNG에서 한글 글꼴 깨짐 | 글꼴 base64 임베드, `document.fonts.ready` 대기 | T3.4 |
| 사파리 SVG→canvas 제약 | webkit E2E, 실패 시 대체 경로(직접 canvas 그리기) 검토 | T3.4, 출시 전 |
| 임시 저장 오해 | 상시 문구 + 저장 시점 안내 + CSV 내보내기 권유 | T4.1 |
| 색상만으로 구분 | 레이블·값·툴팁 병행, 대비 자동 계산 | T2.2, T2.3 |

---

## 7. 확인이 필요한 결정

개발은 §2.2 잠정값으로 시작하되, 아래는 S1 종료 전까지 답을 받으면 좋다.

| # | 질문 | 잠정값 |
|---|---|---|
| Q1 | 프런트엔드 프레임워크를 React로 확정해도 되는가(팀이 Vue에 익숙하면 변경) | React |
| Q2 | 순환 연결을 MVP에서 오류로 막아도 되는가 | 오류 |
| Q3 | 최대 행 수 | 500 (T1.6 측정 후 재제안) |
| Q4 | 호스팅 위치와 도메인 | GitHub Pages |
| Q5 | 운영 지표 수집 도구 도입 여부 | 미도입(S5는 관찰 기록) |
| Q6 | 서비스 이름·로고·브랜드 색 | 가칭 "생키 메이커", 중립 팔레트 |
| Q7 | 예시 데이터 4종에 쓸 실제 수치(공개 예산 등) 제공 여부 | 가상 수치 |
