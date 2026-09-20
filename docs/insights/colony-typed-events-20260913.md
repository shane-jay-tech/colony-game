# colony 状态事件面类型化落地（c-13，2026-09-13）

## 改动

- `src/renderer/state/gameStore.ts`：
  1. 新增 `StateEventName` 类型（由 STATE_EVENTS 值域派生，新增事件自动收进联合）；
  2. 新增 `IStateEventEmitter` 泛型接口（on/off/emit/listenerCount 的 event 收窄到 StateEventName，拼错事件名编译期报错）；
  3. `GameStore implements IStateEventEmitter`（运行时行为零变更——纯类型收窄，未触任何 emit/on 调用点）；
- 兼容：原 `IEventEmitter`（string 宽口径）保留，外部注入 emitter 的既有构造不受影响。

## 断言与全量

- 新增 `src/renderer/state/__tests__/typedEvents.test.ts` 3 用例：合法事件名订阅/触发/注销（引用一致注销）；StateEventName 覆盖全部 STATE_EVENTS 值；@ts-expect-error 编译期拒绝非法事件名。
- 全量 `npm test`：**85 文件 / 1106 passed, 0 failed**（1103+3）。
