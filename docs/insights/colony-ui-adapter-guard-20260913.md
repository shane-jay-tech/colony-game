# colony UI 适配器守卫测试（c-16，2026-09-13）

- 新增 `src/renderer/ui/__tests__/uiAdapterGuard.test.ts` 2 用例：
  ①源码扫描：ui/ 全部 .ts（registry.ts 白名单——它是类型化访问层本身）无「.state.x =」「.state.push/pop/splice」直改模式；
  ②行为断言：GameStore.getBuildings()/getActiveModifiers() 返回 Object.freeze 冻结视图（运行时防改，对应 gameStore.ts:467/:477 既有实现）。
- 全量 `npm test`：1108+2=**1110 passed, 0 failed**。生产码零改动（守卫只加测试）。
