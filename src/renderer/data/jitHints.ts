/**
 * JIT（Just-In-Time）即时提示——首次遇到某情境时，弹一句大白话教学，**只弹一次**（seen 持久化）。
 *
 * 设计（§11.C 新手引导）：不在开头堆教程，而是"现学现用"。每条提示绑定一个 trigger（情境 key），
 * 该情境**首次**发生时由 JitHintManager 通过 Toast 弹出，随后写入 seenJitHints 永不再扰。
 *
 * 纯数据 + 纯函数，便于测试；实际弹出/持久化在 ui/JitHintManager.ts。
 * 文案守半文半白、禁偏字（记忆 colony-game-text-balance）。
 */

export type JitTrigger =
  | 'first_build'        // 首次落子建造
  | 'first_complete'     // 首座建筑营建完成
  | 'first_grade'        // 首次国格晋阶
  | 'first_crisis'       // 首次跌入低谷危机
  | 'first_event'        // 首次朝堂事件
  | 'first_diplomacy'    // 首次邻邦动作（邦交登场）
  | 'game_start'         // 开局第一次进入
  | 'first_policy'       // 首次采纳国策
  | 'first_decree'       // 首次颁布朝令
  | 'first_gold_income'  // 首次获得钱（引导经济链）
  | 'first_cloth_income' // 首次获得布
  | 'first_bronze_income'// 首次获得铜（引导军备链）
  | 'first_rite_income'  // 首次获得礼器（引导礼制/晋格链）
  | 'first_labor_fail';  // 首次因劳力不足失败

export interface JitHint {
  trigger: JitTrigger;
  /** Toast 一句话；可关、不重复 */
  text: string;
}

export const JIT_HINTS: Readonly<Record<JitTrigger, JitHint>> = {
  game_start: { trigger: 'game_start', text: '先在左栏选建筑、点地图放下。建议：农田产粮、陶窑产钱、桑园产布。开局暂停中——放下第一座建筑后时间开始流动。' },
  first_build: { trigger: 'first_build', text: '已落子动工。营建需时日，建好才出产。建议先建农田和桑园，确保粮与布的产出。' },
  first_complete: { trigger: 'first_complete', text: '建筑已成！点击它可查看详情和升级选项。相邻建筑有加成——农田贴水井多产粮，陶窑靠市集多产钱。' },
  first_policy: { trigger: 'first_policy', text: '国策已采纳。国策是永久效果，解锁新建筑或增强产出。注意有些建筑需先采纳对应国策才能建造。' },
  first_decree: { trigger: 'first_decree', text: '朝令已颁。朝令是限时任务，完成后有奖励。同时只能执行少量朝令。' },
  first_gold_income: { trigger: 'first_gold_income', text: '有钱入账了。早期靠陶窑（每日+2），后期建市集（+5）和驿道（+2）。钱用于外交、国策和高级建筑。' },
  first_cloth_income: { trigger: 'first_cloth_income', text: '有布入账了。布从桑园来（每日+2），升级织官后更多。布用于科技建筑和外交。' },
  first_bronze_income: { trigger: 'first_bronze_income', text: '有铜入账了。铜从「铜冶坊」来（需先采纳相应国策解锁）。铜是士兵的装备来源——养兵、出征都靠铜，缺铜军力难以提升。' },
  first_rite_income: { trigger: 'first_rite_income', text: '有礼器入账了。礼器从「祖庙／太庙」等礼制建筑来。礼用于晋升国格、巨型工程（铸九鼎/作春秋）与高阶礼制——攒礼是通往诸侯、霸主的关键。' },
  first_grade: { trigger: 'first_grade', text: '国格晋阶了！新的建筑和国策已解锁——看左栏和右栏，有新选项出现。' },
  first_crisis: { trigger: 'first_crisis', text: '邦势跌入低谷。别慌——稳住口粮和民心，削减开支，假以时日可复元。不会直接结束游戏。' },
  first_event: { trigger: 'first_event', text: '朝堂有事待决。每个选项各有得失，没有绝对对错。留意选项下方的资源变动提示。' },
  first_diplomacy: { trigger: 'first_diplomacy', text: '邻邦来了。点顶栏"邦交"可看各国关系；通商需金50布2，出使需金30布5。先攒够资源再操作。' },
  first_labor_fail: { trigger: 'first_labor_fail', text: '劳力不足。部分高级建筑需要特定阶层（如士人）。目前民力全是农民，建学塾等基础设施不需要特殊阶层。' },
};

/**
 * 纯函数：某 trigger 是否该弹提示。已 seen 或无此 trigger → null。
 * @param seen 已弹过的 trigger 集合（来自持久化 seenJitHints）
 */
export function pickJitHint(trigger: JitTrigger, seen: ReadonlySet<string>): JitHint | null {
  if (seen.has(trigger)) return null;
  return JIT_HINTS[trigger] ?? null;
}
