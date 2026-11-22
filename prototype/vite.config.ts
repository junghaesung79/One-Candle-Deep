import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 빌드 결과는 예전처럼 파일 하나(dist/index.html)예요. 더블클릭으로 열어도 되고, 어느 정적 호스팅에 올려도 돼요.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 300_000 },
});
