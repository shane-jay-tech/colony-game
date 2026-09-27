# c927-35 · topbar 按钮 Playwright 合成指针失效：DOM/CSS 命中栈定位与机制解释

- 班次：`qoder-executor-20260927-2024-colony45`｜日期：2026-09-27 20:4x｜只读调查，**零产品码改动、零新增测试件、未起浏览器、未跑 Playwright**。
- 锚点：`done/20260925-120510-2b5b.result.md`（3 697 B，卷宗写 `outbox/`＝波次 brief §3a 路径搬家）遗留 1：「自动化指针路径（Playwright click/press）对本 topbar 按钮不生效（合成 `.click()`/`dispatchEvent` 均正常）……需调查 pointer-events/transform 组合」。

## 0. 先说一件必须先说的错配（前提不在 cwd）

工单 `cwd: D:\code\colony-game`，但**锚点 2b5b 通篇是 kaoyan-system**：按钮是 `src/components/layout/Sidebar.tsx:84-98` 的「打开导航菜单」汉堡钮，复现命令是 `KAOYAN_DB_PATH=<副本> npx next dev -p <port>`（2b5b 证据节），截图落 `tmp/k924-22/`。而 **colony-game 根本没有 DOM topbar**：

$ cat src/renderer/index.html → `<body><div id="game-container"></div><script type="module" src="./main.ts"></script></body>`（全仓 renderer 仅此一个 HTML，`find src -name "*.html"` 命中 1）
$ grep -rn "pointer-events" src/renderer（含 *.css）→ **0 命中**；`src/renderer` 下无任何 `.css` 文件

⇒ 卷宗点名的三栈（`pointer-events`／`transform`／`z-index`）**在 colony-game 的顶栏上不存在**：那里的顶栏是 Phaser 对象（`HUD.ts:147 setDepth(1000)`、点击区是 `add.zone(...).setInteractive()`，`HUD.ts:267,288,310,502`），命中测试发生在 canvas 内部，Playwright 只看得见一块 canvas。

**处理办法（按 brief §3b「按磁盘实况收窄并点名否证」）**：本档主体裁的是**锚点真身所在的那枚按钮**（kaoyan-system，全程只读，零写入、零 dev server、零 DB 触碰），末尾 §6 给 colony-game 侧的等价风险，供主班决定这枚单该归哪个仓（产物按卷宗落在 `colony-game/docs/insights/`，未擅改路径）。

## 1. DOM/CSS 定位与命中栈（判据②的"现值"）

### 1a 四层栈（逐条引 file:line，全部读自磁盘）

| 层 | 元素 | 关键样式现值 | 存在条件 | 出处 |
|---|---|---|---|---|
| L1 | 顶栏 `div[data-testid="mobile-topbar"]` | `fixed inset-x-0 top-0 z-40 flex items-center bg-slate-950/95 backdrop-blur lg:hidden` ＋ CSS 侧 `min-height: calc(3.5rem + env(safe-area-inset-top))`、`padding: env(top) max(1rem,env(right)) 0 max(1rem,env(left))` | 视口 <1024 px | `Sidebar.tsx:82-83`＋`globals.css:135-142` |
| L2 | **被测按钮** `button[aria-label="打开导航菜单"]` | `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`（44×44，无 `pointer-events`、无 `transform`、无 `z-index`） | 随 L1 | `Sidebar.tsx:84-98` |
| L3 | 抽屉 `aside#primary-navigation` | `fixed left-0 top-0 z-50 w-72 max-w-[86vw] shadow-2xl transition-transform duration-200` ＋ `-translate-x-full`（open 时 `translate-x-0`）＋ CSS 侧 `height:100vh/100dvh; padding-top/bottom: env(...)` | **恒存在**（closed 只是平移） | `Sidebar.tsx:142`＋`globals.css:144-149` |
| L4a | 遮罩 `div.fixed.inset-0.z-50.bg-black/50` | 全屏、`onClick=closeMenu`、`aria-hidden` | **仅 `open===true`** | `Sidebar.tsx:105-108` |
| L4b | **profile 同步失败告警** `div[role="alert"]` | `fixed right-4 top-4 z-[80] max-w-sm px-4 py-3 text-sm` | **仅 `status==='failed'`**，且**无自动消失**（只有手动「重新同步」） | `profile-context.tsx:87-97` |
| L4c | 目标保存失败告警 | `fixed bottom-20 right-4 z-[70] max-w-sm … lg:bottom-4` | 仅 `saveError` | `exam-target-context.tsx:97-98` |

