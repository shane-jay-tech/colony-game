"""邦国录 · 通用精灵后处理：扣黑底 → 透明 + 柔和接触影（Pillow，零额度）。

通用化自 postprocess_buildings.py，可处理任意目录（建筑/散布素材）。
从多个边缘点 flood-fill 标记与边缘连通的近黑背景 → 透明（保留内部暗部）；
由 alpha 剪影生成接触影（偏移 + 高斯模糊 + 暗色），光照右下方向（与建筑一致）。
原图备份到 <raw>，每次从备份重做，可重复运行不叠加。

用法：
  python scripts/postprocess_sprites.py --dir public/art/scatter --raw art-library/scatter_raw --glob "*.png" --shadow 3,5 --blur 5
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path("D:/code/colony-game")
SENT = (255, 0, 255)


def edge_seeds(w: int, h: int):
    pts = []
    for fx in (2, w // 4, w // 2, 3 * w // 4, w - 3):
        pts.append((fx, 2)); pts.append((fx, h - 3))
    for fy in (2, h // 4, h // 2, 3 * h // 4, h - 3):
        pts.append((2, fy)); pts.append((w - 3, fy))
    return pts


def process(src: Path, thresh: int, shadow_off, blur: int, shadow_alpha: int) -> str:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    rgb = im.convert("RGB").copy()
    for c in edge_seeds(w, h):
        try:
            ImageDraw.floodfill(rgb, c, SENT, thresh=thresh)
        except Exception:
            pass
    px_rgb = rgb.load(); px = im.load()
    cut = 0
    for y in range(h):
        for x in range(w):
            if px_rgb[x, y] == SENT:
                r, g, b, _ = px[x, y]; px[x, y] = (r, g, b, 0); cut += 1
    alpha = im.split()[3]
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow.paste((10, 8, 6, shadow_alpha), (0, 0), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(shadow, shadow_off)
    canvas.alpha_composite(im, (0, 0))
    canvas.save(src)
    return f"{src.name}: cut {100*cut/(w*h):.0f}%"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--raw", required=True)
    ap.add_argument("--glob", default="*.png")
    ap.add_argument("--thresh", type=int, default=42)
    ap.add_argument("--shadow", default="6,12", help="shadow offset x,y")
    ap.add_argument("--blur", type=int, default=9)
    ap.add_argument("--shadow-alpha", type=int, default=150)
    args = ap.parse_args()
    d = (ROOT / args.dir) if not Path(args.dir).is_absolute() else Path(args.dir)
    raw = (ROOT / args.raw) if not Path(args.raw).is_absolute() else Path(args.raw)
    raw.mkdir(parents=True, exist_ok=True)
    sx, sy = (int(v) for v in args.shadow.split(","))
    pngs = sorted(p for p in d.glob(args.glob) if not p.name.startswith("manifest"))
    if not pngs:
        print(f"[FAIL] no png in {d}")
        return 2
    print(f"[postprocess] {len(pngs)} sprites in {d}")
    for p in pngs:
        bak = raw / p.name
        if not bak.exists():
            Image.open(p).save(bak)
        Image.open(bak).convert("RGBA").save(p)  # 从备份重做
        print("  " + process(p, args.thresh, (sx, sy), args.blur, args.shadow_alpha))
    print("[postprocess] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
