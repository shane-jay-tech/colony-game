Implement Slice A (core state + time loop) for a TypeScript + Phaser 3 + Electron 28 offline game.
Write all deliverables completely. No ellipsis. No placeholder comments.

## EXISTING CODE (do NOT re-export or duplicate these types)

### resourceRegistry.ts exports:
- RESOURCE_IDS = [grain,wood,stone,gold,people,cloth,bronze,rite] as const (TypeScript)
- type ResourceId = typeof RESOURCE_IDS[number]
- type ResourceCost = Partial<Record<ResourceId, number>>
- type ResourceBag = Partial<Record<ResourceId, number>>
- function isValidResourceId(id: string): id is ResourceId
- MODIFIER_TARGETS includes: country_grain_output, country_wood_output, country_stone_output, country_gold_output, country_cloth_output, country_bronze_output, country_rite_output, country_grain_consumption, country_population_growth, country_population_cap, country_military_power, country_morale, country_research_speed, country_diplomacy_weight, building_construction_speed, building_construction_cost, building_efficiency, building_upkeep, population_happiness, population_class_growth_shi, population_class_growth_nong, population_class_growth_gong, event_positive_probability, event_negative_probability
- type ModifierTargetKey = typeof MODIFIER_TARGETS[number]
- function isValidModifierTarget(target: string): target is ModifierTargetKey

### schema.ts exports:
- type ModifierOp = add | mul (string literals)
- interface ModifierEffect { target: ModifierTargetKey; op: ModifierOp; value: number }
- type ModifierCategory = economy|military|culture|tech|population|diplomacy|disaster
- interface ModifierInstance { id: string; name: string; category: ModifierCategory; stackable: boolean; effects: ModifierEffect[]; visualBadge: string | null; remainingDays: number; description: string; descPlain: string; }
- type BuildingStatus = idle|constructing|working|paused|derelict
- type BuildingTier = 1 | 2 | 3
- interface BuildingDef { id: string; name: string; tier: BuildingTier; cost: ResourceCost; constructionTime: number; output: { resource: ResourceId; perDay: number }[]; upkeep: ResourceCost; size: { width: number; height: number }; assetKey: string; upgradeRequires: string[]; badgeRules: unknown[]; description: string; descPlain: string; }
- interface BuildingInstance { defId: string; position: { x: number; y: number }; status: BuildingStatus; tier: BuildingTier; constructionProgress: number; modifiers: string[]; }
- interface SaveData { version: string; timestamp: number; world: { resources: Partial<Record<ResourceId, number>>; buildings: BuildingInstance[]; policies: { id: string; adopted: boolean }[]; activeModifiers: ModifierInstance[]; activeDecrees: { id: string; currentStage: number; daysElapsed: number }[]; eventHistory: string[]; tutorialStepId: string | null; defeatCount: number; permanentBuffs: string[]; lastSeenTimestamp: number; } }

### modifierValidator.ts exports:
- class ModifierValidationError extends Error
- function validateModifierEffect(e: ModifierEffect, path: string): void  // throws ModifierValidationError
- function validateModifierInstance(m: ModifierInstance): void

### src/main/index.ts (existing):
Electron main. Sets userData to D:/colony-game/user-data. existsSync/mkdirSync/join already imported. No ipcMain handlers.

### src/preload/index.ts (existing):
Exposes colonyApi.getVersion()/saveGame(data)/loadGame() via contextBridge + ipcRenderer.invoke.
Implement Slice A (core state + time loop) for a TypeScript + Phaser 3 + Electron 28 offline game.
Write all deliverables completely. No ellipsis. No placeholder comments.

## EXISTING CODE (do NOT re-export or duplicate these types)

