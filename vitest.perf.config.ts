import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * 计时护栏专用配置（主班 2026-10-04 立）。
 *
 * 存在理由：hudRefreshCost.test.ts 读的是**墙钟**。在默认 vitest threads 池里它与别的测试文件并行，
 * 抢核会让读数整体膨胀——2026-10-04 同日实测：单跑 MilitaryPanel 2637.67µs / cpuShare=1.96；
 * 全量跑同件 14172.87µs / cpuShare=6.82（5.3×）。这条膨胀把 pre-commit 打成长时间不可过，
 * 2026-09-30 起各执行班被迫 --no-verify（连带绕过 type-check 与 1897 个测试）。
 *
 * 处置：该件从默认 test 面摘出（见 vitest.config.ts 的 exclude），改由 `npm run test:perf`
 * 在本配置下**单线程串行**跑，继续守严格的 5000µs/call。
 *
 * 为什么不「按运行时抢占信号动态放宽阈值」：那会把允许回归范围放大 10 倍（5000→50000µs），
 * 2.6ms→49ms 的真实退化会被放过；且 cpuShare 这类信号无法区分「本进程自身多 worker」与
 * 「外部抢占」，高估/低估两个方向都有反例（GPT-5.6 独立评审，2026-10-04）。
 */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer') },
  },
  test: {
    environment: 'node',
    include: ['src/renderer/ui/__tests__/hudRefreshCost.test.ts'],
    // 串行：保证计时读数只由本件占用 CPU。
    // vitest 4 迁移（2026-11-14）：1.x 的 `poolOptions.threads.singleThread` 已移除
    // （2.0 起 threads 池废 singleThread、3.0 起默认池= forks），等价形态为
    // `poolOptions.forks.singleFork`——单文件单进程串行，语义与旧 singleThread 一致。
    poolOptions: { forks: { singleFork: true } },
  },
});
