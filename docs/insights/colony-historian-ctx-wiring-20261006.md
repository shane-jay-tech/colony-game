# 史官 12 条谏言 ctx 接线核验表（c1004-05，2026-10-06，只读）

- ctx 装配点：gameStore.ts:2236-2251（每谏言 tick 现场构造）；瞬态二分依据=saveLoad.ts 序列化面（crisisActive 在 :347/:542 双向持久化；historianGradeAscended/historianIdleDays 为 **private 瞬态** :409-410，saveLoad 零登记）。

## 12 条核验表

| # | id | 条件（行号） | ctx 字段 | 来源 | 读档后语义漂移 |
|---|---|---|---|---|---|
| 1 | hist_01_first_game | isFirstDay（:37） | currentDay==1 | **持久**（currentDay 落档） | 无 |
| 2 | hist_02_grain_low | grainNegativeDays≥3（:42） | grainNegativeDays | **持久**（gameStore state 字段，saveLoad 面在册） | 无（已验，c1004-04） |
| 3 | hist_03_gold_empty | gold==0 && hasGoldCostBuilding（:47） | gold＝resources.gold（持久）；hasGoldCostBuilding＝buildings.some(constructing)（buildings 持久） | 双持久 | 无 |
| 4 | hist_04_policy_unlock | policyPanelUnlocked（:52） | grade（持久）＋policies.every(!adopted)（policies 持久） | 双持久 | 无 |
| 5 | hist_05_hostile_npc | hasHostileNpc（:57）＝npcCountries.some(stance≤-30) | npcCountries（持久） | 持久 | 无 |
| 6 | hist_06_pop_cap | populationAtCap（:62）＝people≥housingCap | people/buildings（持久） | 持久 | 无 |
| 7 | hist_07_grade_ascend | gradeJustAscended（:67） | **historianGradeAscended＝瞬态（private，:410；1684 置 true；consume 后 :2266 置 false；saveLoad 零登记）** | **瞬态** | **读档后恒 false ⇒ hist_07 读档即死**（升格→存档→读档：提示永不出现）；且 seenIds 若已含（升格帧已弹过）则本就跳过——漂移面=「升格与存档同帧」场景 |
| 8 | hist_08_idle | idleDays≥30（:72） | **historianIdleDays＝瞬态（private，:409；:818/:1356/:1379 三处归零）** | **瞬态** | **读档后 idleDays=0 ⇒ 挂机 30 天→存档→读档，计数清零**（「无作为」提示重置） |
| 9 | hist_09_crisis | crisisActive（:77） | state.crisisActive | **持久**（saveLoad :347/:542） | 无 |
| 10 | hist_10_no_adjacency | noAdjacentBonus（:82）＝working 建筑集合现算 | buildings/status（持久） | 持久（现算派生） | 无 |
| 11 | hist_11_first_winter | isFirstWinter（:87）＝cal.season==3 | currentDay 派生（持久） | 持久 | 无 |
| 12 | hist_12_general | hasAvailableGeneral（:92） | 方法调用（武将池，持久面） | 持久 | 无 |

## 运行时计数器顶替风险扫描结论

- **顶替（瞬态字段顶掉持久语义）实锤 2 条**：hist_07（gradeJustAscended 瞬态——读档即死）与 hist_08（idleDays 瞬态清零——读档重置）。二者的「正确持久化位」应为 saveLoad 登记或改从持久字段派生（idleDays 可由 lastActionDay 派生——若仓内有该持久字段）。
- 其余 10 条：条件全由持久字段或其派生构成，读档后语义稳定。
- **与 s1002-40 案(a) 同族**：historianGradeAscended/historianIdleDays 若进 session_state 持久化清单即闭环——改动面=saveLoad 序列化对 +2 字段（红名单=「瞬态不落档」若被钉则同批；现 rg 无此钉）。
