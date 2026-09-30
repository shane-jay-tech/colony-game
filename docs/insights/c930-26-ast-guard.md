# 双写守卫 AST 轨·执行记录（c930-26）

> **单号** `c930-26` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 05:2x（实测）

## 实施（c927-22 dualwrite 设计稿 §A2 落地；取数器移植 tmp/c924-20/census.mts）

新件 `scripts/__tests__/dualwriteAstGuard.test.ts` 3 例：
1. **A2 不变量**：migrations 注入字段集合 ⊆ deserialize gameState 兜底键集（≥8 字段非空闸＋migOnly=[]，今天 15/15 恒真）。
2. **步号完备**：migrations 键＝1..SAVE_SCHEMA_VERSION−1（删/改号任一步即红）。
3. **变异自证**：内存副本步 8 改号 90 ⇒ 步完备判据当场可检红（不触盘）。

## 两轨分工（防后人合并，笔记要点）

- **canary 15 例**（c927-48，运行时轨）：migrations[8] 的**行为**真跑证明。
- **本件 AST 轨**：migrations **写侧结构**静态不变量（步号完备＋双写面非破）。
- 两轨判据不同源、红因不同（运行时行为 vs 静态结构），**不是重复建设**——c927-48 遗留原话「收编时别当重复建设合掉」。

## 验证

3 passed（15ms）。生产码零改动（saveLoad.ts 只读）。提交 colony（--no-verify 同在册理由）。

## 遗留

A4（GameState 非运行时键 ↔ serialize/deserialize 双字面量 49/51 对账，豁免 paused/lastTickTimestamp）设计稿已有形状，另单可接。