**z 栈数值**：全仓顶栏系只有 `z-40`／`z-50`×2／`z-[70]`／`z-[80]`（grep 计数：`z-50` 2 处、`z-40` 1 处、`z-[80]` 1、`z-[70]` 1），无 `z-[100]`+ 的常驻件；`fixed inset-0` 全屏层在 `src/` 内**只有 L4a 一处**，且它只在 open 时渲染。

### 1b 几何自洽验证（用现值反算 2b5b 的实测坐标）

`padding-left = max(1rem, env(safe-area-inset-left)) = 16 px` ⇒ 按钮 `x=16`；顶栏 `min-height = 3.5rem = 56 px`、`align-items:center`、按钮 44 px ⇒ `y = (56−44)/2 = 6`；`h-11 w-11 = 2.75rem = 44 px`。
⇒ 与 2b5b 证据节实测 `{x:16, y:6, w:44, h:44}` **逐位吻合** ⇒ 本文的样式读数与那次采样的模型同源，按钮中心＝`(38, 28)`。

### 1c 闭合态谁在 (38,28) 之上？（静态算术）

- L3 抽屉：`left:0 + width:288 px（w-72）+ translate −100%` ⇒ 占 `x ∈ [−288, 0]` ⇒ **右缘＝0，不覆盖 x=38**。`max-w-[86vw]` 在 390 px 下＝335 px，取小者 288 ⇒ 同上。
- L4a 遮罩：closed 态**不在 DOM 里**（条件渲染）。
- L4b 告警：`right:16, top:16, max-width:384`，shrink-to-fit ⇒ 实际宽≈正文优先宽（该行 21 个中文字 × 14 px ≈ 294 ＋ `px-4` 32 ≈ **326 px**）⇒ 占 `x ∈ [390−16−326, 374] = [48, 374]`、`y ∈ [16, ~95]`。按钮占 `x ∈ [16,60]`、`y ∈ [6,50]` ⇒ **交集 ≈ 12×34 px（按钮右侧一条）**：中心点 (38,28) 不在交集内，但按钮**右半边被盖**。
- L4c：`bottom-20 right-4` ⇒ 屏幕下缘，够不着顶栏。

⇒ **静态结论**：闭合态**没有任何常驻元素压在按钮中心点上**；卷宗暗示的「`pointer-events`/`transform` 组合」这两样在被测按钮上**都不存在**（`Sidebar.tsx:88` 的 class 串里既无 `pointer-events-*` 也无 `transform-*`/`translate-*`）。唯一能形成覆盖的是 L4b，而它是条件渲染。→ 判据②的"机制解释"因此**不能只靠静态样式**，必须落到 Playwright 的**契约**上（§2），这也是 §4 判定树存在的理由。

## 2. 机制解释：为什么"合成 .click() 正常、真指针不生效"是 Playwright 契约层的形状

读自本仓实际安装的 `playwright-core@1.62.1`（`node_modules/playwright-core/lib/coreBundle.js`，非二手文档）：

1. **非 force 路径先等 actionability**：`elementStates = ["visible","enabled","stable"]`，日志原文 `waiting for element to be visible, enabled and stable` ⇒ 只要求**可见/启用/两帧稳定**，与 React 处理器无关。若按钮的盒子在 2 个连续 rAF 里变过（L3 抽屉的 200 ms `transition`、`openMenu()` 里 `document.body.style.overflow='hidden'` 引发的重排、`env()`/`viewport-fit=cover` 在仿真设备下的非零安全区），就**永远等不完** ⇒ 表现为"click 超时"。
   - `transition-transform` 在 Tailwind **v4.3.3** 的编译产物是 `transition-property: transform, translate, scale, rotate`（读自 `node_modules/tailwindcss/dist/lib.js` 字面量），而 v4 的 `-translate-x-full` 走的是独立 `translate` 属性 ⇒ **抽屉平移确实会跑 200 ms 动画**（若换成只列 `transform` 的老写法反而不会）。
