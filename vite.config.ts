import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * 배포 빌드에만 보안·개인정보 메타 태그를 넣는다(T4.4).
 * - CSP: 외부 스크립트·연결을 막아 사용자 데이터가 다른 곳으로 나가지 않게 한다.
 *   style-src 'unsafe-inline'은 React의 style 속성(차트 확대 폭, 툴팁 위치) 때문에 필요하다.
 *   blob:·data:는 PNG 만들기(SVG→이미지, 글꼴 포함)에 쓴다.
 * - 개발 서버는 인라인 스크립트(HMR)를 쓰므로 넣지 않는다.
 * - SANKEY_INDEX=1이 아니면 검색엔진 노출을 막는다(시험 운영 기간).
 */
function securityMeta(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'sankey-security-meta',
    apply: 'build',
    transformIndexHtml() {
      const tags = [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp } },
        { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' } },
      ];
      if (process.env.SANKEY_INDEX !== '1') {
        tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } });
      }
      return tags.map((t) => ({ ...t, injectTo: 'head-prepend' as const }));
    },
  };
}

// 정적 호스팅(GitHub Pages 하위 경로 포함)에서 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react(), securityMeta()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