### resourceRegistry.ts exports:
- RESOURCE_IDS = [grain,wood,stone,gold,people,cloth,bronze,rite] as const (TypeScript)
- type ResourceId = typeof RESOURCE_IDS[number]
- type ResourceCost = Partial<Record<ResourceId, number>>
- type ResourceBag = Partial<Record<ResourceId, number>>
- function isValidResourceId(id: string): id is ResourceId
- MODIFIER_TARGETS includes: country_grain_output, country_wood_output, country_stone_output, country_gold_output, country_cloth_output, country_bronze_output, country_rite_output, country_grain_consumption, country_population_growth, country_population_cap, country_military_power, country_morale, country_research_speed, country_diplomacy_weight, building_construction_speed, building_construction_cost, building_efficiency, building_upkeep, population_happiness, population_class_growth_shi, population_class_growth_nong, population_class_growth_gong, event_positive_probability, event_negative_probability
- type ModifierTargetKey = typeof MODIFIER_TARGETS[number]
- function isValidModifierTarget(target: string): target is ModifierTargetKey

### schema.ts exports:
- type ModifierOp = add | mul (string literals)
- interface ModifierEffect { target: ModifierTargetKey; op: ModifierOp; value: number }
- type ModifierCategory = economy|military|culture|tech|population|diplomacy|disaster
- interface ModifierInstance { id: string; name: string; category: ModifierCategory; stackable: boolean; effects: ModifierEffect[]; visualBadge: string | null; remainingDays: number; description: string; descPlain: string; }
- type BuildingStatus = idle|constructing|working|paused|derelict
- type BuildingTier = 1 | 2 | 3
- interface BuildingDef { id: string; name: string; tier: BuildingTier; cost: ResourceCost; constructionTime: number; output: { resource: ResourceId; perDay: number }[]; upkeep: ResourceCost; size: { width: number; height: number }; assetKey: string; upgradeRequires: string[]; badgeRules: unknown[]; description: string; descPlain: string; }
- interface BuildingInstance { defId: string; position: { x: number; y: number }; status: BuildingStatus; tier: BuildingTier; constructionProgress: number; modifiers: string[]; }
- interface SaveData { version: string; timestamp: number; world: { resources: Partial<Record<ResourceId, number>>; buildings: BuildingInstance[]; policies: { id: string; adopted: boolean }[]; activeModifiers: ModifierInstance[]; activeDecrees: { id: string; currentStage: number; daysElapsed: number }[]; eventHistory: string[]; tutorialStepId: string | null; defeatCount: number; permanentBuffs: string[]; lastSeenTimestamp: number; } }

### modifierValidator.ts exports:
- class ModifierValidationError extends Error
- function validateModifierEffect(e: ModifierEffect, path: string): void  // throws ModifierValidationError
- function validateModifierInstance(m: ModifierInstance): void

### src/main/index.ts (existing):
Electron main. Sets userData to D:/colony-game/user-data. existsSync/mkdirSync/join already imported. No ipcMain handlers.

### src/preload/index.ts (existing):
Exposes colonyApi.getVersion()/saveGame(data)/loadGame() via contextBridge + ipcRenderer.invoke.


## DELIVERABLE 1: src/renderer/state/gameStore.ts

Write the complete file implementing these requirements:

1. Export IEventEmitter interface with on/off/emit/listenerCount methods.
2. Export STATE_EVENTS const object:
   RESOURCES_CHANGED=state:resourcesChanged, DAY_TICK=state:dayTick,
   SEASON_TICK=state:seasonTick, YEAR_TICK=state:yearTick,
   MODIFIER_ADDED=state:modifierAdded, MODIFIER_REMOVED=state:modifierRemoved,
   BUILDING_PLACED=state:buildingPlaced, BUILDING_COMPLETED=state:buildingCompleted

3. Export GameState interface (copies SaveData.world fields + runtime fields):
   resources, buildings, policies, activeModifiers, activeDecrees,
   eventHistory, tutorialStepId, defeatCount, permanentBuffs, lastSeenTimestamp
   PLUS: paused: boolean; speed: 0|1|2|3; lastTickTimestamp: number; currentDay: number; rngSeed: number

