import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 정적 호스팅(GitHub Pages 하위 경로 포함)에서 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