2. **命中测试**：`expectHitTarget(hitPoint, targetElement)` 用 `root.elementsFromPoint(x,y)` ＋ `root.elementFromPoint(x,y)` 求最上层，再沿 shadow/`assignedSlot` 上溯，`hitElement === targetElement` 才算 `done`；不等就取 `previewNode(hitParents[0])` 生成 **`<某节点> intercepts pointer events`**，非自动等待态直接 `NonRecoverableDOMError` 抛出、自动等待态则 `progress.log` 后 **continue 重试直到超时**。
3. **真指针还要再过一道可信事件复查**：`setupHitTargetInterceptor(...)` 注册的监听器里有 `if (!event.isTrusted && !event.__pwTrustedSynthetic) return;` ⇒ Playwright 派发的**受信**鼠标/触摸事件会被二次按事件实际坐标复核命中；而 `element.click()`／`dispatchEvent` 属**非受信合成**，这条链**直接 return**，且合成 click **根本不做 hit-test** ⇒ 这正是 2b5b「合成 `.click()`/`dispatchEvent` 均正常」而真指针失败的**唯一自洽解释**：缺陷位于 actionability/hit-target 层，**不在 React 处理链**。
4. **`press()` 失败可静态另解**：`press` 需要焦点落在那枚钮上；本组件 `openMenu()`/`closeMenu()` 用 `requestAnimationFrame(() => closeRef/triggerRef.current?.focus())` 主动搬焦点（`Sidebar.tsx:51-58`），且抽屉内有 Tab 焦点陷阱（`:120-130`）⇒ 焦点在 `body` 时按键打到 body，**"press 不生效"与指针问题不一定是同一件事**（2b5b 自己的遗留 2「Esc 依赖焦点在抽屉内」就是这条的旁证）。
5. **`retarget(node, "button-link")`**：Playwright 会把点击目标退化到最近的 button/anchor——若将来把钮换成 `div`，命中判定对象会跟着变，属排查时要知道的一条。

## 3. 复现件（判据①）

**离线单文件**，零外链、零依赖、零字体，双击即可核对（自查读数：8 678 B／143 行，外链普查 `NONE`，内联脚本 `node --check` 通过）。

- 归档副本（本班唯一允许的非 docs 落盘位，按横幅在 `D:\code\tmp\<班名>\`）：`D:\code\tmp\qoder-executor-20260927-2024-colony45\repro-c927-35.html`
- 内嵌副本＝下面这段（两处内容逐字一致）；**仓内除本 docs 外零新文件**。

它把 §1a 的四层原样搬进来（含 `z-40 + backdrop-filter` 顶栏、`z-50 + translate:-100% + transition` 抽屉、open 才出现的 `z-50` 遮罩、`z-[80] right-4 top-4 max-w-sm` 告警），并在页面左下常驻一块**命中探针**：打印视口、按钮 `getBoundingClientRect`、中心点、`elementFromPoint` 结果、`elementsFromPoint` 栈、告警∩按钮的重叠面积（并直接标出"真指针会吃到 …intercepts pointer events"）、以及两帧 `requestAnimationFrame` 稳定性采样。两个勾选框分别注入 L4b 与切 open，用来现场看覆盖如何形成。

```html
<!doctype html>
<!-- c927-35 复现件（离线、零外链、零依赖）：kaoyan-system 窄屏 topbar 汉堡钮的四层命中栈几何。
     样式值全部照搬现值：Sidebar.tsx:83/88/107/142 ＋ globals.css:135/144 ＋ profile-context.tsx:88 ＋ Tailwind v4.3.3 编译语义。 -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>c927-35 · topbar 汉堡钮命中栈复现</title>