4. Export GameStore class:
   - constructor(emitter: IEventEmitter, initialState?: Partial<GameState>)
   - getState(): Readonly<GameState>  // structuredClone + Object.freeze
   - private setResourceClamped(id: ResourceId, value: number): void  // Math.floor, clamp [0,9999]
   - addResource(id: ResourceId, amount: number, reason?: string): void  // emits RESOURCES_CHANGED
   - setSpeed(s: 0|1|2|3): void
   - setPaused(b: boolean): void
   - addModifier(instance: ModifierInstance): void  // validateModifierInstance first
   - removeModifier(id: string): void
   - placeBuilding(def: BuildingDef, gridX: number, gridY: number): void  // status=constructing
   - completeBuildingAt(gridX: number, gridY: number): void  // find by pos, set working
   - applyDayDeltas(deltas: Partial<Record<ResourceId, number>>): void
   - advanceDay(n?: number): void
   - getEmitter(): IEventEmitter  // needed by TimeSystem

   Default initial state: all empty, paused=false, speed=1, currentDay=0, rngSeed=12345

   Note: resource values are stored as integers. Math.floor before clamping.
   Comment: callers should avoid fractional deltas to prevent float drift over many days.


## DELIVERABLE 2: src/renderer/state/timeSystem.ts

Write the complete file.

Export SPEED_MS_PER_DAY: Record<1|2|3, number> = { 1: 1000, 2: 500, 3: 333 }
Export SEASON_NAMES: readonly string[] = [spring, summer, autumn, winter]
Export function dayToCalendar(day: number): { year: number; season: 0|1|2|3; dayOfSeason: number }
  - 30 days/season, 4 seasons/year = 120 days/year
  - day=0 => { year:0, season:0, dayOfSeason:0 }

Export class TimeSystem:
  - constructor(store: GameStore)
  - private accumulator = 0
  - update(realDeltaMs: number): void
    Steps:
    1. Get state from store. If speed === 0, return immediately.
    2. Record calBefore = dayToCalendar(state.currentDay)
    3. accumulator += realDeltaMs
    4. const threshold = SPEED_MS_PER_DAY[state.speed as 1|2|3]
    5. while (accumulator >= threshold): accumulator -= threshold; store.advanceDay(1); store.getEmitter().emit(STATE_EVENTS.DAY_TICK, store.getState().currentDay)
    6. calAfter = dayToCalendar(store.getState().currentDay)
    7. if calAfter.season !== calBefore.season: emit STATE_EVENTS.SEASON_TICK
    8. if calAfter.year !== calBefore.year: emit STATE_EVENTS.YEAR_TICK


## DELIVERABLE 3: src/renderer/state/resourceSystem.ts

Write the complete file.

Import GameState from gameStore; BuildingDef from schema; ResourceId, RESOURCE_IDS, isValidResourceId from resourceRegistry; validateModifierEffect from modifierValidator.

Export function computeDayDeltas(state: GameState, buildingDefs: Map<string, BuildingDef>): Partial<Record<ResourceId, number>>:
  1. Initialize base totals map for each resource
  2. For each building where status === working: look up def, add output[].perDay, subtract upkeep entries
  3. For each activeModifier effect where op===add and target matches country_<rid>_output pattern: call validateModifierEffect, extract rid, add effect.value to totals
  4. For each activeModifier effect where op===mul same pattern: call validateModifierEffect, multiply total for that resource
  5. Return Partial<Record<ResourceId, number>> omitting zero values

Local helper (not exported): extractOutputResource(target: string): ResourceId | null
  - match target against /^country_(.+)_output$/, check isValidResourceId on captured group

Export function tickModifierLifecycle(state: GameState, _currentDay: number): string[]:
  - return ids of modifiers where remainingDays !== -1 and remainingDays <= 0
  - does NOT mutate state; caller calls store.removeModifier for each


## DELIVERABLE 4: src/renderer/state/rng.ts

