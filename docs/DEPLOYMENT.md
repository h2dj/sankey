# 배포 안내

생키 메이커는 서버 없는 정적 웹앱입니다. `npm run build`가 만든 `dist/` 폴더를 어떤 정적 호스팅에 올려도 동작하며, 하위 경로(예: `https://example.org/tools/sankey/`)에서도 동작합니다(상대 경로 빌드, 로컬에서 `/sankey/` 하위 경로로 확인).

## GitHub Pages (기본)

저장소에 이미 `.github/workflows/deploy.yml`이 있습니다. **main의 CI가 통과하면** 자동으로 빌드·배포하고, 배포된 주소에서 스모크 테스트(첫 화면, 접근성, 외부 요청 0건, 글꼴·PNG 생성)를 실행합니다.

### 처음 한 번 해야 할 일 (저장소 관리자)

1. GitHub 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
2. 비공개 저장소라면 GitHub 요금제가 Pages를 지원하는지 확인합니다(무료 계정은 공개 저장소만 가능).
3. main에 병합하거나, **Actions → Deploy → Run workflow**로 직접 실행합니다.
4. 주소는 보통 `https://<계정>.github.io/sankey/`입니다. Actions 실행 결과의 `github-pages` 환경 링크에서 확인합니다.

### 검색엔진 노출

시험 운영 기간에는 `<meta name="robots" content="noindex, nofollow">`가 들어갑니다. 공개 운영을 시작할 때 **Settings → Secrets and variables → Actions → Variables**에 `SANKEY_INDEX` = `1`을 추가하고 다시 배포합니다.

### 이전 버전으로 되돌리기

**Actions → Deploy → Run workflow**에서 되돌릴 커밋이 있는 브랜치를 골라 실행하거나, main에서 문제 커밋을 되돌린(revert) 뒤 병합합니다.

### 사용자 도메인

**Settings → Pages → Custom domain**에 도메인을 넣고 DNS에 CNAME을 추가합니다. 앱은 상대 경로로 빌드되어 따로 고칠 것이 없습니다.

## 다른 정적 호스팅

| 호스팅 | 빌드 명령 | 출력 폴더 |
|---|---|---|
| Cloudflare Pages | `npm run build` | `dist` |
| Netlify | `npm run build` | `dist` |
| 기관 웹 서버(nginx 등) | 로컬에서 `npm ci && npm run build` 후 `dist/` 복사 | — |

Node.js 22가 필요합니다. `npm run build` 전에 Pretendard 글꼴 파일이 `dist/fonts/`로 함께 복사됩니다(약 2.7MB, 화면에 쓰인 글자 범위만 내려받으므로 실제 전송량은 훨씬 작음).

## 보안·개인정보 설정

- 빌드된 `index.html`에 **Content-Security-Policy** 메타 태그가 들어갑니다. 스크립트·연결은 같은 주소에서만 허용하고(`connect-src 'self'`), 외부 분석·CDN 스크립트는 없습니다. 사용자 데이터는 서버로 전송되지 않습니다.
- 메타 태그로는 `frame-ancestors`(다른 사이트에 끼워 넣기 차단)와 HSTS를 설정할 수 없습니다. 필요하면 호스팅의 응답 헤더로 추가합니다. 예(nginx):

  ```nginx
  add_header Content-Security-Policy "frame-ancestors 'none'" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  ```

- 운영 지표 수집 도구는 넣지 않았습니다(계획 Q5 미결정). 도입할 때는 입력 데이터·다이어그램 내용을 보내지 않는 이벤트만 쓰고 CSP의 `connect-src`에 해당 주소를 추가해야 합니다.

## 배포 전 점검

```bash
npm ci
npm run check      # lint + 타입 검사 + 단위 테스트
npm run test:e2e   # 빌드본으로 E2E
```

배포된 주소를 직접 검사하려면:

```bash
PLAYWRIGHT_BASE_URL=https://<계정>.github.io/sankey/ npx playwright test tests/e2e/smoke.spec.ts
```