<style>
  html { transition: background-color .2s, color .2s; }            /* globals.css:42 */
  body { margin: 0; background: #0f172a; color: #e2e8f0;
         font: 14px/1.5 system-ui, sans-serif; min-height: 100svh; }
  main { padding: calc(3.5rem + 1rem) 1rem; }                       /* globals.css:51 .app-main */

  .mobile-topbar {                                                   /* Sidebar.tsx:83 ＋ globals.css:135 */
    position: fixed; inset-inline: 0; top: 0; z-index: 40;
    display: flex; align-items: center; min-height: calc(3.5rem + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
    background: rgba(2,6,23,.95); border-bottom: 1px solid rgba(255,255,255,.1);
    backdrop-filter: blur(8px); box-shadow: 0 1px 3px rgba(0,0,0,.3);
  }
  #hamburger {                                                       /* Sidebar.tsx:88 */
    display: flex; align-items: center; justify-content: center;
    height: 2.75rem; width: 2.75rem; flex: 0 0 auto; border: 0; border-radius: .75rem;
    background: transparent; color: #94a3b8; cursor: pointer;
  }
  #hamburger:hover { background: rgba(255,255,255,.1); color: #fff; }
  .titleblock { margin-left: .75rem; min-width: 0; }                 /* Sidebar.tsx:99 */

  .mobile-sidebar {                                                  /* Sidebar.tsx:142 ＋ globals.css:144 */
    position: fixed; left: 0; top: 0; z-index: 50; display: flex; flex-direction: column;
    width: 18rem; max-width: 86vw; height: 100dvh; padding: 1rem;
    background: #0d1628; border-right: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 25px 50px -12px rgba(0,0,0,.25);
    translate: -100% 0;                                              /* -translate-x-full（v4 用 translate 属性） */
    transition-property: transform, translate, scale, rotate;        /* transition-transform 的 v4 编译产物 */
    transition-duration: .2s;
  }
  .mobile-sidebar.open { translate: 0 0; }                           /* translate-x-0 */
  .overlay {                                                         /* Sidebar.tsx:107（仅 open 时存在） */
    position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.5);
  }
  .alert-profile {                                                   /* profile-context.tsx:88（仅 status==='failed'） */
    position: fixed; right: 1rem; top: 1rem; z-index: 80; max-width: 24rem;
    padding: .75rem 1rem; border-radius: .75rem; font-size: .875rem;
    background: #fef2f2; color: #7f1d1d; border: 1px solid #fca5a5; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1);
  }
  .probe { position: fixed; left: .5rem; bottom: .5rem; z-index: 200; width: 22rem;
           font: 12px/1.45 ui-monospace, monospace; background: #0b1220; border: 1px solid #334155;
           border-radius: .5rem; padding: .5rem .6rem; }
  .probe b { color: #7dd3fc; } .probe .hit { color: #fca5a5; } .probe .ok { color: #86efac; }
  label { display: inline-flex; gap: .3rem; align-items: center; margin-right: .6rem; }
</style>
</head>
<body>
  <div class="mobile-topbar" data-testid="mobile-topbar">
    <button id="hamburger" type="button" aria-label="打开导航菜单" aria-expanded="false" aria-controls="primary-navigation">≡</button>
    <div class="titleblock"><div style="font-size:10px;letter-spacing:.18em">考研学习工作台</div><div style="font-weight:600">首页</div></div>
  </div>

  <aside id="primary-navigation" class="mobile-sidebar" data-testid="primary-navigation"><b>抽屉</b><br>（closed 态：translate -100% ⇒ 右缘 x=0）</aside>

  <main>
    <h3 style="margin-top:0">c927-35 命中栈复现（把窗口拉到 390×844 再看探针）</h3>
    <p>下方探针打印 <code>elementFromPoint(钮中心)</code> 与 <code>elementsFromPoint</code> 栈、钮的 rect、以及两帧稳定性。
       勾选「profile 同步失败告警」＝把 <code>z-[80] right-4 top-4 max-w-sm</code> 那条放进屏；在 390 px 宽下它的左缘会压进汉堡钮右缘（见探针 <code>overlap</code> 行）。</p>
  </main>

  <div class="probe">
    <div><label><input type="checkbox" id="tAlert"> profile 同步失败告警(z-80)</label>
         <label><input type="checkbox" id="tOpen"> 抽屉 open</label></div>
    <div>viewport <b id="vp"></b> · rect <b id="rect"></b></div>
    <div>center(<b id="cx"></b>,<b id="cy"></b>) → <span id="top" class="ok"></span></div>
    <div>栈：<span id="stack"></span></div>
    <div>overlap(alert∩btn)：<b id="ovl"></b> · 两帧稳定：<b id="stab"></b></div>
    <div>真指针模拟：<span id="sim"></span></div>
  </div>

<script>
  var btn = document.getElementById('hamburger'),
      aside = document.getElementById('primary-navigation'),
      probe = document.getElementById('probe') || null;
  function nameOf(el) {
    if (!el) return 'null';
    var id = el.id ? '#' + el.id : '', cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  }
  function refresh() {
    var r = btn.getBoundingClientRect(), cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    var top = document.elementFromPoint(cx, cy), stack = document.elementsFromPoint(cx, cy).map(nameOf).join(' › ');
    document.getElementById('vp').textContent = innerWidth + '×' + innerHeight;
    document.getElementById('rect').textContent = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    document.getElementById('cx').textContent = cx; document.getElementById('cy').textContent = cy;
    var t = document.getElementById('top'); t.textContent = nameOf(top);
    t.className = (top === btn || btn.contains(top)) ? 'ok' : 'hit';
    document.getElementById('stack').textContent = stack;
    var al = document.querySelector('.alert-profile');
    if (al) { var a = al.getBoundingClientRect();
      var ow = Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left));
      var oh = Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
      document.getElementById('ovl').textContent = (ow > 0 && oh > 0) ? (Math.round(ow) + '×' + Math.round(oh) + ' px（真指针会吃到 "…intercepts pointer events"）') : '无';
    } else document.getElementById('ovl').textContent = '无告警件';
    var r2 = btn.getBoundingClientRect();
    requestAnimationFrame(function () {
      var r3 = btn.getBoundingClientRect();
      document.getElementById('stab').textContent =
        (Math.abs(r2.x - r3.x) < 0.5 && Math.abs(r2.y - r3.y) < 0.5) ? 'stable（可点）' : 'moving（Playwright "visible, enabled and stable" 会一直等）';
    });
    var el = document.elementFromPoint(cx, cy);
    document.getElementById('sim').textContent = (el === btn || btn.contains(el))
      ? '<span class="ok">命中钮本体 ⇒ 真指针可用</span>'
      : '<span class="hit">命中 ' + nameOf(el) + ' ⇒ 真指针被拦截，而 btn.click() 仍能触发（与 2b5b 症状同形）</span>';
  }
  btn.addEventListener('click', function () {
    var open = aside.classList.toggle('open');
    document.getElementById('tOpen').checked = open;
    btn.setAttribute('aria-expanded', String(open));
    if (open && !document.querySelector('.overlay')) {
      var o = document.createElement('div'); o.className = 'overlay';
      o.addEventListener('click', function () { o.remove(); aside.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); document.getElementById('tOpen').checked = false; refresh(); });
      document.body.appendChild(o);
    }
    setTimeout(refresh, 260);
  });
  document.getElementById('tOpen').addEventListener('change', function (e) {
    aside.classList.toggle('open', e.target.checked); btn.setAttribute('aria-expanded', String(e.target.checked));
    if (e.target.checked) { if (!document.querySelector('.overlay')) { var o = document.createElement('div'); o.className = 'overlay'; document.body.appendChild(o); } }
    else { var ex = document.querySelector('.overlay'); if (ex) ex.remove(); }
    setTimeout(refresh, 260);
  });
  document.getElementById('tAlert').addEventListener('change', function (e) {
    if (e.target.checked) { var d = document.createElement('div'); d.className = 'alert-profile'; d.setAttribute('role', 'alert');
      d.innerHTML = '<p>个人目标同步失败，当前页面可能显示本地默认值。</p><button type="button">重新同步</button>'; document.body.appendChild(d); }
    else { var x = document.querySelector('.alert-profile'); if (x) x.remove(); }
    refresh();
  });
  addEventListener('resize', refresh); addEventListener('scroll', refresh);
  refresh();
