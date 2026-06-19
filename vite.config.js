import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function copyImgToDist() {
  return {
    name: 'copy-img-to-dist',
    closeBundle() {
      cpSync(resolve('img'), resolve('dist/img'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  plugins: [copyImgToDist()],
});
