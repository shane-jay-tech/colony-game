# colony 清单等价断言补测（c-18，2026-09-13）

- `bootLoadList.test.ts` 新增 describe「c18 manifest equivalence」4 用例：①ART_MANIFEST 并集=五类之和（无幽灵条目）②key 全局唯一 ③path 命名与 category 目录约定一致（正则 assets/<category>s?/）④BUILDINGS/GENERAL_POOL 逐 id 有 art 条目（事件画为通用插画池——非逐事件映射，仅断言唯一非空，口径注记在案）。
- 过程修正：④初版对 EVENTS 逐 id 断言过严（EVENTS 30+ 条 vs EVENT_ART 6 条为设计态），按真实结构收窄。
- 全量 `npm test`：**86 文件 / 1114 passed, 0 failed**（1110+4）。