</script>
</body>
</html>
```

> 能核对什么：(a) 闭合态 (38,28) 的最上层是谁；(b) 勾上 z-[80] 告警后，`overlap` 行给出真实相交面积、`sim` 行翻红——即「`.click()` 仍有效而真指针被拦截」这个**症状形状**；(c) 切 open 时 `stab` 行在两帧窗口内报 moving。**不能核对什么**：Playwright 自身的 actionability 计时（那是 driver 进程内的事），所以那部分只有 §4 的运行时探针一条路。

## 4. 定因判定树（每叶一条可跑探针，20 行内）

| 叶 | 候选因 | 一条量法（Playwright 里跑） | 判读 |
|---|---|---|---|
| A | **覆盖**：L4b `z-[80] right-4 top-4` 告警在窄屏压住按钮右缘（`/api/system?view=profile` 非 ok／响应畸形／fetch 异常 → `status==='failed'`，**且不自动消失**，`profile-context.tsx:63-73,87-97`；2b5b 用的是隔离副本 DB，失败态可达） | `page.evaluate(() => {const r=document.querySelector('[aria-label="打开导航菜单"]').getBoundingClientRect(); return document.elementsFromPoint(r.left+r.width/2, r.top+r.height/2).map(e=>e.className\|\|e.tagName)})` | 栈顶若不是按钮/其子孙 ⇒ 就是 Playwright 日志里的 `… intercepts pointer events`；**这时它是用户同样点不到的真缺陷，不该被 e2e 绕开** |
| B | **稳定性**：200 ms `transition`＋`openMenu` 里 `body.style.overflow='hidden'` 重排＋仿真设备非零 `env(safe-area-inset)`（`viewport-fit=cover`） | `page.on('console')` 抓 Playwright 自打日志；或 `await page.waitForTimeout(300)` 后再点 | 日志停在 `waiting for element to be visible, enabled and stable` ⇒ 稳定腿；停在 `intercepts pointer events` ⇒ 覆盖腿 |
| C | **焦点/press**：`press()` 要求焦点在钮上，而 `openMenu/closeMenu` 会用 rAF 搬焦点（`Sidebar.tsx:51-58`）＋抽屉有 Tab 陷阱 | `await page.getByLabel('打开导航菜单').focus(); await page.keyboard.press('Enter')` vs 直接 `press` | focus 后能触发 ⇒ press 那条与指针无关，应拆成两枚缺陷登记 |
| D | **选择器层**：`lg:hidden`/`isMobile` 使桌面态按钮本就不存在（`display:none` ⇒ `visible` 腿红） | `page.getByLabel('打开导航菜单').isVisible()` 于 1280 与 390 各一次 | 1280 下不可见是**预期**，不是缺陷；别把它记成"合成指针失效" |

## 5. 给 e2e 侧的三条路径（判据③）

- **路径 1｜先消歧，再谈规避（推荐首做，零产品码、零新测试件之外的成本）**：把 §4 的 A＋B 两条探针做成一次诊断跑，读数（rect／`elementsFromPoint` 栈／两帧稳定）进日志。理由：2b5b 把这条记为"基建口径"，但**A 叶一旦为真，它就是手机用户点不到汉堡钮的真缺陷**（顶栏 z-40 vs 告警 z-80，且告警不自动消失）——用规避手法把它盖掉会把真缺陷测成绿。
- **路径 2｜绕开 hit-test 但保留真指针（仅当 A/B 叶判为"非缺陷"后使用）**：用坐标级 `page.mouse.click()`，点位仍由被测元素的盒子算出，并**在点击后立刻断言状态**（`aria-expanded` 翻 true／抽屉 `translate` 归零）；或把点位从中心改成左上安全区：`locator.click({ position: { x: 10, y: 10 } })`（避开右缘 12×34 px 的可疑交叠）。
  ```ts
  const box = await page.getByLabel('打开导航菜单').boundingBox();           // 期望 {x:16,y:6,width:44,height:44}
  await page.mouse.click(box!.x + 10, box!.y + 10);                        // 不经 actionability、不查 hit target，但仍是受信输入
  await expect(page.getByRole('complementary', { name: '主导航' })).toHaveClass(/translate-x-0/); // 后置断言，缺它这条用例等于没测
  ```
  🔴 **不许把 `force: true` 当解药**：它同时关掉 visible/stable/receives-events 三段检查，正好把 A 叶（真覆盖）与 B 叶（动画不稳）全部吞掉——症状会消失，缺陷留下。要真绕也只允许坐标级 `page.mouse.*` ＋**必须带后置状态断言**。
- **路径 3｜产品侧最小改（属人工放行闸，本单一字未改）**：按改动面从小到大
  1. **告警条避让顶栏**（1 处 class 改）：`profile-context.tsx:88` 的 `top-4` → `top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)]`，让它落在顶栏下缘之外；回滚＝改回一个 class；视觉影响＝红色告警条整体下移 ≈ 62 px。
  2. **给告警条限宽避让左缘**（1 处）：`max-w-sm` → `max-w-[min(24rem,calc(100vw-6rem))]`；对窄屏更保守，但与 1. 二选一即可。
  3. **顶栏提层**（1 处，副作用最大）：`Sidebar.tsx:83` 的 `z-40` → `z-[90]`；会把顶栏盖到抽屉(z-50)与告警(z-80)之上，改变三层的既有视觉秩序 ⇒ 需设计确认。
  4. **闭合抽屉彻底移出命中面**（2 处）：`:142` closed 态并置 `invisible`（或 `pointer-events-none`），避免 `shadow-2xl`/未来 padding 变化把抽屉的命中面推回 x>0。**注意**：本班静态算术显示 closed 抽屉右缘＝0，当前**不构成**覆盖源 ⇒ 这条属"防御性登记"，不应在没有 §4-A 读数前就改。
  5. 若要给真指针留出稳定窗口：`openMenu()` 里的 `body.style.overflow='hidden'` 改为锁滚动条宽度（`scrollbar-gutter: stable`，`globals.css` 一处），消除"开抽屉→视口变宽→fixed 层重排"这一跳。

## 6. colony-game 侧对照（若主班判这枚单确实该落本仓）

那里的顶栏**没有 DOM 层**，`pointer-events/transform/z-index` 三栈不适用；等价风险是**另外两件事**，且都可静态坐实：

- **canvas 内命中**：顶栏点击区是 Phaser `Zone`（`HUD.ts:267/288/310/502 setInteractive`），`elementFromPoint` 永远返回那块 canvas ⇒ Playwright 的 hit-target 检查**通不过也拦不住**，点歪了只会被 Phaser 内部吃掉。真指针必须用**画布内坐标**：`Scale mode = Phaser.Scale.RESIZE`＋`autoCenter = NO_CENTER`（`src/renderer/main.ts:32-36`），DOM 尺寸与游戏坐标在 RESIZE 下近似 1:1，但**缩放因子仍要现场取**（`game.scale.scaleFactor`/`canvas.getBoundingClientRect()` 折算），否则 1280 最小宽与 1366 默认档之间会系统性偏移。
- **DOM 容器**：`main.ts:44-46 dom: { createContainer: true }`（IntroScene 的邦名输入框）会插一层 `<div>`，Phaser 给它写的是 `position: absolute; overflow: hidden; transform: scale(1); transform-origin: left top; pointer-events: <config.dom.pointerEvents>`，默认 **`'none'`**（读自 `node_modules/phaser/dist/phaser.js` 的 `domPointerEvents` 默认值与该 style 串），而单个 `DOMElement` 自己渲染时写 `pointerEvents = 'auto'` ⇒ **容器不吃指针、子元素吃**；若将来有人把 `dom.pointerEvents` 改成 `'auto'`，就会长出一个覆盖整块画布、吃掉全部 canvas 指针的透明层——那才是这枚单标题里"pointer-events/transform 组合"在本仓的真正形状。

## 7. 判据对照（完成标准 4 条）

| # | 卷宗判据 | 本文位置 | 命中 |
|---|---|---|---|
| ① | 复现件可离线打开核对 | §3：143 行单文件（外链普查 `NONE`、`node --check` 通过），**同时内嵌于本文代码块**并另存 `D:\code\tmp\qoder-executor-20260927-2024-colony45\repro-c927-35.html`；⚠ 本班未起浏览器做"打开动作"的画面确认（卷宗禁止事项含"联网/不碰范围外"，无浏览器授权），可核对性以静态自证＋样式同源反算（§1b 与 2b5b 实测坐标逐位吻合）交付 ⇒ 若主班要"真打开一次"的读数，需人工放行 | ✅（交付方式已注明限制） |
| ② | 机制解释引 CSS 现值 | §1a/§1b/§1c（六条 file:line 现值＋几何反算）＋§2（`playwright-core@1.62.1` 的 `expectHitTarget`／`elementStates`／`isTrusted` 三条一手实现，`tailwindcss@4.3.3` 的 `transition-transform` 编译串） | ✅ |
| ③ | 三条路径建议 | §5 路径 1/2/3（含 `force:true` 禁用条款；路径 3 五个子项各带改动面＋回滚成本＋视觉影响） | ✅ |
| ④ | 零码改动 | 两仓全部只读：colony-game `git status --porcelain src/`＝0；**kaoyan-system 零写入、未起 dev server、未碰 DB**（见 result 证据节） | ✅ |

## 8. 否证／收窄清单

1. **否证本单前提（在 cwd 内）**：colony-game 无 DOM topbar ⇒ 卷宗要求的 `pointer-events/transform/z-index` 三栈"定位"在 cwd 内**无从定位**；对象实际在 kaoyan-system（§0）。
2. **否证"按钮自身带 pointer-events/transform 组合"**：`Sidebar.tsx:88` 的 class 串里两样都没有；`fixed inset-0` 全屏层全仓只有 1 处且仅 open 时存在 ⇒ 2b5b 遗留 1 猜测的方向**未被静态证据支持**，改判为"必须运行时消歧"（§4）。
3. **收窄"自动化基建口径、非用户可感知缺陷"**：§1c＋§4-A 显示存在一条**用户同样点不到**的可能路径（`z-[80]` 告警在窄屏与按钮交叠 ≈12×34 px，且不自动消失）⇒ 这句定性**不能无条件接受**；本班未跑浏览器，故给的是"待一次 §4-A 读数即可判定"的条件式结论。
4. **修正引用口径**：`-translate-x-full` 在 Tailwind v4 走独立 `translate` 属性，`transition-transform` 编译为 `transform, translate, scale, rotate` ⇒ 老口径里"transform 动画与 pointer-events 组合"这一表述在本仓**已换实现**（引 v4.3.3 字面量）。

## 9. 遗留

1. **归仓裁决**：产物落在 `colony-game/docs/insights/`（按卷宗），但调查对象与修复位都在 `kaoyan-system`；若主班认为该归档到 kaoyan 的 docs，请搬档并同步改 `done/c927-35.task.md` 的指向，本班未擅自改路径。
2. **未做的两件事**（超出只读授权）：① 真跑 Playwright 采 `elementsFromPoint`/actionability 日志（§4-A/B 各一条命令即可坐实）；② 真打开 §3 复现件取画面读数。二者都需起浏览器/dev server，属人工放行。
3. kaoyan 侧的 `Viewport.interactiveWidget='resizes-content'`＋`viewportFit='cover'`（`layout.tsx:18-26`）在设备仿真下会改变 `env()` 取值，可能让"2b5b 的 390×844"与真实平板的命中面不同——要坐实需一次真机口径，属另一枚单。
4. §5 路径 3 全部条目属产品码改动，**未实施**；如放行，最小起点是 1. 或 2.（一个 class），不是 3.（提层）。
