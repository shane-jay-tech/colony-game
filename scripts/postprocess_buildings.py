"""邦国录 · 建筑原画扣黑底 + 柔和投影（Pillow，零额度）。

把 public/art/buildings/*.png 的纯黑 void 背景扣成透明、再加一层柔和投影,
让建筑无缝坐落在地图上(不再是黑方块)。原图先备份到 art-library/buildings_raw/。

做法:
  - 从多个边缘点 flood-fill 标记"与边缘连通的近黑像素"为透明(阈值可调),
    保留与边缘不连通的建筑内部暗部(屋檐阴影/门洞)。
  - 由 alpha 剪影生成投影:偏移 + 高斯模糊 + 暗色,合成到建筑下层。
可重复运行(每次从 buildings_raw 备份重做),不会越扣越多。
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

BUILD_DIR = Path("D:/code/colony-game/public/art/buildings")
RAW_DIR = Path("D:/code/colony-game/art-library/buildings_raw")

THRESH = 42            # flood-fill 近黑判定容差
SHADOW_OFFSET = (6, 12)
SHADOW_BLUR = 9
SHADOW_COLOR = (10, 8, 6, 150)
SENT = (255, 0, 255)   # flood-fill 哨兵色


def edge_seeds(w: int, h: int):
    # 四角 + 四边中点 + 更密的边缘点,确保连通 void 全标记
    pts = []
    for fx in (2, w // 4, w // 2, 3 * w // 4, w - 3):
        pts.append((fx, 2)); pts.append((fx, h - 3))
    for fy in (2, h // 4, h // 2, 3 * h // 4, h - 3):
        pts.append((2, fy)); pts.append((w - 3, fy))
    return pts


def process(src: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    rgb = im.convert("RGB").copy()
    for c in edge_seeds(w, h):
        try:
            ImageDraw.floodfill(rgb, c, SENT, thresh=THRESH)
        except Exception:
            pass
    px_rgb = rgb.load()
    px = im.load()
    cut = 0
    for y in range(h):
        for x in range(w):
            if px_rgb[x, y] == SENT:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
                cut += 1

    # 等距修正：裁掉透明留白，让图片底边=建筑地基底边 → 渲染时 bottom-center 锚点正好落在地块前角，
    # 建筑不再上浮。等距原画自带菱形地基，无需再加投影（保留 SHADOW_* 常量不用，避免破坏其他调用）。
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(src)
    print(f"  {src.name}: cut {cut} px, trimmed -> {im.size[0]}x{im.size[1]}")


def main() -> int:
    if not BUILD_DIR.exists():
        print("[FAIL] buildings dir missing")
        return 2
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pngs = sorted(BUILD_DIR.glob("bld_*.png"))
    if not pngs:
        print("[FAIL] no bld_*.png")
        return 2
    print(f"[postprocess] {len(pngs)} buildings")
    for p in pngs:
        raw = RAW_DIR / p.name
        if not raw.exists():
            # 首次:备份原图
            Image.open(p).save(raw)
        # 始终从 raw 备份重做,保证可重复运行不叠加
        Image.open(raw).convert("RGBA").save(p)
        process(p)
    print("[postprocess] done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
