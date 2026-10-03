import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // c924-13：与 electron.vite.config.ts:60-62 的 renderer `resolve.alias` **对齐**。
  // 存在理由（否证 c923-13 设计稿的一处隐含前提）：设计稿 §5 档 B 断言「档 B 仍必须 vi.mock('phaser')」，
  // 但没验到 BootScene.ts:2 的 `import … from '@/data'` 在**测试面根本不可解析**——
  // 本文件原先没有 `@` 别名 ⇒ 任何 `import { BootScene }` 的用例在收集期即
  // `Failed to load url @/data (resolved id: @/data)`（c924-13 探针实测），档 B 4 例落不了地。
  // 风险面：全仓 `@` 前缀说明符仅 2 处（`grep -rhoE "from '@[^']*'" src scripts --include=*.ts`），
  //   其中 '@/ui-x' 在 renderUiBoundary.test.ts:55 的注释里 ⇒ 实际只有 BootScene.ts 一处受影响的真 import。
  //   Vite 别名字符串键按「全等 或 前缀+'/'」匹配，故 `@vitest/*` 这类包名不会被误改。
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer') },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'scripts/__tests__/**/*.test.ts'],
    // 主班 2026-10-04：计时护栏件从默认（并行）门禁面摘出——它读的是墙钟，与别的测试文件并行时
    // 抢核会把读数整体放大（同日实测 2637µs → 14172µs，5.3×），曾使 pre-commit 长期不可过。
    // 该件改由 `npm run test:perf` 在 vitest.perf.config.ts 下单线程串行跑，继续守严格门槛。
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/hudRefreshCost.test.ts',
    ],
  },
});
