import { defineConfig } from 'vitest/config';

// 성능 측정 전용(npm run perf). 일반 테스트(npm test)에는 포함하지 않는다.
export default defineConfig({
  test: {
    include: ['tests/perf/**/*.perf.test.ts'],
    environment: 'node',
  },
});
