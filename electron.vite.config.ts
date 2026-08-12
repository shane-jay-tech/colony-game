import { defineConfig } from 'electron-vite';
import { resolve } from 'path';
import { loadEnv } from 'vite';

const VITE_DEPS_CACHE = resolve(__dirname, '.vite-deps-cache');

/**
 * DeepSeek 二审 major F6/F15：原本 main/preload 用 externalizeDepsPlugin 把所有
 * package.json 中的依赖标为 external，运行时从 node_modules 加载——但 electron-builder.yml
 * 的 files 排除了 node_modules，导致一旦 main/preload 引用第三方库就会在生产环境崩溃。
 * 现在去掉 externalizeDepsPlugin，让 main/preload 全量打 bundle（electron 自身仍是 external，
 * 因为它由 Electron runtime 提供）。代价：bundle 略大，但当前 main 仅 ~4KB、preload ~0.5KB，
 * 完全可以忽略。
 *
 * `output.format` 显式 'es'（main 和 preload 都用 .mjs / .js ESM 输出）—— DeepSeek nit F13。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    main: {
      build: {
        outDir: 'dist/main',
        rollupOptions: {
          input: resolve(__dirname, 'src/main/index.ts'),
          external: ['electron', /^node:.*/], // electron 由 runtime 提供；node:* 内置
          output: { format: 'es' },
        },
      },
      define: {
        'process.env.ELECTRON_CACHE': JSON.stringify(env.ELECTRON_CACHE ?? ''),
        'process.env.ELECTRON_BUILDER_CACHE': JSON.stringify(env.ELECTRON_BUILDER_CACHE ?? ''),
      },
    },
    preload: {
      build: {
        outDir: 'dist/preload',
        rollupOptions: {
          input: resolve(__dirname, 'src/preload/index.ts'),
          external: ['electron', /^node:.*/],
          output: { format: 'es' },
        },
      },
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      publicDir: resolve(__dirname, 'public'),
      build: {
        outDir: resolve(__dirname, 'dist/renderer'),
        assetsInlineLimit: 0,
        rollupOptions: {
          input: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src/renderer'),
        },
      },
      server: {
        port: 5173,
      },
      cacheDir: VITE_DEPS_CACHE,
      optimizeDeps: {
        // include phaser explicitly so the deps cache (forced to D drive) is warm
        include: ['phaser'],
      },
    },
  };
});
