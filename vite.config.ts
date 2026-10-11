import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: { three: ['three'], motion: ['gsap'], math: ['katex'] } } } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