Write the complete file. No Math.random.

Export interface RngHandle:
  next(): number  // returns [0, 1)
  nextInt(min: number, max: number): number  // inclusive both ends
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
  getSeed(): number  // current internal state for save/restore

Export function createRng(seed: number): RngHandle  // mulberry32
Export function restoreRng(state: number): RngHandle  // alias for createRng

Mulberry32 algorithm:
  let s = seed >>> 0;
  function raw(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), s | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000;
  }
getSeed() returns current value of s.
pick on empty array should throw Error.


## DELIVERABLE 5: src/renderer/state/saveLoad.ts

Write the complete file.

Export const SAVE_SCHEMA_VERSION = 1
Export class SaveLoadError extends Error {}

Export interface SerializedSave:
  schemaVersion: number
  savedAt: number
  state: { resources, buildings, policies, activeModifiers, activeDecrees, eventHistory, tutorialStepId, defeatCount, permanentBuffs, lastSeenTimestamp, currentDay: number, rngSeed: number, speed: 0|1|2|3 }

type MigrationFn = (old: unknown) => unknown
const migrations: Partial<Record<number, MigrationFn>> = {}  // ready for future versions

Export function serialize(state: GameState): SerializedSave
Export function deserialize(blob: unknown): GameState
  - validate blob is object with schemaVersion field
  - if schemaVersion > SAVE_SCHEMA_VERSION: throw SaveLoadError (from the future)
  - if schemaVersion < SAVE_SCHEMA_VERSION: run migration chain; throw if no path
  - reconstruct GameState with defaults: paused=false, lastTickTimestamp=0

Export function validateSlot(slot: string): void
  - throw SaveLoadError if slot does not match /^[a-z0-9_-]{1,32}$/

type ColonyApiShape = { saveGame(slot: string, json: string): Promise<boolean>; loadGame(slot: string): Promise<string | null>; }
function getColonyApi(): ColonyApiShape { return (window as unknown as { colonyApi: ColonyApiShape }).colonyApi; }

Export async function saveToSlot(slot: string, state: GameState): Promise<void>
  - validateSlot(slot)
  - await getColonyApi().saveGame(slot, JSON.stringify(serialize(state)))

Export async function loadFromSlot(slot: string): Promise<GameState | null>
  - validateSlot(slot)
  - const raw = await getColonyApi().loadGame(slot)
  - if raw === null return null
  - return deserialize(JSON.parse(raw))


## DELIVERABLE 6: Complete updated src/main/index.ts

Keep ALL existing code. Make these additions:
1. Add ipcMain to the electron import line.
2. Add readFileSync, writeFileSync, readdirSync to the fs import line.
3. Add before app.whenReady() call:

const VALID_SLOT_RE = /^[a-z0-9_-]{1,32}$/;

Handler save-game takes (slot: unknown, json: unknown):
  - validate slot is string matching VALID_SLOT_RE, else throw Error
  - validate json is string, else throw Error
  - mkdirSync the saves dir (path.join userData, saves), recursive=true
  - writeFileSync the slot.json file with json content
  - return true

Handler load-game takes (slot: unknown):
  - validate slot
  - build filepath = join(userData, saves, slot+.json)
  - if not existsSync return null
  - return readFileSync(fp, utf-8)

Handler list-saves takes no args:
  - if saves dir not exists return []
  - return *.json filenames with .json stripped

Output the COMPLETE updated file.

## DELIVERABLE 7: Complete updated src/preload/index.ts

Updated api object:
  getVersion(): string => process.versions.electron ?? unknown
  saveGame(slot: string, json: string): Promise<boolean> via ipcRenderer.invoke(save-game, slot, json)
  loadGame(slot: string): Promise<string|null> via ipcRenderer.invoke(load-game, slot)
  listSaves(): Promise<string[]> via ipcRenderer.invoke(list-saves)

