# colony registry key 集中化与类型化访问核验（c-14，2026-09-13）

- **实况：已由既有 P1-2 架构硬化实现**（src/renderer/ui/registry.ts）——全部 key 登记于 REGISTRY_KEYS（唯一字符串点）、泛型 helper 类型化 get/set、127 处调用方采用；
- 残留扫描：src 内无 registry.get/set 直接字符串字面量（唯一命中 buildingRegistry.ts:30 为数据 map 的 registry.set，非 Phaser registry 面）；
- 纪律核验：本单零改动（实况已达标）；全量 npm test 1106 passed 0 failed。
