"""邦国录 · 生成 2.5D 散布素材（树/石/灌木/芦苇），与建筑同斜 45° 视角，黑底后扣透明。

复用 D:/code/scripts/gen_wanxiang_batch.py 的 async 管线，换"单体自然物"专用风格尾：
斜 3/4 等距视角（和建筑一致）、单个孤立物、纯黑 void 背景、无地面无阴影投到地上。
输出 public/art/scatter/<id>.png。--model 控额度（pro 优先）。
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "D:/code/scripts")
import gen_wanxiang_batch as gw  # noqa: E402

# 单体自然物风格尾：与建筑同角度，但去掉建筑专属约束，强调单体 + 无地面
SCATTER_STYLE = (
    "Single isolated object, ISOMETRIC 3/4 elevated bird's-eye view at the SAME 45-degree angle as "
    "Anno-style building sprites (viewed slightly from above and the side, NOT flat top-down, NOT straight side). "
    "Painted in the official art style of Anno 1404 / Pharaoh-remake / Nebuchadnezzar: traditional digital "
    "oil painting, matte painting, visible brushwork, naturalistic and heavily desaturated dusty earth tones, "
    "Spring and Autumn period (770-476 BC) rural China nature. "
    "ONE single specimen centered in frame, the whole object fully visible, modest margin around it. "
    "Cinematic afternoon golden-hour light coming from the upper-right (so any self-shadow falls to the lower-left), "
    "consistent with the building sprites. "
    "Pure pitch-black void background (will be cut to transparent), NO ground plane, NO grass patch under it, "
    "NO cast shadow on the ground (the game adds its own contact shadow), NO base, NO platform. "
    "Ultra-detailed 8k, ArtStation. "
    "ABSOLUTELY NOT: anime, manga, cartoon, chibi, cute, 国漫, 二次元, 江南百景图, flat vector, cel shading, "
    "saturated colors, 3D PBR render, CG render, multiple objects, scene, landscape, horizon, sky, "
    "ground texture, drop shadow on floor, text, watermark, frame, border, UI."
)

SCATTER: list[tuple[str, str]] = [
    ("tree_pine", "A single tall ancient Chinese pine/conifer tree with a dark blue-green layered needle canopy and a weathered reddish-brown trunk, slightly gnarled, north-China highland pine."),
    ("tree_locust", "A single old Chinese scholar-tree (locust / huai), broad rounded leafy crown of small bright-and-dark green compound leaves, thick gnarled grey-brown trunk and spreading branches."),
    ("tree_mulberry", "A single cultivated mulberry tree, lower and bushier, broad heart-shaped green leaves, short stout trunk with a pollarded knobbly top, the kind grown for sericulture."),
    ("tree_willow", "A single weeping willow tree beside water, long drooping yellow-green trailing branches, slender pale trunk, graceful cascading foliage."),
    ("rock_boulder", "A single large weathered grey granite boulder, rounded and cracked, with subtle moss patches and lichen, sitting alone, ancient and mossy."),
    ("rock_cluster", "A small cluster of three or four weathered grey fieldstones and rubble of varying sizes piled loosely together, dry and dusty."),
    ("bush_shrub", "A single low green leafy wild shrub bush, dense rounded foliage of small leaves, a bit of dry twig showing, temperate wild brush."),
    ("bush_dry", "A single dry brown-yellow withered scrub bush / tumbleweed-like dry brush clump, sparse brittle twigs, arid hill vegetation."),
    ("reed_clump", "A single clump of tall green-and-tan riverside reeds and rushes, slender vertical blades with feathery tops, the kind growing at a water's edge, leaning slightly."),
    ("grass_tuft", "A single small tuft of wild grass and weeds, a low clump of mixed green and dry-yellow blades sprouting from bare earth."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="D:/code/colony-game/public/art/scatter")
    ap.add_argument("--size", default="1024*1024")
    ap.add_argument("--workers", type=int, default=2)  # 降并发避开限流
    ap.add_argument("--model", default="wan2.7-image-pro")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    if not gw.KEY:
        print("[FAIL] WANXIANG_API_KEY missing")
        return 2
    gw.MODEL = args.model
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    jobs = [gw.Job(id=i, desc=d, prompt=f"{d} {SCATTER_STYLE}") for i, d in SCATTER if not only or i in only]
    if not jobs:
        print(f"[FAIL] no jobs match --only={args.only}")
        return 2
    print(f"[scatter] {len(jobs)} jobs, model={gw.MODEL}, out={out_dir}")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.submit_one, j, args.size): j for j in jobs}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [submit-{'ok' if j.task_id else 'err'}] {j.id} -> {j.task_id or j.error}")
    submitted = [j for j in jobs if j.task_id]
    if not submitted:
        print("[FAIL] zero submitted")
        return 1
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(gw.poll_one, j, out_dir): j for j in submitted}
        for f in as_completed(futs):
            j = f.result()
            print(f"  [{'done' if j.saved else 'fail'}] {j.id} ({j.elapsed_s:.0f}s) -> {j.saved or j.error}")
    (out_dir / f"manifest_scatter_{int(time.time())}.json").write_text(
        json.dumps([{"id": j.id, "model": gw.MODEL, "saved": j.saved, "error": j.error} for j in jobs], indent=2, ensure_ascii=False),
        encoding="utf-8")
    ok = sum(1 for j in jobs if j.saved)
    print(f"[scatter] {ok}/{len(jobs)} ok")
    return 0 if ok == len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