Keep the contextIsolated check and the fallback.
Export type ColonyApi = typeof api.
Output the COMPLETE file.

## DELIVERABLE 8: Five test files (vitest, node environment)

For GameStore tests: import { EventEmitter } from eventemitter3 as the IEventEmitter.
For TimeSystem tests: create a minimal GameStore mock.

### src/renderer/state/__tests__/rng.test.ts
Write at least 5 tests:
1. same seed gives same sequence of 10 next() calls
2. getSeed then restoreRng gives same next 10 values
3. nextInt(1,6) stays in [1..6] for 100 calls
4. chance(1) returns true
5. chance(0) returns false

### src/renderer/state/__tests__/timeSystem.test.ts
Create a minimal mock for GameStore: tracks advanceDay count, returns controllable state.
Write at least 7 tests:
1. speed=0: update(5000) does not call advanceDay
2. speed=2: update(1000) calls advanceDay exactly 2 times
3. speed=1: update(3500) calls advanceDay exactly 3 times
4. remainder preserved: update(600) then update(600) at speed=1 = 1 advanceDay total
5. season tick: after driving 30 days, SEASON_TICK emitted
6. year tick: after driving 120 days, YEAR_TICK emitted
7. large delta: update(5000) at speed=1 fires 5 DAY_TICK events

### src/renderer/state/__tests__/resourceSystem.test.ts
Build minimal test GameState and BuildingDef objects.
Write at least 6 tests:
1. working building with grain output 10/day gives delta grain=10
2. building with status=constructing NOT counted
3. add then mul: (base + addAmt) * mulFactor, not (base * mulFactor) + addAmt
4. tickModifierLifecycle: remainingDays=0 returns that id
5. tickModifierLifecycle: remainingDays=5 not returned
6. tickModifierLifecycle: remainingDays=-1 (permanent) not returned

### src/renderer/state/__tests__/gameStore.test.ts
Import EventEmitter from eventemitter3.
Write at least 7 tests:
1. addResource with negative amount: final value clamped to 0
2. addResource(10000): value clamped to 9999
3. addResource(5.9): stored as 5 (Math.floor)
4. addModifier with invalid effect target throws ModifierValidationError
5. subscribe listener then call off/unsubscribe, then addResource: listener NOT called
6. placeBuilding creates building with status constructing
7. completeBuildingAt changes status to working

### src/renderer/state/__tests__/saveLoad.test.ts
Write at least 6 tests:
1. serialize + deserialize round-trip: result deep equals original (toEqual)
2. deserialize with schemaVersion=999 throws SaveLoadError
3. deserialize with missing schemaVersion throws SaveLoadError
4. validateSlot(..) throws SaveLoadError
5. validateSlot(foo/bar) throws SaveLoadError
6. saveToSlot with mocked window.colonyApi: verify called with (save_1, expectedJson)

## DELIVERABLE 9: vitest.config.ts

Place at D:/code/colony-game/vitest.config.ts:
import { defineConfig } from vitest/config;
export default defineConfig({ test: { environment: node, include: [src/**/__tests__/**/*.test.ts] } });

package.json additions:
  devDependencies: vitest ^1.6.0, eventemitter3 ^5.0.1
  scripts: test => vitest run

## HARD CONSTRAINTS

1. strict + noUncheckedIndexedAccess: handle all indexed access undefined cases.
2. No block comments. Only // inline comments, max one line.
3. No emoji in console strings.
4. eventemitter3 and vitest devDeps only, not in runtime imports.
5. Paths: forward slashes or path.join. No backslashes.
6. Renderer code never imports from fs or electron.
7. validateModifierEffect called before every modifier use; throw on invalid.
8. setResourceClamped: Math.floor then clamp [0, 9999].
9. Every file complete. Zero placeholders or ellipsis.
10. pick<T>(arr) on empty array: throw Error.

## Self-Review (required)

End response with ## Self-Review listing at least 3 honest weaknesses or trade-offs.
